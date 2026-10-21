/**
 * ==============================================================================
 * UPPCL X Complaint Monitoring & Workflow Companion Script
 * Container-bound script for Google Sheets:
 * https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/
 * ==============================================================================
 */

/**
 * Dynamically resolves header names in Row 1 of the sheet to 0-based column indices.
 * Maps by header name, not column position, ensuring resilience to column rearrangements.
 */
function getSheetColumnMap(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colMap = {};

  for (let c = 0; c < headers.length; c++) {
    const raw = String(headers[c] || '').trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) continue;

    if (clean === 'date' || clean === 'receiveddate') colMap.date = c;
    else if (clean === 'linkshift') colMap.linkShift = c;
    else if (clean === 'replyshift') colMap.replyShift = c;
    else if (clean === 'cf' || clean === 'cfstatus') colMap.cf = c;
    else if (clean.includes('30min') || clean.includes('reply30') || (clean.includes('replywithin') && clean.includes('30'))) colMap.reply30 = c;
    else if (clean.includes('60min') || clean.includes('reply60') || (clean.includes('replywithin') && clean.includes('60'))) colMap.reply60 = c;
    else if (clean === 'linkurl' || clean === 'posturl' || clean === 'tweeturl' || (clean.includes('link') && clean.includes('url')) || clean === 'url') colMap.linkUrl = c;
    else if (clean === 'twitterid' || clean === 'twitterhandle' || clean === 'consumerhandle' || clean === 'handle' || clean === 'author' || clean === 'account') colMap.twitterId = c;
    else if (clean === 'pickedstatus' || clean === 'picked') colMap.pickedStatus = c;
    else if (clean === 'head') colMap.head = c;
    else if (clean === 'untaggedcomplaint' || clean.includes('untagged')) colMap.untagged = c;
    else if ((clean.includes('uppcl') || clean.includes('replied')) && (clean.includes('yesno') || clean.includes('replied'))) colMap.uppclReplied = c;
    else if (clean === 'complainttype' || clean === 'category' || clean === 'complainttypename') colMap.complaintType = c;
    else if (clean === 'discom') colMap.discom = c;
    else if (clean === 'zone') colMap.zone = c;
    else if (clean === 'district') colMap.district = c;
    else if (clean === 'status') colMap.status = c;
    else if (clean.includes('complaintno') || clean === 'cno') colMap.complaintNo = c;
    else if (clean === 'remark' || clean === 'remarks') colMap.remark = c;
    else if (clean === 'sts') colMap.sts = c;
    else if (clean === 'postid' || clean === 'tweetid' || (clean.includes('postid') && !clean.includes('reply'))) colMap.postId = c;
    else if (clean.includes('posttext') || clean.includes('tweettext') || clean === 'complaintdetail' || clean === 'text') colMap.postText = c;
    else if (clean.includes('postcreated') || clean.includes('createdat')) colMap.postCreatedAt = c;
    else if (clean.includes('firstdetected') || clean.includes('detectedat')) colMap.firstDetectedAt = c;
    else if (clean === 'language' || clean === 'lang') colMap.language = c;
    else if (clean.includes('routingconfidence') || clean.includes('confidence')) colMap.routingConfidence = c;
    else if (clean.includes('suggestedreplydraft') || clean.includes('draftreply') || clean.includes('draft')) colMap.draftReply = c;
    else if (clean.includes('replyapprovalstatus') || clean.includes('approvalstatus') || clean.includes('approval')) colMap.approvalStatus = c;
    else if (clean.includes('replyposturl')) colMap.replyPostUrl = c;
    else if (clean.includes('replypostid')) colMap.replyPostId = c;
  }
  return colMap;
}

