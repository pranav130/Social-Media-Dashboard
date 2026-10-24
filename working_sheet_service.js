/**
 * ==============================================================================
 * UPPCL SOCIAL MEDIA CELL — WORKING SHEET SERVICE
 * ==============================================================================
 * Authoritative module for viewing, managing, and updating the 11 designated
 * columns of the Google Sheet directly from the dashboard:
 *
 * 1. DATE
 * 2. C F
 * 3. LINK URL
 * 4. Twitter Id
 * 5. Picked Status
 * 6. Head
 * 7. Untagged Complaint
 * 8. UPPCLLKO Replied (YES/NO)
 * 9. Complaint Type
 * 10. District
 * 11. Status
 *
 * Architecture & Guarantees:
 * - Operates strictly on these 11 columns in exact order.
 * - Source column positions resolved dynamically by reading Row 1 headers.
 * - Supports Google Sheets API v4 (Service Account) with fallback to Google
 *   Apps Script Webhook and CSV range fetch.
 * - Single-cell updates with pre-write row resolution and post-write verification.
 * - Preserves existing formulas (e.g. CF formula in Row 3+), blank frozen Row 2,
 *   and district-to-DISCOM/Zone automation.
 * ==============================================================================
 */

const https = require('https');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { getIstTimestamp } = require('./google_sheets_service');
const sheetRotationService = require('./sheet_rotation_service');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY';
const WORKSHEET_GID = process.env.GOOGLE_SHEET_GID || '598922870';
const WORKSHEET_NAME = process.env.GOOGLE_SHEET_TAB_NAME || 'Twitter Complaint List';
const DISTRICT_LIST_TAB = 'Discom_District_List';
const WEBHOOK_URL = process.env.GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbx3uJpVaB33ss8jGnmfArBpDXBc4o-pQ6fsD0x-FggDWRT1_pWEHNPDUWKpf5uG0B6HCQ/exec';

function getActiveSpreadsheetId() {
  return sheetRotationService.getActiveSpreadsheetId();
}
function getActiveWorksheetGid() {
  return sheetRotationService.getActiveWorksheetGid();
}
function getActiveWorksheetName() {
  return sheetRotationService.getActiveWorksheetName();
}

// Invalidate caches immediately when active spreadsheet rotates
sheetRotationService.onConfigChange((newConfig) => {
  console.log(`[WorkingSheet] Rotated to sheet ${newConfig.spreadsheetId} (GID: ${newConfig.worksheetGid}). Resetting in-memory caches.`);
  cachedWorkingData = null;
  lastFetchTimestamp = 0;
  cachedDistricts = null;
  lastDistrictsTimestamp = 0;
});

// Exactly the 11 target columns in order
const WORKING_SHEET_COLUMNS = [
  'DATE',
  'C F',
  'LINK URL',
  'Twitter Id',
  'Picked Status',
  'Head',
  'Untagged Complaint',
  'UPPCLLKO Replied (YES/NO)',
  'Complaint Type',
  'District',
  'Status'
];

// Permitted options for dropdown controls
const PICKED_STATUS_OPTIONS = ['YES', 'NO', 'OTHER', 'TROLL', 'APPRECIATION'];
const UPPCLLKO_REPLIED_OPTIONS = ['YES', 'NO'];

const HEAD_OPTIONS = [
  'akm', 'akc', 'emm', 'emc', 'mdc', 'mdm',
  'upm', 'upc', 'upl', 'cmc', 'cmm', 'ako', 'NEWS', 'GROK'
];

const UNTAGGED_OPTIONS = ['YES', 'NO'];

const COMPLAINT_TYPE_OPTIONS = [
  'SUPPLY_OUTAGE',
  'SUPPLY_VOLTAGE',
  'BREAKDOWN_LT',
  'BREAKDOWN_HT',
  'BREAKDOWN_POLE',
  'TRANSFORMER_DAMAGE',
  'TRANSFORMER_NEW',
  'THEFT',
  'EMPLOYEE_RELATED',
  'DISSATISFIED_CONSUMER',
  'BILL_RELATED',
  'CONNECTION_NEW',
  'ACCIDENT_PRONE_TO_OCCURED',
  'ACCIDENT_OCCURED',
  'INFO_AND_SUGG',
  'METER_RELATED',
  'PTW',
  'DISCONNECTION',
  'LOAD ENHANCEMENT',
  'POLE_RELATED',
  'OTS',
  'APP RELATED',
  'SMART_METER_PAYMENT',
  'SMART_METER',
  'SMART_METER_APP_RELATED',
  'SMART_METER_PREPAID_TO_POSTPAID',
  'SMART_METER_BILL',
  'SMART_CHECK_METER',
  'T/F CAPACITY INCREASE'
];

const STATUS_OPTIONS = [
  'Forwarded to Discom',
  'Reply to Consumer',
  'DM',
  'Discom follow-up',
  'Problem not Solved',
  'Information Needed',
  'Pending Review'
];

// Editable column whitelist
const EDITABLE_COLUMNS = [
  'Picked Status',
  'Head',
  'Untagged Complaint',
  'UPPCLLKO Replied (YES/NO)',
  'Complaint Type',
  'District',
  'Status'
];

// Read-only column list
const READONLY_COLUMNS = [
  'DATE',
  'C F',
  'LINK URL',
  'Twitter Id'
];

// In-memory cache
let cachedWorkingData = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 60000; // 60 seconds fresh TTL (with Stale-While-Revalidate)
let isBackgroundRefreshing = false;

let cachedDistricts = null;
let lastDistrictsTimestamp = 0;
const DISTRICTS_TTL_MS = 600000; // 10 minutes TTL

/**
 * Utility: Fetch URL with automatic redirect handling
 */
function fetchUrl(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(targetUrl, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location, options));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        text: () => Promise.resolve(data),
        json: () => Promise.resolve(JSON.parse(data))
      }));
    });
    req.on('error', reject);
    if (options.timeout) {
      req.setTimeout(options.timeout, () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    }
  });
}

/**
 * Post JSON data to URL
 */
function postJson(targetUrl, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const parsed = new URL(targetUrl);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...(options.headers || {})
      }
    };

    const req = https.request(reqOptions, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location, options));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        text: () => Promise.resolve(data),
        json: () => {
          try { return Promise.resolve(JSON.parse(data)); }
          catch (e) { return Promise.resolve({ raw: data }); }
        }
      }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Convert 0-based column index to A1 column letter (0 -> A, 1 -> B, ..., 26 -> AA)
 */
function getColumnLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Normalizes header string for robust matching across case and punctuation
 */
function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\(\)\/\-]/g, '');
}

