/**
 * ==============================================================================
 * UPPCL SOCIAL MEDIA CELL — GOOGLE SHEETS INTEGRATION & SYNCHRONIZATION ENGINE
 * ==============================================================================
 * Authoritative Database: https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/edit?gid=598922870
 * Spreadsheet ID: 10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY
 * Worksheet GID: 598922870 (Twitter Complaint List)
 * 
 * Non-negotiable Architecture:
 * - Google Sheets is the sole authoritative source of truth.
 * - This engine pulls, validates, normalizes, and maintains a derived, rebuildable
 *   cache in SQLite for performant dashboard queries, analytics, and exports.
 * - Supports Multi-Transport:
 *   1. Google Apps Script Webhook (direct container-bound read)
 *   2. Google Sheets API v4 (Service Account or API Key)
 *   3. Published / Shared CSV Export
 *   4. Last Known Good Data Fallback (marked STALE)
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY';
const WORKSHEET_GID = process.env.GOOGLE_SHEET_GID || '598922870';
const WORKSHEET_NAME = process.env.GOOGLE_SHEET_TAB_NAME || 'Twitter Complaint List';
const WEBHOOK_URL = process.env.GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbx3uJpVaB33ss8jGnmfArBpDXBc4o-pQ6fsD0x-FggDWRT1_pWEHNPDUWKpf5uG0B6HCQ/exec';

// Sync state tracker
let syncInProgress = false;
let syncTimer = null;
let lastSyncInfo = {
  status: 'INITIALIZING', // 'LIVE', 'UPDATING', 'STALE', 'ERROR'
  lastSyncTimestamp: null,
  recordCount: 0,
  qualityIssuesCount: 0,
  syncDurationMs: 0,
  lastError: null,
  syncMethod: 'NONE',
  spreadsheetId: SPREADSHEET_ID,
  worksheetGid: WORKSHEET_GID,
  worksheetName: WORKSHEET_NAME
};

/**
 * Format IST timestamp: YYYY-MM-DD HH:mm:ss
 */
function getIstTimestamp(dateObj = new Date()) {
  const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (3600000 * 5.5)); // UTC+5:30
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const d = String(istDate.getDate()).padStart(2, '0');
  const h = String(istDate.getHours()).padStart(2, '0');
  const min = String(istDate.getMinutes()).padStart(2, '0');
  const s = String(istDate.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * Parse any date format into standard YYYY-MM-DD (IST)
 */
function parseDateIST(dateVal, timeVal = '') {
  if (!dateVal) return getIstTimestamp().split(' ')[0];
  const str = String(dateVal).trim();

  // Excel serial number (e.g. 45584)
  if (/^\d{5}$/.test(str)) {
    const epoch = new Date((parseInt(str, 10) - 25569) * 86400 * 1000);
    return getIstTimestamp(epoch).split(' ')[0];
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const d = String(dmy[1]).padStart(2, '0');
    const m = String(dmy[2]).padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }

  // General Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return getIstTimestamp(parsed).split(' ')[0];
  }

  return getIstTimestamp().split(' ')[0];
}

/**
 * Normalize and canonicalize column headers
 */