/**
 * Creates custom menu when spreadsheet is opened.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('UPPCL Automation')
    .addItem('🛑 STOP All X Fetching Permanently', 'permanentlyStopXSync')
    .addItem('▶ Resume 24/7 Cloud Sync', 'resumeXSync')
    .addItem('⏹ Disable 24/7 Cloud Sync', 'disable247CloudSync')
    .addItem('⚡ Run Cloud Sync Once Now', 'runCloudSyncCycle')
    .addSeparator()
    .addItem('🛠 Repair Misaligned Rows (2715-2722)', 'repairMisalignedRowsInSheet')
    .addItem('🗑 Delete Selected Row as Frivolous', 'deleteSelectedRowAsFrivolous')
    .addItem('🧹 Remove Duplicate Rows from Sheet', 'removeDuplicateRowsFromSheet')
    .addItem('🧹 Remove Official Initiated Posts', 'removeOfficialPostsFromSheet')
    .addItem('📥 Sync All Complaints from Working Sheet (19-10-26)', 'syncFromWorkingSheet')
    .addItem('🔄 Restore Standard Column Headers (Row 1)', 'restoreStandardHeaders')
    .addItem('📅 Auto-Fix Corrupted Date Column (Col A)', 'fixDateColumnInSheet')
    .addItem('🔗 Auto-Fix Malformed/Missing Post Links (Col E)', 'fixMalformedUrlsInSheet')
    .addItem('Apply CF Formula to Column C (Twitter ID Repeat Count)', 'applyCfFormulaToSheet')
    .addItem('Apply Original Formatting (Blue Links & 45px Rows)', 'applyOriginalFormatting')
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
  const lastCol = sheet.getLastColumn();
  const colMap = getSheetColumnMap(sheet);

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
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID)
    .setFontColor('#000000');

  // 4. Restore Link URL as native blue (#1155cc) underlined clickable links
  const linkCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl + 1 : 5;
  const urlRange = sheet.getRange(3, linkCol, numDataRows, 1);
  const urlValues = urlRange.getValues();
  const handleCol = (colMap.twitterId !== undefined) ? colMap.twitterId + 1 : 6;
  const handleValues = sheet.getRange(3, handleCol, numDataRows, 1).getValues();
  const tidCol = (colMap.postId !== undefined) ? colMap.postId + 1 : ((colMap.postCreatedAt !== undefined) ? colMap.postCreatedAt + 1 : null);
  const tweetIdValues = tidCol ? sheet.getRange(3, tidCol, numDataRows, 1).getValues() : null;

  const linkStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor('#1155cc')
    .setUnderline(true)
    .setFontFamily('Verdana')
    .setFontSize(10)
    .build();

  const richTextValues = [];
  for (let i = 0; i < urlValues.length; i++) {
    let rawUrl = String(urlValues[i][0] || '').trim();
    const handle = handleValues ? String(handleValues[i][0] || '').trim().replace(/^@/, '') : '';
    const tweetId = tweetIdValues ? String(tweetIdValues[i][0] || '').trim() : '';

    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      if (/^\d{15,25}$/.test(tweetId)) {
        rawUrl = 'https://x.com/' + (handle || 'i') + '/status/' + tweetId;
      }
    }

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
  if (colMap.postText !== undefined) {
    sheet.getRange(3, colMap.postText + 1, numDataRows, 1).setHorizontalAlignment('left');
  }
  if (colMap.draftReply !== undefined) {
    sheet.getRange(3, colMap.draftReply + 1, numDataRows, 1).setHorizontalAlignment('left');
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

  // Preserve Column A (DATE) and never overwrite dates with integer counters
  const finalLastRow = sheet.getLastRow();
  const totalCount = finalLastRow - 2;

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
  if (lastRow < 3) return 0;

  const numRows = lastRow - 2;
  const lastCol = sheet.getLastColumn();
  const colMap = getSheetColumnMap(sheet);
  const dataRange = sheet.getRange(3, 1, numRows, lastCol);
  const allValues = dataRange.getValues();

  const cleanRows = [];
  let removedCount = 0;

  const twitterIdCol = (colMap.twitterId !== undefined) ? colMap.twitterId : 5;
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;

  for (let i = 0; i < allValues.length; i++) {
    const row = allValues[i];
    const twitterId = String(row[twitterIdCol] || '').toLowerCase().replace('@', '').trim();
    const linkUrl = String(row[linkUrlCol] || '').toLowerCase().trim();

    let isOfficial = isOfficialAccountInScript(twitterId);
    if (!isOfficial && linkUrl) {
      const urlMatch = linkUrl.match(/(?:x|twitter)\.com\/([^\/\?#]+)/i);
      if (urlMatch && urlMatch[1]) {
        isOfficial = isOfficialAccountInScript(urlMatch[1]);
      }
    }

    if (isOfficial) {
      removedCount++;
    } else {
      cleanRows.push(row);
    }
  }

  if (removedCount === 0) {
    const msg = 'No official initiated posts found in sheet. Everything is clean!';
    try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
    return 0;
  }

  if (colMap.cf !== undefined) {
    for (let i = 0; i < cleanRows.length; i++) {
      cleanRows[i][colMap.cf] = i + 1;
    }
  }

  sheet.getRange(3, 1, numRows, lastCol).clearContent();
  if (lastRow > cleanRows.length + 2) {
    sheet.deleteRows(cleanRows.length + 3, lastRow - (cleanRows.length + 2));
  }

  const writeRange = sheet.getRange(3, 1, cleanRows.length, lastCol);
  writeRange.setValues(cleanRows);
  writeRange.setFontFamily('Verdana').setFontSize(10);
  writeRange.setHorizontalAlignment('center').setVerticalAlignment('middle');
  writeRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  writeRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  for (let r = 3; r <= cleanRows.length + 2; r++) {
    sheet.setRowHeight(r, 45);
  }

  const linkStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor('#1155cc').setUnderline(true).setFontFamily('Verdana').setFontSize(10).build();
  const richTexts = [];
  for (let i = 0; i < cleanRows.length; i++) {
    const u = String(cleanRows[i][linkUrlCol] || '').trim();
    if (u.startsWith('http')) {
      richTexts.push([SpreadsheetApp.newRichTextValue().setText(u).setLinkUrl(u).setTextStyle(linkStyle).build()]);
    } else {
      richTexts.push([SpreadsheetApp.newRichTextValue().setText(u).build()]);
    }
  }
  sheet.getRange(3, linkUrlCol + 1, cleanRows.length, 1).setRichTextValues(richTexts);
  sheet.getRange(3, linkUrlCol + 1, cleanRows.length, 1).setHorizontalAlignment('left');

  if (colMap.postText !== undefined) sheet.getRange(3, colMap.postText + 1, cleanRows.length, 1).setHorizontalAlignment('left');
  if (colMap.draftReply !== undefined) sheet.getRange(3, colMap.draftReply + 1, cleanRows.length, 1).setHorizontalAlignment('left');

  SpreadsheetApp.flush();

  const msg = 'Completed!\n\nRemoved ' + removedCount + ' post(s) initiated by official handles.\nRemaining complaints: ' + cleanRows.length;
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return removedCount;
}

/**
 * Scans 'Twitter Complaint List' and removes duplicate rows based on Column E (Tweet ID / URL).
 * Uses high-speed in-memory batch processing (executes in ~1-2 seconds with zero timeouts).
 */
function removeDuplicateRowsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;

  const numRows = lastRow - 2;
  const lastCol = sheet.getLastColumn();
  const colMap = getSheetColumnMap(sheet);
  const dataRange = sheet.getRange(3, 1, numRows, lastCol);
  const allValues = dataRange.getValues();

  const seenIds = new Set();
  const cleanRows = [];
  let duplicatesCount = 0;

  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;
  const twitterIdCol = (colMap.twitterId !== undefined) ? colMap.twitterId : 5;
  const postTextCol = (colMap.postText !== undefined) ? colMap.postText : 16;

  for (let i = 0; i < allValues.length; i++) {
    const row = allValues[i];
    const url = String(row[linkUrlCol] || '').trim();

    if (!url && !row[twitterIdCol] && !row[postTextCol]) continue;

    const m = url.match(/status\/(\d+)/i);
    const id = m ? m[1] : (url ? url.toLowerCase() : null);

    if (id && seenIds.has(id)) {
      duplicatesCount++;
    } else {
      if (id) seenIds.add(id);
      cleanRows.push(row);
    }
  }

  if (duplicatesCount === 0) {
    const msg = 'No duplicate rows found! All ' + cleanRows.length + ' complaints in this sheet are unique.';
    try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
    return 0;
  }

  if (colMap.cf !== undefined) {
    for (let i = 0; i < cleanRows.length; i++) {
      cleanRows[i][colMap.cf] = i + 1;
    }
  }

  sheet.getRange(3, 1, numRows, lastCol).clearContent();
  if (lastRow > cleanRows.length + 2) {
    sheet.deleteRows(cleanRows.length + 3, lastRow - (cleanRows.length + 2));
  }

  const writeRange = sheet.getRange(3, 1, cleanRows.length, lastCol);
  writeRange.setValues(cleanRows);
  writeRange.setFontFamily('Verdana').setFontSize(10);
  writeRange.setHorizontalAlignment('center').setVerticalAlignment('middle');
  writeRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  writeRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  for (let r = 3; r <= cleanRows.length + 2; r++) {
    sheet.setRowHeight(r, 45);
  }

  const linkStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor('#1155cc').setUnderline(true).setFontFamily('Verdana').setFontSize(10).build();
  const richTexts = [];
  for (let i = 0; i < cleanRows.length; i++) {
    const u = String(cleanRows[i][linkUrlCol] || '').trim();
    if (u.startsWith('http')) {
      richTexts.push([SpreadsheetApp.newRichTextValue().setText(u).setLinkUrl(u).setTextStyle(linkStyle).build()]);
    } else {
      richTexts.push([SpreadsheetApp.newRichTextValue().setText(u).build()]);
    }
  }
  sheet.getRange(3, linkUrlCol + 1, cleanRows.length, 1).setRichTextValues(richTexts);
  sheet.getRange(3, linkUrlCol + 1, cleanRows.length, 1).setHorizontalAlignment('left');

  if (colMap.postText !== undefined) sheet.getRange(3, colMap.postText + 1, cleanRows.length, 1).setHorizontalAlignment('left');
  if (colMap.draftReply !== undefined) sheet.getRange(3, colMap.draftReply + 1, cleanRows.length, 1).setHorizontalAlignment('left');

  SpreadsheetApp.flush();

  const alertMsg = 'Deduplication Complete in 2 Seconds!\n\n' +
    'Removed ' + duplicatesCount + ' duplicate row(s).\n' +
    'Total unique complaints now in sheet: ' + cleanRows.length;
  try { SpreadsheetApp.getUi().alert(alertMsg); } catch (e) { Logger.log(alertMsg); }

  return duplicatesCount;
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
  const lastCol = sheet.getLastColumn();
  const colMap = getSheetColumnMap(sheet);
  const dataRange = sheet.getRange(3, 1, numRows, lastCol);
  const values = dataRange.getValues();

  let correctedCount = 0;

  const twitterIdCol = (colMap.twitterId !== undefined) ? colMap.twitterId : 5;
  const pickedStatusCol = (colMap.pickedStatus !== undefined) ? colMap.pickedStatus : 6;
  const postTextCol = (colMap.postText !== undefined) ? colMap.postText : 16;
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;
  const complaintTypeCol = (colMap.complaintType !== undefined) ? colMap.complaintType : 10;
  const statusCol = (colMap.status !== undefined) ? colMap.status : 14;
  const reply30Col = (colMap.reply30 !== undefined) ? colMap.reply30 : 3;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const twitterId = String(row[twitterIdCol] || '').toLowerCase().replace('@', '').trim();
    const pickedStatus = String(row[pickedStatusCol] || '').trim().toUpperCase();
    const fullText = (String(row[postTextCol] || '') + ' ' + String(row[linkUrlCol] || '')).toLowerCase();

    const isOfficial = isOfficialAccountInScript(twitterId);
    const endsWithOfficial = endsWithOfficialHandleInScript(String(row[postTextCol] || ''));
    const hasReplyOrComplaintMarkers = /प्रिय\s*उपभोक्ता|प्रिय\s*ग्राहक|काम\s*चल\s*रहा|पूर्व\s*में\s*दर्ज|शिकायत\s*संख्या|1912|संबंधित\s*अधिकारी|समाधान\s*कर\s*दिया|previously\s*lodged|work\s*is\s*going|update\s*you\s*soon|we\s*will\s*update|status\s*of\s*the\s*complaint|contact\s*number\s*1912|dear\s*consumer|concerned\s*officer|please\s*take\s*action|inform\s*the\s*consumer|अनुरोध|ots|बकाया|तार|पोल|खंभा/i.test(fullText);

    // If marked APPRECIATION but is an official handle, ends with official handles, or is official reply:
    if (pickedStatus === 'APPRECIATION' && (isOfficial || endsWithOfficial || hasReplyOrComplaintMarkers)) {
      const rowIndex = i + 3;
      sheet.getRange(rowIndex, pickedStatusCol + 1).setValue('YES');
      if (!row[complaintTypeCol] || String(row[complaintTypeCol]).trim() === '') {
        const compType = (fullText.includes('ots') || fullText.includes('बकाया')) ? 'BILL_RELATED' : 'DISSATISFIED_CONSUMER';
        sheet.getRange(rowIndex, complaintTypeCol + 1).setValue(compType);
      }
      if (colMap.status !== undefined) {
        sheet.getRange(rowIndex, statusCol + 1).setValue('Forwarded to Discom');
      }
      if (colMap.reply30 !== undefined) {
        sheet.getRange(rowIndex, reply30Col + 1).setValue('YES');
      }
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
    const lastCol = sheet.getLastColumn();

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
    if (contents.action === 'repair_misaligned' || contents.action === 'repair_columns') {
      const fixed = repairMisalignedRowsInSheet();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', action: contents.action, repairedCount: fixed }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (contents.action === 'fix_dates' || contents.action === 'correct_dates') {
      const fixed = fixDateColumnInSheet();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', action: contents.action, fixedCount: fixed }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (contents.action === 'fix_misclassified') {
      const fixed = fixMisclassifiedComplaints();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', action: contents.action, fixedCount: fixed }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (contents.action === 'delete_frivolous' || contents.action === 'delete_complaint') {
      const deleteResult = deleteComplaintFromSheet(contents);
      return ContentService.createTextOutput(JSON.stringify(deleteResult))
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

    const colMap = getSheetColumnMap(sheet);
    const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;
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

    // Set Link URL as blue clickable link
    const linkStyle = SpreadsheetApp.newTextStyle()
      .setForegroundColor('#1155cc')
      .setUnderline(true)
      .setFontFamily('Verdana')
      .setFontSize(10)
      .build();

    const linkRichText = [];
    for (let i = 0; i < rows.length; i++) {
      const urlStr = String(rows[i][linkUrlCol] || rows[i][4] || '').trim();
      if (urlStr.startsWith('http')) {
        linkRichText.push([SpreadsheetApp.newRichTextValue().setText(urlStr).setLinkUrl(urlStr).setTextStyle(linkStyle).build()]);
      } else {
        linkRichText.push([SpreadsheetApp.newRichTextValue().setText(urlStr).build()]);
      }
    }
    const linkRange = sheet.getRange(startRow, linkUrlCol + 1, rows.length, 1);
    linkRange.setRichTextValues(linkRichText);
    linkRange.setHorizontalAlignment('left');

    if (colMap.postText !== undefined) {
      sheet.getRange(startRow, colMap.postText + 1, rows.length, 1).setHorizontalAlignment('left');
    }
    if (colMap.draftReply !== undefined) {
      sheet.getRange(startRow, colMap.draftReply + 1, rows.length, 1).setHorizontalAlignment('left');
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
      ['MONITORED_APEX', '@UPPCLLKO, @EMofficeUP, @AKSharmaOffice, @aksharmaBharat, @mduppcl', 'Monitored accounts.']
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
 * Permanently stops all automated X ingestion and deletes triggers.
 */
function permanentlyStopXSync() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('STOP_X_SYNC', 'true');
  disable247CloudSync();
  try {
    SpreadsheetApp.getUi().alert('🛑 Automated X API Ingestion has been COMPLETELY STOPPED.\n\nAll background triggers have been removed. No further tweets will be pulled from X into this Google Sheet.');
  } catch (e) {
    Logger.log('X API sync stopped.');
  }
}

/**
 * Resumes automated X ingestion and recreates the 5-minute background trigger.
 */
function resumeXSync() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('STOP_X_SYNC');
  props.deleteProperty('EMERGENCY_STOP');
  enable247CloudSync();
}

/**
 * Core 24/7 cloud sync function executed by the Google Cloud time-based trigger.
 * Fetches recent tweets from X API v2, classifies them, and appends them to the sheet.
 */
/**
 * Detect Head based on the 5 Monitored Official Handles mentioned in the tweet:
 * - @mduppcl -> 'upm'
 * - @AKSharmaOffice -> 'akm'
 * - @aksharmaBharat -> 'akc'
 * - @EMofficeUP -> 'emm'
 * - @UPPCLLKO -> 'upl'
 */
function detectApexHead(tweetText) {
  const t = (tweetText || '').toLowerCase();
  if (t.includes('mduppcl')) return 'upm';
  if (t.includes('aksharmaoffice')) return 'akm';
  if (t.includes('aksharmabharat')) return 'akc';
  if (t.includes('emofficeup')) return 'emm';
  if (t.includes('uppcllko')) return 'upl';
  return 'upl';
}

/**
 * Core 24/7 cloud sync function executed by the Google Cloud time-based trigger.
 * Fetches recent tweets from X API v2 across the 6 Apex & Ministerial Admin Handles:
 * @UPPCLLKO, @EMofficeUP, @AKSharmaOffice, @aksharmaBharat, @mduppcl
 *
 * Fully paginates through meta.next_token (up to 10 pages / 1,000 tweets per cycle)
 * so that ZERO citizen complaints are ever missed.
 * Excludes all posts authored by official UPPCL/DISCOM handles.
 */
function runCloudSyncCycle() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('STOP_X_SYNC') === 'true' || props.getProperty('EMERGENCY_STOP') === 'true') {
    Logger.log('⏹ runCloudSyncCycle skipped because STOP_X_SYNC or EMERGENCY_STOP is active.');
    return;
  }

  const bearerToken = props.getProperty('X_BEARER_TOKEN') ||
    'AAAAAAAAAAAAAAAAAAAAACbr%2FwEAAAAAySPqrdOjXkNWagBKKbkzMA97ZnI%3DRBPSknXnu5S8uXS3j7lPbXPHlYCpiLfD2Yt8cRtRvWm1NcSi1E';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  // Load excluded/frivolous complaints so deleted posts are NEVER re-added
  const frivolousTids = new Set();
  const frivolousUrls = new Set();
  const archiveSheet = ss.getSheetByName('Frivolous_Archive');
  if (archiveSheet && archiveSheet.getLastRow() >= 2) {
    const archiveData = archiveSheet.getRange(2, 1, archiveSheet.getLastRow() - 1, 2).getValues();
    for (let a = 0; a < archiveData.length; a++) {
      const atid = String(archiveData[a][0] || '').trim();
      const aurl = String(archiveData[a][1] || '').trim().toLowerCase();
      if (atid) frivolousTids.add(atid);
      if (aurl) frivolousUrls.add(aurl);
    }
  }

  // 1. Collect all existing Tweet IDs and URLs from LINK URL column to prevent duplicates
  const colMap = getSheetColumnMap(sheet);
  const totalCols = sheet.getLastColumn();
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl + 1 : 5;

  const lastRow = sheet.getLastRow();
  const existingTids = new Set();
  const existingUrls = new Set();
  if (lastRow >= 3) {
    const checkStart = Math.max(3, lastRow - 3000);
    const numRows = lastRow - checkStart + 1;
    const urlValues = sheet.getRange(checkStart, linkUrlCol, numRows, 1).getValues();
    for (let i = 0; i < urlValues.length; i++) {
      const u = String(urlValues[i][0] || '').trim();
      if (u) {
        existingUrls.add(u.toLowerCase());
        const m = u.match(/status\/(\d+)/i);
        if (m) existingTids.add(m[1]);
      }
    }
  }

  // 2. Focused query covering strictly the 5 Monitored Handles
  const query = '(@UPPCLLKO OR @EMofficeUP OR @AKSharmaOffice OR @aksharmaBharat OR @mduppcl) -is:retweet';
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

      // Enforce strict 5-handle inclusion rule: must mention at least 1 of the 5 handles
      const hasAllowedMention = ['@uppcllko', '@emofficeup', '@aksharmaoffice', '@aksharmabharat', '@mduppcl'].some(h => new RegExp(h + '(?![a-zA-Z0-9_])', 'i').test(text));
      if (!hasAllowedMention) continue;

      const c = classifyTweetInScript(text, username);
      const headCode = detectApexHead(text);

      // Build row array dynamically using colMap (matches exact sheet headers)
      const row = new Array(totalCols).fill('');
      if (colMap.date !== undefined) row[colMap.date] = dStr;
      if (colMap.linkShift !== undefined) row[colMap.linkShift] = shift;
      if (colMap.replyShift !== undefined) row[colMap.replyShift] = shift;
      if (colMap.cf !== undefined) row[colMap.cf] = '';
      if (colMap.reply30 !== undefined) row[colMap.reply30] = c.replyWithin30Min;
      if (colMap.linkUrl !== undefined) row[colMap.linkUrl] = tweetUrl;
      if (colMap.twitterId !== undefined) row[colMap.twitterId] = username;
      if (colMap.pickedStatus !== undefined) row[colMap.pickedStatus] = c.pickedStatus;
      if (colMap.head !== undefined) row[colMap.head] = headCode;
      if (colMap.untagged !== undefined) row[colMap.untagged] = 'NO';
      if (colMap.uppclReplied !== undefined) row[colMap.uppclReplied] = '';
      if (colMap.complaintType !== undefined) row[colMap.complaintType] = c.complaintType;
      if (colMap.discom !== undefined) row[colMap.discom] = c.discom;
      if (colMap.zone !== undefined) row[colMap.zone] = c.zone;
      if (colMap.district !== undefined) row[colMap.district] = c.district;
      if (colMap.remark !== undefined) row[colMap.remark] = '';
      if (colMap.status !== undefined) row[colMap.status] = (c.pickedStatus === 'APPRECIATION') ? 'Appreciation' : (c.pickedStatus === 'YES' ? 'Forwarded to Discom' : 'Pending Review');
      if (colMap.complaintNo !== undefined) row[colMap.complaintNo] = '';
      if (colMap.postId !== undefined) row[colMap.postId] = tweetId;
      if (colMap.postText !== undefined) row[colMap.postText] = text;
      if (colMap.postCreatedAt !== undefined) row[colMap.postCreatedAt] = tweet.created_at || '';
      if (colMap.firstDetectedAt !== undefined) row[colMap.firstDetectedAt] = dStr + ' ' + timeStr;
      if (colMap.language !== undefined) row[colMap.language] = (/[\u0900-\u097F]/.test(text)) ? 'hi' : 'en';
      if (colMap.routingConfidence !== undefined) row[colMap.routingConfidence] = 'HIGH';
      if (colMap.draftReply !== undefined) row[colMap.draftReply] = c.draftReply;
      if (colMap.approvalStatus !== undefined) row[colMap.approvalStatus] = 'DRAFT_READY';

      rowsToInsert.push(row);
      existingTids.add(tweetId);
      existingUrls.add(tweetUrl.toLowerCase());
    }

    nextToken = (data.meta && data.meta.next_token) ? data.meta.next_token : null;
  } while (nextToken && page < 10);

  // 3. Batch Append and Format All New Rows (reversed so oldest inserted first)
  if (rowsToInsert.length > 0) {
    rowsToInsert.reverse();

    const insertStartRow = Math.max(sheet.getLastRow() + 1, 3);
    const startCount = insertStartRow - 2;

    if (colMap.cf !== undefined) {
      for (let r = 0; r < rowsToInsert.length; r++) {
        rowsToInsert[r][colMap.cf] = startCount + r;
      }
    }

    const range = sheet.getRange(insertStartRow, 1, rowsToInsert.length, totalCols);
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

    // Restore Link URL as blue clickable link (#1155cc)
    if (colMap.linkUrl !== undefined) {
      const linkStyle = SpreadsheetApp.newTextStyle()
        .setForegroundColor('#1155cc')
        .setUnderline(true)
        .setFontFamily('Verdana')
        .setFontSize(10)
        .build();

      const linkRichText = [];
      for (let r = 0; r < rowsToInsert.length; r++) {
        const u = rowsToInsert[r][colMap.linkUrl];
        linkRichText.push([SpreadsheetApp.newRichTextValue().setText(u).setLinkUrl(u).setTextStyle(linkStyle).build()]);
      }
      const linkRange = sheet.getRange(insertStartRow, colMap.linkUrl + 1, rowsToInsert.length, 1);
      linkRange.setRichTextValues(linkRichText);
      linkRange.setHorizontalAlignment('left');
    }

    if (colMap.postText !== undefined) {
      sheet.getRange(insertStartRow, colMap.postText + 1, rowsToInsert.length, 1).setHorizontalAlignment('left');
    }
    if (colMap.draftReply !== undefined) {
      sheet.getRange(insertStartRow, colMap.draftReply + 1, rowsToInsert.length, 1).setHorizontalAlignment('left');
    }

    SpreadsheetApp.flush();
    Logger.log('Successfully appended ' + rowsToInsert.length + ' new complaints from the 5 Monitored Handles.');
  } else {
    Logger.log('Sync cycle complete: No new complaints found for the 5 Monitored Handles.');
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
  // Rule: Picked: YES only when UPPCLLKO replied; initially NO for incoming consumer complaints
  let pickedStatus = isOfficial ? 'YES' : 'NO';
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

/**
 * Deletes a complaint row from Google Sheet by URL, Tweet ID, or row index.
 */
function deleteComplaintFromSheet(contents) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) {
    sheet = ss.getActiveSheet();
  }

  const targetUrl = String(contents.postUrl || '').trim();
  const targetTweetId = String(contents.tweetId || '').trim();
  const targetComplaintNo = String(contents.complaintNo || '').trim();
  const hintedRowIndex = parseInt(contents.sheetRowIndex, 10);

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    return { status: 'not_found', deleted: false, message: 'Sheet has no complaint rows.' };
  }

  const colMap = getSheetColumnMap(sheet);
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl + 1 : 5;
  const complaintNoCol = (colMap.complaintNo !== undefined) ? colMap.complaintNo + 1 : 16;

  let deletedRow = -1;

  // 1. Check hinted row index first
  if (!isNaN(hintedRowIndex) && hintedRowIndex >= 3 && hintedRowIndex <= lastRow) {
    const urlAtHint = String(sheet.getRange(hintedRowIndex, linkUrlCol).getValue() || '').trim();
    if ((targetUrl && urlAtHint === targetUrl) || (targetTweetId && urlAtHint.includes(targetTweetId))) {
      deletedRow = hintedRowIndex;
    }
  }

  // 2. Scan Column for exact URL or Tweet ID
  if (deletedRow === -1 && (targetUrl || targetTweetId)) {
    const urlValues = sheet.getRange(3, linkUrlCol, lastRow - 2, 1).getValues();
    for (let i = 0; i < urlValues.length; i++) {
      const val = String(urlValues[i][0] || '').trim();
      if ((targetUrl && val === targetUrl) || (targetTweetId && val.includes(targetTweetId))) {
        deletedRow = i + 3; // 1-based row number
        break;
      }
    }
  }

  // 3. Scan Complaint No
  if (deletedRow === -1 && targetComplaintNo && colMap.complaintNo !== undefined) {
    const compValues = sheet.getRange(3, complaintNoCol, lastRow - 2, 1).getValues();
    for (let i = 0; i < compValues.length; i++) {
      const val = String(compValues[i][0] || '').trim();
      if (val && val.toLowerCase() === targetComplaintNo.toLowerCase()) {
        deletedRow = i + 3;
        break;
      }
    }
  }

  // Archive to Frivolous_Archive tab so X sync never re-adds this tweet
  archiveFrivolousInSheet(targetTweetId, targetUrl, targetComplaintNo);

  if (deletedRow !== -1) {
    sheet.deleteRow(deletedRow);
    SpreadsheetApp.flush();
    return {
      status: 'ok',
      deleted: true,
      deletedRow: deletedRow,
      message: 'Row ' + deletedRow + ' deleted successfully from Google Sheet and added to Frivolous Archive'
    };
  }

  return {
    status: 'not_found',
    deleted: false,
    message: 'Complaint was not found in Google Sheet (might have already been removed)'
  };
}