/**
 * Extracts Twitter snowflake ID from URL or string
 */
function extractTweetId(urlOrId) {
  if (!urlOrId) return '';
  const str = String(urlOrId).trim();
  const m = str.match(/status\/(\d+)/i);
  if (m) return m[1];
  if (/^\d{15,25}$/.test(str)) return str;
  return '';
}

/**
 * Parses date string (DD-MM-YYYY, YYYY-MM-DD, or ISO) to millisecond epoch
 */
function parseDateToEpoch(dateStr, snowflakeId = '') {
  if (dateStr) {
    const s = String(dateStr).trim();
    // DD-MM-YYYY or DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      const hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
      const min = dmy[5] ? parseInt(dmy[5], 10) : 0;
      const sec = dmy[6] ? parseInt(dmy[6], 10) : 0;
      return new Date(year, month, day, hour, min, sec).getTime();
    }
    // YYYY-MM-DD
    const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (ymd) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10) - 1;
      const day = parseInt(ymd[3], 10);
      const hour = ymd[4] ? parseInt(ymd[4], 10) : 0;
      const min = ymd[5] ? parseInt(ymd[5], 10) : 0;
      const sec = ymd[6] ? parseInt(ymd[6], 10) : 0;
      return new Date(year, month, day, hour, min, sec).getTime();
    }
  }

  // Fallback to Twitter Snowflake ID if date is missing or unparseable
  if (snowflakeId && /^\d{15,25}$/.test(snowflakeId)) {
    try {
      const snowflakeBigInt = BigInt(snowflakeId);
      const TWITTER_EPOCH = 1288834974657n;
      const timestampMs = Number((snowflakeBigInt >> 22n) + TWITTER_EPOCH);
      if (!isNaN(timestampMs) && timestampMs > 0) {
        return timestampMs;
      }
    } catch (e) {}
  }

  return 0;
}

/**
 * Google Service Account OAuth2 Access Token Generator
 */
let cachedGoogleToken = null;
let googleTokenExpiry = 0;

async function getGoogleApiAccessToken() {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const rawKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  let email = serviceEmail;
  let key = privateKey;

  if (rawKeyJson) {
    try {
      const parsed = JSON.parse(rawKeyJson);
      email = parsed.client_email || email;
      key = parsed.private_key || key;
    } catch (e) {}
  }

  if (!email || !key) {
    return null; // Service account not configured in environment
  }

  // Format private key if escaped newlines present
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && googleTokenExpiry > now + 60) {
    return cachedGoogleToken;
  }

  const jwtPayload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const signedJwt = jwt.sign(jwtPayload, key, { algorithm: 'RS256' });

  const postBody = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: signedJwt
  }).toString();

  const tokenRes = await new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postBody)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid token response: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(postBody);
    req.end();
  });

  if (tokenRes.access_token) {
    cachedGoogleToken = tokenRes.access_token;
    googleTokenExpiry = now + (tokenRes.expires_in || 3600);
    return cachedGoogleToken;
  } else {
    throw new Error('Google OAuth2 error: ' + (tokenRes.error_description || tokenRes.error || JSON.stringify(tokenRes)));
  }
}

/**
 * Dynamically fetches valid district list from Discom_District_List worksheet
 */
async function getDistrictList(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedDistricts && (now - lastDistrictsTimestamp < DISTRICTS_TTL_MS)) {
    return cachedDistricts;
  }

  try {
    const activeId = getActiveSpreadsheetId();
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${activeId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(DISTRICT_LIST_TAB)}`;
    const res = await fetchUrl(gvizUrl, { timeout: 8000 });
    if (res && res.ok) {
      const text = await res.text();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const districts = [];
      const mapping = {};

      for (let i = 1; i < lines.length; i++) {
        const raw = lines[i];
        // Parse CSV format "DVVNL","AGRA","AGRA-1"
        const match = raw.match(/"([^"]*)","([^"]*)","([^"]*)"/);
        if (match) {
          const discom = match[1].trim();
          const district = match[2].trim();
          const zone = match[3].trim();
          districts.push({ discom, district, zone });
          mapping[district.toUpperCase()] = { discom, zone };
        } else {
          // Fallback simple comma split
          const parts = raw.split(',').map(p => p.replace(/"/g, '').trim());
          if (parts.length >= 2 && parts[1]) {
            const discom = parts[0];
            const district = parts[1];
            const zone = parts[2] || '';
            districts.push({ discom, district, zone });
            mapping[district.toUpperCase()] = { discom, zone };
          }
        }
      }

      if (districts.length > 0) {
        cachedDistricts = {
          status: 'ok',
          count: districts.length,
          districts: districts,
          mapping: mapping,
          districtNames: districts.map(d => d.district).sort()
        };
        lastDistrictsTimestamp = now;
        return cachedDistricts;
      }
    }
  } catch (err) {
    console.warn('[WorkingSheet] Dynamic district fetch error:', err.message);
  }

  // If previous cached districts exist, keep serving them
  if (cachedDistricts) return cachedDistricts;

  // If completely unavailable, throw explicit error per requirement
  throw new Error('Discom_District_List worksheet could not be loaded from Google Sheets.');
}

/**
 * Fetch raw sheet lines via Google Sheets CSV export
 */
async function fetchSheetCsvLines() {
  const activeId = getActiveSpreadsheetId();
  const activeGid = getActiveWorksheetGid();
  const csvUrl = `https://docs.google.com/spreadsheets/d/${activeId}/export?format=csv&gid=${activeGid}`;
  const res = await fetchUrl(csvUrl, { timeout: 15000 });
  if (!res || !res.ok) {
    throw new Error(`Failed to fetch Google Sheet CSV: HTTP ${res ? res.status : 'network error'}`);
  }
  const text = await res.text();
  return parseCsvToRows(text);
}

/**
 * Robust CSV parser handling multi-line quoted fields
 */
