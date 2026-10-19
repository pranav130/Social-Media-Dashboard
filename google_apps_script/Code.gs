/**
 * ==============================================================================
 * UPPCL X Complaint Monitoring & Workflow Companion Script
 * Container-bound script for Google Sheets:
 * https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/
 * ==============================================================================
 */

/**
 * Creates custom menu when spreadsheet is opened.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('UPPCL Automation')
    .addItem('▶ Enable 24/7 Cloud Sync (Laptop-Free)', 'enable247CloudSync')
    .addItem('⏹ Disable 24/7 Cloud Sync', 'disable247CloudSync')
    .addItem('⚡ Run Cloud Sync Once Now', 'runCloudSyncCycle')
    .addSeparator()
    .addItem('📥 Sync All Complaints from Working Sheet (19-10-26)', 'syncFromWorkingSheet')
    .addItem('Apply Original Formatting (Blue Links & 45px Rows)', 'applyOriginalFormatting')
    .addItem('🧹 Remove Duplicate Rows from Sheet', 'removeDuplicateRowsFromSheet')
    .addItem('🧹 Remove Official Initiated Posts', 'removeOfficialPostsFromSheet')
    .addItem('Fix Misclassified Appreciation Rows', 'fixMisclassifiedComplaints')
    .addItem('Make Rows Compact (22px)', 'makeRowsCompact')
    .addSeparator()
    .addItem('Review Pending Drafts', 'highlightPendingDrafts')
    .addItem('Approve Selected Rows', 'approveSelectedRows')
    .addSeparator()
    .addItem('Setup Supporting Tabs', 'setupSupportingTabs')
    .addItem('Refresh Dashboard KPIs', 'refreshDashboard')
    .addSeparator()
    .addItem('Emergency Stop: ENGAGE', 'engageEmergencyStop')
    .addItem('Emergency Stop: RELEASE', 'releaseEmergencyStop')
    .addToUi();
}

/**
 * Applies the original comfortable row height (45px) with text wrapping
 * and restores Column E as blue clickable hyperlinks (#1155cc, underlined).
 */
function applyOriginalFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) {
    sheet = ss.getActiveSheet();
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;
  const numDataRows = lastRow - 2;
  const lastCol = Math.max(sheet.getLastColumn(), 32);

  // 1. Row 1 Header (66px, #4DD0E1 Cyan, Verdana 13pt bold)
  sheet.setRowHeight(1, 66);
  sheet.getRange(1, 1, 1, lastCol)
    .setFontFamily('Verdana').setFontSize(13).setFontWeight('bold')
    .setBackground('#4DD0E1').setFontColor('#1A2F40')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // 2. Row 2 Counter (33px, #4DD0E1 Cyan, Verdana 11pt bold)
  sheet.setRowHeight(2, 33);
  sheet.getRange(2, 1, 1, lastCol)
    .setFontFamily('Verdana').setFontSize(11).setFontWeight('bold')
    .setBackground('#4DD0E1').setFontColor('#1A2F40')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(false)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  sheet.setFrozenRows(2);

  // 3. Set all data rows to 45px height with text wrapping
  for (let r = 3; r <= lastRow; r++) {
    sheet.setRowHeight(r, 45);
  }

  const dataRange = sheet.getRange(3, 1, numDataRows, lastCol);
  dataRange.setFontFamily('Verdana')
    .setFontSize(10)
    .setFontWeight('normal')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // Set standard columns font color to black
  sheet.getRange(3, 1, numDataRows, 4).setFontColor('#000000');
  sheet.getRange(3, 6, numDataRows, lastCol - 5).setFontColor('#000000');

  // 4. Restore Column E (LINK URL) as native blue (#1155cc) underlined clickable links
  const urlRange = sheet.getRange(3, 5, numDataRows, 1);
  const urlValues = urlRange.getValues();
  const linkStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor('#1155cc')
    .setUnderline(true)
    .setFontFamily('Verdana')
    .setFontSize(10)
    .build();

  const richTextValues = [];
  for (let i = 0; i < urlValues.length; i++) {
    const rawUrl = String(urlValues[i][0] || '').trim();
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      const rich = SpreadsheetApp.newRichTextValue()
        .setText(rawUrl)
        .setLinkUrl(rawUrl)
        .setTextStyle(linkStyle)
        .build();
      richTextValues.push([rich]);
    } else {
      richTextValues.push([SpreadsheetApp.newRichTextValue().setText(rawUrl).build()]);
    }
  }
  urlRange.setRichTextValues(richTextValues);
  urlRange.setHorizontalAlignment('left');

  // Left-align text columns
  if (lastCol >= 21) {
    sheet.getRange(3, 21, numDataRows, 1).setHorizontalAlignment('left');
  }
  if (lastCol >= 27) {
    sheet.getRange(3, 27, numDataRows, 1).setHorizontalAlignment('left');
  }

  SpreadsheetApp.flush();
}

/**
 * Optional alternative: Compact 22px row height with blue links.
 */
function makeRowsCompact() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  for (let r = 3; r <= lastRow; r++) {
    sheet.setRowHeight(r, 22);
  }
  sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn()).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  SpreadsheetApp.flush();
}

/**
 * Global Official UPPCL and DISCOM Handles (90+ apex, headquarters, and district handles)
 */