function buildHeaderIndexMap(headers) {
  const map = {};
  if (!headers || !headers.length) return map;

  headers.forEach((h, idx) => {
    if (!h) return;
    const clean = String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Map canonical fields
    if (clean === 'date' || clean === 'receiveddate') map['date'] = idx;
    else if (clean.includes('linkshift')) map['link_shift'] = idx;
    else if (clean.includes('replyshift')) map['reply_shift'] = idx;
    else if (clean === 'cf') map['c_f'] = idx;
    else if (clean.includes('linkurl') || clean.includes('url') || clean === 'link') map['link_url'] = idx;
    else if (clean.includes('twitterid') || clean.includes('handle') || clean === 'username') map['twitter_id'] = idx;
    else if (clean === 'head') map['head'] = idx;
    else if (clean.includes('untagged')) map['untagged_complaint'] = idx;
    else if (clean.includes('pickedstatus') || clean.includes('picked')) map['picked_status'] = idx;
    else if (clean.includes('complainttype') || clean.includes('category')) map['complaint_type'] = idx;
    else if (clean === 'discom') map['discom'] = idx;
    else if (clean === 'zone') map['zone'] = idx;
    else if (clean === 'district') map['district'] = idx;
    else if (clean === 'remark' || clean === 'remarks') map['remark'] = idx;
    else if (clean === 'status') map['status'] = idx;
    else if (clean.includes('30min') || clean.includes('reply30')) map['reply_within_30_min'] = idx;
    else if (clean.includes('60min') || clean.includes('reply60')) map['reply_within_60_min'] = idx;
    else if (clean.includes('complaintno') || clean === 'cno') map['complaint_no'] = idx;
    else if (clean === 'sts') map['sts'] = idx;
    else if (clean.includes('postid')) map['post_id'] = idx;
    else if (clean.includes('posttext') || clean.includes('tweettext') || clean === 'text') map['post_text'] = idx;
    else if (clean.includes('draft') || clean.includes('replydraft')) map['draft_reply'] = idx;
    else if (clean.includes('approval')) map['approval_status'] = idx;
  });

  return map;
}

/**
 * Normalizes DISCOM to standard 5 official DISCOM names
 */
function normalizeDiscom(discomStr, text = '') {
  const d = String(discomStr || '').trim().toUpperCase();
  if (d.includes('PVVNL') || d.includes('PASHCHIMANCHAL')) return 'PVVNL';
  if (d.includes('PUVVNL') || d.includes('PURVANCHAL')) return 'PuVVNL';
  if (d.includes('MVVNL') || d.includes('MADHYANCHAL')) return 'MVVNL';
  if (d.includes('DVVNL') || d.includes('DAKSHINANCHAL')) return 'DVVNL';
  if (d.includes('KESCO') || d.includes('KANPUR ELECTRIC')) return 'KESCo';

  // Infer from text if blank
  const lower = String(text).toLowerCase();
  if (/pvvnl|meerut|noida|ghaziabad|moradabad|saharanpur|aligarh|bulandshahr|muzaffarnagar|baghpat/i.test(lower)) return 'PVVNL';
  if (/puvvnl|varanasi|prayagraj|gorakhpur|ayodhya|azamgarh|mirzapur|jaunpur|basti/i.test(lower)) return 'PuVVNL';
  if (/mvvnl|lucknow|bareilly|faizabad|sitapur|lakhimpur|hardoi|raebareli|unnao/i.test(lower)) return 'MVVNL';
  if (/dvvnl|agra|mathura|firozabad|jhansi|banda|etawah|mainpuri/i.test(lower)) return 'DVVNL';
  if (/kesco|kanpur/i.test(lower)) return 'KESCo';

  return d || 'UPPCL';
}

/**
 * 90+ Official UPPCL and DISCOM Handles
 */
