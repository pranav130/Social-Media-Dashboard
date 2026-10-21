/**
 * ==============================================================================
 * UPPCL SOCIAL MEDIA CELL — GOOGLE SHEETS INTEGRATION & SYNCHRONIZATION ENGINE
 * ==============================================================================
 * Primary Working Sheet: https://docs.google.com/spreadsheets/d/1shjWcK69y0S7pIHI-2V5Wh6c2SSSQBKcpgprmPbeNe8/edit?gid=283417465
 * Automated Trial Sheet: https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/edit?gid=598922870
 * 
 * Non-negotiable Architecture:
 * - Google Sheets is the sole authoritative source of truth.
 * - This engine pulls, validates, normalizes, and maintains a derived, rebuildable
 *   cache in SQLite for performant dashboard queries, analytics, and exports.
 * - Decodes Twitter Snowflake IDs to exact IST seconds (never hardcoded 12:00:00).
 * - Multi-transport dual-sheet reconciliation seamlessly combines operator manual
 *   classifications with automated monitoring.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');
const {
  TARGET_HANDLES,
  TARGET_HANDLES_CANONICAL,
  isPostEligible,
  getMatchedTargetHandles,
  resolvePrimaryMonitoredAccount
} = require('./eligibility');

// Primary: Operational Working Sheet (Authoritative Google Sheet)
const MANUAL_SPREADSHEET_ID = process.env.GOOGLE_MANUAL_SPREADSHEET_ID || '10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY';
const MANUAL_WORKSHEET_GID = process.env.GOOGLE_MANUAL_SHEET_GID || '598922870';
const MANUAL_WORKSHEET_NAME = process.env.GOOGLE_MANUAL_SHEET_TAB_NAME || 'Twitter Complaint List';

// Secondary: Automated Trial Monitoring Sheet
const AUTO_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY';
const AUTO_WORKSHEET_GID = process.env.GOOGLE_SHEET_GID || '598922870';
const AUTO_WORKSHEET_NAME = process.env.GOOGLE_SHEET_TAB_NAME || 'Twitter Complaint List';

const SPREADSHEET_ID = MANUAL_SPREADSHEET_ID;
const WORKSHEET_GID = MANUAL_WORKSHEET_GID;
const WORKSHEET_NAME = MANUAL_WORKSHEET_NAME;

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
 * Retrieve set of all frivolous/deleted tweet IDs, URLs, and complaint numbers
 */
function getFrivolousIdentifiersSet() {
  const set = new Set();

  const addIdentifier = (rawTid, rawUrl, rawCno) => {
    if (rawTid) set.add(String(rawTid).trim());
    if (rawCno) set.add(String(rawCno).trim().toLowerCase());
    if (rawUrl) {
      const u = String(rawUrl).trim().toLowerCase();
      set.add(u);
      set.add(u.split('?')[0]);
      set.add(u.replace(/\/$/, ''));
      const m = u.match(/status\/(\d+)/i);
      if (m && m[1]) set.add(m[1]);
    }
  };

  // 1. Load from SQLite frivolous_complaints table
  try {
    const rows = db.query("SELECT post_url, tweet_id, complaint_no FROM frivolous_complaints;");
    if (rows && rows.length) {
      for (const fr of rows) {
        addIdentifier(fr.tweet_id, fr.post_url, fr.complaint_no);
      }
    }
  } catch (e) {}

  // 2. Load from persistent data/frivolous_ledger.json file (persists across server restarts)
  try {
    const ledgerFile = path.join(__dirname, 'data', 'frivolous_ledger.json');
    if (fs.existsSync(ledgerFile)) {
      const fileData = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
      if (Array.isArray(fileData)) {
        for (const item of fileData) {
          addIdentifier(item.tweet_id, item.post_url, item.complaint_no);
        }
      }
    }
  } catch (e) {}

  return set;
}

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
  if (/^\d{4,5}$/.test(str)) {
    const serial = parseInt(str, 10);
    if (serial > 40000) {
      const epoch = new Date((serial - 25569) * 86400 * 1000);
      return getIstTimestamp(epoch).split(' ')[0];
    }
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const y = parseInt(str.substring(0, 4), 10);
    if (y >= 2020 && y <= 2030) return str.substring(0, 10);
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const y = parseInt(dmy[3], 10);
    if (y >= 2020 && y <= 2030) {
      const d = String(dmy[1]).padStart(2, '0');
      const m = String(dmy[2]).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // General Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y >= 2020 && y <= 2030) {
      return getIstTimestamp(parsed).split(' ')[0];
    }
  }

  return getIstTimestamp().split(' ')[0];
}

/**
 * Extract Twitter/X Status ID from URL
 */
function extractTweetId(url) {
  if (!url) return '';
  const m = String(url).match(/status\/(\d+)/i);
  return m ? m[1] : '';
}

/**
 * Extract exact IST creation timestamp down to the second from Twitter Snowflake ID.
 * Falls back to shift approximate time if ID is absent, never flat 12:00:00.
 */
function extractExactTimestampIST(linkUrl, rawDate, shift = '') {
  if (linkUrl) {
    const tweetId = extractTweetId(linkUrl);
    if (tweetId) {
      try {
        const tweetIdBig = BigInt(tweetId);
        const epochMs = (tweetIdBig >> 22n) + 1288834974657n;
        const d = new Date(Number(epochMs));
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030) {
          return getIstTimestamp(d);
        }
      } catch (e) {}
    }
  }

  const istDate = parseDateIST(rawDate);
  const s = String(shift || '').toUpperCase();
  let timeStr = '12:00:00';
  if (s.includes('NIGHT')) timeStr = '02:30:00';
  else if (s.includes('MORNING')) timeStr = '09:30:00';
  else if (s.includes('EVENING')) timeStr = '17:30:00';
  return `${istDate} ${timeStr}`;
}

/**
 * Normalize and canonicalize column headers
 */
