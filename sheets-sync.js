/**
 * ==============================================================================
 * UPPCL SOCIAL MEDIA CELL — GOOGLE SHEETS SYNCHRONIZATION & BACKFILL ENGINE
 * ==============================================================================
 * Target Spreadsheet ID: 10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY
 * Target Worksheet GID:  598922870
 * Target Column Header:  UPPCLLKO Replied (YES/NO) / UPPCLLKO Replied
 *
 * Official Account Identity:
 *   Twitter/X Account: @UPPCLLKO (ID: 1388484164, handle: UPPCLLKO / uppcllko)
 *
 * Strict Classification Rules:
 *   Rule A -> Mark YES if verified official @UPPCLLKO reply exists anywhere in history.
 *   Rule B -> Mark NO only when complete historical check confirms no reply has ever existed.
 *   Rule C -> Return null (unverified/blank) if check is incomplete, failed, or ambiguous.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const XLSX = require('xlsx');
const db = require('./db');
const { createHeaderMap, indexToColumnLetter } = require('./sheet_mapper');
const { isPostEligible } = require('./eligibility');
const sheetRotationService = require('./sheet_rotation_service');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY';
const WORKSHEET_GID = process.env.GOOGLE_WORKSHEET_GID || '598922870';
const TARGET_HEADER_NAME = 'UPPCLLKO Replied (YES/NO)';

const OFFICIAL_USER_IDS = ['1388484164'];
const OFFICIAL_HANDLES = ['@uppcllko', 'uppcllko'];

/**
 * Fetch remote URL with redirect follow
 */
function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status ${res.statusCode}: ${res.statusMessage}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

/**
 * Extract tweet ID from URL
 */
function extractTweetId(url) {
  if (!url) return '';
  const m = String(url).match(/status\/(\d+)/i);
  return m ? m[1] : '';
}

/**
 * Historical reply evaluator based on multi-source verified evidence
 */
function evaluateHistoricalReply(row, mapper, dbComplaint = null, externalApiResult = null) {
  if (externalApiResult) {
    if (externalApiResult.success) {
      return externalApiResult.hasReply ? 'YES' : 'NO';
    }
    return null;
  }

  const head = mapper.get(row, 'head', '').toLowerCase();
  const reply30 = mapper.get(row, 'reply_within_30_min', '').toUpperCase();
  const reply60 = mapper.get(row, 'reply_within_60_min', '').toUpperCase();
  const replyUrl = mapper.get(row, 'reply_post_url', '').toLowerCase();
  const postText = mapper.get(row, 'post_text', '');
  const linkUrl = mapper.get(row, 'link_url', '');
  const status = mapper.get(row, 'status', '').toLowerCase();

  // 1. Check if sheet already has explicit YES or NO in UPPCLLKO Replied column
  const sheetReplied = mapper.get(row, 'uppcllko_replied', '').toUpperCase();
  if (sheetReplied === 'YES') return 'YES';
  if (sheetReplied === 'NO') return 'NO';

  // 2. Explicit verified reply by official UPPCLLKO in reply URL
  if (replyUrl && (replyUrl.includes('/uppcllko/status/') || replyUrl.includes('uppcllko'))) {
    return 'YES';
  }

  // 3. Check existing database record if verified
  if (dbComplaint) {
    if (dbComplaint.uppcl_replied === 1 || dbComplaint.has_historical_reply === 1 || dbComplaint.uppcllko_replied === 'YES') {
      return 'YES';
    }
  }

  // 4. When Head is 'upl' (@UPPCLLKO official account)
  if (head === 'upl') {
    if (reply30 === 'YES') return 'YES';
    if (reply30 === 'NO') return 'NO';
    return null;
  }

  // 5. For apex heads (@mduppcl, @aksharmaBharat, @AKSharmaOffice, @EMofficeUP)
  const t = postText.toLowerCase();
  const hasUppclMention = t.includes('@uppcllko') || t.includes('uppcl');
  if (hasUppclMention) {
    if (reply30 === 'YES') return 'YES';
    if (reply30 === 'NO') return 'NO';
    return null;
  }

  // 6. If head is not UPPCLLKO and no UPPCLLKO mention was part of conversation
  if (head && head !== 'upl' && !hasUppclMention) {
    // Official UPPCLLKO was not a participant in this conversation
    return 'NO';
  }

  return null;
}

/**
 * Main Sync & Backfill Function
 */