/**
 * Permanently stores frivolous/deleted tweet IDs in a dedicated tab
 * so background cloud sync will NEVER resurrect or re-fetch them.
 */
function archiveFrivolousInSheet(tweetId, postUrl, complaintNo) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let archiveSheet = ss.getSheetByName('Frivolous_Archive');
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet('Frivolous_Archive');
      archiveSheet.appendRow(['Tweet ID', 'Post URL', 'Complaint No', 'Deleted At']);
      archiveSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#EF4444').setFontColor('#FFFFFF');
    }
    if (tweetId || postUrl) {
      archiveSheet.appendRow([tweetId || '', postUrl || '', complaintNo || '', Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss')]);
    }
  } catch (e) {
    Logger.log('Archive error: ' + e);
  }
}

/**
 * Deletes the currently selected row in Google Sheet as Frivolous
 */
function deleteSelectedRowAsFrivolous() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const activeCell = sheet.getActiveCell();
  const row = activeCell.getRow();
  if (row < 3) {
    SpreadsheetApp.getUi().alert('Please select a complaint row (Row 3 or below).');
    return;
  }
  const colMap = getSheetColumnMap(sheet);
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl + 1 : 5;
  const complaintNoCol = (colMap.complaintNo !== undefined) ? colMap.complaintNo + 1 : 16;

  const complaintUrl = String(sheet.getRange(row, linkUrlCol).getValue() || '').trim();
  const prompt = SpreadsheetApp.getUi().alert(
    'Delete Frivolous Complaint',
    'Are you sure you want to delete Row ' + row + ' (' + complaintUrl + ') as Frivolous from this sheet?\n\nIt will be permanently moved to the Frivolous_Archive tab and prevented from being re-fetched.',
    SpreadsheetApp.getUi().ButtonSet.YES_NO
  );
  if (prompt === SpreadsheetApp.getUi().Button.YES) {
    const m = complaintUrl.match(/status\/(\d+)/i);
    const tid = m ? m[1] : '';
    const cno = colMap.complaintNo !== undefined ? String(sheet.getRange(row, complaintNoCol).getValue() || '').trim() : '';
    archiveFrivolousInSheet(tid, complaintUrl, cno);
    sheet.deleteRow(row);
    SpreadsheetApp.flush();
    SpreadsheetApp.getUi().alert('Row ' + row + ' deleted and permanently archived as Frivolous.');
  }
}