function parseCsvToRows(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Main Data Fetcher: Retrieves ONLY the 11 designated columns
 */
/**
 * Fetches fresh working data from Google Sheets (via API or CSV export)
 */
async function fetchFreshWorkingDataFromGoogle() {
  let googleToken = null;
  try {
    googleToken = await getGoogleApiAccessToken();
  } catch (e) {
    console.warn('[WorkingSheet] Google Sheets API token not configured; using CSV/Webhook transport.');
  }

  let allRecords = null;
  let headers = null;

  if (googleToken) {
    try {
      const activeId = getActiveSpreadsheetId();
      const activeWsName = getActiveWorksheetName();
      const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${activeId}/values/'${encodeURIComponent(activeWsName)}'!1:1`;
      const headerRes = await fetchUrl(headerUrl, {
        headers: { 'Authorization': `Bearer ${googleToken}` }
      });
      const headerJson = await headerRes.json();
      const rawHeaders = (headerJson.values && headerJson.values[0]) ? headerJson.values[0] : [];

      if (rawHeaders.length > 0) {
        headers = rawHeaders;
        const targetColLetters = [];
        const targetIndices = [];

        WORKING_SHEET_COLUMNS.forEach(colName => {
          const normTarget = normalizeHeader(colName);
          let idx = -1;
          for (let c = 0; c < rawHeaders.length; c++) {
            if (normalizeHeader(rawHeaders[c]) === normTarget) {
              idx = c;
              break;
            }
          }
          targetIndices.push(idx);
          if (idx >= 0) {
            const letter = getColumnLetter(idx);
            targetColLetters.push(`'${encodeURIComponent(activeWsName)}'!${letter}3:${letter}`);
          }
        });

        let linkUrlCol = -1;
        let twitterIdCol = -1;
        for (let c = 0; c < rawHeaders.length; c++) {
          const norm = normalizeHeader(rawHeaders[c]);
          if (norm === 'linkurl' || norm === 'posturl' || norm === 'url') linkUrlCol = c;
          if (norm === 'twitterid' || norm === 'tweetid' || norm === 'snowflakeid') twitterIdCol = c;
        }

        if (linkUrlCol >= 0 && !targetIndices.includes(linkUrlCol)) {
          const letter = getColumnLetter(linkUrlCol);
          targetColLetters.push(`'${encodeURIComponent(activeWsName)}'!${letter}3:${letter}`);
        }
        if (twitterIdCol >= 0 && !targetIndices.includes(twitterIdCol)) {
          const letter = getColumnLetter(twitterIdCol);
          targetColLetters.push(`'${encodeURIComponent(activeWsName)}'!${letter}3:${letter}`);
        }

        const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${activeId}/values:batchGet?ranges=${targetColLetters.join('&ranges=')}`;
        const batchRes = await fetchUrl(batchUrl, {
          headers: { 'Authorization': `Bearer ${googleToken}` }
        });
        const batchJson = await batchRes.json();
        const valueRanges = batchJson.valueRanges || [];

        const colDataMap = {};
        let vrIndex = 0;
        WORKING_SHEET_COLUMNS.forEach((colName, idx) => {
          if (targetIndices[idx] >= 0 && vrIndex < valueRanges.length) {
            colDataMap[colName] = valueRanges[vrIndex].values || [];
            vrIndex++;
          } else {
            colDataMap[colName] = [];
          }
        });

        let maxRows = 0;
        WORKING_SHEET_COLUMNS.forEach(colName => {
          if (colDataMap[colName].length > maxRows) maxRows = colDataMap[colName].length;
        });

        const parsedRecords = [];
        for (let r = 0; r < maxRows; r++) {
          const sheetRowIndex = r + 3;
          const record = { sheet_row_index: sheetRowIndex };
          let allEmpty = true;
          WORKING_SHEET_COLUMNS.forEach(colName => {
            const cellArr = colDataMap[colName][r];
            const cellVal = (cellArr && cellArr[0] !== undefined) ? String(cellArr[0]).trim() : '';
            record[colName] = cellVal;
            if (cellVal) allEmpty = false;
          });
          if (allEmpty) continue;
          const postUrl = record['LINK URL'] || '';
          let tweetId = extractTweetId(postUrl) || extractTweetId(record['Twitter Id']);
          record['tweet_id'] = tweetId;
          record['link_url'] = postUrl;
          parsedRecords.push(record);
        }
        allRecords = parsedRecords;
      }
    } catch (err) {
      console.warn('[WorkingSheet] Google Sheets API batchGet failed, falling back to CSV export:', err.message);
    }
  }

  // Fallback: Read via CSV export
  if (!allRecords) {
    const csvRows = await fetchSheetCsvLines();
    if (!csvRows || csvRows.length < 2) {
      throw new Error('Google Sheet returned insufficient rows.');
    }

    headers = csvRows[0];
    const targetIndices = [];
    WORKING_SHEET_COLUMNS.forEach(colName => {
      const normTarget = normalizeHeader(colName);
      let idx = -1;
      for (let c = 0; c < headers.length; c++) {
        if (normalizeHeader(headers[c]) === normTarget) {
          idx = c;
          break;
        }
      }
      targetIndices.push(idx);
    });

    let linkUrlCol = -1;
    let twitterIdCol = -1;
    for (let c = 0; c < headers.length; c++) {
      const norm = normalizeHeader(headers[c]);
      if (norm === 'linkurl' || norm === 'posturl' || norm === 'url') linkUrlCol = c;
      if (norm === 'twitterid' || norm === 'tweetid' || norm === 'snowflakeid') twitterIdCol = c;
    }

    const parsedRecords = [];
    for (let r = 2; r < csvRows.length; r++) {
      const row = csvRows[r];
      const sheetRowIndex = r + 1;
      if (!row || row.every(c => String(c || '').trim() === '')) continue;
      const record = { sheet_row_index: sheetRowIndex };
      let allEmpty = true;
      WORKING_SHEET_COLUMNS.forEach((colName, cIdx) => {
        const colPos = targetIndices[cIdx];
        const cellVal = (colPos >= 0 && colPos < row.length) ? String(row[colPos] || '').trim() : '';
        record[colName] = cellVal;
        if (cellVal) allEmpty = false;
      });
      if (allEmpty) continue;
      const postUrl = record['LINK URL'] || (linkUrlCol >= 0 ? String(row[linkUrlCol] || '').trim() : '');
      let tweetId = extractTweetId(postUrl) || extractTweetId(record['Twitter Id'] || (twitterIdCol >= 0 ? String(row[twitterIdCol] || '').trim() : ''));
      record['tweet_id'] = tweetId;
      record['link_url'] = postUrl;
      parsedRecords.push(record);
    }
    allRecords = parsedRecords;
  }

  cachedWorkingData = {
    records: allRecords,
    headers: headers || WORKING_SHEET_COLUMNS
  };
  lastFetchTimestamp = Date.now();
  return allRecords;
}

/**
 * Returns the filtered and paginated records for WORKING SHEET
 */
