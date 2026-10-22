const https = require('https');
const { createHeaderMap } = require('../sheet_mapper');
const { isPostEligible } = require('../eligibility');
const { shouldDeleteOrOmitPost } = require('../google_sheets_service');
const db = require('../db');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

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

async function main() {
  await db.initDb();
  const url = 'https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/export?format=csv&gid=598922870';
  const text = await fetchUrl(url);
  const rows = parseCSV(text);
  console.log('Total lines in CSV:', rows.length);

  // Get all post_urls and original_post_ids from current DB
  const dbRows = db.query("SELECT post_url, complaint_no FROM complaints;");
  const dbUrls = new Set();
  const dbTids = new Set();
  for (const r of dbRows) {
    if (r.post_url) {
      dbUrls.add(r.post_url.trim().toLowerCase());
      const m = r.post_url.match(/status\/(\d+)/i);
      if (m && m[1]) dbTids.add(m[1]);
    }
  }
  console.log('Total records in local DB:', dbRows.length);

  const missingFromDb = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length || row.every(c => !String(c).trim())) continue;

    let rowUrl = '';
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim();
      if (/https?:\/\/(?:twitter|x)\.com\/\S+/i.test(cell) || /status\/\d+/i.test(cell)) {
        rowUrl = cell;
        break;
      }
    }

    if (!rowUrl) {
      missingFromDb.push({ sheetRow: i + 1, reason: 'NO_URL_FOUND', sample: row.slice(0, 8) });
      continue;
    }

    const cleanUrl = rowUrl.trim().toLowerCase().split('?')[0];
    const m = cleanUrl.match(/status\/(\d+)/i);
    const tid = m ? m[1] : null;

    if (!dbUrls.has(cleanUrl) && (!tid || !dbTids.has(tid))) {
      missingFromDb.push({ sheetRow: i + 1, reason: 'NOT_IN_DB', url: rowUrl, tid, sample: row.slice(0, 15) });
    }
  }

  console.log(`Total rows missing from DB: ${missingFromDb.length}`);
  console.log(JSON.stringify(missingFromDb, null, 2));
}

main().catch(console.error);