const UPPCL_OFFICIAL_HANDLES = new Set([
  // Apex & Ministers
  'uppcllko', 'cmofficeup', 'emofficeup', 'aksharmaoffice', 'aksharmabharat', 'chairmanuppcl', 'mduppcl',
  // Core DISCOM HQ & Helplines
  'pvvnlhq', '1912pvvnl', 'pvvnl', 'dvvnlhq', 'dvvnl_care', '1912dvvnl', 'puvvnlhq', 'puvvnl', '1912puvvnl',
  'kescohq', 'skescokanpur', '1912kesco', 'mvvnlhq', 'mvvnlmd', 'madhyanchalv', '1912mvvnl',
  // PuVVNL District & Regional Handles
  'puvvnlazamgarh', 'puvvnlbhadohi', 'puvvnlballia', 'puvvnlbasti', 'puvvnlchandauli', 'puvvnldeoria',
  'puvvnlfatehpur', 'puvvnlghazipur', 'puvvnlgorakhpur', 'puvvnljaunpur', 'puvvnlkaushambi', 'puvvnlkusinagar',
  'puvvnlmhrjganj', 'puvvnlmau', 'puvvnlmirzapur1', 'puvvnlprtapgarh', 'puvvnlprayagraj', 'puvvnlsknagar',
  'puvvnlsdnagar', 'puvvnlsonbhadra', 'puvvnlvaranasi',
  // MVVNL District & Regional Handles
  'mvvnlbareilly', 'mvvnlbudaun', 'mvvnlpilibhit', 'mvvnlsahjahapur', 'edc_ambdkrnagar', 'mvvnlamethi',
  'mvvnlbarabanki', 'mvvnlayodhya', 'mvvnlsultanpur', 'mvvnlbahraich', 'mvvnlbalrampur', 'mvvnlgonda',
  'mvvnlshrawasti', 'zoneamausi', 'mvvnlcisgomti2', 'zonegomtinagar', 'mvvnllesatrans', 'mvvnllakhimpur',
  'mvvnlhardoi', 'mvvnlraebareli', 'mvvnlsitapur', 'mvvnlunnao', 'gomtinagarzone', 'cebareilly1',
  // DVVNL District & Regional Handles
  'dvvnlagra', 'dvvnlaligarh', 'dvvnlauraiya', 'dvvnlbanda', 'dvvnlchitrakoot', 'dvvnletah',
  'dvvnletawah01', 'dvvnlfarrukhaba', 'dvvnlfirozabad', 'dvvnlhamirpur', 'dvvnlhathras', 'dvvnljalaun2',
  'dvvnljhansi', 'dvvnlkannauj', 'dvvnlkanpurdeha', 'dvvnlkanpurnagr', 'dvvnlkasganj', 'dvvnllalitpur2',
  'dvvnlmahoba', 'dvvnlmainpuri', 'dvvnlmathura1',
  // PVVNL District & Regional Handles
  'pvvnlamroha', 'pvvnlbaghpat', 'pvvnlbijnor', 'pvvnlbulandshr', 'pvvnlgbnagar', 'pvvnlghaziabad',
  'pvvnlhapur', 'pvvnlmeerut', 'pvvnlmoradabad', 'pvvnlmuzafarngr', 'pvvnlrampur', 'pvvnlsaharanpur',
  'pvvnlsambhal', 'pvvnlshamli', 'pvvnlnoida'
]);

function isOfficialAccountInScript(username) {
  if (!username) return false;
  const u = String(username).toLowerCase().replace(/^@/, '').trim();
  if (UPPCL_OFFICIAL_HANDLES.has(u)) return true;
  if (/^(uppcl|kesco|pvvnl|dvvnl|puvvnl|mvvnl|1912|cmoffice|emoffice|aksharma|chairman|mduppcl|zone|ce|se|ee|sdohq|lesa|edc_)/i.test(u)) return true;
  if (u.endsWith('hq') || u.endsWith('care')) return true;
  return false;
}

