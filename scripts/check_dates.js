const https = require('https');

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/export?format=csv&gid=598922870';

function getCsv(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(getCsv(res.headers.location));
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

function extractDateFromTweetId(tid) {
  if (!tid || !/^\d{15,25}$/.test(tid)) return null;
  try {
    const big = BigInt(tid);
    const ms = Number((big >> 22n) + 1288834974657n);
    const d = new Date(ms + (5.5 * 3600000)); // UTC+5:30
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    if (yyyy >= 2020 && yyyy <= 2030) {
      return `${dd}-${mm}-${yyyy}`;
    }
  } catch (e) {}
  return null;
}

async function main() {
  console.log('Fetching Google Sheet CSV...');
  const csvText = await getCsv(SHEET_CSV_URL);
  const rows = parseCSV(csvText);
  console.log('Total rows fetched:', rows.length);

  const stats = {
    totalDataRows: rows.length - 2,
    year1900Count: 0,
    valid2026Count: 0,
    recoverableFromSnowflake: 0,
    recoverableFromColV: 0,
    otherCount: 0
  };

  const sampleFixes = [];

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const dateCol = (row[0] || '').trim();
    const url = (row[4] || '').trim();
    const tidCol = (row[19] || '').trim();
    const colV = (row[22] || '').trim(); // First Detected At (IST)

    const m = url.match(/status\/(\d+)/i);
    const tid = m ? m[1] : tidCol;

    const recoveredDate = extractDateFromTweetId(tid);

    if (/190[0-9]/.test(dateCol) || /^\d{1,4}$/.test(dateCol)) {
      stats.year1900Count++;
      if (recoveredDate) stats.recoverableFromSnowflake++;
      else if (colV) stats.recoverableFromColV++;

      if (sampleFixes.length < 10) {
        sampleFixes.push({
          row: r + 1,
          currentDateCol: dateCol,
          recoveredDate: recoveredDate || (colV ? colV.split(' ')[0] : '19-10-2026'),
          tweetId: tid,
          url: url
        });
      }
    } else if (dateCol.includes('2026')) {
      stats.valid2026Count++;
    } else {
      stats.otherCount++;
    }
  }

  console.log('\n--- DATE COLUMN ANALYSIS ---');
  console.log('Total Data Rows:', stats.totalDataRows);
  console.log('Rows with 1900-1904 or serial integers:', stats.year1900Count);
  console.log('Rows already with valid 2026 dates:', stats.valid2026Count);
  console.log('Recoverable directly from Snowflake Tweet IDs:', stats.recoverableFromSnowflake);
  console.log('Other / Uncategorized:', stats.otherCount);

  console.log('\nSample Fixes (First 10):');
  console.log(JSON.stringify(sampleFixes, null, 2));
}

main().catch(console.error);