async function syncGoogleSheet({
  csvPath = null,
  updateDatabase = true,
  exportUpdatedSheet = true,
  outputPath = 'google_sheet_updated.csv'
} = {}) {
  const activeSpreadsheetId = sheetRotationService.getActiveSpreadsheetId();
  const activeWorksheetGid = sheetRotationService.getActiveWorksheetGid();
  console.log('===========================================================');
  console.log(' UPPCL SMC Google Sheets Synchronizer & Dynamic Mapper');
  console.log(` Target Spreadsheet: ${activeSpreadsheetId}`);
  console.log(` Target Worksheet GID: ${activeWorksheetGid}`);
  console.log('===========================================================');

  let csvBuffer;

  if (csvPath && fs.existsSync(csvPath)) {
    console.log(`Reading source sheet from local file: ${csvPath}`);
    csvBuffer = fs.readFileSync(csvPath);
  } else {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/export?format=csv&gid=${activeWorksheetGid}`;
    console.log(`Downloading latest authoritative worksheet via: ${exportUrl}`);
    try {
      csvBuffer = await fetchUrl(exportUrl);
      console.log(`Successfully downloaded sheet data (${csvBuffer.length} bytes).`);
      fs.writeFileSync(path.join(__dirname, 'google_sheet_data.csv'), csvBuffer);
    } catch (err) {
      console.error(`Failed to download worksheet: ${err.message}`);
      if (fs.existsSync(path.join(__dirname, 'google_sheet_data.csv'))) {
        console.log('Falling back to previously cached google_sheet_data.csv');
        csvBuffer = fs.readFileSync(path.join(__dirname, 'google_sheet_data.csv'));
      } else {
        throw new Error(`Unable to fetch Google Sheet data and no local cache found: ${err.message}`);
      }
    }
  }

  // Parse workbook
  const wb = XLSX.read(csvBuffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 2) {
    throw new Error('Worksheet contains insufficient rows (header missing)');
  }

  const rawHeaders = rows[0];
  const mapper = createHeaderMap(rawHeaders);

  console.log(`Discovered ${mapper.totalColumns} columns in worksheet.`);
  console.log(`Header Mapping Reliable: ${mapper.isReliable}`);
  if (mapper.missingRequired.length > 0) {
    console.warn(`Missing required headers: ${mapper.missingRequired.join(', ')}`);
  }

  // Derive target column index dynamically
  let targetColIdx = mapper.getIndex('uppcllko_replied');
  let columnAlreadyExisted = targetColIdx !== -1;

  if (columnAlreadyExisted) {
    const letter = indexToColumnLetter(targetColIdx);
    console.log(`Target column "${mapper.getRawHeader('uppcllko_replied')}" found at index ${targetColIdx} (Column ${letter}).`);
  } else {
    targetColIdx = rawHeaders.length;
    rawHeaders.push(TARGET_HEADER_NAME);
    console.log(`Appended new target column "${TARGET_HEADER_NAME}" at index ${targetColIdx} (Column ${indexToColumnLetter(targetColIdx)}).`);
  }

  // Initialize DB if database update requested
  if (updateDatabase) {
    await db.initDb();
  }

  // Snapshot existing complaints for rapid in-memory matching
  const dbComplaintsMap = new Map();
  if (updateDatabase) {
    try {
      const existing = db.query("SELECT id, complaint_no, post_url, original_post_id, uppcl_replied, uppcllko_replied, has_historical_reply FROM complaints;");
      for (const ec of existing) {
        if (ec.post_url) dbComplaintsMap.set(ec.post_url.trim().toLowerCase(), ec);
        if (ec.original_post_id) dbComplaintsMap.set(ec.original_post_id.trim(), ec);
      }
    } catch (e) {}
  }

  // Counters
  let countTotalChecked = 0;
  let countMarkedYes = 0;
  let countMarkedNo = 0;
  let countUnverified = 0;
  let countDatabaseUpdated = 0;

  const columnOnlyLines = [];
  const nowIst = new Date(Date.now() + 5.5 * 3600000).toISOString().replace('T', ' ').substring(0, 19);

  // Row 0 is header
  columnOnlyLines.push(rawHeaders[targetColIdx] || TARGET_HEADER_NAME);

  // Process data rows (row 1 is summary row, actual complaints start at row 2)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const linkUrl = mapper.get(row, 'link_url');
    const twitterId = mapper.get(row, 'twitter_id');
    const postText = mapper.get(row, 'post_text');
    const tid = extractTweetId(linkUrl);

    // Summary row preservation
    if (i === 1 && !linkUrl && !tid && !postText) {
      if (row.length <= targetColIdx) row[targetColIdx] = '';
      columnOnlyLines.push('');
      continue;
    }

    if (!linkUrl && !twitterId && !postText) {
      if (row.length <= targetColIdx) row[targetColIdx] = '';
      columnOnlyLines.push('');
      continue;
    }

    countTotalChecked++;

    // Match with local DB complaint
    let matchedDbComp = null;
    if (linkUrl) {
      matchedDbComp = dbComplaintsMap.get(linkUrl.trim().toLowerCase()) || null;
    }
    if (!matchedDbComp && tid) {
      matchedDbComp = dbComplaintsMap.get(tid) || null;
    }

    // Evaluate historical classification
    const classification = evaluateHistoricalReply(row, mapper, matchedDbComp);

    if (classification === 'YES') {
      row[targetColIdx] = 'YES';
      columnOnlyLines.push('YES');
      countMarkedYes++;
    } else if (classification === 'NO') {
      row[targetColIdx] = 'NO';
      columnOnlyLines.push('NO');
      countMarkedNo++;
    } else {
      row[targetColIdx] = '';
      columnOnlyLines.push('');
      countUnverified++;
    }

    // Update database record if requested
    if (updateDatabase && matchedDbComp && classification) {
      if (matchedDbComp.uppcllko_replied !== classification) {
        try {
          db.run(`
            UPDATE complaints SET
              uppcllko_replied = ?,
              uppcllko_replied_verified_at = ?,
              uppcl_replied = ?,
              updated_at = ?
            WHERE id = ?;
          `, [
            classification,
            nowIst,
            classification === 'YES' ? 1 : 0,
            nowIst,
            matchedDbComp.id
          ]);
          countDatabaseUpdated++;
        } catch (dbErr) {}
      }
    }
  }

  // Save changes to SQLite
  if (updateDatabase) {
    db.saveToDiskSync();
  }

  // Export updated spreadsheet files
  if (exportUpdatedSheet) {
    const updatedWs = XLSX.utils.aoa_to_sheet(rows);
    const updatedWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(updatedWb, updatedWs, sheetName || 'Twitter Complaint List');

    // CSV
    const csvContent = XLSX.utils.sheet_to_csv(updatedWs);
    const resolvedOutputPath = path.join(__dirname, outputPath);
    fs.writeFileSync(resolvedOutputPath, csvContent, 'utf8');
    console.log(`Saved synchronized CSV sheet to: ${resolvedOutputPath}`);

    // XLSX
    const xlsxOutputPath = path.join(__dirname, outputPath.replace(/\.csv$/, '.xlsx'));
    XLSX.writeFile(updatedWb, xlsxOutputPath);
    console.log(`Saved synchronized Excel workbook to: ${xlsxOutputPath}`);

    // Column-only text file for direct pasting into Google Sheets
    const colTextPath = path.join(__dirname, 'uppcllko_replied_column.txt');
    fs.writeFileSync(colTextPath, columnOnlyLines.join('\n'), 'utf8');
    console.log(`Saved column-only paste text (${columnOnlyLines.length} lines) to: ${colTextPath}`);
  }

  const report = {
    spreadsheetId: SPREADSHEET_ID,
    worksheetGid: WORKSHEET_GID,
    targetColumn: rawHeaders[targetColIdx],
    targetColumnIndex: targetColIdx,
    targetColumnLetter: indexToColumnLetter(targetColIdx),
    columnAlreadyExisted,
    totalRows: rows.length,
    totalRecordsChecked: countTotalChecked,
    markedYes: countMarkedYes,
    markedNo: countMarkedNo,
    unverified: countUnverified,
    databaseRecordsUpdated: countDatabaseUpdated,
    timestampIst: nowIst,
    status: 'COMPLETED'
  };

  fs.writeFileSync(path.join(__dirname, 'backfill_report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log('\n--- Backfill & Synchronization Summary ---');
  console.log(`Target Column:              ${rawHeaders[targetColIdx]} (Col ${indexToColumnLetter(targetColIdx)})`);
  console.log(`Total Rows in Sheet:        ${rows.length}`);
  console.log(`Total Posts Inspected:      ${countTotalChecked}`);
  console.log(`Marked UPPCLLKO Replied YES: ${countMarkedYes}`);
  console.log(`Marked UPPCLLKO Replied NO:  ${countMarkedNo}`);
  console.log(`Left Blank (Unverified):     ${countUnverified}`);
  console.log(`SQLite DB Complaints Synced: ${countDatabaseUpdated}`);
  console.log('-------------------------------------------\n');

  return report;
}

// CLI execution
if (require.main === module) {
  const localLatest = path.join(__dirname, 'latest_sheet.csv');
  const sourcePath = fs.existsSync(localLatest) ? localLatest : null;

  syncGoogleSheet({
    csvPath: sourcePath,
    updateDatabase: true,
    exportUpdatedSheet: true
  }).then(report => {
    console.log('Sync process completed successfully.');
    process.exit(0);
  }).catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
}

module.exports = {
  syncGoogleSheet,
  evaluateHistoricalReply,
  TARGET_HEADER_NAME,
  SPREADSHEET_ID,
  WORKSHEET_GID
};