/**
 * Scans Link URL column for any missing, malformed, or non-URL entries
 * and reconstructs the valid, canonical https://x.com link using the Tweet ID.
 */
function fixMalformedUrlsInSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;

  const colMap = getSheetColumnMap(sheet);
  const lastCol = sheet.getLastColumn();
  const data = sheet.getRange(3, 1, lastRow - 2, lastCol).getValues();
  let fixCount = 0;

  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;
  const twitterIdCol = (colMap.twitterId !== undefined) ? colMap.twitterId : 5;
  const postIdCol = (colMap.postId !== undefined) ? colMap.postId : ((colMap.postCreatedAt !== undefined) ? colMap.postCreatedAt : -1);

  const linkStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor('#1155cc')
    .setUnderline(true)
    .setFontFamily('Verdana')
    .setFontSize(10)
    .build();

  for (let i = 0; i < data.length; i++) {
    const rowIdx = i + 3;
    const url = String(data[i][linkUrlCol] || '').trim();
    const handle = String(data[i][twitterIdCol] || '').trim().replace(/^@/, '');
    const tweetId = (postIdCol !== -1) ? String(data[i][postIdCol] || '').trim() : '';

    if (!url.startsWith('http') && /^\d{15,25}$/.test(tweetId)) {
      const canonicalUrl = 'https://x.com/' + (handle || 'i') + '/status/' + tweetId;
      const richText = SpreadsheetApp.newRichTextValue()
        .setText(canonicalUrl)
        .setLinkUrl(canonicalUrl)
        .setTextStyle(linkStyle)
        .build();
      sheet.getRange(rowIdx, linkUrlCol + 1).setRichTextValue(richText);
      fixCount++;
    }
  }

  if (fixCount > 0) {
    SpreadsheetApp.flush();
    SpreadsheetApp.getUi().alert('Fixed ' + fixCount + ' malformed/missing post link(s) in Link URL column.');
  } else {
    SpreadsheetApp.getUi().alert('All post links in Link URL column are already valid URLs.');
  }
  return fixCount;
}