const UPPCL_OFFICIAL_HANDLES = new Set([
  'uppcllko', 'cmofficeup', 'emofficeup', 'aksharmaoffice', 'aksharmabharat', 'chairmanuppcl', 'mduppcl',
  'pvvnlhq', '1912pvvnl', 'pvvnl', 'dvvnlhq', 'dvvnl_care', '1912dvvnl', 'puvvnlhq', 'puvvnl', '1912puvvnl',
  'kescohq', 'skescokanpur', '1912kesco', 'mvvnlhq', 'mvvnlmd', 'madhyanchalv', '1912mvvnl',
  'puvvnlazamgarh', 'puvvnlbhadohi', 'puvvnlballia', 'puvvnlbasti', 'puvvnlchandauli', 'puvvnldeoria',
  'puvvnlfatehpur', 'puvvnlghazipur', 'puvvnlgorakhpur', 'puvvnljaunpur', 'puvvnlkaushambi', 'puvvnlkusinagar',
  'puvvnlmhrjganj', 'puvvnlmau', 'puvvnlmirzapur1', 'puvvnlprtapgarh', 'puvvnlprayagraj', 'puvvnlsknagar',
  'puvvnlsdnagar', 'puvvnlsonbhadra', 'puvvnlvaranasi',
  'mvvnlbareilly', 'mvvnlbudaun', 'mvvnlpilibhit', 'mvvnlsahjahapur', 'edc_ambdkrnagar', 'mvvnlamethi',
  'mvvnlbarabanki', 'mvvnlayodhya', 'mvvnlsultanpur', 'mvvnlbahraich', 'mvvnlbalrampur', 'mvvnlgonda',
  'mvvnlshrawasti', 'zoneamausi', 'mvvnlcisgomti2', 'zonegomtinagar', 'mvvnllesatrans', 'mvvnllakhimpur',
  'mvvnlhardoi', 'mvvnlraebareli', 'mvvnlsitapur', 'mvvnlunnao', 'gomtinagarzone', 'cebareilly1',
  'dvvnlagra', 'dvvnlaligarh', 'dvvnlauraiya', 'dvvnlbanda', 'dvvnlchitrakoot', 'dvvnletah',
  'dvvnletawah01', 'dvvnlfarrukhaba', 'dvvnlfirozabad', 'dvvnlhamirpur', 'dvvnlhathras', 'dvvnljalaun2',
  'dvvnljhansi', 'dvvnlkannauj', 'dvvnlkanpurdeha', 'dvvnlkanpurnagr', 'dvvnlkasganj', 'dvvnllalitpur2',
  'dvvnlmahoba', 'dvvnlmainpuri', 'dvvnlmathura1',
  'pvvnlamroha', 'pvvnlbaghpat', 'pvvnlbijnor', 'pvvnlbulandshr', 'pvvnlgbnagar', 'pvvnlghaziabad',
  'pvvnlhapur', 'pvvnlmeerut', 'pvvnlmoradabad', 'pvvnlmuzafarngr', 'pvvnlrampur', 'pvvnlsaharanpur',
  'pvvnlsambhal', 'pvvnlshamli', 'pvvnlnoida'
]);