async function getWorkingSheetData({
  page = 1,
  limit = 50,
  search = '',
  sortBy = 'DATE',
  sortOrder = 'DESC',
  pickedStatus = 'All',
  head = 'All',
  district = 'All',
  complaintType = 'All',
  forceRefresh = false
} = {}) {
  const now = Date.now();
  let allRecords = null;
  const isCacheFresh = cachedWorkingData && (now - lastFetchTimestamp < CACHE_TTL_MS);

  if (!forceRefresh && isCacheFresh) {
    // 1. Fast Path: Cache is fresh, return immediately (< 30ms)
    allRecords = cachedWorkingData.records;
  } else if (!forceRefresh && cachedWorkingData && cachedWorkingData.records && cachedWorkingData.records.length > 0) {
    // 2. Stale-While-Revalidate: Return cached records immediately, refresh asynchronously in background
    allRecords = cachedWorkingData.records;
    if (!isBackgroundRefreshing) {
      isBackgroundRefreshing = true;
      fetchFreshWorkingDataFromGoogle()
        .catch(err => console.warn('[WorkingSheet] Background refresh failed:', err.message))
        .finally(() => { isBackgroundRefreshing = false; });
    }
  } else {
    // 3. Cold Start or Forced Refresh: Fetch synchronously
    allRecords = await fetchFreshWorkingDataFromGoogle();
  }

  // 3. Apply Filters
  let filtered = allRecords.slice();

  // Search filter across DATE, C F, Twitter Id, LINK URL, Head, District, Complaint Type, Status
  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    filtered = filtered.filter(rec => {
      return (
        (rec['DATE'] && rec['DATE'].toLowerCase().includes(s)) ||
        (rec['C F'] && rec['C F'].toLowerCase().includes(s)) ||
        (rec['Twitter Id'] && rec['Twitter Id'].toLowerCase().includes(s)) ||
        (rec['LINK URL'] && rec['LINK URL'].toLowerCase().includes(s)) ||
        (rec['District'] && rec['District'].toLowerCase().includes(s)) ||
        (rec['Head'] && rec['Head'].toLowerCase().includes(s)) ||
        (rec['Complaint Type'] && rec['Complaint Type'].toLowerCase().includes(s)) ||
        (rec['Status'] && rec['Status'].toLowerCase().includes(s)) ||
        (rec['tweet_id'] && rec['tweet_id'].toLowerCase().includes(s))
      );
    });
  }

  // Picked Status filter
  if (pickedStatus && pickedStatus !== 'All') {
    filtered = filtered.filter(rec => String(rec['Picked Status'] || '').toUpperCase() === pickedStatus.toUpperCase());
  }

  // Head filter
  if (head && head !== 'All') {
    filtered = filtered.filter(rec => String(rec['Head'] || '').toLowerCase() === head.toLowerCase());
  }

  // District filter
  if (district && district !== 'All') {
    filtered = filtered.filter(rec => String(rec['District'] || '').toUpperCase() === district.toUpperCase());
  }

  // Complaint Type filter
  if (complaintType && complaintType !== 'All') {
    filtered = filtered.filter(rec => String(rec['Complaint Type'] || '').toUpperCase() === complaintType.toUpperCase());
  }

  // 4. Multi-tier Sorting (DATE descending by default)
  const isDesc = String(sortOrder).toUpperCase() === 'DESC';

  filtered.sort((a, b) => {
    if (sortBy === 'DATE') {
      const epochA = parseDateToEpoch(a['DATE'], a['tweet_id']);
      const epochB = parseDateToEpoch(b['DATE'], b['tweet_id']);
      if (epochA !== epochB) {
        return isDesc ? (epochB - epochA) : (epochA - epochB);
      }
      // Secondary tiebreaker: Snowflake ID descending
      const snA = BigInt(a['tweet_id'] && /^\d+$/.test(a['tweet_id']) ? a['tweet_id'] : '0');
      const snB = BigInt(b['tweet_id'] && /^\d+$/.test(b['tweet_id']) ? b['tweet_id'] : '0');
      return snB > snA ? 1 : (snB < snA ? -1 : 0);
    }

    if (sortBy === 'C F') {
      const cfA = parseFloat(a['C F']) || 0;
      const cfB = parseFloat(b['C F']) || 0;
      return isDesc ? (cfB - cfA) : (cfA - cfB);
    }

    const valA = String(a[sortBy] || '').toLowerCase();
    const valB = String(b[sortBy] || '').toLowerCase();
    if (valA < valB) return isDesc ? 1 : -1;
    if (valA > valB) return isDesc ? -1 : 1;
    return 0;
  });

  // 5. Pagination
  const totalRecords = filtered.length;
  const numLimit = Math.max(1, parseInt(limit, 10) || 50);
  const numPage = Math.max(1, parseInt(page, 10) || 1);
  const totalPages = Math.ceil(totalRecords / numLimit) || 1;
  const offset = (numPage - 1) * numLimit;
  const paginatedRows = filtered.slice(offset, offset + numLimit);

  // Dynamic district options
  let districtOptions = [];
  try {
    const dInfo = await getDistrictList();
    districtOptions = dInfo.districtNames;
  } catch (e) {
    districtOptions = [];
  }

  return {
    status: 'ok',
    totalRecords,
    page: numPage,
    limit: numLimit,
    totalPages,
    columns: WORKING_SHEET_COLUMNS,
    editableColumns: EDITABLE_COLUMNS,
    readonlyColumns: READONLY_COLUMNS,
    dropdownOptions: {
      'Picked Status': PICKED_STATUS_OPTIONS,
      'Head': HEAD_OPTIONS,
      'Untagged Complaint': UNTAGGED_OPTIONS,
      'UPPCLLKO Replied (YES/NO)': UPPCLLKO_REPLIED_OPTIONS,
      'Complaint Type': COMPLAINT_TYPE_OPTIONS,
      'District': districtOptions,
      'Status': STATUS_OPTIONS
    },
    rows: paginatedRows,
    lastFetchedAt: new Date(lastFetchTimestamp).toISOString()
  };
}

/**
 * Updates a single cell directly in Google Sheets and verifies the write
 */