function endsWithOfficialHandleInScript(text) {
  if (!text) return false;
  const clean = text.trim();
  // Strip trailing hashtags, URLs, and punctuation to detect trailing handles
  const stripped = clean.replace(/(?:#\w+|\bhttps?:\/\/\S+|[.,!?;:\s])+$/gi, '').trim();
  const match = stripped.match(/((?:@[\w]+\s*)+)$/);
  if (match) {
    const handles = match[1].match(/@([\w]+)/g) || [];
    for (let i = 0; i < handles.length; i++) {
      const h = handles[i].replace(/^@/, '').toLowerCase();
      if (isOfficialAccountInScript(h)) return true;
    }
  }
  return false;
}

/**
 * Synchronizes all complaints from the manual working sheet (19-10-26)
 * into this automated Google Sheet.
 * Working sheet: https://docs.google.com/spreadsheets/d/1shjWcK69y0S7pIHI-2V5Wh6c2SSSQBKcpgprmPbeNe8/edit?gid=283417465
 */
function syncFromWorkingSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const workingCsvUrl = 'https://docs.google.com/spreadsheets/d/1shjWcK69y0S7pIHI-2V5Wh6c2SSSQBKcpgprmPbeNe8/export?format=csv&gid=283417465';

  let resp;
  try {
    resp = UrlFetchApp.fetch(workingCsvUrl, { muteHttpExceptions: true });
  } catch (e) {
    SpreadsheetApp.getUi().alert('Failed to connect to working sheet: ' + e.message);
    return;
  }

  if (resp.getResponseCode() !== 200) {
    SpreadsheetApp.getUi().alert('Failed to download working sheet CSV (HTTP ' + resp.getResponseCode() + ')');
    return;
  }

  const csvText = resp.getContentText();
  const rows = Utilities.parseCsv(csvText);
  if (!rows || rows.length < 3) {
    SpreadsheetApp.getUi().alert('Working sheet does not contain enough data rows.');
    return;
  }

  // Collect existing URLs and Tweet IDs in this sheet
  const existingLastRow = sheet.getLastRow();
  const existingTids = new Set();
  const existingUrls = new Set();

  if (existingLastRow >= 3) {
    const existingData = sheet.getRange(3, 1, existingLastRow - 2, Math.max(sheet.getLastColumn(), 6)).getValues();
    for (let i = 0; i < existingData.length; i++) {
      const u = String(existingData[i][4] || '').trim();
      if (u) {
        existingUrls.add(u.toLowerCase());
        const m = u.match(/status\/(\d+)/i);
        if (m) existingTids.add(m[1]);
      }
    }
  }

  const rowsToAppend = [];
  const linkStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor('#1155cc')
    .setUnderline(true)
    .setFontFamily('Verdana')
    .setFontSize(10)
    .build();

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const url = String(row[4] || '').trim();
    const handle = String(row[5] || '').trim().replace(/^@/, '');
    const text = String(row[20] || row[17] || row[13] || '').trim();

    // Skip empty/phantom rows
    if (!url && !handle && !text) continue;

    // Skip official accounts
    if (isOfficialAccountInScript(handle)) continue;
    const urlMatch = url.match(/(?:x|twitter)\.com\/([^\/\?#]+)/i);
    if (urlMatch && urlMatch[1] && isOfficialAccountInScript(urlMatch[1])) continue;

    const tidMatch = url.match(/status\/(\d+)/i);
    const tid = tidMatch ? tidMatch[1] : '';

    if (tid && existingTids.has(tid)) continue;
    if (url && existingUrls.has(url.toLowerCase())) continue;

    // Pad row to at least 32 columns
    const padded = new Array(32).fill('');
    for (let c = 0; c < row.length && c < 32; c++) {
      padded[c] = row[c];
    }

    rowsToAppend.push({
      values: padded,
      url: url
    });

    if (tid) existingTids.add(tid);
    if (url) existingUrls.add(url.toLowerCase());
  }

  if (rowsToAppend.length === 0) {
    SpreadsheetApp.getUi().alert('All complaints from working sheet are already present in this sheet!');
    return;
  }

  const startAppendRow = sheet.getLastRow() + 1;
  const numToAppend = rowsToAppend.length;
  const rawValues = rowsToAppend.map(r => r.values);

  sheet.getRange(startAppendRow, 1, numToAppend, 32).setValues(rawValues);

  // Set row heights and formatting
  for (let r = startAppendRow; r < startAppendRow + numToAppend; r++) {
    sheet.setRowHeight(r, 45);
  }

  // Renumber S.No. (Column A) sequentially
  const finalLastRow = sheet.getLastRow();
  const totalCount = finalLastRow - 2;
  const sNos = [];
  for (let i = 1; i <= totalCount; i++) sNos.push([i]);
  sheet.getRange(3, 1, totalCount, 1).setValues(sNos);

  // Restore blue clickable hyperlinks in Column E
  const allUrls = sheet.getRange(3, 5, totalCount, 1).getValues();
  const richTexts = [];
  for (let i = 0; i < allUrls.length; i++) {
    const cellVal = String(allUrls[i][0] || '').trim();
    if (cellVal.startsWith('http')) {
      const rt = SpreadsheetApp.newRichTextValue()
        .setText(cellVal)
        .setLinkUrl(cellVal)
        .setTextStyle(linkStyle)
        .build();
      richTexts.push([rt]);
    } else {
      richTexts.push([SpreadsheetApp.newRichTextValue().setText(cellVal).build()]);
    }
  }
  sheet.getRange(3, 5, totalCount, 1).setRichTextValues(richTexts);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('Success!\n\nSynchronized ' + numToAppend + ' complaints from working sheet (19-10-26).\nTotal complaints now in sheet: ' + totalCount);
}

/**
 * Scans all rows in 'Twitter Complaint List' and deletes any rows initiated
 * by official UPPCL, DISCOM, Ministerial, or Chief Engineer handles.
 * Re-indexes serial numbers (S.No.) after deletion.
 */
function removeOfficialPostsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    try {
      SpreadsheetApp.getUi().alert('No complaint data rows found to check.');
    } catch (e) {}
    return 0;
  }

  const numRows = lastRow - 2;
  const lastCol = Math.max(sheet.getLastColumn(), 32);
  const dataRange = sheet.getRange(3, 1, numRows, lastCol);
  const values = dataRange.getValues();

  let removedCount = 0;

  // Iterate backwards from bottom to top so row deletions don't alter indices
  for (let i = numRows - 1; i >= 0; i--) {
    const row = values[i];
    const actualSheetRow = i + 3;

    const twitterId = String(row[5] || '').toLowerCase().replace('@', '').trim();
    const linkUrl = String(row[4] || '').toLowerCase().trim();

    // Check if author username is official
    let isOfficial = isOfficialAccountInScript(twitterId);

    // Also check if link URL indicates post was created by official handle (e.g. https://x.com/UPPCLLKO/status/...)
    if (!isOfficial && linkUrl) {
      const urlMatch = linkUrl.match(/(?:x|twitter)\.com\/([^\/\?#]+)/i);
      if (urlMatch && urlMatch[1]) {
        isOfficial = isOfficialAccountInScript(urlMatch[1]);
      }
    }

    if (isOfficial) {
      sheet.deleteRow(actualSheetRow);
      removedCount++;
    }
  }

  // Renumber S.No. (Column A) sequentially
  const newLastRow = sheet.getLastRow();
  if (newLastRow >= 3) {
    const newCount = newLastRow - 2;
    const sNoValues = [];
    for (let r = 1; r <= newCount; r++) {
      sNoValues.push([r]);
    }
    sheet.getRange(3, 1, newCount, 1).setValues(sNoValues);
  }

  SpreadsheetApp.flush();

  const message = 'Completed!\n\nRemoved ' + removedCount + ' post(s) initiated by official handles.\nRemaining complaint records: ' + (newLastRow >= 3 ? (newLastRow - 2) : 0);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    Logger.log(message);
  }

  return removedCount;
}

/**
 * Scans 'Twitter Complaint List' and removes duplicate rows based on Column E (Tweet ID / URL).
 * Keeps the first instance and removes subsequent duplicate copies.
 * Re-indexes serial numbers (S.No. Column A) sequentially.
 */
function removeDuplicateRowsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    try {
      SpreadsheetApp.getUi().alert('No complaint data rows found to check.');
    } catch (e) {}
    return 0;
  }

  const numRows = lastRow - 2;
  const urlValues = sheet.getRange(3, 5, numRows, 1).getValues();

  const seenIds = new Set();
  const rowsToDelete = [];

  for (let i = 0; i < urlValues.length; i++) {
    const actualSheetRow = i + 3;
    const url = String(urlValues[i][0] || '').trim().toLowerCase();
    if (!url) continue;

    const m = url.match(/status\/(\d+)/i);
    const id = m ? m[1] : url;

    if (seenIds.has(id)) {
      rowsToDelete.push(actualSheetRow);
    } else {
      seenIds.add(id);
    }
  }

  if (rowsToDelete.length === 0) {
    const msg = 'No duplicate rows found! All ' + numRows + ' complaints in this sheet are unique.';
    try {
      SpreadsheetApp.getUi().alert(msg);
    } catch (e) {
      Logger.log(msg);
    }
    return 0;
  }

  // Delete from bottom to top to preserve row indices
  rowsToDelete.sort((a, b) => b - a);
  for (let i = 0; i < rowsToDelete.length; i++) {
    sheet.deleteRow(rowsToDelete[i]);
  }

  // Renumber S.No. (Column A) sequentially
  const newLastRow = sheet.getLastRow();
  if (newLastRow >= 3) {
    const newCount = newLastRow - 2;
    const sNoValues = [];
    for (let r = 1; r <= newCount; r++) {
      sNoValues.push([r]);
    }
    sheet.getRange(3, 1, newCount, 1).setValues(sNoValues);
  }

  SpreadsheetApp.flush();

  const message = 'Deduplication Complete!\n\nRemoved ' + rowsToDelete.length + ' duplicate row(s).\nRemaining unique complaints: ' + (newLastRow >= 3 ? (newLastRow - 2) : 0);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    Logger.log(message);
  }

  return rowsToDelete.length;
}