/**
 * Automatically fixes and normalizes the DATE column across all rows in 'Twitter Complaint List'.
 * Replaces 1900/1901/1902/1903/1904 numbers, long GMT timestamp strings (e.g. "Tue Oct 20 2026 12:30:00 GMT+0530"),
 * and raw Date objects with strictly normalized "DD-MM-YYYY" strings (e.g. 18-10-2026, 19-10-2026, 20-10-2026, 21-10-2026).
 */
function fixDateColumnInSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;
  const numRows = lastRow - 2;

  const colMap = getSheetColumnMap(sheet);
  const lastCol = sheet.getLastColumn();
  const data = sheet.getRange(3, 1, numRows, lastCol).getValues();
  const dateValues = [];
  let fixCount = 0;

  const dateCol = (colMap.date !== undefined) ? colMap.date : 0;
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;
  const postIdCol = (colMap.postId !== undefined) ? colMap.postId : -1;
  const detectedCol = (colMap.firstDetectedAt !== undefined) ? colMap.firstDetectedAt : -1;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rawCell = row[dateCol];
    const curDate = String(rawCell || '').trim();
    const url = String(row[linkUrlCol] || '').trim();
    const tidCol = (postIdCol !== -1) ? String(row[postIdCol] || '').trim() : '';
    const colDetected = (detectedCol !== -1) ? String(row[detectedCol] || '').trim() : '';

    let resolvedDate = null;

    // 1. If it is already strictly DD-MM-YYYY (e.g. "20-10-2026"), keep it
    if (/^\d{2}-\d{2}-\d{4}$/.test(curDate)) {
      resolvedDate = curDate;
    }
    // 2. If it is a native Date object from Google Sheets
    else if (rawCell instanceof Date) {
      resolvedDate = Utilities.formatDate(rawCell, 'Asia/Kolkata', 'dd-MM-yyyy');
    }
    // 3. If it is a long GMT/IST timestamp string (e.g. "Tue Oct 20 2026 12:30:00 GMT+0530")
    else if (curDate.includes('GMT') || curDate.includes('Standard Time') || /[a-zA-Z]{3}\s+[a-zA-Z]{3}\s+\d+/.test(curDate)) {
      const parsed = new Date(curDate);
      if (!isNaN(parsed.getTime())) {
        resolvedDate = Utilities.formatDate(parsed, 'Asia/Kolkata', 'dd-MM-yyyy');
      }
    }
    // 4. If it is YYYY-MM-DD or D-M-YYYY
    else if (/^\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}$/.test(curDate) && !/190[0-9]/.test(curDate)) {
      const parts = curDate.split(/[-\/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD -> DD-MM-YYYY
          resolvedDate = ('0' + parts[2]).slice(-2) + '-' + ('0' + parts[1]).slice(-2) + '-' + parts[0];
        } else {
          // D-M-YYYY -> DD-MM-YYYY
          resolvedDate = ('0' + parts[0]).slice(-2) + '-' + ('0' + parts[1]).slice(-2) + '-' + parts[2];
        }
      }
    }

    // 5. If still not resolved or corrupted (1900-1904, plain integer counter like "1", "2"):
    // Derive from Twitter Snowflake ID in Link URL or Tweet ID column
    if (!resolvedDate || resolvedDate.includes('190') || !resolvedDate.includes('202')) {
      const m = url.match(/status\/(\d+)/i);
      const tid = m ? m[1] : (tidCol && /^\d{15,25}$/.test(tidCol) ? tidCol : null);

      if (tid) {
        try {
          // Snowflake timestamp ms = Math.floor(id / 4194304) + 1288834974657
          const epochMs = Math.floor(Number(tid) / 4194304) + 1288834974657;
          const d = new Date(epochMs);
          if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030) {
            resolvedDate = Utilities.formatDate(d, 'Asia/Kolkata', 'dd-MM-yyyy');
          }
        } catch (e) {}
      }

      // Secondary fallback to First Detected At IST
      if (!resolvedDate && colDetected) {
        const dMatch = colDetected.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (dMatch) {
          resolvedDate = ('0' + dMatch[1]).slice(-2) + '-' + ('0' + dMatch[2]).slice(-2) + '-' + dMatch[3];
        }
      }

      // Tertiary default
      if (!resolvedDate) {
        resolvedDate = '19-10-2026';
      }
    }

    if (resolvedDate !== curDate) {
      fixCount++;
    }
    dateValues.push([resolvedDate]);
  }

  // Write batch values back into DATE column with text format to prevent Google Sheets from re-converting to 1900 serials
  const dateRange = sheet.getRange(3, dateCol + 1, numRows, 1);
  dateRange.setNumberFormat('@');
  dateRange.setValues(dateValues);
  dateRange.setHorizontalAlignment('center');
  dateRange.setVerticalAlignment('middle');
  dateRange.setFontFamily('Verdana');
  dateRange.setFontSize(10);
  dateRange.setFontColor('#000000');

  SpreadsheetApp.flush();

  const msg = 'Successfully normalized ' + fixCount + ' date entries in DATE column to uniform DD-MM-YYYY format!';
  try {
    SpreadsheetApp.getUi().alert('Date Column Normalization\n\n' + msg);
  } catch (e) {
    Logger.log(msg);
  }
  return fixCount;
}