async function updateWorkingSheetCell({
  tweetId,
  postUrl,
  sheetRowIndex,
  columnName,
  newValue,
  user
}) {
  const normCol = String(columnName || '').trim();
  let rawVal = String(newValue !== undefined && newValue !== null ? newValue : '').trim();

  // 1. Whitelist validation: Allowed editable columns
  if (!EDITABLE_COLUMNS.includes(normCol)) {
    throw new Error(`Column "${normCol}" is formula-controlled or read-only and cannot be manually edited.`);
  }

  // 2. Validate value against permitted options (case-insensitive normalization)
  if (normCol === 'Picked Status') {
    const matched = PICKED_STATUS_OPTIONS.find(p => p.toUpperCase() === rawVal.toUpperCase());
    if (!matched) {
      throw new Error(`Invalid Picked Status "${rawVal}". Permitted: ${PICKED_STATUS_OPTIONS.join(', ')}`);
    }
    rawVal = matched;
  }
  if (normCol === 'Head') {
    const matched = HEAD_OPTIONS.find(h => h.toLowerCase() === rawVal.toLowerCase());
    if (!matched) {
      throw new Error(`Invalid Head code "${rawVal}". Permitted: ${HEAD_OPTIONS.join(', ')}`);
    }
    rawVal = matched;
  }
  if (normCol === 'Untagged Complaint') {
    const matched = UNTAGGED_OPTIONS.find(u => u.toUpperCase() === rawVal.toUpperCase());
    if (!matched) {
      throw new Error(`Invalid Untagged option "${rawVal}". Permitted: YES, NO`);
    }
    rawVal = matched;
  }
  if (normCol === 'UPPCLLKO Replied (YES/NO)') {
    const upper = rawVal.toUpperCase();
    if (upper === 'YES' || upper === 'NO') {
      rawVal = upper;
    } else if (rawVal === '' || rawVal === '-') {
      rawVal = '';
    } else {
      throw new Error(`Invalid UPPCLLKO Replied option "${rawVal}". Permitted: YES, NO`);
    }
  }
  if (normCol === 'Complaint Type' && !COMPLAINT_TYPE_OPTIONS.includes(rawVal)) {
    throw new Error(`Invalid Complaint Type "${rawVal}".`);
  }
  if (normCol === 'Status' && !STATUS_OPTIONS.includes(rawVal)) {
    throw new Error(`Invalid Status "${rawVal}". Permitted: ${STATUS_OPTIONS.join(', ')}`);
  }

  let mappedDiscom = null;
  let mappedZone = null;
  if (normCol === 'District') {
    const districtInfo = await getDistrictList();
    const upperDist = rawVal.toUpperCase();
    if (!districtInfo.mapping[upperDist]) {
      throw new Error(`Invalid District "${rawVal}". District must exist in Discom_District_List.`);
    }
    mappedDiscom = districtInfo.mapping[upperDist].discom;
    mappedZone = districtInfo.mapping[upperDist].zone;
  }

  // 3. Resolve exact row index in Google Sheet
  const cleanTweetId = extractTweetId(tweetId || postUrl);
  const cleanUrl = String(postUrl || '').trim();

  if (!cleanTweetId && !cleanUrl && (!sheetRowIndex || sheetRowIndex < 3)) {
    throw new Error('Record cannot be safely identified. A valid Tweet ID or Post URL is required.');
  }

  // 4. Check if Google Sheets API v4 can be used
  let googleToken = null;
  try {
    googleToken = await getGoogleApiAccessToken();
  } catch (e) {}

  let verifiedValue = null;
  let targetRow = parseInt(sheetRowIndex, 10);

  const op = await sheetRotationService.beginOperation();
  const currentSpreadsheetId = op.spreadsheetId;
  const currentWorksheetName = op.worksheetName;
  const currentWorksheetGid = op.worksheetGid;

  try {
    if (googleToken) {
      try {
        // Fetch headers to find exact column letters
        const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/'${encodeURIComponent(currentWorksheetName)}'!1:1`;
        const headerRes = await fetchUrl(headerUrl, { headers: { 'Authorization': `Bearer ${googleToken}` } });
        const headerJson = await headerRes.json();
        const rawHeaders = (headerJson.values && headerJson.values[0]) ? headerJson.values[0] : [];

        let colIdx = -1;
        let discomColIdx = -1;
        let zoneColIdx = -1;
        let linkUrlColIdx = -1;
        let twitterIdColIdx = -1;

        for (let c = 0; c < rawHeaders.length; c++) {
          const norm = normalizeHeader(rawHeaders[c]);
          if (norm === normalizeHeader(normCol)) colIdx = c;
          if (norm === 'discom') discomColIdx = c;
          if (norm === 'zone') zoneColIdx = c;
          if (norm === 'linkurl' || norm === 'posturl' || norm === 'url') linkUrlColIdx = c;
          if (norm === 'twitterid' || norm === 'tweetid' || norm === 'snowflakeid') twitterIdColIdx = c;
        }

        if (colIdx === -1) {
          throw new Error(`Target column "${normCol}" was not found in Google Sheet headers.`);
        }

        // Verify row with stable identifier
        let resolvedRow = -1;
        if (targetRow >= 3) {
          const checkRange = `'${encodeURIComponent(currentWorksheetName)}'!A${targetRow}:Z${targetRow}`;
          const checkRes = await fetchUrl(`https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/${checkRange}`, {
            headers: { 'Authorization': `Bearer ${googleToken}` }
          });
          const checkJson = await checkRes.json();
          const rowVals = (checkJson.values && checkJson.values[0]) ? checkJson.values[0] : [];
          const u = linkUrlColIdx >= 0 ? String(rowVals[linkUrlColIdx] || '').trim() : '';
          const tid = twitterIdColIdx >= 0 ? String(rowVals[twitterIdColIdx] || '').trim() : '';
          if ((cleanUrl && u === cleanUrl) || (cleanTweetId && (u.includes(cleanTweetId) || tid === cleanTweetId))) {
            resolvedRow = targetRow;
          }
        }

        // If hinted row didn't match, scan the link URL column
        if (resolvedRow === -1 && linkUrlColIdx >= 0) {
          const letter = getColumnLetter(linkUrlColIdx);
          const colRes = await fetchUrl(`https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/'${encodeURIComponent(currentWorksheetName)}'!${letter}3:${letter}`, {
            headers: { 'Authorization': `Bearer ${googleToken}` }
          });
          const colJson = await colRes.json();
          const vals = colJson.values || [];
          for (let i = 0; i < vals.length; i++) {
            const u = String(vals[i][0] || '').trim();
            if ((cleanUrl && u === cleanUrl) || (cleanTweetId && u.includes(cleanTweetId))) {
              resolvedRow = i + 3;
              break;
            }
          }
        }

        if (resolvedRow === -1 || resolvedRow < 3) {
          throw new Error('Unable to resolve exact complaint row in Google Sheet for safe single-cell update.');
        }

        targetRow = resolvedRow;
        const targetColLetter = getColumnLetter(colIdx);
        const updateRange = `'${encodeURIComponent(currentWorksheetName)}'!${targetColLetter}${targetRow}`;

        // Update ONLY the corresponding cell
        const updateRes = await new Promise((resolve, reject) => {
          const putBody = JSON.stringify({
            range: updateRange,
            majorDimension: 'ROWS',
            values: [[rawVal]]
          });
          const req = https.request(`https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${googleToken}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(putBody)
            }
          }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(data)); }
              catch (e) { reject(new Error('Invalid update response: ' + data)); }
            });
          });
          req.on('error', reject);
          req.write(putBody);
          req.end();
        });

        if (!updateRes || updateRes.error) {
          throw new Error('Google Sheets API update error: ' + (updateRes?.error?.message || JSON.stringify(updateRes)));
        }

        // If District changed, preserve DISCOM & Zone automation in Google Sheets
        if (normCol === 'District' && mappedDiscom) {
          if (discomColIdx >= 0) {
            const discomLetter = getColumnLetter(discomColIdx);
            await updateSingleCellViaGoogleApi(googleToken, `${discomLetter}${targetRow}`, mappedDiscom, currentSpreadsheetId, currentWorksheetName);
          }
          if (zoneColIdx >= 0 && mappedZone) {
            const zoneLetter = getColumnLetter(zoneColIdx);
            await updateSingleCellViaGoogleApi(googleToken, `${zoneLetter}${targetRow}`, mappedZone, currentSpreadsheetId, currentWorksheetName);
          }
        }

        // Step 7: Read back cell via Google Sheets API to verify update
        const verifyRes = await fetchUrl(`https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/${updateRange}`, {
          headers: { 'Authorization': `Bearer ${googleToken}` }
        });
        const verifyJson = await verifyRes.json();
        verifiedValue = (verifyJson.values && verifyJson.values[0] && verifyJson.values[0][0] !== undefined)
          ? String(verifyJson.values[0][0]).trim()
          : '';

      } catch (apiErr) {
        console.warn('[WorkingSheet] Google Sheets API update failed; trying Webhook transport:', apiErr.message);
      }
    }

    // Fallback / Hybrid Transport: Google Apps Script Webhook
    if (verifiedValue === null && WEBHOOK_URL) {
      const payload = {
        action: 'update_cell',
        spreadsheetId: currentSpreadsheetId,
        worksheetGid: currentWorksheetGid,
        tweetId: cleanTweetId,
        postUrl: cleanUrl,
        sheetRowIndex: targetRow,
        columnName: normCol,
        newValue: rawVal,
        userEmail: user ? user.email || user.username : 'Dashboard User'
      };

      const webhookRes = await postJson(WEBHOOK_URL, payload, { timeout: 15000 });
      const json = await webhookRes.json();
      if (json.status === 'ok' && json.verified) {
        verifiedValue = json.value !== undefined ? String(json.value).trim() : rawVal;
        if (json.row) targetRow = json.row;
      } else if (json.status === 'ok' && (json.inserted === 0 || !json.verified)) {
        throw new Error(
          'Google Apps Script Web App is running an older deployment that does not support cell updates yet. Please paste the updated Code.gs into Google Sheets (Extensions > Apps Script) and deploy a "New version". Copy 1-click code at: https://social-media-dashboard-b1mv.onrender.com/code'
        );
      } else {
        throw new Error(json.error || 'Google Apps Script update failed.');
      }
    }
  } finally {
    sheetRotationService.endOperation();
  }

  if (verifiedValue === null) {
    throw new Error('Failed to update Google Sheet: neither Google Sheets API nor Webhook confirmed the write.');
  }

  // Update in-memory cache directly so it stays fresh without dropping
  if (cachedWorkingData && Array.isArray(cachedWorkingData.records)) {
    const cachedRec = cachedWorkingData.records.find(r =>
      (cleanTweetId && r.tweet_id === cleanTweetId) ||
      (cleanUrl && r.link_url === cleanUrl) ||
      (r.sheet_row_index === targetRow)
    );
    if (cachedRec) {
      cachedRec[normCol] = verifiedValue;
      if (normCol === 'District' && mappedDiscom) {
        cachedRec['DISCOM'] = mappedDiscom;
        cachedRec['Zone'] = mappedZone;
      }
    }
  }
  lastFetchTimestamp = Date.now();

  // Sync to local SQLite database cache so all dashboard views stay in sync
  try {
    syncWorkingEditToSqlite({
      tweetId: cleanTweetId,
      postUrl: cleanUrl,
      columnName: normCol,
      newValue: rawVal,
      mappedDiscom,
      mappedZone
    });
  } catch (dbErr) {
    console.warn('[WorkingSheet] SQLite sync error (non-fatal):', dbErr.message);
  }

  return {
    success: true,
    row: targetRow,
    column: normCol,
    updated_value: verifiedValue,
    discom: mappedDiscom,
    zone: mappedZone,
    message: `Successfully updated ${normCol} to "${verifiedValue}" in Google Sheet (Row ${targetRow}).`
  };
}