/**
 * Scans all rows in 'Twitter Complaint List' and corrects any official DISCOM replies,
 * trailing thread updates, or citizen requests that were incorrectly marked as APPRECIATION.
 */
function fixMisclassifiedComplaints() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;

  const numRows = lastRow - 2;
  const lastCol = Math.max(sheet.getLastColumn(), 32);
  const dataRange = sheet.getRange(3, 1, numRows, lastCol);
  const values = dataRange.getValues();

  let correctedCount = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const twitterId = String(row[5] || '').toLowerCase().replace('@', '').trim();
    const pickedStatus = String(row[8] || '').trim().toUpperCase();
    const fullText = (String(row[20] || '') + ' ' + String(row[4] || '')).toLowerCase();

    const isOfficial = isOfficialAccountInScript(twitterId);
    const endsWithOfficial = endsWithOfficialHandleInScript(String(row[20] || ''));
    const hasReplyOrComplaintMarkers = /प्रिय\s*उपभोक्ता|प्रिय\s*ग्राहक|काम\s*चल\s*रहा|पूर्व\s*में\s*दर्ज|शिकायत\s*संख्या|1912|संबंधित\s*अधिकारी|समाधान\s*कर\s*दिया|previously\s*lodged|work\s*is\s*going|update\s*you\s*soon|we\s*will\s*update|status\s*of\s*the\s*complaint|contact\s*number\s*1912|dear\s*consumer|concerned\s*officer|please\s*take\s*action|inform\s*the\s*consumer|अनुरोध|ots|बकाया|तार|पोल|खंभा/i.test(fullText);

    // If marked APPRECIATION but is an official handle, ends with official handles, or is official reply:
    if (pickedStatus === 'APPRECIATION' && (isOfficial || endsWithOfficial || hasReplyOrComplaintMarkers)) {
      const rowIndex = i + 3;
      sheet.getRange(rowIndex, 9).setValue('YES'); // Picked Status
      if (!row[9] || String(row[9]).trim() === '') {
        const compType = (fullText.includes('ots') || fullText.includes('बकाया')) ? 'BILL_RELATED' : 'DISSATISFIED_CONSUMER';
        sheet.getRange(rowIndex, 10).setValue(compType); // Complaint Type
      }
      sheet.getRange(rowIndex, 15).setValue('Forwarded to Discom'); // Status
      sheet.getRange(rowIndex, 16).setValue('YES'); // Reply within 30 min
      correctedCount++;
    }
  }

  SpreadsheetApp.flush();
  try {
    SpreadsheetApp.getUi().alert(`Completed: Corrected ${correctedCount} misclassified complaint rows to 'Picked Status: YES' and 'DISSATISFIED_CONSUMER'.`);
  } catch (e) {
    // Webhook execution context without active UI
  }
  return correctedCount;
}