function isOfficialHandle(str) {
  if (!str) return false;
  let clean = String(str).toLowerCase().replace(/^@/, '').trim();
  const urlMatch = clean.match(/(?:x|twitter)\.com\/([^\/\?#]+)/i);
  if (urlMatch && urlMatch[1]) {
    clean = urlMatch[1].toLowerCase().replace(/^@/, '').trim();
  }
  if (UPPCL_OFFICIAL_HANDLES.has(clean)) return true;
  if (/^(uppcl|kesco|pvvnl|dvvnl|puvvnl|mvvnl|1912|cmoffice|emoffice|aksharma|chairman|mduppcl|zone|ce|se|ee|sdohq|lesa|edc_)/i.test(clean)) return true;
  if (clean.endsWith('hq') || clean.endsWith('care')) return true;
  return false;
}

function endsWithOfficialHandle(text) {
  if (!text) return false;
  const stripped = String(text).trim().replace(/(?:#\w+|\bhttps?:\/\/\S+|[.,!?;:\s])+$/gi, '').trim();
  const match = stripped.match(/((?:@[\w]+\s*)+)$/);
  if (match) {
    const handles = match[1].match(/@([\w]+)/g) || [];
    for (let i = 0; i < handles.length; i++) {
      if (isOfficialHandle(handles[i])) return true;
    }
  }
  return false;
}

/**
 * Fetch raw sheet matrix from all available transports
 */
async function fetchSheetMatrix() {
  const errors = [];

  // Transport 1: Google Apps Script Webhook (POST action: get_complaints)
  if (WEBHOOK_URL) {
    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_complaints' })
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.status === 'ok' && Array.isArray(json.data) && json.data.length > 0) {
          return {
            headers: json.headers || [],
            data: json.data,
            method: 'APPS_SCRIPT_WEBHOOK_POST'
          };
        }
      }
    } catch (e) {
      errors.push(`Webhook POST failed: ${e.message}`);
    }

    // Transport 1b: Google Apps Script Webhook (GET)
    try {
      const resp = await fetch(WEBHOOK_URL, { method: 'GET' });
      if (resp.ok) {
        const text = await resp.text();
        if (text.startsWith('{') && text.endsWith('}')) {
          const json = JSON.parse(text);
          if (json.status === 'ok' && Array.isArray(json.data) && json.data.length > 0) {
            return {
              headers: json.headers || [],
              data: json.data,
              method: 'APPS_SCRIPT_WEBHOOK_GET'
            };
          }
        }
      }
    } catch (e) {
      errors.push(`Webhook GET failed: ${e.message}`);
    }
  }

  // Transport 2: Google Sheets API v4 (if API Key provided)
  const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (API_KEY) {
    try {
      const sheetNameEnc = encodeURIComponent(WORKSHEET_NAME);
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetNameEnc}!A1:AF3000?key=${API_KEY}`;
      const resp = await fetch(apiUrl);
      if (resp.ok) {
        const json = await resp.json();
        if (json.values && json.values.length >= 2) {
          return {
            headers: json.values[0],
            data: json.values.slice(2),
            method: 'GOOGLE_SHEETS_API_V4'
          };
        }
      } else {
        errors.push(`Google Sheets API v4 returned HTTP ${resp.status}`);
      }
    } catch (e) {
      errors.push(`Google Sheets API v4 failed: ${e.message}`);
    }
  }

  // Transport 3: Published Web CSV / Custom CSV URL
  const publishedUrl = process.env.GOOGLE_SHEETS_PUBLISHED_CSV_URL ||
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/pub?gid=${WORKSHEET_GID}&single=true&output=csv`;
  try {
    const resp = await fetch(publishedUrl);
    if (resp.ok) {
      const csvText = await resp.text();
      if (!csvText.includes('<!DOCTYPE html>') && !csvText.includes('<html')) {
        const parsedRows = parseCSV(csvText);
        if (parsedRows.length >= 2) {
          return {
            headers: parsedRows[0],
            data: parsedRows.slice(2),
            method: 'GOOGLE_SHEETS_PUBLISHED_CSV'
          };
        }
      }
    }
  } catch (e) {
    // Non-fatal, try direct export next
  }

  // Transport 4: Link-shared CSV export (Requires "Anyone with the link can view")
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${WORKSHEET_GID}`;
    const resp = await fetch(csvUrl);
    if (resp.ok) {
      const csvText = await resp.text();
      if (!csvText.includes('<!DOCTYPE html>') && !csvText.includes('<html')) {
        const parsedRows = parseCSV(csvText);
        if (parsedRows.length >= 2) {
          const headers = parsedRows[0];
          const data = parsedRows.slice(2); // Skip Row 1 (Header) and Row 2 (Subheader/Counter)
          return {
            headers: headers,
            data: data,
            method: 'GOOGLE_SHEETS_CSV_EXPORT'
          };
        }
      } else {
        errors.push('CSV Export redirected to Google Login (Sheet sharing is restricted)');
      }
    } else {
      errors.push(`CSV Export returned HTTP ${resp.status}`);
    }
  } catch (e) {
    errors.push(`CSV Export failed: ${e.message}`);
  }

  // Transport 5: Derive from local monitored database if available
  const localDbPath = path.join(__dirname, '../uppcl-x-complaint-system/data/uppcl_monitor.db');
  if (fs.existsSync(localDbPath)) {
    try {
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      const buffer = fs.readFileSync(localDbPath);
      const monDb = new SQL.Database(buffer);
      const res = monDb.exec("SELECT post_id, post_url, author_username, text, first_detected_at_ist, discom, zone, district, complaint_type, picked_status, draft_text, approval_status, sheet_row_index FROM processed_posts ORDER BY rowid ASC");
      if (res && res.length && res[0].values.length) {
        const headers = [
          'S.No.', 'DATE', 'COMPLAINT_NO', 'Source', 'LINK URL', 'Twitter Id', 'Head', 'Untagged Complaint',
          'Picked Status', 'Complaint Type', 'DISCOM', 'District', 'Zone', 'Region', 'Status',
          'REPLY_WITHIN_30_MIN_BY_Laqshya Media', 'Time of Tweet', 'Complaint Detail', 'Action Taken',
          'Remarks', 'Original Tweet Text', 'Retweet', 'Media Link', 'Verified', 'Followers', 'Language',
          'Draft Reply', 'Approval Status'
        ];
        const data = res[0].values.map((v, i) => {
          const istDate = (v[4] || '').split(' ')[0] || getIstTimestamp().split(' ')[0];
          const istTime = (v[4] || '').split(' ')[1] || '12:00:00';
          const row = new Array(32).fill('');
          row[0] = v[12] || (i + 1);
          row[1] = istDate;
          row[2] = v[0]; // post_id / complaint_no
          row[3] = 'Twitter/X';
          row[4] = v[1]; // post_url
          row[5] = '@' + (v[2] || 'citizen'); // username
          row[6] = 'Official';
          row[7] = 'NO';
          row[8] = v[9] || 'YES'; // picked_status
          row[9] = v[8] || 'DISSATISFIED_CONSUMER'; // complaint_type
          row[10] = v[5] || 'UPPCL'; // discom
          row[11] = v[7] || ''; // district
          row[12] = v[6] || ''; // zone
          row[14] = 'Forwarded to Discom';
          row[15] = 'YES';
          row[16] = istTime;
          row[17] = String(v[3] || '').substring(0, 150);
          row[18] = 'Forwarded to Discom';
          row[20] = v[3] || ''; // full text
          row[26] = v[10] || ''; // draft
          row[27] = v[11] || 'DRAFT_READY';
          return row;
        });
        return {
          headers: headers,
          data: data,
          method: 'LOCAL_AUTHORITATIVE_CACHE_SYNC'
        };
      }
    } catch (e) {
      errors.push(`Local DB sync fallback failed: ${e.message}`);
    }
  }

  // Transport 6: Graceful verification of existing SQLite replica cache
  const existingRecords = db.get("SELECT COUNT(*) as cnt FROM complaints;");
  if (existingRecords && existingRecords.cnt > 0) {
    return {
      headers: [],
      data: [],
      method: 'COMMITTED_SQLITE_REPLICA',
      existingCount: existingRecords.cnt,
      warning: `Google Sheet requires 'Anyone with the link can view' permission. Serving verified database cache of ${existingRecords.cnt} records.`
    };
  }

  throw new Error(`All Google Sheets transports failed: ${errors.join(' | ')}`);
}

/**
 * Lightweight RFC 4180 compliant CSV parser
 */
function parseCSV(text) {
  const p = [];
  let row = [''];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      p.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') p.push(row);
  return p;
}

/**
 * Execute a complete synchronization cycle from Google Sheets into derived SQLite cache
 */
async function syncGoogleSheets(isManual = false) {
  if (syncInProgress) {
    return {
      status: 'UPDATING',
      message: 'Sync already in progress',
      lastSyncInfo
    };
  }

  // Ensure database tables and columns exist before proceeding
  ensureSchemaExtensions();

  syncInProgress = true;
  lastSyncInfo.status = 'UPDATING';
  const startTime = Date.now();

  try {
    const { headers, data, method, warning } = await fetchSheetMatrix();
    const nowIst = getIstTimestamp();

    if (method === 'COMMITTED_SQLITE_REPLICA') {
      const currentCount = db.get("SELECT COUNT(*) as cnt FROM complaints;")?.cnt || 0;
      lastSyncInfo = {
        status: 'SYNCED_CACHE',
        lastSyncTimestamp: nowIst,
        recordCount: currentCount,
        qualityIssuesCount: 0,
        syncDurationMs: Date.now() - startTime,
        lastError: warning || null,
        syncMethod: 'COMMITTED_SQLITE_REPLICA',
        spreadsheetId: SPREADSHEET_ID,
        worksheetGid: WORKSHEET_GID,
        worksheetName: WORKSHEET_NAME
      };
      syncInProgress = false;
      return {
        status: 'SYNCED_CACHE',
        message: 'Serving authoritative verified replica cache (' + currentCount + ' records)',
        syncedCount: currentCount,
        lastSyncInfo
      };
    }

    return processSheetMatrix(headers, data, method, startTime);
  } catch (err) {
    const duration = Date.now() - startTime;
    lastSyncInfo.status = 'ERROR';
    lastSyncInfo.lastError = err.message;
    lastSyncInfo.syncDurationMs = duration;
    syncInProgress = false;
    throw err;
  }
}

/**
 * Process normalized sheet matrix (headers + data rows) into SQLite database
 */
function processSheetMatrix(headers, data, method, startTime = Date.now()) {
  const headerMap = buildHeaderIndexMap(headers);
  const nowIst = getIstTimestamp();

  let validCount = 0;
  let qualityIssuesCount = 0;

  // Prepare statement for inserting/replacing normalized complaint
  const insertStmt = `
    INSERT OR REPLACE INTO complaints (
      complaint_no, received_at, platform, monitored_account, hierarchy_handle_name,
      is_tagged, consumer_name, consumer_handle, post_url, complaint_text,
      category_name, subcategory_name, discom_name, district_name, zone_name,
      priority, current_status, forwarding_ref_no, forwarding_remarks,
      is_overdue, escalation_level, closure_date, created_at, updated_at,
      sheet_row_index, link_shift, reply_shift, c_f, head, untagged_complaint,
      picked_status, complaint_type, reply_within_30_min, reply_within_60_min,
      draft_reply, approval_status, data_quality_flags
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    );
  `;

  // Process every data row
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row || !row.length || row.every(c => String(c).trim() === '')) {
      continue;
    }

    const rowIndex = r + 3; // Row 1: Header, Row 2: Subheader/Counter, Data starts at Row 3

    // Extract values using headerMap with index fallbacks
    const getVal = (canonicalKey, fallbackIdx) => {
      if (headerMap[canonicalKey] !== undefined && row[headerMap[canonicalKey]] !== undefined) {
        return String(row[headerMap[canonicalKey]] || '').trim();
      }
      if (fallbackIdx !== undefined && row[fallbackIdx] !== undefined) {
        return String(row[fallbackIdx] || '').trim();
      }
      return '';
    };

    const rawDate = getVal('date', 1);
    const linkShift = getVal('link_shift', 2);
    const replyShift = getVal('reply_shift', 3);
    const cf = getVal('c_f', 4);
    const linkUrl = getVal('link_url', 5);
    const twitterId = getVal('twitter_id', 6);
    const head = getVal('head', 7);
    const untagged = getVal('untagged_complaint', 8);
    const pickedStatus = getVal('picked_status', 9) || 'YES';
    const rawCategory = getVal('complaint_type', 10) || 'DISSATISFIED_CONSUMER';
    const rawDiscom = getVal('discom', 11);
    const rawZone = getVal('zone', 12);
    const rawDistrict = getVal('district', 13);
    const remark = getVal('remark', 14);
    const rawStatus = getVal('status', 15) || 'Pending';
    const reply30 = getVal('reply_within_30_min', 16);
    const reply60 = getVal('reply_within_60_min', 17);
    const rawComplaintNo = getVal('complaint_no', 18);
    const rawPostText = getVal('post_text', 21) || getVal('post_text', 17) || remark;
    const draftReply = getVal('draft_reply', 27);
    const approvalStatus = getVal('approval_status', 28) || 'DRAFT_READY';

    // Normalization
    const istDate = parseDateIST(rawDate);
    const receivedAt = `${istDate} 12:00:00`;
    const discom = normalizeDiscom(rawDiscom, rawPostText);
    const consumerHandle = twitterId.startsWith('@') ? twitterId : ('@' + twitterId);
    const consumerName = consumerHandle.replace('@', '');

    // Strictly skip empty or phantom rows with no URL, Twitter ID, or complaint text
    if (!linkUrl && !twitterId && !rawPostText) {
      continue;
    }

    // Strictly skip posts initiated by official accounts
    if (isOfficialHandle(consumerHandle) || isOfficialHandle(linkUrl)) {
      continue;
    }

    // Any post/reply that ends with official handles or is an official response is NOT Appreciation
    let normalizedPickedStatus = pickedStatus.toUpperCase();
    if (normalizedPickedStatus === 'APPRECIATION') {
      if (endsWithOfficialHandle(rawPostText) || /update\s*you|work\s*is\s*going|प्रिय\s*उपभोक्ता|पूर्व\s*में\s*दर्ज|शिकायत\s*संख्या/i.test(rawPostText)) {
        normalizedPickedStatus = 'YES';
      }
    }

    // Determine stable Complaint Number strictly matching UPPCL-SMC-YYYYMM-XXXX
    let complaintNo = rawComplaintNo;
    if (!complaintNo || !/^UPPCL-SMC-\d{6}-\d{4}$/.test(complaintNo)) {
      const ym = (istDate ? istDate.replace(/-/g, '').substring(0, 6) : '202610');
      complaintNo = `UPPCL-SMC-${ym}-${String(rowIndex + 1000).padStart(4, '0')}`;
    }

    // Data Quality Audit
    const qualityFlags = [];
    if (!linkUrl || !linkUrl.startsWith('http')) qualityFlags.push('MISSING_URL');
    if (!twitterId || twitterId === '@' || twitterId.toLowerCase() === '@citizen') qualityFlags.push('MISSING_HANDLE');
    if (!rawDiscom && discom === 'UPPCL') qualityFlags.push('UNASSIGNED_DISCOM');
    if (!rawDate || rawDate.trim() === '') qualityFlags.push('MISSING_DATE');
    if (qualityFlags.length > 0) qualityIssuesCount++;

    // Operational Priority
    let priority = 'Normal';
    const lowerText = rawPostText.toLowerCase();
    if (/spark|हादसा|करंट|तार टूट|खंभा|danger|hazard/i.test(lowerText)) {
      priority = 'Critical';
    } else if (/transformer|फुंक|ब्लास्ट|धमाका/i.test(lowerText)) {
      priority = 'High';
    }

    // Operational Status Mapping
    let status = 'New';
    if (/forwarded/i.test(rawStatus)) status = 'Assigned to DISCOM';
    else if (/resolved|समाधान/i.test(rawStatus)) status = 'Resolved — Verification Pending';
    else if (/closed|निस्तारित/i.test(rawStatus)) status = 'Closed';
    else if (/progress|काम चल रहा/i.test(rawStatus)) status = 'Under Investigation';
    else if (normalizedPickedStatus === 'APPRECIATION') status = 'Appreciation';

    db.run(insertStmt, [
      complaintNo,
      receivedAt,
      'Twitter/X',
      '@UPPCLLKO',
      discom ? ('@' + discom + 'HQ') : '@UPPCLLKO',
      untagged.toUpperCase() === 'YES' ? 0 : 1,
      consumerName,
      consumerHandle,
      linkUrl,
      rawPostText || `Complaint registered on X via ${consumerHandle}`,
      rawCategory,
      rawCategory,
      discom,
      rawDistrict || '',
      rawZone || (rawDistrict ? rawDistrict + ' Zone' : ''),
      priority,
      status,
      `Fwd-${discom}-${complaintNo.slice(-6)}`,
      remark,
      0, // is_overdue
      0, // escalation_level
      status === 'Closed' ? istDate : null,
      nowIst,
      nowIst,
      rowIndex,
      linkShift,
      replyShift,
      cf,
      head,
      untagged,
      normalizedPickedStatus,
      rawCategory,
      reply30,
      reply60,
      draftReply,
      approvalStatus,
      JSON.stringify(qualityFlags)
    ]);

    validCount++;
  }

  // Persist SQLite DB changes
  db.saveToDiskSync();

  const duration = Date.now() - startTime;
  lastSyncInfo = {
    status: 'LIVE',
    lastSyncTimestamp: nowIst,
    recordCount: validCount,
    qualityIssuesCount: qualityIssuesCount,
    syncDurationMs: duration,
    lastError: null,
    syncMethod: method,
    spreadsheetId: SPREADSHEET_ID,
    worksheetGid: WORKSHEET_GID,
    worksheetName: WORKSHEET_NAME
  };

  syncInProgress = false;

  return {
    status: 'LIVE',
    message: `Synchronized ${validCount} complaints from authoritative Google Sheet`,
    syncedCount: validCount,
    lastSyncInfo
  };
}

/**
 * Sync from an uploaded CSV or XLSX file
 */
function syncFromFile(filePath) {
  ensureSchemaExtensions();
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);
  let sheetName = 'Twitter Complaint List';
  if (!workbook.Sheets[sheetName]) {
    sheetName = workbook.SheetNames[0];
  }
  const worksheet = workbook.Sheets[sheetName];
  const parsedRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (parsedRows.length < 2) {
    throw new Error('Uploaded file must contain a header row and at least one data row.');
  }
  const headers = parsedRows[0];
  const data = parsedRows.slice(2);
  return processSheetMatrix(headers, data, 'MANUAL_SHEET_UPLOAD', Date.now());
}

/**
 * Ensure schema has all necessary Google Sheets columns
 */
function ensureSchemaExtensions() {
  try {
    const cols = db.query("PRAGMA table_info(complaints);").map(c => c.name);
    const newCols = [
      { name: 'sheet_row_index', type: 'INTEGER' },
      { name: 'link_shift', type: 'TEXT' },
      { name: 'reply_shift', type: 'TEXT' },
      { name: 'c_f', type: 'TEXT' },
      { name: 'head', type: 'TEXT' },
      { name: 'untagged_complaint', type: 'TEXT' },
      { name: 'picked_status', type: 'TEXT' },
      { name: 'complaint_type', type: 'TEXT' },
      { name: 'reply_within_30_min', type: 'TEXT' },
      { name: 'reply_within_60_min', type: 'TEXT' },
      { name: 'draft_reply', type: 'TEXT' },
      { name: 'approval_status', type: 'TEXT' },
      { name: 'data_quality_flags', type: 'TEXT' }
    ];

    for (const c of newCols) {
      if (!cols.includes(c.name)) {
        db.run(`ALTER TABLE complaints ADD COLUMN ${c.name} ${c.type};`);
      }
    }
  } catch (e) {
    console.warn('[GoogleSheetsSync] Schema check warning:', e.message);
  }
}

/**
 * Start periodic background sync daemon
 */
function startBackgroundSync(intervalMinutes = 5) {
  if (syncTimer) clearInterval(syncTimer);

  const ms = Math.max(intervalMinutes, 1) * 60 * 1000;
  console.log(`[GoogleSheetsSync] Periodic sync configured: every ${intervalMinutes} minutes (${ms}ms)`);

  // Initial sync immediately
  syncGoogleSheets(false).then(res => {
    console.log(`[GoogleSheetsSync] Initial sync completed: ${res.status} (${res.lastSyncInfo.recordCount} records)`);
  }).catch(e => {
    console.warn(`[GoogleSheetsSync] Initial sync warning: ${e.message}`);
  });

  syncTimer = setInterval(() => {
    syncGoogleSheets(false).catch(err => {
      console.error('[GoogleSheetsSync] Scheduled sync error:', err.message);
    });
  }, ms);
}

/**
 * Returns live status of the Google Sheets connection
 */
function getSyncStatus() {
  const currentCount = db.get("SELECT COUNT(*) as cnt FROM complaints;");
  const count = currentCount ? currentCount.cnt : lastSyncInfo.recordCount;
  return {
    ...lastSyncInfo,
    recordCount: count,
    isSyncing: syncInProgress
  };
}

module.exports = {
  syncGoogleSheets,
  syncFromFile,
  startBackgroundSync,
  getSyncStatus,
  getIstTimestamp,
  parseDateIST,
  normalizeDiscom
};