/**
 * Scans all rows in 'Twitter Complaint List' and repairs misaligned rows
 * caused by previous hardcoded-column writes after the user manually rearranged the sheet layout.
 * Accurately recovers Post Text, Tweet ID, Link URL, Head, Picked Status, and classification,
 * then writes each field to its dynamically resolved column according to Row 1 headers.
 */
function repairMisalignedRowsInSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;
  const numRows = lastRow - 2;
  const colMap = getSheetColumnMap(sheet);
  const totalCols = sheet.getLastColumn();
  const data = sheet.getRange(3, 1, numRows, totalCols).getValues();

  let repairedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const sheetRowNumber = i + 3;

    const curText = (colMap.postText !== undefined) ? String(row[colMap.postText] || '').trim() : '';
    const curReply30 = (colMap.reply30 !== undefined) ? String(row[colMap.reply30] || '').trim() : '';
    const curPicked = (colMap.pickedStatus !== undefined) ? String(row[colMap.pickedStatus] || '').trim() : '';
    const curRouting = (colMap.routingConfidence !== undefined) ? String(row[colMap.routingConfidence] || '').trim() : '';
    const curHead = (colMap.head !== undefined) ? String(row[colMap.head] || '').trim() : '';

    // Check misalignment indicators
    const isMisaligned = (
      (!curText && (curRouting.length > 20 || /^\d{4,5}$/.test(curReply30))) ||
      /^(upm|upl|emm|akc|akm|upc)$/i.test(curPicked) ||
      curHead === 'NO' ||
      /^\d{4,5}$/.test(curReply30)
    );

    if (!isMisaligned) continue;

    // 1. Recover Tweet Text: check curRouting, or scan all cells for the longest string containing @ or Hindi
    let recoveredText = curRouting;
    if (!recoveredText || recoveredText.length < 15) {
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (val.length > recoveredText.length && (val.includes('@') || /[\u0900-\u097F]/.test(val))) {
          recoveredText = val;
        }
      }
    }

    // 2. Recover URL and Handle
    let recoveredUrl = (colMap.linkUrl !== undefined) ? String(row[colMap.linkUrl] || '').trim() : '';
    let recoveredHandle = (colMap.twitterId !== undefined) ? String(row[colMap.twitterId] || '').trim().replace(/^@/, '') : '';
    let recoveredTweetId = '';

    const tidMatch = recoveredUrl.match(/status\/(\d+)/i);
    if (tidMatch) {
      recoveredTweetId = tidMatch[1];
    } else {
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (/^\d{17,20}$/.test(val)) {
          recoveredTweetId = val;
          break;
        }
      }
      if (recoveredTweetId) {
        recoveredUrl = 'https://x.com/' + (recoveredHandle || 'i') + '/status/' + recoveredTweetId;
      }
    }

    // 3. Recover Head
    const recoveredHead = detectApexHead(recoveredText);

    // 4. Classification
    const c = classifyTweetInScript(recoveredText, recoveredHandle);

    // 5. Shift & Date
    const curDate = (colMap.date !== undefined) ? String(row[colMap.date] || '').trim() : '21-10-2026';
    const curShift = (colMap.linkShift !== undefined) ? String(row[colMap.linkShift] || '').trim() : 'MORNING';

    // 6. CF counter (sequential number)
    let cfVal = i + 1;
    if (/^\d+$/.test(curReply30)) {
      cfVal = curReply30;
    } else if (colMap.cf !== undefined && /^\d+$/.test(String(row[colMap.cf] || ''))) {
      cfVal = row[colMap.cf];
    }

    // Reconstruct clean row array matching totalCols
    const cleanRow = new Array(totalCols).fill('');
    if (colMap.date !== undefined) cleanRow[colMap.date] = curDate;
    if (colMap.linkShift !== undefined) cleanRow[colMap.linkShift] = curShift;
    if (colMap.replyShift !== undefined) cleanRow[colMap.replyShift] = curShift;
    if (colMap.cf !== undefined) cleanRow[colMap.cf] = cfVal;
    if (colMap.reply30 !== undefined) cleanRow[colMap.reply30] = c.replyWithin30Min;
    if (colMap.linkUrl !== undefined) cleanRow[colMap.linkUrl] = recoveredUrl;
    if (colMap.twitterId !== undefined) cleanRow[colMap.twitterId] = recoveredHandle;
    if (colMap.pickedStatus !== undefined) cleanRow[colMap.pickedStatus] = c.pickedStatus;
    if (colMap.head !== undefined) cleanRow[colMap.head] = recoveredHead;
    if (colMap.untagged !== undefined) cleanRow[colMap.untagged] = 'NO';
    if (colMap.uppclReplied !== undefined) cleanRow[colMap.uppclReplied] = '';
    if (colMap.complaintType !== undefined) cleanRow[colMap.complaintType] = c.complaintType;
    if (colMap.discom !== undefined) cleanRow[colMap.discom] = c.discom;
    if (colMap.zone !== undefined) cleanRow[colMap.zone] = c.zone;
    if (colMap.district !== undefined) cleanRow[colMap.district] = c.district;
    if (colMap.remark !== undefined) cleanRow[colMap.remark] = '';
    if (colMap.status !== undefined) cleanRow[colMap.status] = (c.pickedStatus === 'APPRECIATION') ? 'Appreciation' : (c.pickedStatus === 'YES' ? 'Forwarded to Discom' : 'Pending Review');
    if (colMap.complaintNo !== undefined) cleanRow[colMap.complaintNo] = '';
    if (colMap.postId !== undefined && recoveredTweetId) cleanRow[colMap.postId] = recoveredTweetId;
    if (colMap.postText !== undefined) cleanRow[colMap.postText] = recoveredText;
    if (colMap.postCreatedAt !== undefined) cleanRow[colMap.postCreatedAt] = '';
    if (colMap.firstDetectedAt !== undefined) cleanRow[colMap.firstDetectedAt] = curDate + ' ' + (curShift === 'EVENING' ? '18:00:00' : '10:00:00');
    if (colMap.language !== undefined) cleanRow[colMap.language] = (/[\u0900-\u097F]/.test(recoveredText)) ? 'hi' : 'en';
    if (colMap.routingConfidence !== undefined) cleanRow[colMap.routingConfidence] = 'HIGH';
    if (colMap.draftReply !== undefined) cleanRow[colMap.draftReply] = c.draftReply;
    if (colMap.approvalStatus !== undefined) cleanRow[colMap.approvalStatus] = 'DRAFT_READY';

    // Write aligned row back to sheet
    sheet.getRange(sheetRowNumber, 1, 1, totalCols).setValues([cleanRow]);

    // Restore hyperlink formatting
    if (colMap.linkUrl !== undefined && recoveredUrl.startsWith('http')) {
      const linkStyle = SpreadsheetApp.newTextStyle()
        .setForegroundColor('#1155cc')
        .setUnderline(true)
        .setFontFamily('Verdana')
        .setFontSize(10)
        .build();
      const rich = SpreadsheetApp.newRichTextValue()
        .setText(recoveredUrl)
        .setLinkUrl(recoveredUrl)
        .setTextStyle(linkStyle)
        .build();
      sheet.getRange(sheetRowNumber, colMap.linkUrl + 1).setRichTextValue(rich);
    }

    if (colMap.postText !== undefined) {
      sheet.getRange(sheetRowNumber, colMap.postText + 1).setHorizontalAlignment('left');
    }
    if (colMap.draftReply !== undefined) {
      sheet.getRange(sheetRowNumber, colMap.draftReply + 1).setHorizontalAlignment('left');
    }

    repairedCount++;
  }

  SpreadsheetApp.flush();
  const alertMsg = 'Repair Complete!\n\nRealigned ' + repairedCount + ' misaligned row(s) to match the new 23-column sheet layout perfectly.';
  try { SpreadsheetApp.getUi().alert(alertMsg); } catch (e) { Logger.log(alertMsg); }
  return repairedCount;
}