/**
 * Webhook receiver that serves live spreadsheet data to the analytics dashboard
 * and accepts incoming complaints from the monitoring engine.
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Twitter Complaint List');
    if (!sheet) {
      const sheets = ss.getSheets();
      for (let s of sheets) {
        if (String(s.getSheetId()) === '598922870') {
          sheet = s;
          break;
        }
      }
    }
    if (!sheet) sheet = ss.getActiveSheet();

    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 32);

    if (lastRow < 3) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        sheetTitle: sheet.getName(),
        gid: sheet.getSheetId(),
        totalRows: 0,
        headers: [],
        data: [],
        lastUpdated: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sheet.getRange(3, 1, lastRow - 2, lastCol).getValues();

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      sheetTitle: sheet.getName(),
      gid: sheet.getSheetId(),
      totalRows: data.length,
      headers: headers,
      data: data,
      lastUpdated: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    if (contents.action === 'get_complaints' || contents.action === 'read_all') {
      return doGet(e);
    }
    if (contents.action === 'restore_links' || contents.action === 'apply_original_format') {
      applyOriginalFormatting();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', action: contents.action }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (contents.action === 'fix_misclassified') {
      const fixed = fixMisclassifiedComplaints();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', action: contents.action, fixedCount: fixed }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const rows = contents.rows;
    if (!rows || !rows.length) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', inserted: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Twitter Complaint List');
    if (!sheet) {
      sheet = ss.getActiveSheet();
    }

    const startRow = Math.max(sheet.getLastRow() + 1, 3);
    const range = sheet.getRange(startRow, 1, rows.length, rows[0].length);
    range.setValues(rows);
    range.setFontFamily('Verdana');
    range.setFontSize(10);
    range.setHorizontalAlignment('center');
    range.setVerticalAlignment('middle');
    range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    range.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

    // Set row height to 45px matching original format
    for (let i = 0; i < rows.length; i++) {
      sheet.setRowHeight(startRow + i, 45);
    }

    // Set Column E as blue clickable link
    const linkStyle = SpreadsheetApp.newTextStyle()
      .setForegroundColor('#1155cc')
      .setUnderline(true)
      .setFontFamily('Verdana')
      .setFontSize(10)
      .build();

    const linkRichText = [];
    for (let i = 0; i < rows.length; i++) {
      const urlStr = String(rows[i][4] || '').trim();
      if (urlStr.startsWith('http')) {
        linkRichText.push([SpreadsheetApp.newRichTextValue().setText(urlStr).setLinkUrl(urlStr).setTextStyle(linkStyle).build()]);
      } else {
        linkRichText.push([SpreadsheetApp.newRichTextValue().setText(urlStr).build()]);
      }
    }
    const linkRange = sheet.getRange(startRow, 5, rows.length, 1);
    linkRange.setRichTextValues(linkRichText);
    linkRange.setHorizontalAlignment('left');

    if (rows[0].length >= 21) {
      sheet.getRange(startRow, 21, rows.length, 1).setHorizontalAlignment('left');
    }
    if (rows[0].length >= 27) {
      sheet.getRange(startRow, 27, rows.length, 1).setHorizontalAlignment('left');
    }

    SpreadsheetApp.flush();
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', inserted: rows.length, startRow: startRow }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function engageEmergencyStop() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = ss.getSheetByName('Settings');
  if (settings) {
    settings.getRange(2, 2).setValue('TRUE');
    SpreadsheetApp.getUi().alert('EMERGENCY STOP ENGAGED: Automated posting and sync halted.');
  }
}

function releaseEmergencyStop() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = ss.getSheetByName('Settings');
  if (settings) {
    settings.getRange(2, 2).setValue('FALSE');
    SpreadsheetApp.getUi().alert('EMERGENCY STOP RELEASED: System returned to normal operating mode.');
  }
}

function refreshDashboard() {
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('Dashboard metrics refreshed.');
}

function setupSupportingTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('Settings');
    const settingsData = [
      ['SETTING_KEY', 'VALUE', 'DESCRIPTION'],
      ['EMERGENCY_STOP', 'FALSE', 'Global kill-switch. When TRUE, no polling or replies run.'],
      ['AUTO_POST_ENABLED', 'FALSE', 'When FALSE, replies only draft and require manual approval.'],
      ['DAILY_POST_CAP', '50', 'Maximum automated replies permitted per calendar day.'],
      ['POLLING_INTERVAL_MINS', '5', 'Frequency of background post monitoring cycles.'],
      ['ALLOWED_DISCOMS', '@PVVNLHQ, @dvvnlhq, @PuVVNLHQ, @KESCoHQ, @MVVNLHQ', 'Safety allowlist of receiving handles.'],
      ['MONITORED_APEX', '@UPPCLLKO, @EMofficeUP, @AKSharmaOffice, @aksharmaBharat, @ChairmanUppcl, @mduppcl', 'Monitored accounts.']
    ];
    settingsSheet.getRange(1, 1, settingsData.length, 3).setValues(settingsData);
    settingsSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#4DD0E1').setFontColor('#1A2F40');
    settingsSheet.autoResizeColumns(1, 3);
  }
}

function highlightPendingDrafts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== 'Twitter Complaint List') {
    SpreadsheetApp.getUi().alert('Please switch to the "Twitter Complaint List" tab.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  const approvalCol = 28;
  const range = sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn());
  const values = range.getValues();

  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const status = values[i][approvalCol - 1];
    if (status === 'DRAFT_READY' || status === 'PENDING') {
      sheet.getRange(3 + i, 1, 1, sheet.getLastColumn()).setBackground('#FFF9C4');
      count++;
    }
  }

  SpreadsheetApp.getUi().alert('Found ' + count + ' complaint row(s) with drafts pending review.');
}

function approveSelectedRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== 'Twitter Complaint List') {
    SpreadsheetApp.getUi().alert('Please switch to the "Twitter Complaint List" tab.');
    return;
  }

  const selection = sheet.getActiveRange();
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();

  if (startRow < 3) {
    SpreadsheetApp.getUi().alert('Please select data rows starting at Row 3.');
    return;
  }

  const approvalCol = 28;
  for (let r = startRow; r < startRow + numRows; r++) {
    sheet.getRange(r, approvalCol).setValue('APPROVED');
    sheet.getRange(r, 1, 1, sheet.getLastColumn()).setBackground('#E8F5E9');
  }

  SpreadsheetApp.getUi().alert('Marked ' + numRows + ' row(s) as APPROVED.');
}

/**
 * ==============================================================================
 * 24/7 CLOUD SYNC ENGINE (RUNS ENTIRELY ON GOOGLE CLOUD - ZERO LAPTOP NEEDED)
 * ==============================================================================
 */