/**
 * Helper to update single cell via Google API v4
 */
function updateSingleCellViaGoogleApi(token, cellA1, value, spreadsheetId = null, worksheetName = null) {
  const targetId = spreadsheetId || getActiveSpreadsheetId();
  const targetWsName = worksheetName || getActiveWorksheetName();
  return new Promise((resolve, reject) => {
    const range = `'${encodeURIComponent(targetWsName)}'!${cellA1}`;
    const putBody = JSON.stringify({
      range: range,
      majorDimension: 'ROWS',
      values: [[value]]
    });
    const req = https.request(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(putBody)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(putBody);
    req.end();
  });
}

/**
 * Syncs the verified Google Sheet edit into SQLite database
 */
function syncWorkingEditToSqlite({
  tweetId,
  postUrl,
  columnName,
  newValue,
  mappedDiscom,
  mappedZone
}) {
  let complaint = null;
  if (tweetId) {
    complaint = db.get("SELECT id, status, picked_status, uppcl_replied, uppcllko_replied FROM complaints WHERE post_url LIKE ?;", [`%${tweetId}%`]);
  }
  if (!complaint && postUrl) {
    complaint = db.get("SELECT id, status, picked_status, uppcl_replied, uppcllko_replied FROM complaints WHERE post_url = ?;", [postUrl]);
  }

  if (!complaint) return;

  const nowIst = getIstTimestamp();

  if (columnName === 'Picked Status') {
    const upper = newValue.toUpperCase();
    let uppclReplied = (upper === 'YES') ? 1 : 0;
    db.run("UPDATE complaints SET picked_status = ?, uppcl_replied = ?, updated_at = ? WHERE id = ?;", [upper, uppclReplied, nowIst, complaint.id]);
  } else if (columnName === 'Head') {
    db.run("UPDATE complaints SET assigned_handle = ?, updated_at = ? WHERE id = ?;", [newValue.toLowerCase(), nowIst, complaint.id]);
  } else if (columnName === 'Untagged Complaint') {
    db.run("UPDATE complaints SET untagged_complaint = ?, updated_at = ? WHERE id = ?;", [newValue.toUpperCase(), nowIst, complaint.id]);
  } else if (columnName === 'Complaint Type') {
    db.run("UPDATE complaints SET category_name = ?, updated_at = ? WHERE id = ?;", [newValue, nowIst, complaint.id]);
  } else if (columnName === 'District') {
    let sql = "UPDATE complaints SET district_name = ?";
    let params = [newValue.toUpperCase()];
    if (mappedDiscom) {
      sql += ", discom_name = ?";
      params.push(mappedDiscom);
    }
    if (mappedZone) {
      sql += ", zone_name = ?";
      params.push(mappedZone);
    }
    sql += ", updated_at = ? WHERE id = ?;";
    params.push(nowIst, complaint.id);
    db.run(sql, params);
  } else if (columnName === 'UPPCLLKO Replied (YES/NO)' || columnName.includes('Replied')) {
    const upper = (newValue || '').toUpperCase();
    const isYes = (upper === 'YES');
    db.run("UPDATE complaints SET uppcl_replied = ?, uppcllko_replied = ?, updated_at = ? WHERE id = ?;", [isYes ? 1 : 0, isYes ? 'YES' : (upper === 'NO' ? 'NO' : null), nowIst, complaint.id]);
  } else if (columnName === 'Status') {
    db.run("UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?;", [newValue, nowIst, complaint.id]);
  }
}

/**
 * Permanently deletes a complaint row from Google Sheet and synchronizes SQLite & cache
 */
async function deleteWorkingSheetRow({
  tweetId,
  postUrl,
  sheetRowIndex,
  user
}) {
  const cleanTweetId = extractTweetId(tweetId || postUrl);
  const cleanUrl = String(postUrl || '').trim();
  const hintedRow = parseInt(sheetRowIndex, 10);

  if (!cleanTweetId && !cleanUrl && (!hintedRow || hintedRow < 3)) {
    throw new Error('Complaint cannot be safely identified for deletion. A valid Tweet ID or Post URL is required.');
  }

  let deleted = false;
  let resolvedRow = (hintedRow >= 3) ? hintedRow : -1;
  let deleteError = null;

  const op = await sheetRotationService.beginOperation();
  const currentSpreadsheetId = op.spreadsheetId;
  const currentWorksheetName = op.worksheetName;
  const currentWorksheetGid = op.worksheetGid;

  try {
    // 1. Check if Google Sheets API v4 can be used
    let googleToken = null;
    try {
      googleToken = await getGoogleApiAccessToken();
    } catch (e) {}

    if (googleToken) {
      try {
        const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/'${encodeURIComponent(currentWorksheetName)}'!1:1`;
        const headerRes = await fetchUrl(headerUrl, { headers: { 'Authorization': `Bearer ${googleToken}` } });
        const headerJson = await headerRes.json();
        const rawHeaders = (headerJson.values && headerJson.values[0]) ? headerJson.values[0] : [];

        let linkUrlColIdx = -1;
        let twitterIdColIdx = -1;

        for (let c = 0; c < rawHeaders.length; c++) {
          const norm = normalizeHeader(rawHeaders[c]);
          if (norm === 'linkurl' || norm === 'posturl' || norm === 'url') linkUrlColIdx = c;
          if (norm === 'twitterid' || norm === 'tweetid' || norm === 'snowflakeid') twitterIdColIdx = c;
        }

        let verifiedRow = -1;

        // Verify hinted row
        if (hintedRow >= 3) {
          const checkRange = `'${encodeURIComponent(currentWorksheetName)}'!A${hintedRow}:Z${hintedRow}`;
          const checkRes = await fetchUrl(`https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/${checkRange}`, {
            headers: { 'Authorization': `Bearer ${googleToken}` }
          });
          const checkJson = await checkRes.json();
          const rowVals = (checkJson.values && checkJson.values[0]) ? checkJson.values[0] : [];
          const u = linkUrlColIdx >= 0 ? String(rowVals[linkUrlColIdx] || '').trim() : '';
          const tid = twitterIdColIdx >= 0 ? String(rowVals[twitterIdColIdx] || '').trim() : '';
          if ((cleanUrl && u === cleanUrl) || (cleanTweetId && (u.includes(cleanTweetId) || tid === cleanTweetId))) {
            verifiedRow = hintedRow;
          }
        }

        // If hinted row didn't match, scan Link URL column
        if (verifiedRow === -1 && linkUrlColIdx >= 0) {
          const letter = getColumnLetter(linkUrlColIdx);
          const colRes = await fetchUrl(`https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/'${encodeURIComponent(currentWorksheetName)}'!${letter}3:${letter}`, {
            headers: { 'Authorization': `Bearer ${googleToken}` }
          });
          const colJson = await colRes.json();
          const vals = colJson.values || [];
          for (let i = 0; i < vals.length; i++) {
            const u = String(vals[i][0] || '').trim();
            if ((cleanUrl && u === cleanUrl) || (cleanTweetId && u.includes(cleanTweetId))) {
              verifiedRow = i + 3;
              break;
            }
          }
        }

        // Scan Twitter ID column if still not found
        if (verifiedRow === -1 && twitterIdColIdx >= 0 && cleanTweetId) {
          const letter = getColumnLetter(twitterIdColIdx);
          const colRes = await fetchUrl(`https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/'${encodeURIComponent(currentWorksheetName)}'!${letter}3:${letter}`, {
            headers: { 'Authorization': `Bearer ${googleToken}` }
          });
          const colJson = await colRes.json();
          const vals = colJson.values || [];
          for (let i = 0; i < vals.length; i++) {
            const tid = String(vals[i][0] || '').trim();
            if (tid === cleanTweetId || tid.includes(cleanTweetId)) {
              verifiedRow = i + 3;
              break;
            }
          }
        }

        if (verifiedRow >= 3) {
          resolvedRow = verifiedRow;
          const batchReq = {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: parseInt(currentWorksheetGid, 10),
                    dimension: 'ROWS',
                    startIndex: resolvedRow - 1,
                    endIndex: resolvedRow
                  }
                }
              }
            ]
          };

          const batchRes = await postJson(`https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}:batchUpdate`, batchReq, {
            headers: { 'Authorization': `Bearer ${googleToken}` }
          });
          const json = await batchRes.json();
          if (json && !json.error) {
            deleted = true;
          } else {
            console.warn('[WorkingSheet] Sheets API deleteDimension response error:', json?.error?.message || json);
          }
        }
      } catch (apiErr) {
        console.warn('[WorkingSheet] Sheets API delete failed; trying Webhook transport:', apiErr.message);
      }
    }

    // 2. Fallback / Hybrid Transport: Google Apps Script Webhook
    if (!deleted && WEBHOOK_URL) {
      try {
        const payload = {
          action: 'delete_row',
          spreadsheetId: currentSpreadsheetId,
          worksheetGid: currentWorksheetGid,
          sheetRowIndex: resolvedRow >= 3 ? resolvedRow : hintedRow,
          postUrl: cleanUrl,
          tweetId: cleanTweetId,
          userEmail: user ? (user.email || user.username) : 'Operator'
        };

        const webhookRes = await postJson(WEBHOOK_URL, payload, { timeout: 15000 });
        const json = await webhookRes.json();
        if (json && (json.deleted || json.status === 'ok')) {
          deleted = true;
          if (json.deletedRow) resolvedRow = json.deletedRow;
        } else if (json && json.status === 'not_found') {
          deleted = true;
        } else {
          deleteError = json?.message || json?.error || 'Google Apps Script deletion failed';
        }
      } catch (whErr) {
        deleteError = whErr.message;
      }
    }
  } finally {
    sheetRotationService.endOperation();
  }

  if (!deleted) {
    throw new Error(deleteError || 'Failed to delete complaint from Google Sheet. Please check sheet permissions and connection.');
  }

  // 3. Update In-Memory Cache
  if (cachedWorkingData && Array.isArray(cachedWorkingData.records)) {
    const idx = cachedWorkingData.records.findIndex(r =>
      (cleanTweetId && r.tweet_id === cleanTweetId) ||
      (cleanUrl && r.link_url === cleanUrl) ||
      (resolvedRow >= 3 && r.sheet_row_index === resolvedRow)
    );
    if (idx !== -1) {
      cachedWorkingData.records.splice(idx, 1);
      // Decrement subsequent row indices
      for (let i = idx; i < cachedWorkingData.records.length; i++) {
        if (cachedWorkingData.records[i].sheet_row_index > resolvedRow) {
          cachedWorkingData.records[i].sheet_row_index -= 1;
        }
      }
    }
  }
  lastFetchTimestamp = Date.now();

  // 4. Cascade delete in local SQLite & ledger
  try {
    syncWorkingDeleteToSqlite({
      tweetId: cleanTweetId,
      postUrl: cleanUrl,
      user
    });
  } catch (dbErr) {
    console.warn('[WorkingSheet] SQLite delete sync warning (non-fatal):', dbErr.message);
  }

  return {
    success: true,
    deleted: true,
    deletedRow: resolvedRow,
    tweetId: cleanTweetId,
    message: `Complaint (Row ${resolvedRow}) successfully and permanently deleted from Google Sheet.`
  };
}

/**
 * Syncs the verified Google Sheet deletion into SQLite database and frivolous ledger
 */
function syncWorkingDeleteToSqlite({ tweetId, postUrl, user }) {
  let complaint = null;
  if (tweetId) {
    complaint = db.get("SELECT id, complaint_no, consumer_handle, post_url FROM complaints WHERE post_url LIKE ?;", [`%${tweetId}%`]);
  }
  if (!complaint && postUrl) {
    complaint = db.get("SELECT id, complaint_no, consumer_handle, post_url FROM complaints WHERE post_url = ?;", [postUrl]);
  }

  const istTime = getIstTimestamp();
  const userName = user ? (user.full_name || user.username) : 'Operator';
  const cNo = complaint ? complaint.complaint_no : (tweetId ? `TWEET-${tweetId}` : 'COMPLAINT');
  const cUrl = complaint ? complaint.post_url : postUrl;

  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS frivolous_complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_url TEXT UNIQUE,
        tweet_id TEXT,
        complaint_no TEXT,
        deleted_at TEXT NOT NULL,
        deleted_by_name TEXT,
        reason TEXT DEFAULT 'Deleted from Working Sheet'
      );
    `);
    db.run(`
      INSERT OR REPLACE INTO frivolous_complaints (post_url, tweet_id, complaint_no, deleted_at, deleted_by_name, reason)
      VALUES (?, ?, ?, ?, ?, ?);
    `, [cUrl, tweetId, cNo, istTime, userName, 'Deleted from Working Sheet']);

    try {
      const fs = require('fs');
      const path = require('path');
      const ledgerPath = path.join(__dirname, 'data', 'frivolous_ledger.json');
      let ledger = [];
      if (fs.existsSync(ledgerPath)) {
        try { ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); } catch (e) {}
      }
      if (!Array.isArray(ledger)) ledger = [];
      const exists = ledger.some(x => (tweetId && x.tweet_id === tweetId) || (cUrl && x.post_url === cUrl));
      if (!exists) {
        ledger.push({
          tweet_id: tweetId,
          post_url: cUrl,
          complaint_no: cNo,
          deleted_at: istTime,
          deleted_by: userName,
          reason: 'Deleted from Working Sheet'
        });
        fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
      }
    } catch (e) {}
  } catch (e) {}

  if (complaint && complaint.id) {
    const safeDeleteFrom = (table, col = 'complaint_id') => {
      try { db.run(`DELETE FROM ${table} WHERE ${col} = ?;`, [complaint.id]); } catch (e) {}
    };
    safeDeleteFrom('complaint_timeline');
    safeDeleteFrom('complaint_forwarding_logs');
    safeDeleteFrom('complaint_followup_logs');
    safeDeleteFrom('complaint_escalation_logs');
    safeDeleteFrom('complaint_evidence');
    safeDeleteFrom('x_outgoing_replies');
    safeDeleteFrom('notifications');
    safeDeleteFrom('complaints', 'id');
  }

  try {
    if (typeof db.flush === 'function') db.flush();
    else if (typeof db.saveToDiskSync === 'function') db.saveToDiskSync();
  } catch (e) {}
}

module.exports = {
  WORKING_SHEET_COLUMNS,
  EDITABLE_COLUMNS,
  READONLY_COLUMNS,
  PICKED_STATUS_OPTIONS,
  UPPCLLKO_REPLIED_OPTIONS,
  HEAD_OPTIONS,
  UNTAGGED_OPTIONS,
  COMPLAINT_TYPE_OPTIONS,
  STATUS_OPTIONS,
  getWorkingSheetData,
  getDistrictList,
  updateWorkingSheetCell,
  deleteWorkingSheetRow,
  syncWorkingDeleteToSqlite,
  getColumnLetter,
  normalizeHeader,
  extractTweetId,
  parseDateToEpoch,
  getActiveSpreadsheetId,
  getActiveWorksheetGid,
  clearWorkingSheetCache: () => {
    cachedWorkingData = null;
    lastFetchTimestamp = 0;
    cachedDistricts = null;
    lastDistrictsTimestamp = 0;
  }
};