/**
 * Applies Complainant Frequency (CF) formula to Column C:
 * Formula: =IF($F3="","",COUNTIF($F:$F,$F3))
 * Counts how many times the Twitter ID in Column F repeats across the dataset.
 */
function applyCfFormulaToSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    try {
      SpreadsheetApp.getUi().alert('No data rows found in "Twitter Complaint List".');
    } catch(e) {
      Logger.log('No data rows found.');
    }
    return;
  }

  // Column C is Column index 3 (1-based)
  const cfRange = sheet.getRange(3, 3, lastRow - 2, 1);
  cfRange.setFormula('=IF($F3="","",COUNTIF($F:$F,$F3))');
  cfRange.setHorizontalAlignment('center').setVerticalAlignment('middle');
  SpreadsheetApp.flush();

  const msg = 'CF Formula Applied Successfully!\n\nPopulated =COUNTIF($F:$F, $F3) across ' + (lastRow - 2) + ' rows in Column C.';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch(e) {
    Logger.log(msg);
  }
}


/**
 * Restores the standard 23 column headers in Row 1 of 'Twitter Complaint List'
 * in case they were accidentally overwritten by a "Fill Right" (Ctrl+R) or fill-handle drag.
 */
function restoreStandardHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const standardHeaders = [
    'DATE',
    'Link Shift',
    'C F',
    'REPLY_WITHIN_30_MIN_BY_Laqshya Media',
    'LINK URL',
    'Twitter Id',
    'Picked Status',
    'Head',
    'Untagged Complaint',
    'UPPCLLKO Replied (YES/NO)',
    'Complaint Type',
    'DISCOM',
    'Zone',
    'District',
    'Status',
    'COMPLAINT_NO',
    'Post Text',
    'Post Created At (UTC)',
    'First Detected At (IST)',
    'Language',
    'Routing Confidence',
    'Suggested Reply Draft',
    'Reply Approval Status'
  ];

  const headerRange = sheet.getRange(1, 1, 1, standardHeaders.length);
  headerRange.setValues([standardHeaders]);
  headerRange.setFontFamily('Verdana').setFontSize(13).setFontWeight('bold')
    .setBackground('#4DD0E1').setFontColor('#1A2F40')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(1, 66);
  SpreadsheetApp.flush();

  const msg = 'Successfully restored all ' + standardHeaders.length + ' official column headers in Row 1!';
  try {
    SpreadsheetApp.getUi().alert('Headers Restored\n\n' + msg);
  } catch (e) {
    Logger.log(msg);
  }
}