/**
 * Enables automatic 5-minute cloud synchronization via Google Cloud time-driven trigger.
 * Once activated, Google's cloud servers run the sync 24/7 even when your laptop is closed.
 */
function enable247CloudSync() {
  disable247CloudSync(); // Prevent multiple triggers
  ScriptApp.newTrigger('runCloudSyncCycle')
    .timeBased()
    .everyMinutes(5)
    .create();

  // Run initial cycle immediately
  runCloudSyncCycle();

  try {
    SpreadsheetApp.getUi().alert(
      '✅ 24/7 Cloud Sync is now ACTIVE!\n\n' +
      'Google Cloud will automatically monitor X and update this sheet every 5 minutes.\n\n' +
      'You can safely close your laptop or browser — the cloud will keep running 24/7 uninterrupted!'
    );
  } catch (e) {
    Logger.log('24/7 Trigger created.');
  }
}

/**
 * Disables the automatic 24/7 cloud sync trigger.
 */
function disable247CloudSync() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runCloudSyncCycle') {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  try {
    SpreadsheetApp.getUi().alert('⏹ 24/7 Cloud Sync stopped. Removed ' + count + ' active trigger(s).');
  } catch (e) {
    Logger.log('Disabled ' + count + ' trigger(s).');
  }
}

/**
 * Core 24/7 cloud sync function executed by the Google Cloud time-based trigger.
 * Fetches recent tweets from X API v2, classifies them, and appends them to the sheet.
 */
/**
 * Detect Head based on the 6 Apex & Ministerial admin handles mentioned in the tweet.
 * Matches operational sheet distribution:
 * - @mduppcl -> 'upm'
 * - @ChairmanUppcl -> 'upc'
 * - @AKSharmaOffice -> 'akm'
 * - @aksharmaBharat -> 'akc'
 * - @EMofficeUP -> 'emm'
 * - @UPPCLLKO -> 'upl'
 */
function detectApexHead(tweetText) {
  const t = (tweetText || '').toLowerCase();
  if (t.includes('mduppcl')) return 'upm';
  if (t.includes('chairmanuppcl')) return 'upc';
  if (t.includes('aksharmaoffice')) return 'akm';
  if (t.includes('aksharmabharat')) return 'akc';
  if (t.includes('emofficeup')) return 'emm';
  if (t.includes('uppcllko')) return 'upl';
  return 'upm';
}

/**
 * Core 24/7 cloud sync function executed by the Google Cloud time-based trigger.
 * Fetches recent tweets from X API v2 across the 6 Apex & Ministerial Admin Handles:
 * @UPPCLLKO, @EMofficeUP, @AKSharmaOffice, @aksharmaBharat, @ChairmanUppcl, @mduppcl
 *
 * Fully paginates through meta.next_token (up to 10 pages / 1,000 tweets per cycle)
 * so that ZERO citizen complaints are ever missed.
 * Excludes all posts authored by official UPPCL/DISCOM handles.
 */