function buildHeaderIndexMap(headers) {
  const map = {};
  if (!headers || !headers.length) return map;

  headers.forEach((h, idx) => {
    if (!h) return;
    const raw = String(h).trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) return;

    // Map canonical fields
    if (clean === 'date' || clean === 'receiveddate') map['date'] = idx;
    else if (clean === 'linkshift') map['link_shift'] = idx;
    else if (clean === 'replyshift') map['reply_shift'] = idx;
    else if (clean === 'cf' || clean === 'cfstatus') map['c_f'] = idx;
    else if (clean.includes('30min') || clean.includes('reply30') || (clean.includes('replywithin') && clean.includes('30'))) map['reply_within_30_min'] = idx;
    else if (clean.includes('60min') || clean.includes('reply60') || (clean.includes('replywithin') && clean.includes('60'))) map['reply_within_60_min'] = idx;
    else if (clean === 'linkurl' || clean === 'posturl' || clean === 'tweeturl' || (clean.includes('link') && clean.includes('url')) || clean === 'url') map['link_url'] = idx;
    else if (clean === 'twitterid' || clean === 'twitterhandle' || clean === 'consumerhandle' || clean === 'handle' || clean === 'author' || clean === 'account') map['twitter_id'] = idx;
    else if (clean === 'pickedstatus' || clean === 'picked') map['picked_status'] = idx;
    else if (clean === 'head') map['head'] = idx;
    else if (clean === 'untaggedcomplaint' || clean.includes('untagged')) map['untagged_complaint'] = idx;
    else if ((clean.includes('uppcl') || clean.includes('replied')) && (clean.includes('yesno') || clean.includes('replied'))) map['uppcl_replied'] = idx;
    else if (clean === 'complainttype' || clean === 'category' || clean === 'complainttypename') map['complaint_type'] = idx;
    else if (clean === 'discom') map['discom'] = idx;
    else if (clean === 'zone') map['zone'] = idx;
    else if (clean === 'district') map['district'] = idx;
    else if (clean === 'remark' || clean === 'remarks') map['remark'] = idx;
    else if (clean === 'status') map['status'] = idx;
    else if (clean.includes('complaintno') || clean === 'cno') map['complaint_no'] = idx;
    else if (clean === 'sts') map['sts'] = idx;
    else if (clean === 'postid' || clean === 'tweetid' || (clean.includes('postid') && !clean.includes('reply'))) map['post_id'] = idx;
    else if (clean.includes('posttext') || clean.includes('tweettext') || clean === 'complaintdetail' || clean === 'text') map['post_text'] = idx;
    else if (clean.includes('postcreated') || clean.includes('createdat')) map['post_created_at'] = idx;
    else if (clean.includes('firstdetected') || clean.includes('detectedat')) map['first_detected_at'] = idx;
    else if (clean === 'language' || clean === 'lang') map['language'] = idx;
    else if (clean.includes('routingconfidence') || clean.includes('confidence')) map['routing_confidence'] = idx;
    else if (clean.includes('suggestedreplydraft') || clean.includes('draftreply') || clean.includes('draft')) map['draft_reply'] = idx;
    else if (clean.includes('replyapprovalstatus') || clean.includes('approvalstatus') || clean.includes('approval')) map['approval_status'] = idx;
    else if (clean.includes('replyposturl')) map['reply_post_url'] = idx;
    else if (clean.includes('replypostid')) map['reply_post_id'] = idx;
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

/**
 * 89 Official Non-UPPCL Hierarchy Handles (Apex & Ministerial, DISCOM HQs, and Regional/Field handles)
 * Rule: If ANY of these 89 handles replies to a consumer post BEFORE @UPPCLLKO,
 * that post must NOT land on Google Sheet, and if already present, must be DELETED from the dashboard and sheet.
 */
const NON_UPPCL_OFFICIAL_HANDLES = new Set([
  // Apex & Ministerial (6 handles)
  'cmofficeup', 'emofficeup', 'aksharmaoffice', 'aksharmabharat', 'chairmanuppcl', 'mduppcl',
  // DISCOM Corporate HQs (5 handles)
  'pvvnlhq', 'dvvnlhq', 'puvvnlhq', 'mvvnlhq', 'kescohq',
  // PuVVNL Regional & Field (21 handles)
  'puvvnlazamgarh', 'puvvnlbhadohi', 'puvvnlballia', 'puvvnlbasti', 'puvvnlchandauli', 'puvvnldeoria',
  'puvvnlfatehpur', 'puvvnlghazipur', 'puvvnlgorakhpur', 'puvvnljaunpur', 'puvvnlkaushambi', 'puvvnlkusinagar',
  'puvvnlmhrjganj', 'puvvnlmau', 'puvvnlmirzapur1', 'puvvnlprtapgarh', 'puvvnlprayagraj', 'puvvnlsknagar',
  'puvvnlsdnagar', 'puvvnlsonbhadra', 'puvvnlvaranasi',
  // MVVNL Regional & Field (22 handles)
  'mvvnlbareilly', 'mvvnlbudaun', 'mvvnlpilibhit', 'mvvnlsahjahapur', 'edc_ambdkrnagar', 'mvvnlamethi',
  'mvvnlbarabanki', 'mvvnlayodhya', 'mvvnlsultanpur', 'mvvnlbahraich', 'mvvnlbalrampur', 'mvvnlgonda',
  'mvvnlshrawasti', 'zoneamausi', 'mvvnlcisgomti2', 'zonegomtinagar', 'mvvnllesatrans', 'mvvnllakhimpur',
  'mvvnlhardoi', 'mvvnlraebareli', 'mvvnlsitapur', 'mvvnlunnao',
  // DVVNL Regional & Field (21 handles)
  'dvvnlagra', 'dvvnlaligarh', 'dvvnlauraiya', 'dvvnlbanda', 'dvvnlchitrakoot', 'dvvnletah',
  'dvvnletawah01', 'dvvnlfarrukhaba', 'dvvnlfirozabad', 'dvvnlhamirpur', 'dvvnlhathras', 'dvvnljalaun2',
  'dvvnljhansi', 'dvvnlkannauj', 'dvvnlkanpurdeha', 'dvvnlkanpurnagr', 'dvvnlkasganj', 'dvvnllalitpur2',
  'dvvnlmahoba', 'dvvnlmainpuri', 'dvvnlmathura1',
  // PVVNL Regional & Field (14 handles)
  'pvvnlamroha', 'pvvnlbaghpat', 'pvvnlbijnor', 'pvvnlbulandshr', 'pvvnlgbnagar', 'pvvnlghaziabad',
  'pvvnlhapur', 'pvvnlmeerut', 'pvvnlmoradabad', 'pvvnlmuzafarngr', 'pvvnlrampur', 'pvvnlsaharanpur',
  'pvvnlsambhal', 'pvvnlshamli'
]);

function isNonUppclOfficialHandle(str) {
  if (!str) return false;
  let clean = String(str).toLowerCase().replace(/^@/, '').trim();
  const urlMatch = clean.match(/(?:x|twitter)\.com\/([^\/\?#]+)/i);
  if (urlMatch && urlMatch[1]) {
    clean = urlMatch[1].toLowerCase().replace(/^@/, '').trim();
  }
  return NON_UPPCL_OFFICIAL_HANDLES.has(clean);
}

/**
 * Authoritative 5 Monitored Official Handles:
 * 1. @UPPCLLKO       - UPPCL Official HQ
 * 2. @EMofficeUP     - Energy Minister Office UP
 * 3. @AKSharmaOffice - A.K. Sharma Office
 * 4. @aksharmaBharat - A.K. Sharma
 * 5. @mduppcl        - Managing Director, UPPCL
 */
const MONITORED_OFFICIAL_HEADS = new Set(['upl', 'emo', 'emm', 'ako', 'akm', 'akb', 'akc', 'upm']);

function resolveMonitoredAccount(head, text, url) {
  const t = (text || '').toLowerCase();
  const u = (url || '').toLowerCase();
  const h = (head || '').toLowerCase();

  if (t.includes('mduppcl') || u.includes('mduppcl') || h === 'upm') return { handle: '@mduppcl', head: 'upm' };
  if (t.includes('aksharmaoffice') || u.includes('aksharmaoffice') || h === 'ako' || h === 'akm') return { handle: '@AKSharmaOffice', head: (h === 'ako' ? 'ako' : 'akm') };
  if (t.includes('aksharmabharat') || u.includes('aksharmabharat') || h === 'akb' || h === 'akc') return { handle: '@aksharmaBharat', head: (h === 'akb' ? 'akb' : 'akc') };
  if (t.includes('emofficeup') || u.includes('emofficeup') || h === 'emo' || h === 'emm') return { handle: '@EMofficeUP', head: (h === 'emo' ? 'emo' : 'emm') };
  if (t.includes('uppcllko') || u.includes('uppcllko') || h === 'upl') return { handle: '@UPPCLLKO', head: 'upl' };

  if (MONITORED_OFFICIAL_HEADS.has(h)) {
    if (h === 'upm') return { handle: '@mduppcl', head: h };
    if (h === 'ako' || h === 'akm') return { handle: '@AKSharmaOffice', head: h };
    if (h === 'akb' || h === 'akc') return { handle: '@aksharmaBharat', head: h };
    if (h === 'emo' || h === 'emm') return { handle: '@EMofficeUP', head: h };
    return { handle: '@UPPCLLKO', head: 'upl' };
  }

  return null;
}

/**
 * Checks whether a post should be deleted or omitted because:
 * 1) Remark or status contains 'delete'/'deleted'
 * 2) DISCOM / field handle replied without or before @UPPCLLKO
 * 3) Remark states DISCOM/field handle already replied
 */
function shouldDeleteOrOmitPost({ remark = '', status = '', reply30 = '', reply60 = '', tweetId = '', threadCheckResult = null }) {
  const cleanRemark = String(remark || '').toLowerCase().trim();
  const cleanStatus = String(status || '').toLowerCase().trim();
  const cleanR30 = String(reply30 || '').toUpperCase().trim();
  const cleanR60 = String(reply60 || '').toUpperCase().trim();

  // 1. Explicit deletion in Remark or Status (e.g. 'deleted', 'delete', 'frivolous', 'duplicate', 'invalid')
  if (cleanRemark.includes('delete') || cleanStatus.includes('delete') ||
      cleanRemark.includes('frivolous') || cleanStatus.includes('frivolous') ||
      cleanRemark.includes('duplicate') || cleanStatus.includes('duplicate') ||
      cleanRemark.includes('invalid') || cleanStatus.includes('invalid') ||
      cleanRemark.includes('spam') || cleanStatus.includes('spam') ||
      cleanRemark.includes('ignore') || cleanStatus.includes('ignore')) {
    return { shouldOmit: true, reason: 'EXPLICIT_DELETED_IN_SHEET' };
  }

  // 2. Remark indicates DISCOM or field handle already replied / attended before UPPCLLKO
  if (/replied.*(?:discom|pvvnl|puvvnl|mvvnl|dvvnl|kesco|field|cmoffice|emoffice)|(?:discom|pvvnl|puvvnl|mvvnl|dvvnl|kesco|field).*replied|attended.*(?:discom|field)/i.test(cleanRemark)) {
    return { shouldOmit: true, reason: 'REMARK_INDICATES_OFFICIAL_REPLY' };
  }

  // 3. Sheet Reply columns: DISCOM replied (Col 16) but UPPCLLKO (Col 15) did not reply
  const isDiscomReplied = cleanR60 && cleanR60 !== 'NO' && cleanR60 !== '-';
  const isUppclReplied = cleanR30 && cleanR30 !== 'NO' && cleanR30 !== '-';
  if (isDiscomReplied && !isUppclReplied) {
    return { shouldOmit: true, reason: 'DISCOM_REPLIED_WITHOUT_UPPCLLKO' };
  }

  // 4. Live X API conversation thread check
  if (threadCheckResult && threadCheckResult.officialRepliedFirst) {
    return { shouldOmit: true, reason: `OFFICIAL_HANDLE_${threadCheckResult.handle}_REPLIED_BEFORE_UPPCL` };
  }

  return { shouldOmit: false };
}

const threadCheckCache = new Map();

/**
 * Live X API check: verifies if any of the 89 non-UPPCL official handles replied
 * to a conversation before @UPPCLLKO replied.
 */
async function checkOfficialRepliedBeforeUppcl(tweetId, customBearerToken) {
  if (!tweetId) return { officialRepliedFirst: false };
  if (threadCheckCache.has(tweetId)) {
    return threadCheckCache.get(tweetId);
  }

  const bearerToken = customBearerToken || process.env.X_BEARER_TOKEN || 'AAAAAAAAAAAAAAAAAAAAACbr%2FwEAAAAAySPqrdOjXkNWagBKKbkzMA97ZnI%3DRBPSknXnu5S8uXS3j7lPbXPHlYCpiLfD2Yt8cRtRvWm1NcSi1E';
  if (!bearerToken || bearerToken.length < 20) {
    return { officialRepliedFirst: false };
  }

  try {
    const query = `conversation_id:${tweetId}`;
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&tweet.fields=created_at,author_id,conversation_id&expansions=author_id&user.fields=username`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'User-Agent': 'UPPCL-Grievance-Command-Centre/2.0'
      }
    });

    if (!resp.ok) {
      return { officialRepliedFirst: false };
    }

    const json = await resp.json();
    const tweets = json.data || [];
    const users = (json.includes && json.includes.users) ? json.includes.users : [];
    const userMap = {};
    users.forEach(u => { userMap[u.id] = (u.username || '').toLowerCase(); });

    let uppclReplyTime = null;
    let officialReplyTime = null;
    let officialRepliedHandle = null;

    for (const tw of tweets) {
      const username = userMap[tw.author_id];
      if (username === 'uppcllko') {
        const t = new Date(tw.created_at).getTime();
        if (!uppclReplyTime || t < uppclReplyTime) uppclReplyTime = t;
      } else if (NON_UPPCL_OFFICIAL_HANDLES.has(username)) {
        const t = new Date(tw.created_at).getTime();
        if (!officialReplyTime || t < officialReplyTime) {
          officialReplyTime = t;
          officialRepliedHandle = username;
        }
      }
    }

    let result = { officialRepliedFirst: false };
    if (officialReplyTime) {
      if (!uppclReplyTime || officialReplyTime < uppclReplyTime) {
        result = {
          officialRepliedFirst: true,
          handle: officialRepliedHandle,
          officialTime: officialReplyTime,
          uppclTime: uppclReplyTime
        };
      }
    }

    threadCheckCache.set(tweetId, result);
    return result;
  } catch (e) {
    return { officialRepliedFirst: false };
  }
}

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
 * Fetch raw sheet matrix from all available transports, seamlessly reconciling
 * both the Active Manual Working Sheet and the Automated Monitoring Sheet.
 */
async function fetchSheetMatrix() {
  const errors = [];

  // Transport 1: Dual-Sheet CSV Export (Direct Link-Shared Fetch)
  try {
    const manualCsvUrl = `https://docs.google.com/spreadsheets/d/${MANUAL_SPREADSHEET_ID}/export?format=csv&gid=${MANUAL_WORKSHEET_GID}`;
    const autoCsvUrl = `https://docs.google.com/spreadsheets/d/${AUTO_SPREADSHEET_ID}/export?format=csv&gid=${AUTO_WORKSHEET_GID}`;

    let manualRows = null;
    let autoRows = null;

    if (manualCsvUrl === autoCsvUrl) {
      try {
        const res = await fetch(manualCsvUrl);
        if (res.ok) {
          const csvText = await res.text();
          if (!csvText.includes('<!DOCTYPE html>') && !csvText.includes('<html')) {
            const parsed = parseCSV(csvText);
            if (parsed.length >= 2) {
              manualRows = parsed;
              autoRows = parsed;
            }
          }
        }
      } catch (e) {
        errors.push(`CSV fetch failed: ${e.message}`);
      }
    } else {
      const [manualRes, autoRes] = await Promise.allSettled([
        fetch(manualCsvUrl),
        fetch(autoCsvUrl)
      ]);

      if (manualRes.status === 'fulfilled' && manualRes.value.ok) {
        const csvText = await manualRes.value.text();
        if (!csvText.includes('<!DOCTYPE html>') && !csvText.includes('<html')) {
          const parsed = parseCSV(csvText);
          if (parsed.length >= 2) manualRows = parsed;
        }
      }

      if (autoRes.status === 'fulfilled' && autoRes.value.ok) {
        const csvText = await autoRes.value.text();
        if (!csvText.includes('<!DOCTYPE html>') && !csvText.includes('<html')) {
          const parsed = parseCSV(csvText);
          if (parsed.length >= 2) autoRows = parsed;
        }
      }
    }

    // If both sheets succeeded, merge them intelligently
    if (manualRows && autoRows) {
      const headers = manualRows[0];
      const mergedMap = new Map();
      const frivolousSet = getFrivolousIdentifiersSet();

      const manualHeaderMap = buildHeaderIndexMap(manualRows[0]);
      const autoHeaderMap = buildHeaderIndexMap(autoRows[0]);

      const getValFromMap = (rArr, hMap, key, fallbackIdx) => {
        if (hMap[key] !== undefined && rArr[hMap[key]] !== undefined && String(rArr[hMap[key]]).trim() !== '') {
          return String(rArr[hMap[key]]).trim();
        }
        if (fallbackIdx !== undefined && rArr[fallbackIdx] !== undefined) {
          return String(rArr[fallbackIdx] || '').trim();
        }
        return '';
      };

      // 1. Process manual working sheet first (authoritative human-classified values)
      for (let r = 2; r < manualRows.length; r++) {
        const row = manualRows[r];
        const url = getValFromMap(row, manualHeaderMap, 'link_url', 4);
        const handle = getValFromMap(row, manualHeaderMap, 'twitter_id', 5);
        const text = getValFromMap(row, manualHeaderMap, 'post_text', 16);
        const remark = getValFromMap(row, manualHeaderMap, 'remark');
        const status = getValFromMap(row, manualHeaderMap, 'status', 14);
        const reply30 = getValFromMap(row, manualHeaderMap, 'reply_within_30_min', 3);
        const reply60 = getValFromMap(row, manualHeaderMap, 'reply_within_60_min');

        if (!url && !handle && !text) continue;
        if (isOfficialHandle(handle) || isOfficialHandle(url)) continue;
        // Strictly enforce 5 official monitored accounts eligibility on post text
        if (!isPostEligible(text)) continue;

        const tid = extractTweetId(url) || url;
        if (!tid) continue;
        if (frivolousSet.has(tid) || (url && frivolousSet.has(url.toLowerCase()))) continue;

        // Skip posts where official handle replied before UPPCLLKO or marked deleted
        const check = shouldDeleteOrOmitPost({ remark, status, reply30, reply60, tweetId: tid });
        if (check.shouldOmit) {
          frivolousSet.add(tid);
          if (url) frivolousSet.add(url.toLowerCase());
          continue;
        }

        mergedMap.set(tid, {
          row,
          source: 'MANUAL_SHEET',
          sheetRowIndex: r + 1
        });
      }

      // 2. Append any unique non-official complaints from auto monitoring sheet
      for (let r = 2; r < autoRows.length; r++) {
        const row = autoRows[r];
        const url = getValFromMap(row, autoHeaderMap, 'link_url', 4);
        const handle = getValFromMap(row, autoHeaderMap, 'twitter_id', 5);
        const text = getValFromMap(row, autoHeaderMap, 'post_text', 16);
        const remark = getValFromMap(row, autoHeaderMap, 'remark');
        const status = getValFromMap(row, autoHeaderMap, 'status', 14);
        const reply30 = getValFromMap(row, autoHeaderMap, 'reply_within_30_min', 3);
        const reply60 = getValFromMap(row, autoHeaderMap, 'reply_within_60_min');

        if (!url && !handle && !text) continue;
        if (isOfficialHandle(handle) || isOfficialHandle(url)) continue;
        // Strictly enforce 5 official monitored accounts eligibility on post text
        if (!isPostEligible(text)) continue;

        const tid = extractTweetId(url) || url;
        if (!tid) continue;
        if (frivolousSet.has(tid) || (url && frivolousSet.has(url.toLowerCase()))) continue;

        // Skip posts where official handle replied before UPPCLLKO or marked deleted
        const check = shouldDeleteOrOmitPost({ remark, status, reply30, reply60, tweetId: tid });
        if (check.shouldOmit) {
          frivolousSet.add(tid);
          if (url) frivolousSet.add(url.toLowerCase());
          continue;
        }

        if (!mergedMap.has(tid)) {
          mergedMap.set(tid, {
            row,
            source: 'AUTO_SHEET',
            sheetRowIndex: r + 1
          });
        }
      }

      const mergedData = Array.from(mergedMap.values());
      return {
        headers,
        data: mergedData,
        method: 'GOOGLE_SHEETS_DUAL_SYNC'
      };
    }

    // Fallback: If only manual working sheet succeeded
    if (manualRows) {
      const frivolousSet = getFrivolousIdentifiersSet();
      const validData = [];
      const mHeaderMap = buildHeaderIndexMap(manualRows[0]);
      for (let idx = 0; idx < manualRows.slice(2).length; idx++) {
        const row = manualRows[idx + 2];
        const url = getValFromMap(row, mHeaderMap, 'link_url', 4);
        const handle = getValFromMap(row, mHeaderMap, 'twitter_id', 5);
        const text = getValFromMap(row, mHeaderMap, 'post_text', 16);
        const remark = getValFromMap(row, mHeaderMap, 'remark');
        const status = getValFromMap(row, mHeaderMap, 'status', 14);
        const reply30 = getValFromMap(row, mHeaderMap, 'reply_within_30_min', 3);
        const reply60 = getValFromMap(row, mHeaderMap, 'reply_within_60_min');
        const tid = extractTweetId(url) || url;

        if (isOfficialHandle(handle) || isOfficialHandle(url)) continue;
        if (!isPostEligible(text)) continue;
        if (tid && frivolousSet.has(tid)) continue;
        if (url && frivolousSet.has(url.toLowerCase())) continue;
        if (shouldDeleteOrOmitPost({ remark, status, reply30, reply60, tweetId: tid }).shouldOmit) continue;

        validData.push({ row, source: 'MANUAL_SHEET', sheetRowIndex: idx + 3 });
      }

      return {
        headers: manualRows[0],
        data: validData,
        method: 'GOOGLE_SHEETS_MANUAL_CSV'
      };
    }

    // Fallback: If only auto sheet succeeded
    if (autoRows) {
      const frivolousSet = getFrivolousIdentifiersSet();
      const validData = [];
      const aHeaderMap = buildHeaderIndexMap(autoRows[0]);
      for (let idx = 0; idx < autoRows.slice(2).length; idx++) {
        const row = autoRows[idx + 2];
        const url = getValFromMap(row, aHeaderMap, 'link_url', 4);
        const handle = getValFromMap(row, aHeaderMap, 'twitter_id', 5);
        const text = getValFromMap(row, aHeaderMap, 'post_text', 16);
        const remark = getValFromMap(row, aHeaderMap, 'remark');
        const status = getValFromMap(row, aHeaderMap, 'status', 14);
        const reply30 = getValFromMap(row, aHeaderMap, 'reply_within_30_min', 3);
        const reply60 = getValFromMap(row, aHeaderMap, 'reply_within_60_min');
        const tid = extractTweetId(url) || url;

        if (isOfficialHandle(handle) || isOfficialHandle(url)) continue;
        if (!isPostEligible(text)) continue;
        if (tid && frivolousSet.has(tid)) continue;
        if (url && frivolousSet.has(url.toLowerCase())) continue;
        if (shouldDeleteOrOmitPost({ remark, status, reply30, reply60, tweetId: tid }).shouldOmit) continue;

        validData.push({ row, source: 'AUTO_SHEET', sheetRowIndex: idx + 3 });
      }

      return {
        headers: autoRows[0],
        data: validData,
        method: 'GOOGLE_SHEETS_AUTO_CSV'
      };
    }

    errors.push('Both CSV exports were redirected or returned invalid responses');
  } catch (e) {
    errors.push(`CSV fetch failed: ${e.message}`);
  }

  // Transport 2: Google Apps Script Webhook
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
            data: json.data.map((row, idx) => ({ row, source: 'WEBHOOK', sheetRowIndex: idx + 3 })),
            method: 'APPS_SCRIPT_WEBHOOK_POST'
          };
        }
      }
    } catch (e) {
      errors.push(`Webhook POST failed: ${e.message}`);
    }
  }

  // Transport 3: Graceful fallback to existing SQLite replica cache
  const existingRecords = db.get("SELECT COUNT(*) as cnt FROM complaints;");
  if (existingRecords && existingRecords.cnt > 0) {
    return {
      headers: [],
      data: [],
      method: 'COMMITTED_SQLITE_REPLICA',
      existingCount: existingRecords.cnt,
      warning: `Serving verified SQLite replica cache of ${existingRecords.cnt} records.`
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
        spreadsheetId: MANUAL_SPREADSHEET_ID,
        worksheetGid: MANUAL_WORKSHEET_GID,
        worksheetName: MANUAL_WORKSHEET_NAME
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
  const frivolousSet = getFrivolousIdentifiersSet();

  let validCount = 0;
  let qualityIssuesCount = 0;

  // 1. Snapshot existing verified reply status & DISCOM assignment before refresh
  const existingMap = new Map();
  try {
    const existingReplied = db.query("SELECT post_url, original_post_id, uppcl_replied, reply_evidence, first_replied_at, discom_tagged_in_reply, current_status, picked_status FROM complaints;");
    for (const er of existingReplied) {
      if (er.post_url) existingMap.set(er.post_url, er);
      if (er.original_post_id) existingMap.set(er.original_post_id, er);
    }
  } catch (e) {}

  // Clean out previous Twitter/X cache and remove all legacy demo seed records
  // to ensure 100% exact 1-to-1 parity with authoritative sheet
  db.run("DELETE FROM complaints WHERE platform = 'Twitter/X' OR created_by = 'SMC System Seed' OR complaint_no LIKE 'UPPCL-SMC-%';");
  db.run("DELETE FROM complaint_timeline WHERE complaint_id NOT IN (SELECT id FROM complaints);");
  db.run("DELETE FROM complaint_forwarding_logs WHERE complaint_id NOT IN (SELECT id FROM complaints);");
  db.run("DELETE FROM complaint_escalation_logs WHERE complaint_id NOT IN (SELECT id FROM complaints);");
  db.run("DELETE FROM x_outgoing_replies WHERE complaint_id NOT IN (SELECT id FROM complaints);");

  // Track used complaint numbers to guarantee uniqueness
  const usedComplaintNos = new Set();
  const existingNos = db.query("SELECT complaint_no FROM complaints;");
  for (const en of existingNos) {
    if (en.complaint_no) usedComplaintNos.add(en.complaint_no);
  }

  // Prepare statement for inserting normalized complaint
  const insertStmt = `
    INSERT OR REPLACE INTO complaints (
      complaint_no, received_at, platform, monitored_account, hierarchy_handle_name,
      is_tagged, consumer_name, consumer_handle, post_url, complaint_text,
      category_name, subcategory_name, discom_name, district_name, zone_name,
      priority, current_status, forwarding_ref_no, forwarding_remarks,
      is_overdue, escalation_level, closure_date, created_at, updated_at,
      sheet_row_index, link_shift, reply_shift, c_f, head, untagged_complaint,
      picked_status, complaint_type, reply_within_30_min, reply_within_60_min,
      draft_reply, approval_status, data_quality_flags,
      uppcl_replied, reply_evidence, first_replied_at, discom_tagged_in_reply,
      target_mentions
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?
    );
  `;

  // Process every data item
  for (let r = 0; r < data.length; r++) {
    const item = data[r];
    const row = (item && item.row) ? item.row : item;
    if (!row || !row.length || row.every(c => String(c).trim() === '')) {
      continue;
    }

    const rowIndex = (item && item.sheetRowIndex) ? item.sheetRowIndex : (r + 3);

    // Extract values using headerMap with index fallbacks (0-indexed)
    const getVal = (canonicalKey, fallbackIdx) => {
      if (headerMap[canonicalKey] !== undefined && row[headerMap[canonicalKey]] !== undefined && String(row[headerMap[canonicalKey]]).trim() !== '') {
        return String(row[headerMap[canonicalKey]]).trim();
      }
      if (fallbackIdx !== undefined && row[fallbackIdx] !== undefined) {
        return String(row[fallbackIdx] || '').trim();
      }
      return '';
    };

    const rawDate = getVal('date', 0);
    const linkShift = getVal('link_shift', 1);
    const replyShift = getVal('reply_shift', 2);
    const cf = getVal('c_f', 2) || getVal('c_f', 3);
    let linkUrl = getVal('link_url', 4);
    let twitterId = getVal('twitter_id', 5);
    const rawPickedStatus = getVal('picked_status', 6) || getVal('picked_status', 8);
    const head = getVal('head', 7) || getVal('head', 6);
    const untagged = getVal('untagged_complaint', 8) || getVal('untagged_complaint', 7);
    const sheetUppclReplied = getVal('uppcl_replied', 9);
    const rawCategory = getVal('complaint_type', 10) || getVal('complaint_type', 9) || 'DISSATISFIED_CONSUMER';
    const rawDiscom = getVal('discom', 11) || getVal('discom', 10);
    const rawZone = getVal('zone', 12) || getVal('zone', 11);
    const rawDistrict = getVal('district', 13) || getVal('district', 12);
    const remark = getVal('remark');
    const rawStatus = getVal('status', 14) || 'Pending';
    const reply30 = getVal('reply_within_30_min', 3) || getVal('reply_within_30_min', 15);
    const reply60 = getVal('reply_within_60_min');
    const rawComplaintNo = getVal('complaint_no', 15) || getVal('complaint_no', 17);
    const rawPostText = getVal('post_text', 16) || remark;
    const postCreatedAt = getVal('post_created_at', 17) || getVal('post_created_at', 21);
    const firstDetectedAt = getVal('first_detected_at', 18) || getVal('first_detected_at', 22);
    const language = getVal('language', 19) || getVal('language', 23);
    const routingConfidence = getVal('routing_confidence', 20) || getVal('routing_confidence', 24);
    const draftReply = getVal('draft_reply', 21) || getVal('draft_reply', 25) || getVal('draft_reply', 26);
    const approvalStatus = getVal('approval_status', 22) || getVal('approval_status', 26) || getVal('approval_status', 27) || 'DRAFT_READY';

    // Bulletproof URL auto-recovery
    if (!linkUrl || !linkUrl.startsWith('http')) {
      let foundHttpUrl = '';
      if (row[4] && String(row[4]).trim().startsWith('http')) {
        foundHttpUrl = String(row[4]).trim();
      } else {
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          const cellStr = String(row[colIdx] || '').trim();
          if (/^https?:\/\/(?:x|twitter)\.com\/\S+/i.test(cellStr)) {
            foundHttpUrl = cellStr;
            break;
          }
        }
      }

      if (foundHttpUrl) {
        linkUrl = foundHttpUrl;
      } else {
        // Fallback: Recover from Tweet/Post ID anywhere in the row (15-25 digits)
        let foundTweetId = '';
        const col19 = String(row[19] || '').trim();
        if (/^\d{15,25}$/.test(col19)) {
          foundTweetId = col19;
        } else {
          for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const cellStr = String(row[colIdx] || '').trim();
            if (/^\d{15,25}$/.test(cellStr)) {
              foundTweetId = cellStr;
              break;
            }
          }
        }

        if (foundTweetId) {
          const rawHandle = twitterId ? String(twitterId).replace(/^@/, '').trim() : (row[5] ? String(row[5]).replace(/^@/, '').trim() : '');
          linkUrl = `https://x.com/${rawHandle || 'i'}/status/${foundTweetId}`;
        } else {
          linkUrl = '';
        }
      }
    }

    // Clean tracking query params from linkUrl (e.g., ?s=20, ?t=..., etc.)
    if (linkUrl && linkUrl.startsWith('http')) {
      linkUrl = linkUrl.replace(/\?s=\d+.*$/i, '').replace(/\?[a-z0-9_=&-]+$/i, '');
    }

    // Auto-recover twitterId from linkUrl if missing
    if (!twitterId && linkUrl) {
      const match = linkUrl.match(/https?:\/\/(?:x|twitter)\.com\/([^\/\?]+)/i);
      if (match && !['i', 'intent', 'status'].includes(match[1].toLowerCase())) {
        twitterId = match[1];
      }
    }

    // Normalization & Exact IST Timestamp (calculated from Twitter Snowflake ID down to second)
    const istDate = parseDateIST(rawDate);
    const receivedAt = extractExactTimestampIST(linkUrl, rawDate, linkShift);
    const discom = normalizeDiscom(rawDiscom, rawPostText);
    const consumerHandle = twitterId.startsWith('@') ? twitterId : ('@' + twitterId);
    const consumerName = consumerHandle.replace('@', '');

    // Strictly skip empty or phantom rows with no URL, Twitter ID, or complaint text
    if (!linkUrl && !twitterId && !rawPostText) {
      continue;
    }

    // Strictly skip frivolous / deleted complaints or posts replied by official handles before UPPCLLKO
    const rowTid = extractTweetId(linkUrl) || twitterId;
    const cleanUrl = linkUrl ? linkUrl.trim().toLowerCase() : '';
    const cleanUrlNoQuery = cleanUrl.split('?')[0];
    if (
      frivolousSet.has(rowTid) ||
      (cleanUrl && frivolousSet.has(cleanUrl)) ||
      (cleanUrlNoQuery && frivolousSet.has(cleanUrlNoQuery)) ||
      (rawComplaintNo && frivolousSet.has(rawComplaintNo.toLowerCase()))
    ) {
      continue;
    }

    const omitCheck = shouldDeleteOrOmitPost({ remark, status: rawStatus, reply30, reply60, tweetId: rowTid });
    if (omitCheck.shouldOmit) {
      try {
        db.run(`
          INSERT OR IGNORE INTO frivolous_complaints (post_url, tweet_id, complaint_no, deleted_at, reason)
          VALUES (?, ?, ?, datetime('now'), ?);
        `, [linkUrl, rowTid, rawComplaintNo || null, omitCheck.reason]);
        if (linkUrl) {
          db.run("DELETE FROM complaints WHERE post_url = ?;", [linkUrl]);
        }
        frivolousSet.add(rowTid);
        if (cleanUrl) frivolousSet.add(cleanUrl);
        if (cleanUrlNoQuery) frivolousSet.add(cleanUrlNoQuery);
      } catch (e) {}
      continue;
    }

    if (threadCheckCache.has(rowTid)) {
      const tc = threadCheckCache.get(rowTid);
      if (tc.officialRepliedFirst) {
        try {
          db.run(`
            INSERT OR IGNORE INTO frivolous_complaints (post_url, tweet_id, complaint_no, deleted_at, reason)
            VALUES (?, ?, ?, datetime('now'), ?);
          `, [linkUrl, rowTid, rawComplaintNo || null, `Replied by @${tc.handle} before @UPPCLLKO`]);
          if (linkUrl) {
            db.run("DELETE FROM complaints WHERE post_url = ?;", [linkUrl]);
          }
        } catch (e) {}
        continue;
      }
    }

    // Strictly skip posts initiated by official accounts
    if (isOfficialHandle(consumerHandle) || isOfficialHandle(linkUrl)) {
      continue;
    }

    // Strictly enforce 5 official monitored handles filter:
    // A post is eligible for this X complaint dashboard ONLY if its post content
    // mentions at least one of the 5 exact target accounts:
    // @UPPCLLKO, @EMofficeUP, @AKSharmaOffice, @aksharmaBharat, @mduppcl
    if (!isPostEligible(rawPostText)) {
      continue;
    }

    const matchedTargets = getMatchedTargetHandles(rawPostText);
    const monitoredAccount = resolvePrimaryMonitoredAccount(rawPostText) || '@UPPCLLKO';
    const targetMentions = matchedTargets.join(', ');

    // Permanent Recognition of Any Verified UPPCLLKO Reply
    // Check if this complaint post already has verified historical UPPCLLKO reply on record
    const existingComp = (linkUrl && existingMap.get(linkUrl)) || (rowTid && existingMap.get(rowTid)) || null;

    // Historical reply recognition:
    // UPPCLLKO verified reply is strictly explicit UPPCLLKO reply tweet data,
    // or verified historical reply in thread from complaint_replies.
    // NEVER treat reply30 (Laqshya SLA tag) as proof of UPPCLLKO reply!
    const hasIncomingVerifiedReply = Boolean(getVal('reply_post_id', 27)) ||
                                     Boolean(getVal('reply_post_url', 28)) ||
                                     Boolean(getVal('reply_posted_at', 29));

    // Permanent status retention: once verified in history, never revoked even if DISCOM or consumer replies later!
    const isHistoricallyReplied = Boolean(
      existingComp && (
        existingComp.has_historical_reply === 1 ||
        existingComp.uppcl_replied === 1 ||
        Boolean(existingComp.published_reply_id)
      )
    );
    const isSheetRepliedYes = sheetUppclReplied.toUpperCase() === 'YES';
    const uppclReplied = (isHistoricallyReplied || hasIncomingVerifiedReply || isSheetRepliedYes) ? 1 : 0;

    let replyEvidence = (uppclReplied && existingComp && existingComp.reply_evidence) ? existingComp.reply_evidence : null;
    let firstRepliedAt = (uppclReplied && existingComp && existingComp.first_replied_at) ? existingComp.first_replied_at : null;

    if (hasIncomingVerifiedReply) {
      firstRepliedAt = firstRepliedAt || nowIst;
      if (!replyEvidence) {
        if (getVal('reply_post_url', 28)) {
          replyEvidence = 'Verified reply URL: ' + getVal('reply_post_url', 28);
        } else {
          replyEvidence = 'Verified UPPCLLKO reply on record';
        }
      }
    } else if (isSheetRepliedYes && !replyEvidence) {
      replyEvidence = 'Verified UPPCLLKO reply in sheet record';
      firstRepliedAt = firstRepliedAt || nowIst;
    }

    // Independent concept: DISCOM / division tagging
    const isDiscomTagged = discom && ['PVVNL', 'PUVVNL', 'MVVNL', 'DVVNL', 'KESCO'].includes(discom.toUpperCase());
    let discomTaggedInReply = (existingComp && existingComp.discom_tagged_in_reply) ? existingComp.discom_tagged_in_reply : null;
    if (uppclReplied && isDiscomTagged && !discomTaggedInReply) {
      discomTaggedInReply = '@' + discom + 'HQ';
    }

    // Authoritative UPPCLLKO Reply Rule (Picked status retired completely):
    const isApprec = (rawPickedStatus && rawPickedStatus.toUpperCase() === 'APPRECIATION') ||
                     (rawCategory && rawCategory.toUpperCase() === 'APPRECIATION') ||
                     /appreciation/i.test(rawStatus) ||
                     (/बहुत\s*बहुत\s*धन्यवाद|उत्कृष्ट\s*कार्य|सराहनीय|great\s*job|thank\s*you\s*so\s*much/i.test(rawPostText) &&
                      !/समस्या|शिकायत|बिजली|outage|complaint|अधिकारी|प्रिय\s*उपभोक्ता/i.test(rawPostText));
    const normalizedPickedStatus = isApprec ? 'APPRECIATION' : null;

    // Determine sequential Complaint Number strictly matching UPPCL-SMC-YYYYMM-XXXX
    // Starting from UPPCL-SMC-YYYYMM-0001 sequentially
    const ym = (istDate ? istDate.replace(/-/g, '').substring(0, 6) : '202610');
    let seq = validCount + 1;
    let complaintNo = `UPPCL-SMC-${ym}-${String(seq).padStart(4, '0')}`;
    while (usedComplaintNos.has(complaintNo)) {
      seq++;
      complaintNo = `UPPCL-SMC-${ym}-${String(seq).padStart(4, '0')}`;
    }
    usedComplaintNos.add(complaintNo);

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
    // Business Rule: Assigned to DISCOM only when Any discom got tagged by UPPCLLKO
    let status = 'New';
    if (/follow/i.test(rawStatus) || /discom.*reply/i.test(rawStatus) || (reply60 && reply60.toUpperCase() === 'YES')) {
      status = 'DISCOM Follow Up';
    } else if ((uppclReplied === 1 || Boolean(existingComp && existingComp.current_status === 'Assigned to DISCOM')) && isDiscomTagged) {
      status = 'Assigned to DISCOM';
    } else if (/resolved|समाधान/i.test(rawStatus)) {
      status = 'Resolved — Verification Pending';
    } else if (/closed|निस्तारित/i.test(rawStatus)) {
      status = 'Closed';
    } else if (/progress|काम चल रहा/i.test(rawStatus)) {
      status = 'Under Investigation';
    } else if (normalizedPickedStatus === 'APPRECIATION') {
      status = 'Appreciation';
    }

    db.run(insertStmt, [
      complaintNo,
      receivedAt,
      'Twitter/X',
      monitoredAccount,
      isDiscomTagged ? ('@' + discom + 'HQ') : monitoredAccount,
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
      `Fwd-${discom}-${complaintNo.slice(-4)}`,
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
      head || 'upl',
      untagged,
      normalizedPickedStatus,
      rawCategory,
      reply30,
      reply60,
      draftReply,
      approvalStatus,
      JSON.stringify(qualityFlags),
      uppclReplied,
      replyEvidence,
      firstRepliedAt,
      discomTaggedInReply,
      targetMentions
    ]);

  }

  // Comprehensive purge: remove any complaint from DB where:
  // 1) Remark or status indicates deleted
  // 2) DISCOM replied before UPPCLLKO (reply_within_60_min is set and reply_within_30_min is not)
  // 3) Marked in frivolous_complaints
  // 1. Re-link verified historical replies in complaint_replies with fresh complaint IDs
  db.run(`
    UPDATE complaint_replies
    SET complaint_id = (
      SELECT c.id FROM complaints c 
      WHERE c.post_url LIKE '%' || complaint_replies.conversation_id || '%' 
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1 FROM complaints c 
      WHERE c.post_url LIKE '%' || complaint_replies.conversation_id || '%'
    );
  `);

  // 2. All complaints with verified UPPCLLKO reply (historical, published, or complaint_replies)
  db.run(`
    UPDATE complaints
    SET has_historical_reply = 1,
        uppcl_replied = 1,
        picked_status = NULL,
        reply_evidence = (
          SELECT 'Verified historical @UPPCLLKO reply in thread (Tweet ID: ' || reply_tweet_id || ')' 
          FROM complaint_replies 
          WHERE complaint_id = complaints.id AND is_uppcl_reply = 1 
          ORDER BY id DESC LIMIT 1
        )
    WHERE (id IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_uppcl_reply = 1))
       OR (published_reply_id IS NOT NULL AND published_reply_id != '')
       OR (id IN (SELECT DISTINCT complaint_id FROM x_outgoing_replies WHERE status IN ('Published', 'SENT')));
  `);

  // 3. Complaints where UPPCLLKO has not replied
  db.run(`
    UPDATE complaints
    SET has_historical_reply = 0,
        uppcl_replied = 0,
        picked_status = NULL,
        reply_evidence = NULL
    WHERE (id NOT IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_uppcl_reply = 1))
      AND (published_reply_id IS NULL OR published_reply_id = '')
      AND (id NOT IN (SELECT DISTINCT complaint_id FROM x_outgoing_replies WHERE status IN ('Published', 'SENT')))
      AND (reply_evidence IS NULL OR reply_evidence NOT LIKE '%sheet%');
  `);

  // 4. Scenario A: Registered DISCOM replied (Preserve DISCOM Redressal Tracking)
  db.run(`
    UPDATE complaints
    SET discom_name = CASE
          WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%pvvnl%' THEN 'PVVNL'
          WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%puvvnl%' THEN 'PuVVNL'
          WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%mvvnl%' THEN 'MVVNL'
          WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%dvvnl%' THEN 'DVVNL'
          WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%kesco%' THEN 'KESCo'
          ELSE discom_name
        END
    WHERE (discom_name IS NULL OR discom_name = '' OR discom_name = 'UPPCL')
      AND id IN (SELECT complaint_id FROM complaint_replies WHERE is_discom_reply = 1);
  `);

  db.run(`
    UPDATE complaints
    SET discom_replied = 1,
        assigned_nodal_officer_name = COALESCE(assigned_nodal_officer_name, 'DISCOM Nodal Officer (' || discom_name || ')'),
        discom_reply_evidence = COALESCE(
            (SELECT 'Verified registered DISCOM reply in thread (Tweet ID: ' || reply_tweet_id || ')' 
             FROM complaint_replies 
             WHERE complaint_id = complaints.id AND is_discom_reply = 1 
             ORDER BY id DESC LIMIT 1),
            'Verified registered DISCOM reply on record'
          )
    WHERE (id IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_discom_reply = 1))
       OR (reply_within_60_min IS NOT NULL AND reply_within_60_min != '' AND reply_within_60_min != 'NO' AND reply_within_60_min != '-');
  `);

  db.run(`
    UPDATE complaints
    SET discom_replied = 0,
        discom_reply_evidence = NULL
    WHERE (id NOT IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_discom_reply = 1))
      AND (reply_within_60_min IS NULL OR reply_within_60_min = '' OR reply_within_60_min = 'NO' OR reply_within_60_min = '-');
  `);

  db.run(`
    UPDATE complaints
    SET discom_tagged_in_reply = '@' || UPPER(discom_name) || 'HQ'
    WHERE discom_name IN ('PVVNL', 'PUVVNL', 'MVVNL', 'DVVNL', 'KESCO')
      AND (discom_tagged_in_reply IS NULL OR discom_tagged_in_reply = '');
  `);

  db.run(`
    DELETE FROM complaints 
    WHERE (forwarding_remarks IS NOT NULL AND LOWER(forwarding_remarks) LIKE '%delete%')
       OR (current_status IS NOT NULL AND LOWER(current_status) LIKE '%delete%')
       OR (post_url IN (SELECT post_url FROM frivolous_complaints WHERE post_url IS NOT NULL));
  `);
  db.run("DELETE FROM complaint_timeline WHERE complaint_id NOT IN (SELECT id FROM complaints);");
  db.run("DELETE FROM complaint_forwarding_logs WHERE complaint_id NOT IN (SELECT id FROM complaints);");
  db.run("DELETE FROM complaint_escalation_logs WHERE complaint_id NOT IN (SELECT id FROM complaints);");
  db.run("DELETE FROM x_outgoing_replies WHERE complaint_id NOT IN (SELECT id FROM complaints);");

  // Re-number remaining complaints strictly sequentially starting from UPPCL-SMC-YYYYMM-0001
  const remainingRows = db.query("SELECT id, received_at FROM complaints ORDER BY id ASC;");
  for (let i = 0; i < remainingRows.length; i++) {
    const ym = (remainingRows[i].received_at ? remainingRows[i].received_at.substring(0, 7).replace(/-/g, '') : '202610');
    const seqNo = `UPPCL-SMC-${ym}-${String(i + 1).padStart(4, '0')}`;
    db.run("UPDATE complaints SET complaint_no = ? WHERE id = ?;", [seqNo, remainingRows[i].id]);
  }

  const countRow = db.get("SELECT COUNT(*) as cnt FROM complaints;");
  validCount = countRow ? countRow.cnt : remainingRows.length;

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
    spreadsheetId: MANUAL_SPREADSHEET_ID,
    worksheetGid: MANUAL_WORKSHEET_GID,
    worksheetName: MANUAL_WORKSHEET_NAME
  };

  syncInProgress = false;

  return {
    status: 'LIVE',
    message: `Synchronized ${validCount} complaints from authoritative Google Sheets`,
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
  const data = parsedRows.slice(2).map((row, idx) => ({ row, source: 'UPLOAD', sheetRowIndex: idx + 3 }));
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
      { name: 'data_quality_flags', type: 'TEXT' },
      { name: 'target_mentions', type: 'TEXT' }
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
  normalizeDiscom,
  extractExactTimestampIST,
  NON_UPPCL_OFFICIAL_HANDLES,
  isNonUppclOfficialHandle,
  shouldDeleteOrOmitPost,
  checkOfficialRepliedBeforeUppcl
};