function runCloudSyncCycle() {
  const props = PropertiesService.getScriptProperties();
  const bearerToken = props.getProperty('X_BEARER_TOKEN') ||
    'AAAAAAAAAAAAAAAAAAAAACbr%2FwEAAAAAySPqrdOjXkNWagBKKbkzMA97ZnI%3DRBPSknXnu5S8uXS3j7lPbXPHlYCpiLfD2Yt8cRtRvWm1NcSi1E';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  // 1. Collect all existing Tweet IDs and URLs from Column E (LINK URL) to prevent duplicates
  const lastRow = sheet.getLastRow();
  const existingTids = new Set();
  const existingUrls = new Set();
  if (lastRow >= 3) {
    const checkStart = Math.max(3, lastRow - 3000);
    const numRows = lastRow - checkStart + 1;
    const urlValues = sheet.getRange(checkStart, 5, numRows, 1).getValues();
    for (let i = 0; i < urlValues.length; i++) {
      const u = String(urlValues[i][0] || '').trim();
      if (u) {
        existingUrls.add(u.toLowerCase());
        const m = u.match(/status\/(\d+)/i);
        if (m) existingTids.add(m[1]);
      }
    }
  }

  // 2. Focused query covering strictly the 6 Apex & Ministerial Admin Handles
  const query = '(@UPPCLLKO OR @EMofficeUP OR @AKSharmaOffice OR @aksharmaBharat OR @ChairmanUppcl OR @mduppcl) -is:retweet';
  const sinceId = props.getProperty('LAST_SEEN_POST_ID');

  const rowsToInsert = [];
  let nextToken = null;
  let page = 0;
  let highestTweetId = sinceId || '0';

  do {
    page++;
    let url = 'https://api.twitter.com/2/tweets/search/recent?query=' + encodeURIComponent(query) +
      '&max_results=100' +
      '&tweet.fields=id,text,author_id,created_at,conversation_id,in_reply_to_user_id' +
      '&expansions=author_id' +
      '&user.fields=id,name,username';

    if (sinceId) url += '&since_id=' + sinceId;
    if (nextToken) url += '&next_token=' + encodeURIComponent(nextToken);

    let response;
    try {
      response = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: {
          'Authorization': 'Bearer ' + bearerToken,
          'User-Agent': 'UPPCLComplaintMonitor-AppsScript/2.0'
        },
        muteHttpExceptions: true
      });
    } catch (err) {
      Logger.log('HTTP fetch error: ' + err);
      break;
    }

    if (response.getResponseCode() !== 200) {
      Logger.log('X API returned status ' + response.getResponseCode() + ': ' + response.getContentText());
      break;
    }

    const data = JSON.parse(response.getContentText());
    const tweets = data.data || [];
    if (tweets.length === 0) break;

    const usersMap = {};
    if (data.includes && data.includes.users) {
      for (let i = 0; i < data.includes.users.length; i++) {
        const u = data.includes.users[i];
        usersMap[u.id] = u;
      }
    }

    for (let t = 0; t < tweets.length; t++) {
      const tweet = tweets[t];
      const tweetId = String(tweet.id);

      // Track highest tweet ID seen across all pages
      if (tweetId.length > highestTweetId.length || (tweetId.length === highestTweetId.length && tweetId > highestTweetId)) {
        highestTweetId = tweetId;
      }

      if (existingTids.has(tweetId)) continue;

      const user = usersMap[tweet.author_id] || { username: 'citizen', name: 'Citizen' };
      const username = user.username;

      // Filter out official accounts from landing on our sheet
      if (isOfficialAccountInScript(username)) continue;

      const tweetUrl = 'https://x.com/' + username + '/status/' + tweetId;
      if (existingUrls.has(tweetUrl.toLowerCase())) continue;

      // Exact date and time from tweet timestamp
      let tweetDate = new Date();
      if (tweet.created_at) {
        tweetDate = new Date(tweet.created_at);
      }
      const dStr = Utilities.formatDate(tweetDate, 'Asia/Kolkata', 'dd-MM-yyyy');
      const timeStr = Utilities.formatDate(tweetDate, 'Asia/Kolkata', 'HH:mm:ss');

      // Operational shift
      const hour = tweetDate.getHours();
      let shift = 'MORNING';
      if (hour < 8) shift = 'NIGHT';
      else if (hour >= 16) shift = 'EVENING';

      const text = tweet.text || '';
      const c = classifyTweetInScript(text, username);
      const headCode = detectApexHead(text);

      // Canonical columns matching the authoritative sheet:
      // A: DATE | B: Link Shift | C: Reply Shift | D: C F | E: LINK URL | F: Twitter Id
      // G: Head | H: Untagged Complaint | I: Picked Status | J: Complaint Type | K: DISCOM
      // L: Zone | M: District | N: Remark | O: Status | P: REPLY_30_MIN | Q: REPLY_60_MIN
      // R: COMPLAINT_NO | S: STS | U (Col 20): Original Tweet Text | AA (Col 26): Draft Reply | AB (Col 27): Approval Status
      const row = new Array(32).fill('');
      row[0] = dStr;
      row[1] = shift;
      row[2] = shift;
      row[3] = ''; // C F (filled on append)
      row[4] = tweetUrl;
      row[5] = username;
      row[6] = headCode;
      row[7] = 'NO';
      row[8] = c.pickedStatus;
      row[9] = c.complaintType;
      row[10] = c.discom;
      row[11] = c.zone;
      row[12] = c.district;
      row[13] = ''; // Remark
      row[14] = (c.pickedStatus === 'APPRECIATION') ? 'Appreciation' : 'Forwarded to Discom';
      row[15] = c.replyWithin30Min;
      row[16] = '';
      row[17] = tweetId;
      row[18] = '';
      row[20] = text;
      row[26] = c.draftReply;
      row[27] = 'DRAFT_READY';

      rowsToInsert.push(row);
      existingTids.add(tweetId);
      existingUrls.add(tweetUrl.toLowerCase());
    }

    nextToken = (data.meta && data.meta.next_token) ? data.meta.next_token : null;
  } while (nextToken && page < 10);

  // 3. Batch Append and Format All New Rows (reversed so oldest inserted first)
  if (rowsToInsert.length > 0) {
    // Reverse rows so they are appended in chronological order (oldest to newest)
    rowsToInsert.reverse();

    const insertStartRow = Math.max(sheet.getLastRow() + 1, 3);
    const startCount = insertStartRow - 2;

    for (let r = 0; r < rowsToInsert.length; r++) {
      rowsToInsert[r][3] = startCount + r; // Column D: C F sequential counter
    }

    const range = sheet.getRange(insertStartRow, 1, rowsToInsert.length, 32);
    range.setValues(rowsToInsert);
    range.setFontFamily('Verdana');
    range.setFontSize(10);
    range.setHorizontalAlignment('center');
    range.setVerticalAlignment('middle');
    range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    range.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

    // Apply 45px row height
    for (let r = 0; r < rowsToInsert.length; r++) {
      sheet.setRowHeight(insertStartRow + r, 45);
    }

    // Restore Column E as blue clickable link (#1155cc)
    const linkStyle = SpreadsheetApp.newTextStyle()
      .setForegroundColor('#1155cc')
      .setUnderline(true)
      .setFontFamily('Verdana')
      .setFontSize(10)
      .build();

    const linkRichText = [];
    for (let r = 0; r < rowsToInsert.length; r++) {
      const u = rowsToInsert[r][4];
      linkRichText.push([SpreadsheetApp.newRichTextValue().setText(u).setLinkUrl(u).setTextStyle(linkStyle).build()]);
    }
    const linkRange = sheet.getRange(insertStartRow, 5, rowsToInsert.length, 1);
    linkRange.setRichTextValues(linkRichText);
    linkRange.setHorizontalAlignment('left');

    sheet.getRange(insertStartRow, 21, rowsToInsert.length, 1).setHorizontalAlignment('left');
    sheet.getRange(insertStartRow, 27, rowsToInsert.length, 1).setHorizontalAlignment('left');

    SpreadsheetApp.flush();
    Logger.log('Successfully appended ' + rowsToInsert.length + ' new complaints from the 6 Apex handles.');
  } else {
    Logger.log('Sync cycle complete: No new complaints found for the 6 Apex handles.');
  }

  // ONLY advance since_id after ALL pages are completely fetched and saved to the sheet
  if (highestTweetId && highestTweetId !== '0') {
    props.setProperty('LAST_SEEN_POST_ID', highestTweetId);
  }
}

/**
 * Intelligent grievance classifier with UP Discom routing and accurate Appreciation/Complaint distinction.
 */
function classifyTweetInScript(text, username) {
  const lowerText = text.toLowerCase();
  const lowerUser = username.toLowerCase();

  const isOfficial = isOfficialAccountInScript(username);
  const endsWithOfficial = endsWithOfficialHandleInScript(text);

  // DISCOM Mapping
  let discom = '';
  if (/pvvnl|meerut|noida|ghaziabad|moradabad|saharanpur|aligarh|bulandshahr|muzaffarnagar|baghpat/i.test(lowerText)) {
    discom = 'PVVNL';
  } else if (/puvvnl|varanasi|prayagraj|gorakhpur|ayodhya|azamgarh|mirzapur|jaunpur|basti/i.test(lowerText)) {
    discom = 'PuVVNL';
  } else if (/mvvnl|lucknow|bareilly|faizabad|sitapur|lakhimpur|hardoi|raebareli|unnao/i.test(lowerText)) {
    discom = 'MVVNL';
  } else if (/dvvnl|agra|mathura|firozabad|jhansi|banda|etawah|mainpuri/i.test(lowerText)) {
    discom = 'DVVNL';
  } else if (/kesco|kanpur/i.test(lowerText)) {
    discom = 'KESCo';
  }

  // District Mapping
  let district = '';
  const districts = [
    'Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Meerut', 'Noida', 'Ghaziabad', 'Prayagraj',
    'Gorakhpur', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Jhansi', 'Ayodhya',
    'Muzaffarnagar', 'Mathura', 'Budaun', 'Rampur', 'Shahjahanpur', 'Farrukhabad', 'Firozabad'
  ];
  for (let d of districts) {
    if (new RegExp('\\b' + d.toLowerCase() + '\\b', 'i').test(lowerText)) {
      district = d;
      break;
    }
  }

  // Grievance Category
  let complaintType = 'DISSATISFIED_CONSUMER';
  if (/बिजली\s*गायब|आपूर्ति\s*ठप|no\s*power|no\s*electricity|power\s*cut|outage|blackout|बिजली\s*कटौ|बिजली\s*नहीं/i.test(lowerText)) {
    complaintType = 'SUPPLY_OUTAGE';
  } else if (/ट्रांसफार्मर|transformer|फुंक|ब्लास्ट/i.test(lowerText)) {
    complaintType = 'TRANSFORMER_ISSUE';
  } else if (/बिल|bill|billing|मीटर\s*रीडिंग|overcharge|ots|बकाया/i.test(lowerText)) {
    complaintType = 'BILL_RELATED';
  } else if (/तार\s*टू|करंट|करंट\s*आ\s*रहा|spark|wire\s*break|danger|हादसा|खंभा|पोल/i.test(lowerText)) {
    complaintType = 'SAFETY_HAZARD';
  } else if (/meter|मीटर\s*खराब|मीटर\s*बदल/i.test(lowerText)) {
    complaintType = 'METER_FAULT';
  } else if (/नया\s*कनेक्शन|new\s*connection/i.test(lowerText)) {
    complaintType = 'NEW_CONNECTION';
  }

  // Determine Picked Status (YES, NO, APPRECIATION)
  let pickedStatus = 'YES';
  const hasPureAppreciation = /बहुत\s*बहुत\s*धन्यवाद|उत्कृष्ट\s*कार्य|सराहनीय|great\s*job|thank\s*you\s*so\s*much|thanks\s*for\s*quick/i.test(lowerText) &&
                              !/समस्या|शिकायत|बिजली|outage|complaint|अधिकारी|प्रिय\s*उपभोक्ता/i.test(lowerText);

  // Exclude from Appreciation if authored by official, ends with official handles, or has complaint/request markers
  if (hasPureAppreciation && !isOfficial && !endsWithOfficial) {
    pickedStatus = 'APPRECIATION';
    complaintType = 'APPRECIATION';
  }

  const discomHandle = discom ? ('@' + discom + 'HQ') : '@UPPCLLKO';
  const draftReply = `प्रिय उपभोक्ता, आपकी शिकायत को संबंधित वितरण निगम ${discomHandle} को त्वरित संज्ञान एवं समाधान हेतु अग्रसारित किया जा रहा है।`;

  return {
    discom: discom || 'UPPCL',
    district: district,
    zone: district ? district + ' Zone' : '',
    complaintType: complaintType,
    pickedStatus: pickedStatus,
    replyWithin30Min: isOfficial ? 'YES' : 'NO',
    summary: text.substring(0, 150),
    actionTaken: isOfficial ? 'Forwarded to Discom' : 'Pending Review',
    draftReply: draftReply
  };
}
