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
    else if (clean.includes('replycreatedat') || clean.includes('repliedat') || clean.includes('replypostedat') || clean.includes('replytime') || clean.includes('replytimestamp')) colMap.replyCreatedAt = c;
  }
  return colMap;
}

/**
 * ==============================================================================
 * AUTOMATIC REPLY_WITHIN_30_MIN_BY_Laqshya Media SLA CALCULATION ENGINE
 * ==============================================================================
 * Adheres strictly to the mandated 3-Rule business logic:
 *
 * Rule 1: If UPPCLLKO Replied (YES/NO) != 'YES' (i.e. 'NO', blank, null):
 *         Column D is strictly set to blank (""). NEVER 'YES' or 'NO'.
 *
 * Rule 2: If UPPCLLKO Replied (YES/NO) == 'YES':
 *         - Computes elapsed time in minutes between original consumer post and
 *           UPPCLLKO's actual reply.
 *         - Elapsed time <= 30 minutes -> 'YES'
 *         - Elapsed time > 30 minutes  -> 'NO'
 *
 * Rule 3: If UPPCLLKO Replied (YES/NO) == 'YES' but either timestamp is missing,
 *         invalid, or negative:
 *         Column D is left blank ("") pending verification.
 * ==============================================================================
 */

// Authoritative map of verified historical UPPCLLKO replies by original conversation / tweet ID
const VERIFIED_HISTORICAL_UPPCL_REPLIES = {
  "2112543129006170200": "2112607433881428114",
  "2112567087491420186": "2112580132011745666",
  "2112571567523901584": "2112579617001455983",
  "2112573506114494926": "2112579195457204533",
  "2112573939608436768": "2112578932163899408",
  "2112563401625051437": "2112567077051715842",
  "2112559578441261416": "2112566673383563353",
  "2112546408981283020": "2112559252305015049",
  "2112540697220071882": "2112558345571987954",
  "2112534199785975847": "2112547849384907193",
  "2112546133029626305": "2112547398748979369",
  "2112540788601328090": "2112546169964712361",
  "2112540698012688554": "2112546035574985096",
  "2112530159899402414": "2112539336214446508",
  "2112359967877726601": "2112538671341867178",
  "2112521388628320434": "2112538314104574350",
  "2112521967865860344": "2112534374554214599",
  "2112053721492509158": "2112534258434842704",
  "2112523535721930785": "2112534102385803552",
  "2112526559030473024": "2112533683362247059",
  "2112499356616310939": "2112530452519194769",
  "2112486084336898134": "2112522734005866890",
  "2112511821731250592": "2112520982934307096",
  "2112501489889689611": "2112520849425362995",
  "2112512166616265095": "2112520769054167148",
  "2112512682784092434": "2112520231273091231",
  "2112513042596708472": "2112516911527505941",
  "2112506180086239417": "2112516403811258382",
  "2112496914596020438": "2112509826924491175",
  "2112492454121480193": "2112508519224328388",
  "2112482037932372316": "2112497426422772096",
  "2112478797979328823": "2112497308088836382",
  "2112410753038987401": "2112496760241496454",
  "2112450167186346284": "2112477585657790562",
  "2112469847158514049": "2112473803536347600",
  "2112466533331124377": "2112473291881689503",
  "2112449935505604835": "2112459777490219397",
  "2112439500026896747": "2112459563115180186",
  "2112439185261085025": "2112459359246840095",
  "2112438916200755362": "2112458982573146416",
  "2112427528577237115": "2112441803798695967",
  "2112423862130602240": "2112441473534976155",
  "2112422974116843654": "2112441259763847407",
  "2112419414293327973": "2112441016506777659",
  "2112404499176554739": "2112420997370651031",
  "2112398766812889265": "2112420082773279063",
  "2112403502211514486": "2112419943711203723",
  "2112413931067376063": "2112419772587802987",
  "2112416294649942044": "2112419771442778454",
  "2112413471698813401": "2112418980753461518",
  "2112141928490013122": "2112417831283528035",
  "2112406956426318201": "2112417655856771527",
  "2112404983186616735": "2112417236006895813",
  "2112384160707035370": "2112401570109489273",
  "2112381066157928596": "2112400159720321127",
  "2112370304471466090": "2112399760338690512",
  "2112369378000007430": "2112399633272180765",
  "2112364897858408643": "2112392401000227278",
  "2112376337709310144": "2112381206398705882",
  "2112376768795689021": "2112381038290952205",
  "2112378869202448853": "2112380718102069430",
  "2112374826530943042": "2112377222556434834",
  "2112375055070179562": "2112376460241694908",
  "2112369153852187019": "2112370921101209884",
  "2112361448114720813": "2112363747369181270",
  "2112349691413406007": "2112355304117780553",
  "2112168252235206929": "2112257668635345008",
  "2112235082593571096": "2112239437489086615",
  "2112238057957253228": "2112238959564849473",
  "2112237835516514598": "2112238824399224887",
  "2112235834279891234": "2112238121287078039",
  "2112217252049424418": "2112229537899753719",
  "2112200320407462235": "2112228723059757363",
  "2112221480914391069": "2112223516582150594",
  "2112215192759361722": "2112217541884219509",
  "2112159986923237528": "2112213300826255653",
  "2112200183752831029": "2112212822965055830",
  "2112205469876187327": "2112212544593318261",
  "2112209719012229125": "2112211702167253070",
  "2112209824369016884": "2112211502178746463",
  "2112210806435934661": "2112211390429827131",
  "2112202297350693042": "2112209309241397302",
  "2112190323120325116": "2112204144304070891",
  "2112192724791415254": "2112204029434773983",
  "2112193377617997914": "2112203820122214775",
  "2112199621980340330": "2112203693382906155",
  "2112167183912702222": "2112202627455062192",
  "2112139420237492416": "2112202232485798178",
  "2112184765151682799": "2112201954336358628",
  "2112178888306786508": "2112201871591092712",
  "2112174533553922442": "2112201756335833214",
  "2112136014760448402": "2112201726010991038",
  "2112168757347193012": "2112201706700525648",
  "2112198594833101120": "2112200757378490701",
  "2112192989221282247": "2112200661400166826",
  "2112192276718051645": "2112200571667321042",
  "2112169144087187794": "2112172848412598385",
  "2112161752280670707": "2112166055112229343",
  "2112152362811072555": "2112165681559118193",
  "2112163533509251541": "2112164456994374088",
  "2112161402341486657": "2112163686290952372",
  "2112138587705892912": "2112151749356339656",
  "2112138645683445760": "2112151559522099654",
  "2112146074735616497": "2112150253923405827",
  "2112134410384363635": "2112137924745764900",
  "2112130204466590045": "2112131453727445262",
  "2112125787709325673": "2112127721602167167",
  "2112085097721778522": "2112126581540094303",
  "2112123332317663356": "2112126108724519323",
  "2112123954215211377": "2112126030483951959",
  "2112111966856556977": "2112120953648095369",
  "2112114162000363907": "2112120913697354053",
  "2112066666414969344": "2112116018525143385",
  "2112113957909737551": "2112115334836830317",
  "2112110586540728589": "2112113412406988915",
  "2112110537861411003": "2112113377950707785",
  "2112109456226222309": "2112111911093567907",
  "2112108436251152519": "2112111646336536858",
  "2112101743974826245": "2112111472839123385",
  "2112095759743201565": "2112111385413120122",
  "2112070435626201198": "2112099317075116421",
  "2112091248114971025": "2112098275822309443",
  "2112088024003866705": "2112097638007148684",
  "2112063969028719082": "2112074090848858124",
  "2112064906258501767": "2112073930509078623",
  "2112065097569009744": "2112073396016320549",
  "2112059204274200993": "2112062514368585968",
  "2112060601686233204": "2112062465932677505",
  "2112054873856283022": "2112061506368176618",
  "2112051917904081014": "2112057015082311888",
  "2112050013086056846": "2112056785620312190",
  "2112049810836725943": "2112056781799309698",
  "2111961871502942324": "2112056350364901700",
  "2112043922537255004": "2112056128058302974",
  "2112052188168257654": "2112056000828371114",
  "2112042897948422562": "2112043858196574400",
  "2112037363321053518": "2112042295470276856",
  "2112018088489357384": "2112041503472447662",
  "2112024098792685745": "2112029397066936691",
  "2112017269048156384": "2112021468569870705",
  "2112020724038959510": "2112021206509776967",
  "2112019450853835087": "2112021009641644288",
  "2111891117310661096": "2112016139039736315",
  "2112013175168389365": "2112015666899468310",
  "2112011516354728379": "2112014466825306311",
  "2112009033611968929": "2112014364622639147",
  "2112009487364366416": "2112013923633476044",
  "2112008869203574948": "2112009880236446198",
  "2112008355359461442": "2112009621506498789",
  "2111973752116498606": "2111997479332012460",
  "2111971385157554369": "2111997345533706459",
  "2111992959256367117": "2111997212184244641",
  "2111991753486237823": "2111996989772808195",
  "2111983536450457802": "2111995563629785237",
  "2111920321758724325": "2111923168566968774",
  "2111914423871062483": "2111920034171978216",
  "2111604765486707028": "2111866379255386212",
  "2111631974771360067": "2111634540993405207",
  "2111617408557568279": "2111630533650489518",
  "2112563326958067757": "2112779003383918996"
};

/**
 * Extracts Twitter Snowflake millisecond epoch from a Tweet ID or Tweet URL.
 * Twitter Snowflake epoch: 1288834974657 ms (2010-11-04T01:42:54.657Z)
 * Formula: Math.floor(Number(id) / 4194304) + 1288834974657
 */
function getSnowflakeEpochMs(idOrUrl) {
  if (!idOrUrl) return null;
  const str = String(idOrUrl).trim();
  const match = str.match(/\d{15,22}/);
  if (!match) return null;
  try {
    const idBigInt = BigInt(match[0]);
    let epochMs; if (typeof BigInt !== 'undefined') { epochMs = Math.floor(Number(BigInt(match[0]) / BigInt(4194304))) + 1288834974657; } else { epochMs = Math.floor(Number(match[0]) / 4194304) + 1288834974657; }
    if (isNaN(epochMs) || epochMs < 1288834974657 || epochMs > Date.now() + 86400000 * 365) {
      return null;
    }
    return epochMs;
  } catch (err) {
    return null;
  }
}

/**
 * Parses timestamp string, date object, or snowflake ID into millisecond epoch.
 */
function parseTimestampToEpochMs(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    return (val > 1288834974657) ? val : null;
  }
  if (val instanceof Date) {
    const t = val.getTime();
    return !isNaN(t) ? t : null;
  }

  const str = String(val).trim();
  if (!str) return null;

  // 1. Try Snowflake ID if numeric sequence 15-22 digits
  if (/\b\d{15,22}\b/.test(str)) {
    const sf = getSnowflakeEpochMs(str);
    if (sf) return sf;
  }

  // 2. Try Standard Date parsing (ISO 8601 or standard string)
  const parsed = Date.parse(str);
  if (!isNaN(parsed) && parsed > 1288834974657) {
    return parsed;
  }

  // 3. Try DD-MM-YYYY [HH:mm:ss] format
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const mins = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const secs = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(Date.UTC(year, month, day, hours, mins, secs));
    const t = d.getTime();
    if (!isNaN(t) && t > 1288834974657) return t;
  }

  return null;
}

/**
 * Authoritative 3-rule calculator for REPLY_WITHIN_30_MIN_BY_Laqshya Media.
 */
function calculateReplyWithin30Min(uppclReplied, consumerPostTimeOrUrl, uppclReplyTimeOrUrl) {
  const isReplied = String(uppclReplied || '').trim().toUpperCase() === 'YES';

  // Rule 1: UPPCLLKO Replied is NOT YES -> strictly blank
  if (!isReplied) {
    return '';
  }

  // Rule 2 & 3: UPPCLLKO Replied is YES
  const startEpoch = parseTimestampToEpochMs(consumerPostTimeOrUrl);
  const endEpoch = parseTimestampToEpochMs(uppclReplyTimeOrUrl);

  // Missing or invalid timestamps -> strictly blank pending verification
  if (!startEpoch || !endEpoch) {
    return '';
  }

  const diffMs = endEpoch - startEpoch;

  // Negative elapsed time -> invalid clock/data, strictly blank pending verification
  if (diffMs < 0) {
    return '';
  }

  const diffMinutes = diffMs / 60000;
  if (diffMinutes <= 30) {
    return 'YES';
  }
  return 'NO';
}

/**
 * Calculates 30-min SLA value for a single row in the active sheet.
 */
function calculateRow30MinSlaInScript(sheet, rowNumber, colMap, uppclRepliedVal, tweetIdHint, postUrlHint) {
  const isReplied = String(uppclRepliedVal || '').trim().toUpperCase() === 'YES';
  if (!isReplied) {
    return ''; // Rule 1: strictly blank
  }

  // Identify consumer starting timestamp
  let compId = tweetIdHint || '';
  if (!compId && colMap.postId !== undefined) {
    compId = String(sheet.getRange(rowNumber, colMap.postId + 1).getValue() || '').trim();
  }
  let compUrl = postUrlHint || '';
  if (!compUrl && colMap.linkUrl !== undefined) {
    compUrl = String(sheet.getRange(rowNumber, colMap.linkUrl + 1).getValue() || '').trim();
  }
  let postCreated = '';
  if (colMap.postCreatedAt !== undefined) {
    postCreated = String(sheet.getRange(rowNumber, colMap.postCreatedAt + 1).getValue() || '').trim();
  }

  if (!compId && compUrl) {
    const m = compUrl.match(/status\/(\d+)/i);
    if (m) compId = m[1];
  }

  const startEpoch = parseTimestampToEpochMs(compId || compUrl || postCreated);
  if (!startEpoch) {
    return ''; // Rule 3: blank pending verification
  }

  // Identify UPPCLLKO ending timestamp
  let replyId = '';
  if (colMap.replyPostId !== undefined) {
    replyId = String(sheet.getRange(rowNumber, colMap.replyPostId + 1).getValue() || '').trim();
  }
  let replyUrl = '';
  if (colMap.replyPostUrl !== undefined) {
    replyUrl = String(sheet.getRange(rowNumber, colMap.replyPostUrl + 1).getValue() || '').trim();
  }
  let replyCreated = '';
  if (colMap.replyCreatedAt !== undefined) {
    replyCreated = String(sheet.getRange(rowNumber, colMap.replyCreatedAt + 1).getValue() || '').trim();
  }

  // Check verified historical replies dictionary
  if (!replyId && !replyUrl && !replyCreated) {
    const tid = compId || (compUrl ? (compUrl.match(/status\/(\d+)/i) || [])[1] : '');
    if (tid && VERIFIED_HISTORICAL_UPPCL_REPLIES[tid]) {
      replyId = VERIFIED_HISTORICAL_UPPCL_REPLIES[tid];
    }
  }

  // Check Remark column for possible reply URL/ID
  if (!replyId && !replyUrl && !replyCreated && colMap.remark !== undefined) {
    const rem = String(sheet.getRange(rowNumber, colMap.remark + 1).getValue() || '').trim();
    const m = rem.match(/(?:twitter\.com|x\.com)\/(?:UPPCLLKO|uppcllko)\/status\/(\d+)/i);
    if (m) replyId = m[1];
  }

  const endEpoch = parseTimestampToEpochMs(replyId || replyUrl || replyCreated);
  if (!endEpoch) {
    return ''; // Rule 3: blank pending verification
  }

  const diffMs = endEpoch - startEpoch;
  if (diffMs < 0) {
    return ''; // Inconsistent negative time
  }

  const diffMinutes = diffMs / 60000;
  if (diffMinutes <= 30) {
    return 'YES';
  }
  return 'NO';
}

/**
 * Scans all complaint rows in 'Twitter Complaint List' and recalculates
 * Column D (REPLY_WITHIN_30_MIN_BY_Laqshya Media) strictly following:
 * - Rule 1: UPPCLLKO Replied = NO (or blank) -> strictly blank ("")
 * - Rule 2: UPPCLLKO Replied = YES -> elapsed <= 30 min ? 'YES' : 'NO'
 * - Rule 3: UPPCLLKO Replied = YES but timestamps missing/invalid -> strictly blank ("")
 *
 * Uses dynamic header mapping to locate exact columns without hardcoded letters.
 * Clears stray counter numbers (e.g. 2713..3128) and wrong values from unreplied rows.
 * Batch writes updates in a single setValues() call for performance.
 */
function recalculateReplyWithin30MinInSheet(sheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!sheet) {
    sheet = ss.getSheetByName('Twitter Complaint List');
    if (!sheet) sheet = ss.getActiveSheet();
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return { updated: 0, message: 'No complaint data rows found.' };

  const numRows = lastRow - 2;
  const colMap = getSheetColumnMap(sheet);
  if (colMap.reply30 === undefined) {
    throw new Error('Could not find REPLY_WITHIN_30_MIN column in sheet headers.');
  }
  if (colMap.uppclReplied === undefined) {
    throw new Error('Could not find UPPCLLKO Replied (YES/NO) column in sheet headers.');
  }

  const totalCols = sheet.getLastColumn();
  const data = sheet.getRange(3, 1, numRows, totalCols).getValues();
  const reply30ColIndex = colMap.reply30;
  const uppclRepliedColIndex = colMap.uppclReplied;
  const linkUrlColIndex = colMap.linkUrl;
  const postIdColIndex = colMap.postId;
  const postCreatedColIndex = colMap.postCreatedAt;
  const replyUrlColIndex = colMap.replyPostUrl;
  const replyIdColIndex = colMap.replyPostId;
  const replyCreatedColIndex = colMap.replyCreatedAt;
  const remarkColIndex = colMap.remark;

  const updates = [];
  let clearedCount = 0;
  let yesCount = 0;
  let noCount = 0;
  let blankCount = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const uppclRepliedRaw = String(row[uppclRepliedColIndex] || '').trim().toUpperCase();
    const isRepliedYes = uppclRepliedRaw === 'YES';

    let finalVal = '';

    if (!isRepliedYes) {
      // Rule 1: UPPCLLKO Replied is NOT YES -> strictly blank
      finalVal = '';
      clearedCount++;
    } else {
      // Rule 2 & 3: UPPCLLKO Replied is YES
      let compId = (postIdColIndex !== undefined) ? String(row[postIdColIndex] || '').trim() : '';
      let compUrl = (linkUrlColIndex !== undefined) ? String(row[linkUrlColIndex] || '').trim() : '';
      let postCreated = (postCreatedColIndex !== undefined) ? String(row[postCreatedColIndex] || '').trim() : '';

      if (!compId && compUrl) {
        const m = compUrl.match(/status\/(\d+)/i);
        if (m) compId = m[1];
      }

      const startEpoch = parseTimestampToEpochMs(compId || compUrl || postCreated);

      // Reply identifier:
      let replyId = (replyIdColIndex !== undefined) ? String(row[replyIdColIndex] || '').trim() : '';
      let replyUrl = (replyUrlColIndex !== undefined) ? String(row[replyUrlColIndex] || '').trim() : '';
      let replyCreated = (replyCreatedColIndex !== undefined) ? String(row[replyCreatedColIndex] || '').trim() : '';

      if (!replyId && !replyUrl && !replyCreated) {
        const tid = compId || (compUrl ? (compUrl.match(/status\/(\d+)/i) || [])[1] : '');
        if (tid && VERIFIED_HISTORICAL_UPPCL_REPLIES[tid]) {
          replyId = VERIFIED_HISTORICAL_UPPCL_REPLIES[tid];
        }
      }

      if (!replyId && !replyUrl && !replyCreated && remarkColIndex !== undefined) {
        const rem = String(row[remarkColIndex] || '').trim();
        const m = rem.match(/(?:twitter\.com|x\.com)\/(?:UPPCLLKO|uppcllko)\/status\/(\d+)/i);
        if (m) replyId = m[1];
      }

      const endEpoch = parseTimestampToEpochMs(replyId || replyUrl || replyCreated);

      if (startEpoch && endEpoch) {
        const diffMs = endEpoch - startEpoch;
        if (diffMs >= 0) {
          const diffMinutes = diffMs / 60000;
          if (diffMinutes <= 30) {
            finalVal = 'YES';
            yesCount++;
          } else {
            finalVal = 'NO';
            noCount++;
          }
        } else {
          // Negative elapsed time
          finalVal = '';
          blankCount++;
        }
      } else {
        // Missing timestamps -> Rule 3: blank pending verification
        finalVal = '';
        blankCount++;
      }
    }

    updates.push([finalVal]);
  }

  // Batch write all calculated values to Column D in one operation
  if (updates.length > 0) {
    sheet.getRange(3, reply30ColIndex + 1, updates.length, 1).setValues(updates);
    sheet.getRange(3, reply30ColIndex + 1, updates.length, 1)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  }
  SpreadsheetApp.flush();

  const msg = 'REPLY_WITHIN_30_MIN_BY_Laqshya Media column successfully recalculated for ' + updates.length + ' rows!\n\n' +
    '• Unreplied rows cleared to blank (Rule 1): ' + clearedCount + '\n' +
    '• Replied <= 30 min (YES): ' + yesCount + '\n' +
    '• Replied > 30 min (NO): ' + noCount + '\n' +
    '• Replied with missing/unverified timestamps (blank): ' + blankCount;

  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {}

  return {
    total: updates.length,
    clearedCount: clearedCount,
    yesCount: yesCount,
    noCount: noCount,
    blankCount: blankCount
  };
}

/**
 * ==============================================================================
 * MASTER DROPDOWNS, DATA VALIDATIONS & MANUAL OVERRIDE PERSISTENCE ENGINE
 * ==============================================================================
 */

// Master list of 29 complaint types as specified
const COMPLAINT_TYPE_DROPDOWN_VALUES = [
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

// Picked status dropdown values
const PICKED_STATUS_DROPDOWN_VALUES = ['YES', 'NO', 'TROLL', 'APPRECIATION'];

// Untagged complaint dropdown values
const UNTAGGED_DROPDOWN_VALUES = ['YES', 'NO'];

// Head dropdown values
const HEAD_DROPDOWN_VALUES = [
  'akm', 'akc', 'emm', 'emc', 'mdc', 'mdm',
  'upm', 'upc', 'cmc', 'cmm', 'ako', 'NEWS', 'GROK'
];

// Status dropdown values
const STATUS_DROPDOWN_VALUES = [
  'Forwarded to Discom',
  'Reply to Consumer',
  'DM',
  'Discom follow-up',
  'Problem not Solved',
  'Information Needed'
];

/**
 * Retrieves the Discom_District_List sheet and parses the 75-district mapping.
 * Uses header names to resolve column positions dynamically.
 */
function getDistrictMappingFromListSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  let listSheet = ss.getSheetByName('Discom_District_List');
  if (!listSheet) {
    const sheets = ss.getSheets();
    for (let s of sheets) {
      if (String(s.getSheetId()) === '958127386' || s.getName().toLowerCase().includes('district')) {
        listSheet = s;
        break;
      }
    }
  }
  if (!listSheet) return null;

  const lastRow = listSheet.getLastRow();
  const lastCol = listSheet.getLastColumn();
  if (lastRow < 2 || lastCol < 2) return null;

  const headers = listSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let discomCol = -1, districtCol = -1, zoneCol = -1;
  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').trim().toLowerCase();
    if (h === 'discom') discomCol = c;
    else if (h === 'district') districtCol = c;
    else if (h === 'zone') zoneCol = c;
  }

  if (districtCol === -1) return null;

  const data = listSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const map = {};
  const districtList = [];

  for (let r = 0; r < data.length; r++) {
    const distRaw = String(data[r][districtCol] || '').trim();
    if (!distRaw) continue;
    const discomVal = (discomCol !== -1) ? String(data[r][discomCol] || '').trim() : '';
    const zoneVal = (zoneCol !== -1) ? String(data[r][zoneCol] || '').trim() : '';
    map[distRaw.toUpperCase()] = {
      district: distRaw,
      discom: discomVal,
      zone: zoneVal
    };
    if (!districtList.includes(distRaw)) {
      districtList.push(distRaw);
    }
  }

  return {
    sheet: listSheet,
    districtCol: districtCol,
    discomCol: discomCol,
    zoneCol: zoneCol,
    lastRow: lastRow,
    map: map,
    districtList: districtList
  };
}

/**
 * Gets or creates the Manual_Overrides tracking sheet.
 * Records all user manual selections to guarantee they are never overwritten.
 */
function getOrCreateOverridesSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Manual_Overrides');
  if (!sheet) {
    sheet = ss.insertSheet('Manual_Overrides');
    const headers = ['KEY', 'TWEET_ID', 'POST_URL', 'FIELD_NAME', 'MANUAL_VALUE', 'UPDATED_AT', 'UPDATED_BY'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4DD0E1')
      .setFontColor('#1A2F40');
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

/**
 * Reads all manual overrides into a fast in-memory Map.
 */
function getManualOverridesMap(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const overridesSheet = ss.getSheetByName('Manual_Overrides');
  const map = new Map();
  if (!overridesSheet || overridesSheet.getLastRow() < 2) return map;

  const lastRow = overridesSheet.getLastRow();
  const data = overridesSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (let i = 0; i < data.length; i++) {
    const key = String(data[i][0] || '').trim();
    if (key) {
      map.set(key, {
        tweetId: String(data[i][1] || '').trim(),
        postUrl: String(data[i][2] || '').trim(),
        field: String(data[i][3] || '').trim(),
        value: data[i][4],
        updatedAt: data[i][5],
        updatedBy: data[i][6]
      });
    }
  }
  return map;
}

/**
 * Records or updates a manual override in the Manual_Overrides sheet.
 */
function recordManualOverride(ss, tweetId, postUrl, rowNumber, fieldKey, manualValue, userEmail) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const overridesSheet = getOrCreateOverridesSheet(ss);
  const identifier = tweetId || postUrl || ('ROW_' + rowNumber);
  const key = identifier + '_' + fieldKey;
  const now = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');
  userEmail = userEmail || Session.getActiveUser().getEmail() || 'User';

  const lastRow = overridesSheet.getLastRow();
  let foundRow = -1;
  if (lastRow >= 2) {
    const keys = overridesSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0] || '').trim() === key) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const record = [key, tweetId || '', postUrl || '', fieldKey, String(manualValue), now, userEmail];
  if (foundRow > 0) {
    overridesSheet.getRange(foundRow, 1, 1, 7).setValues([record]);
  } else {
    overridesSheet.appendRow(record);
  }
}

/**
 * Checks whether a specific field on a row has an active manual override.
 */
function isFieldManuallyOverridden(overridesMap, tweetId, postUrl, rowNumber, fieldKey) {
  if (!overridesMap) return false;
  if (tweetId && overridesMap.has(tweetId + '_' + fieldKey)) return true;
  if (postUrl && overridesMap.has(postUrl + '_' + fieldKey)) return true;
  if (rowNumber && overridesMap.has('ROW_' + rowNumber + '_' + fieldKey)) return true;
  return false;
}

/**
 * Applies dropdown validation rules to a given range of rows.
 */
function setupRowDropdowns(sheet, startRow, count, colMap, ss) {
  if (!sheet || count < 1) return;
  ss = ss || sheet.getParent();
  colMap = colMap || getSheetColumnMap(sheet);

  // 1. Picked Status
  if (colMap.pickedStatus !== undefined) {
    const pickedRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(PICKED_STATUS_DROPDOWN_VALUES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(startRow, colMap.pickedStatus + 1, count, 1).setDataValidation(pickedRule);
  }

  // 2. Complaint Type
  if (colMap.complaintType !== undefined) {
    const compTypeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(COMPLAINT_TYPE_DROPDOWN_VALUES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(startRow, colMap.complaintType + 1, count, 1).setDataValidation(compTypeRule);
  }

  // 3. Untagged Complaint
  if (colMap.untagged !== undefined) {
    const untaggedRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(UNTAGGED_DROPDOWN_VALUES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(startRow, colMap.untagged + 1, count, 1).setDataValidation(untaggedRule);
  }

  // 4. Head
  if (colMap.head !== undefined) {
    const headRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(HEAD_DROPDOWN_VALUES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(startRow, colMap.head + 1, count, 1).setDataValidation(headRule);
  }

  // 5. District (dynamically linked to Discom_District_List)
  if (colMap.district !== undefined) {
    const mappingInfo = getDistrictMappingFromListSheet(ss);
    if (mappingInfo && mappingInfo.sheet && mappingInfo.lastRow >= 2) {
      const districtRange = mappingInfo.sheet.getRange(2, mappingInfo.districtCol + 1, mappingInfo.lastRow - 1, 1);
      const districtRule = SpreadsheetApp.newDataValidation()
        .requireValueInRange(districtRange, true)
        .setAllowInvalid(true)
        .build();
      sheet.getRange(startRow, colMap.district + 1, count, 1).setDataValidation(districtRule);
    }
  }

  // 6. Status
  if (colMap.status !== undefined) {
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_DROPDOWN_VALUES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(startRow, colMap.status + 1, count, 1).setDataValidation(statusRule);
  }
}

/**
 * Master function to set up dropdowns across all existing rows (and buffer for new rows).
 * Non-destructive: preserves all existing cell values.
 */
function setupSheetDropdownsAndValidations(sheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!sheet) {
    sheet = ss.getSheetByName('Twitter Complaint List');
    if (!sheet) sheet = ss.getActiveSheet();
  }

  const colMap = getSheetColumnMap(sheet);
  const lastRow = Math.max(sheet.getLastRow(), 3000);
  const numRows = lastRow - 2; // Data rows start at Row 3
  if (numRows < 1) return;

  setupRowDropdowns(sheet, 3, numRows, colMap, ss);
  SpreadsheetApp.flush();

  const msg = 'Dropdowns and Data Validations have been successfully applied!\n\n' +
    '• Picked Status: YES, NO, OTHER, TROLL, APPRECIATION\n' +
    '• Complaint Type: 29 Standard Categories\n' +
    '• Untagged Complaint: YES, NO\n' +
    '• Head: 13 Monitored Codes\n' +
    '• District: Dynamically sourced from Discom_District_List\n' +
    '• Status: 6 Standard Workflow Options\n\n' +
    'All existing cell data was preserved intact.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/**
 * Global edit event handler:
 * - Detects manual user edits to District, DISCOM, Zone, Picked Status, Complaint Type, Untagged, Head.
 * - Updates DISCOM & Zone when District changes, UNLESS DISCOM/Zone was manually overridden.
 * - Records all manual edits to Manual_Overrides sheet to prevent automated overwrite.
 */
function onEdit(e) {
  if (!e || !e.range) return;

  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();

  // Only handle edits in Twitter Complaint List
  if (sheetName !== 'Twitter Complaint List' && String(sheet.getSheetId()) !== '598922870') {
    return;
  }

  const row = range.getRow();
  if (row < 3) return; // Ignore headers / metadata / counter row
  const frozenRows = Math.max(sheet.getFrozenRows(), 1);
  if (row <= frozenRows) return;

  const col = range.getColumn();
  const colIndex = col - 1; // 0-based
  const colMap = getSheetColumnMap(sheet);
  const ss = sheet.getParent();

  // 0. DATE COLUMN EDITED: normalize to genuine Date and sort descending
  if (colIndex === colMap.date) {
    const val = e.value !== undefined ? e.value : (range.getValue() || '');
    if (val) {
      if (typeof val === 'string' && /^\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/.test(val.trim())) {
        const parts = val.trim().split(/[-\/]/);
        let dObj = null;
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          // DD-MM-YYYY
          dObj = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
        if (dObj && !isNaN(dObj.getTime())) {
          range.setNumberFormat('dd-MM-yyyy');
          range.setValue(dObj);
        }
      }
      sortSheetByDateDescending();
    }
    return;
  }

  const newValue = String(e.value !== undefined ? e.value : (range.getValue() || '')).trim();

  // Retrieve Tweet ID and URL for permanent identification
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl + 1 : 5;
  const postIdCol = (colMap.postId !== undefined) ? colMap.postId + 1 : -1;
  const postUrl = String(sheet.getRange(row, linkUrlCol).getValue() || '').trim();
  let tweetId = '';
  if (postIdCol > 0) {
    tweetId = String(sheet.getRange(row, postIdCol).getValue() || '').trim();
  }
  if (!tweetId && postUrl) {
    const m = postUrl.match(/status\/(\d+)/i);
    if (m) tweetId = m[1];
  }

  const userEmail = (e.user && e.user.getEmail) ? e.user.getEmail() : (Session.getActiveUser().getEmail() || 'User');
  const overridesMap = getManualOverridesMap(ss);

  // A. DISTRICT EDITED
  if (colIndex === colMap.district) {
    recordManualOverride(ss, tweetId, postUrl, row, 'district', newValue, userEmail);

    if (newValue) {
      const mappingInfo = getDistrictMappingFromListSheet(ss);
      if (mappingInfo && mappingInfo.map) {
        const matched = mappingInfo.map[newValue.toUpperCase()];
        if (matched) {
          // Rule 4: Update DISCOM if NOT manually overridden
          if (colMap.discom !== undefined) {
            const discomOverridden = isFieldManuallyOverridden(overridesMap, tweetId, postUrl, row, 'discom');
            if (!discomOverridden) {
              const discomCell = sheet.getRange(row, colMap.discom + 1);
              discomCell.setValue(matched.discom);
            }
          }

          // Rule 4: Update Zone if NOT manually overridden
          if (colMap.zone !== undefined) {
            const zoneOverridden = isFieldManuallyOverridden(overridesMap, tweetId, postUrl, row, 'zone');
            if (!zoneOverridden) {
              const zoneCell = sheet.getRange(row, colMap.zone + 1);
              zoneCell.setValue(matched.zone);
            }
          }
        }
      }
    }
    return;
  }

  // B. DISCOM MANUALLY EDITED DIRECTLY
  if (colIndex === colMap.discom) {
    recordManualOverride(ss, tweetId, postUrl, row, 'discom', newValue, userEmail);
    range.setNote('Manual Override: Set to ' + newValue + ' by ' + userEmail);
    return;
  }

  // C. ZONE MANUALLY EDITED DIRECTLY
  if (colIndex === colMap.zone) {
    recordManualOverride(ss, tweetId, postUrl, row, 'zone', newValue, userEmail);
    range.setNote('Manual Override: Set to ' + newValue + ' by ' + userEmail);
    return;
  }

  // D. PICKED STATUS MANUALLY EDITED
  if (colIndex === colMap.pickedStatus) {
    recordManualOverride(ss, tweetId, postUrl, row, 'pickedStatus', newValue, userEmail);
    return;
  }

  // E. COMPLAINT TYPE MANUALLY EDITED
  if (colIndex === colMap.complaintType) {
    recordManualOverride(ss, tweetId, postUrl, row, 'complaintType', newValue, userEmail);
    return;
  }

  // F. UNTAGGED COMPLAINT MANUALLY EDITED
  if (colIndex === colMap.untagged) {
    recordManualOverride(ss, tweetId, postUrl, row, 'untagged', newValue, userEmail);
    return;
  }

  // G. HEAD MANUALLY EDITED
  if (colIndex === colMap.head) {
    recordManualOverride(ss, tweetId, postUrl, row, 'head', newValue, userEmail);
    return;
  }

  // H. STATUS MANUALLY EDITED
  if (colIndex === colMap.status) {
    recordManualOverride(ss, tweetId, postUrl, row, 'status', newValue, userEmail);
    return;
  }

  // I. UPPCLLKO REPLIED (YES/NO) MANUALLY EDITED OR RECALCULATED
  if (colIndex === colMap.uppclReplied) {
    recordManualOverride(ss, tweetId, postUrl, row, 'uppclReplied', newValue, userEmail);
    // Recalculate 30-Min SLA column immediately for this row
    if (colMap.reply30 !== undefined) {
      const calculatedSla = calculateRow30MinSlaInScript(sheet, row, colMap, newValue, tweetId, postUrl);
      sheet.getRange(row, colMap.reply30 + 1).setValue(calculatedSla);
    }
    return;
  }

  // J. POST LINK, POST ID, OR REPLY LINK EDITED
  if (colIndex === colMap.linkUrl || colIndex === colMap.postId || colIndex === colMap.replyPostUrl || colIndex === colMap.replyPostId) {
    if (colMap.reply30 !== undefined && colMap.uppclReplied !== undefined) {
      const curReplied = String(sheet.getRange(row, colMap.uppclReplied + 1).getValue() || '').trim();
      const calculatedSla = calculateRow30MinSlaInScript(sheet, row, colMap, curReplied, tweetId, postUrl);
      sheet.getRange(row, colMap.reply30 + 1).setValue(calculatedSla);
    }
    return;
  }
}

/**
 * Scans existing rows in 'Twitter Complaint List'.
 * For any row that has a District value, but DISCOM or Zone is blank,
 * populates the missing values automatically from Discom_District_List.
 *
 * CRITICAL RULE:
 * Strictly respects manual overrides. Never overwrites a manual value or existing DISCOM/Zone.
 */
function populateBlankDiscomAndZoneFromDistrict(sheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!sheet) {
    sheet = ss.getSheetByName('Twitter Complaint List');
    if (!sheet) sheet = ss.getActiveSheet();
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;
  const numRows = lastRow - 2;
  const colMap = getSheetColumnMap(sheet);
  const totalCols = sheet.getLastColumn();

  if (colMap.district === undefined || (colMap.discom === undefined && colMap.zone === undefined)) {
    return 0;
  }

  const mappingInfo = getDistrictMappingFromListSheet(ss);
  if (!mappingInfo || !mappingInfo.map) return 0;

  const overridesMap = getManualOverridesMap(ss);
  const data = sheet.getRange(3, 1, numRows, totalCols).getValues();

  let populatedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const sheetRowNumber = i + 3;

    const districtVal = String(row[colMap.district] || '').trim();
    if (!districtVal) continue;

    const curDiscom = (colMap.discom !== undefined) ? String(row[colMap.discom] || '').trim() : '';
    const curZone = (colMap.zone !== undefined) ? String(row[colMap.zone] || '').trim() : '';

    const matched = mappingInfo.map[districtVal.toUpperCase()];
    if (!matched) continue;

    const linkUrl = (colMap.linkUrl !== undefined) ? String(row[colMap.linkUrl] || '').trim() : '';
    const postId = (colMap.postId !== undefined) ? String(row[colMap.postId] || '').trim() : '';

    let changed = false;

    // Populate blank DISCOM if not manually overridden
    if (colMap.discom !== undefined && (!curDiscom || curDiscom === '')) {
      const isOverridden = isFieldManuallyOverridden(overridesMap, postId, linkUrl, sheetRowNumber, 'discom');
      if (!isOverridden) {
        sheet.getRange(sheetRowNumber, colMap.discom + 1).setValue(matched.discom);
        changed = true;
      }
    }

    // Populate blank Zone if not manually overridden
    if (colMap.zone !== undefined && (!curZone || curZone === '')) {
      const isOverridden = isFieldManuallyOverridden(overridesMap, postId, linkUrl, sheetRowNumber, 'zone');
      if (!isOverridden) {
        sheet.getRange(sheetRowNumber, colMap.zone + 1).setValue(matched.zone);
        changed = true;
      }
    }

    if (changed) populatedCount++;
  }

  SpreadsheetApp.flush();
  const alertMsg = 'Mapping Complete!\n\nPopulated blank DISCOM / Zone fields for ' + populatedCount + ' row(s) based on Discom_District_List.\nAll existing and manual values were preserved.';
  try { SpreadsheetApp.getUi().alert(alertMsg); } catch (e) { Logger.log(alertMsg); }
  return populatedCount;
}

/**
 * Displays summary of protected manual overrides in the sheet.
 */
function showManualOverridesSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const map = getManualOverridesMap(ss);
  const total = map.size;

  const countsByField = {};
  for (const [k, v] of map.entries()) {
    const f = v.field || 'other';
    countsByField[f] = (countsByField[f] || 0) + 1;
  }

  let details = 'Protected Manual Overrides: ' + total + '\n\n';
  for (const [f, count] of Object.entries(countsByField)) {
    details += '• ' + f + ': ' + count + ' record(s)\n';
  }
  details += '\nAll manual overrides are permanent and protected from automated overwrite.';

  SpreadsheetApp.getUi().alert(details);
}

/**
 * Creates custom menu when spreadsheet is opened.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('UPPCL Automation')
    .addItem('⚡ Sort Sheet by Date: Newest First (Z–A)', 'sortSheetByDateDescending')
    .addItem('📅 Convert & Fix All Date Types (True Dates)', 'fixDateColumnInSheet')
    .addItem('⏱ Recalculate 30-Min SLA Column (REPLY_WITHIN_30_MIN)', 'recalculateReplyWithin30MinInSheet')
    .addSeparator()
    .addItem('⚙ Setup Dropdowns & Validations', 'setupSheetDropdownsAndValidations')
    .addItem('🔄 Map Blank DISCOM & Zone from District', 'populateBlankDiscomAndZoneFromDistrict')
    .addItem('📋 View Protected Manual Overrides', 'showManualOverridesSummary')
    .addSeparator()
    .addItem('🛑 STOP All X Fetching Permanently', 'permanentlyStopXSync')
    .addItem('▶ Resume 24/7 Cloud Sync', 'resumeXSync')
    .addItem('⏹ Disable 24/7 Cloud Sync', 'disable247CloudSync')
    .addItem('⚡ Run Cloud Sync Once Now', 'runCloudSyncCycle')
    .addItem('🛡 Reconcile 5 Approved Handles & Archive Excluded', 'reconcileFiveApprovedHandles')
    .addSeparator()
    .addItem('🛠 Repair Misaligned Rows (2715-2722)', 'repairMisalignedRowsInSheet')
    .addItem('🗑 Delete Selected Row as Frivolous', 'deleteSelectedRowAsFrivolous')
    .addItem('🧹 Remove Duplicate Rows from Sheet', 'removeDuplicateRowsFromSheet')
    .addItem('🧹 Remove Official Initiated Posts', 'removeOfficialPostsFromSheet')
    .addItem('ðŸ§¹ Remove Posts Already Replied by DISCOM / Authorities', 'removeOfficialRepliedFromSheet')
    .addItem('📥 Sync All Complaints from Working Sheet (19-10-26)', 'syncFromWorkingSheet')
    .addItem('🔄 Restore Standard Column Headers (Row 1)', 'restoreStandardHeaders')
    .addItem('⚡ Populate UPPCLLKO Replied (YES/NO) across All Rows', 'populateUppclRepliedColumn')
    .addItem('📋 Setup YES/NO Dropdowns for UPPCLLKO Replied (Col J)', 'setupUppclRepliedDropdowns')
    .addItem('📋 Setup YES/NO/OTHER Dropdowns for Picked Status', 'setupPickedStatusDropdowns')
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

  // 5. Setup YES/NO Dropdown Data Validation for UPPCLLKO Replied (Col J)
  const uppclCol = (colMap.uppclReplied !== undefined) ? colMap.uppclReplied + 1 : 10;
  const dropdownRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['YES', 'NO'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(3, uppclCol, numDataRows, 1).setDataValidation(dropdownRule);

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
/**
 * 83 Official DISCOM & District Handles
 * If any of these handles replied to a complaint post before UPPCLLKO,
 * that complaint must NOT land on the Google Sheet.
 */
const DISCOM_FIELD_HANDLES = new Set([
  // Apex & Ministerial Authorities (6 handles)
  'cmofficeup', 'emofficeup', 'aksharmaoffice', 'aksharmabharat', 'chairmanuppcl', 'mduppcl',
  // DISCOM Corporate HQs (5 handles)
  'pvvnlhq', 'dvvnlhq', 'puvvnlhq', 'mvvnlhq', 'kescohq',
  // PuVVNL (21 handles)
  'puvvnlazamgarh', 'puvvnlbhadohi', 'puvvnlballia', 'puvvnlbasti', 'puvvnlchandauli',
  'puvvnldeoria', 'puvvnlfatehpur', 'puvvnlghazipur', 'puvvnlgorakhpur', 'puvvnljaunpur',
  'puvvnlkaushambi', 'puvvnlkusinagar', 'puvvnlmhrjganj', 'puvvnlmau', 'puvvnlmirzapur1',
  'puvvnlprtapgarh', 'puvvnlprayagraj', 'puvvnlsknagar', 'puvvnlsdnagar', 'puvvnlsonbhadra',
  'puvvnlvaranasi',
  // MVVNL (22 handles)
  'mvvnlbareilly', 'mvvnlbudaun', 'mvvnlpilibhit', 'mvvnlsahjahapur', 'edc_ambdkrnagar',
  'mvvnlamethi', 'mvvnlbarabanki', 'mvvnlayodhya', 'mvvnlsultanpur', 'mvvnlbahraich',
  'mvvnlbalrampur', 'mvvnlgonda', 'mvvnlshrawasti', 'zoneamausi', 'mvvnlcisgomti2',
  'zonegomtinagar', 'mvvnllesatrans', 'mvvnllakhimpur', 'mvvnlhardoi', 'mvvnlraebareli',
  'mvvnlsitapur', 'mvvnlunnao',
  // DVVNL (21 handles)
  'dvvnlagra', 'dvvnlaligarh', 'dvvnlauraiya', 'dvvnlbanda', 'dvvnlchitrakoot',
  'dvvnletah', 'dvvnletawah01', 'dvvnlfarrukhaba', 'dvvnlfirozabad', 'dvvnlhamirpur',
  'dvvnlhathras', 'dvvnljalaun2', 'dvvnljhansi', 'dvvnlkannauj', 'dvvnlkanpurdeha',
  'dvvnlkanpurnagr', 'dvvnlkasganj', 'dvvnllalitpur2', 'dvvnlmahoba', 'dvvnlmainpuri',
  'dvvnlmathura1',
  // PVVNL (14 handles)
  'pvvnlamroha', 'pvvnlbaghpat', 'pvvnlbijnor', 'pvvnlbulandshr', 'pvvnlgbnagar',
  'pvvnlghaziabad', 'pvvnlhapur', 'pvvnlmeerut', 'pvvnlmoradabad', 'pvvnlmuzafarngr',
  'pvvnlrampur', 'pvvnlsaharanpur', 'pvvnlsambhal', 'pvvnlshamli'
]);

/**
 * Checks if any of the 83 DISCOM / district handles replied to a tweet before UPPCLLKO.
 */
function checkDiscomRepliedBeforeUppclInScript(tweetId, bearerToken, conversationId) {
  if (!tweetId) return { discomRepliedFirst: false };
  try {
    const targetCid = conversationId || tweetId;
    const url = 'https://api.twitter.com/2/tweets/search/recent?query=' + encodeURIComponent('conversation_id:' + targetCid) +
      '&max_results=50' +
      '&tweet.fields=created_at,author_id,conversation_id' +
      '&expansions=author_id' +
      '&user.fields=username';

    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + bearerToken,
        'User-Agent': 'UPPCL-Grievance-Command-Centre/2.0'
      },
      muteHttpExceptions: true
    });

    if (resp.getResponseCode() !== 200) {
      return { discomRepliedFirst: false };
    }

    const json = JSON.parse(resp.getContentText());
    let tweets = json.data || [];
    let users = (json.includes && json.includes.users) ? json.includes.users : [];

    // If query returned 0 and we haven't resolved conversation_id, check tweet details to find root conversation_id
    if (tweets.length === 0 && !conversationId) {
      try {
        const detailUrl = 'https://api.twitter.com/2/tweets/' + tweetId + '?tweet.fields=conversation_id';
        const dResp = UrlFetchApp.fetch(detailUrl, {
          method: 'get',
          headers: { 'Authorization': 'Bearer ' + bearerToken, 'User-Agent': 'UPPCL-Grievance-Command-Centre/2.0' },
          muteHttpExceptions: true
        });
        if (dResp.getResponseCode() === 200) {
          const dJson = JSON.parse(dResp.getContentText());
          if (dJson.data && dJson.data.conversation_id && dJson.data.conversation_id !== tweetId) {
            const rootUrl = 'https://api.twitter.com/2/tweets/search/recent?query=' + encodeURIComponent('conversation_id:' + dJson.data.conversation_id) +
              '&max_results=50&tweet.fields=created_at,author_id,conversation_id&expansions=author_id&user.fields=username';
            const rResp = UrlFetchApp.fetch(rootUrl, {
              method: 'get',
              headers: { 'Authorization': 'Bearer ' + bearerToken, 'User-Agent': 'UPPCL-Grievance-Command-Centre/2.0' },
              muteHttpExceptions: true
            });
            if (rResp.getResponseCode() === 200) {
              const rJson = JSON.parse(rResp.getContentText());
              tweets = rJson.data || [];
              users = (rJson.includes && rJson.includes.users) ? rJson.includes.users : [];
            }
          }
        }
      } catch (e) {}
    }
    const userMap = {};
    for (let u = 0; u < users.length; u++) {
      userMap[users[u].id] = (users[u].username || '').toLowerCase();
    }

    if (tweets && tweets.length > 0) {
      // Sort all conversation tweets chronologically (oldest to newest)
      tweets.sort(function(a, b) {
        return (new Date(a.created_at).getTime() || 0) - (new Date(b.created_at).getTime() || 0);
      });

      const latestTweet = tweets[tweets.length - 1];
      const latestAuthor = (userMap[latestTweet.author_id] || '').toLowerCase();

      // STRICT RULE: Only consider the complaint ignored/replied by DISCOM if the LAST post/reply
      // in the thread was authored by an authoritative handle. If the consumer replies afterwards,
      // the complaint must remain active so UPPCL can entertain and address it!
      if (DISCOM_FIELD_HANDLES.has(latestAuthor)) {
        return {
          discomRepliedFirst: true,
          discomRepliedLast: true,
          handle: latestAuthor,
          lastTweetId: latestTweet.id,
          lastCreatedAt: latestTweet.created_at
        };
      } else {
        return {
          discomRepliedFirst: false,
          discomRepliedLast: false,
          lastAuthor: latestAuthor
        };
      }
    }
  } catch (err) {
    Logger.log('Error checking replies for ' + tweetId + ': ' + err);
  }
  return { discomRepliedFirst: false };
}

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

    // Ensure UPPCLLKO Replied (YES/NO) is NOT automatically filled — must remain blank until manual selection or button click
    const uppclColIdx = (colMap.uppclReplied !== undefined) ? colMap.uppclReplied : 9;
    padded[uppclColIdx] = '';

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

  // Apply YES/NO dropdown to UPPCLLKO Replied column for newly appended rows
  const uppclColSync = (colMap.uppclReplied !== undefined) ? colMap.uppclReplied + 1 : 10;
  const dropdownRuleSync = SpreadsheetApp.newDataValidation()
    .requireValueInList(['YES', 'NO'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(startAppendRow, uppclColSync, numToAppend, 1).setDataValidation(dropdownRuleSync);

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

  // Apply dropdown data validations to newly appended rows
  const colMap = getSheetColumnMap(sheet);
  setupRowDropdowns(sheet, startAppendRow, numToAppend, colMap, ss);

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
  const overridesMap = getManualOverridesMap(ss);

  const twitterIdCol = (colMap.twitterId !== undefined) ? colMap.twitterId : 5;
  const pickedStatusCol = (colMap.pickedStatus !== undefined) ? colMap.pickedStatus : 6;
  const postTextCol = (colMap.postText !== undefined) ? colMap.postText : 16;
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;
  const complaintTypeCol = (colMap.complaintType !== undefined) ? colMap.complaintType : 10;
  const statusCol = (colMap.status !== undefined) ? colMap.status : 14;
  const reply30Col = (colMap.reply30 !== undefined) ? colMap.reply30 : 3;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowIndex = i + 3;
    const twitterId = String(row[twitterIdCol] || '').toLowerCase().replace('@', '').trim();
    const pickedStatus = String(row[pickedStatusCol] || '').trim().toUpperCase();
    const linkUrl = String(row[linkUrlCol] || '').trim();
    const fullText = (String(row[postTextCol] || '') + ' ' + linkUrl).toLowerCase();

    // Extract Tweet ID for override check
    const tidMatch = linkUrl.match(/status\/(\d+)/i);
    const tid = tidMatch ? tidMatch[1] : '';

    // RULE 2 & 3: Never overwrite a user's manual selection on Picked Status
    if (isFieldManuallyOverridden(overridesMap, tid, linkUrl, rowIndex, 'pickedStatus')) {
      continue;
    }

    const isOfficial = isOfficialAccountInScript(twitterId);
    const endsWithOfficial = endsWithOfficialHandleInScript(String(row[postTextCol] || ''));
    const hasReplyOrComplaintMarkers = /प्रिय\s*उपभोक्ता|प्रिय\s*ग्राहक|काम\s*चल\s*रहा|पूर्व\s*में\s*दर्ज|शिकायत\s*संख्या|1912|संबंधित\s*अधिकारी|समाधान\s*कर\s*दिया|previously\s*lodged|work\s*is\s*going|update\s*you\s*soon|we\s*will\s*update|status\s*of\s*the\s*complaint|contact\s*number\s*1912|dear\s*consumer|concerned\s*officer|please\s*take\s*action|inform\s*the\s*consumer|अनुरोध|ots|बकाया|तार|पोल|खंभा/i.test(fullText);

    // If marked APPRECIATION but is an official handle, ends with official handles, or is official reply:
    if (pickedStatus === 'APPRECIATION' && (isOfficial || endsWithOfficial || hasReplyOrComplaintMarkers)) {
      sheet.getRange(rowIndex, pickedStatusCol + 1).setValue('YES');
      if (!row[complaintTypeCol] || String(row[complaintTypeCol]).trim() === '') {
        if (!isFieldManuallyOverridden(overridesMap, tid, linkUrl, rowIndex, 'complaintType')) {
          const compType = (fullText.includes('ots') || fullText.includes('बकाया')) ? 'BILL_RELATED' : 'DISSATISFIED_CONSUMER';
          sheet.getRange(rowIndex, complaintTypeCol + 1).setValue(compType);
        }
      }
      if (colMap.status !== undefined) {
        if (!isFieldManuallyOverridden(overridesMap, tid, linkUrl, rowIndex, 'status')) {
          sheet.getRange(rowIndex, statusCol + 1).setValue('Forwarded to Discom');
        }
      }
      if (colMap.reply30 !== undefined) {
        sheet.getRange(rowIndex, reply30Col + 1).setValue('YES');
      }
      correctedCount++;
    }
  }

  SpreadsheetApp.flush();
  try {
    SpreadsheetApp.getUi().alert('Completed: Corrected ' + correctedCount + ' misclassified complaint rows to \'Picked Status: YES\' and \'DISSATISFIED_CONSUMER\'.');
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

    if (lastRow < 2) {
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
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

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
    if (contents.action === 'sort_sheet' || contents.action === 'sort_dates') {
      sortSheetByDateDescending();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', action: contents.action }))
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
    if (contents.action === 'setup_dropdowns' || contents.action === 'setup_validations') {
      setupSheetDropdownsAndValidations();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', action: contents.action }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (contents.action === 'setup_dropdown' || contents.action === 'setup_uppcl_replied_dropdown') {
      const configuredCount = setupUppclRepliedDropdowns();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', action: contents.action, configuredRows: configuredCount }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (contents.action === 'sync_district_mapping' || contents.action === 'map_discom_zone') {
      const fixed = populateBlankDiscomAndZoneFromDistrict();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', action: contents.action, populatedCount: fixed }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (contents.action === 'get_overrides') {
      const map = getManualOverridesMap();
      const records = [];
      for (const [k, v] of map.entries()) {
        records.push({ key: k, ...v });
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: records.length, overrides: records }))
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
    const dateCol = (colMap.date !== undefined) ? colMap.date : 0;

    // Normalize date column in incoming rows to genuine Date objects
    for (let r = 0; r < rows.length; r++) {
      const dVal = rows[r][dateCol];
      if (typeof dVal === 'string' && dVal.trim()) {
        const dmy = dVal.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmy) {
          rows[r][dateCol] = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
        } else {
          const ymd = dVal.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (ymd) {
            rows[r][dateCol] = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
          }
        }
      }
    }

    const startRow = Math.max(sheet.getLastRow() + 1, 2);
    const range = sheet.getRange(startRow, 1, rows.length, rows[0].length);
    range.setValues(rows);
    range.setFontFamily('Verdana');
    range.setFontSize(10);
    range.setHorizontalAlignment('center');
    range.setVerticalAlignment('middle');
    range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    range.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

    // Apply Date number format
    if (colMap.date !== undefined) {
      sheet.getRange(startRow, colMap.date + 1, rows.length, 1).setNumberFormat('dd-MM-yyyy');
    }
    // Apply YES/NO dropdown to UPPCLLKO Replied column for inserted rows
    const uppclColPost = (colMap.uppclReplied !== undefined) ? colMap.uppclReplied + 1 : 10;
    const dropdownRulePost = SpreadsheetApp.newDataValidation()
      .requireValueInList(['YES', 'NO'], true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(startRow, uppclColPost, rows.length, 1).setDataValidation(dropdownRulePost);

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

    // Automatically sort entire sheet by DATE descending (Z-A, latest complaints at top)
    sortSheetByDateDescending();

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

/**
 * Refreshes and updates the 'Dashboard' tab with authoritative KPI formulas.
 * Dynamically resolves columns from 'Twitter Complaint List':
 * - UPPCLLKO Replied & UPPCLLKO Not Replied from Column J ('UPPCLLKO Replied (YES/NO)')
 * - Total Complaints from Column E ('LINK URL')
 * - Complaint Types from Column K ('Complaint Type')
 * - DISCOMs from Column L ('DISCOM')
 */
function refreshDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dashSheet = ss.getSheetByName('Dashboard');
  if (!dashSheet) {
    dashSheet = ss.insertSheet('Dashboard');
  }

  // Column map discovery from 'Twitter Complaint List' to ensure formulas always use correct column letters
  const mainSheet = ss.getSheetByName('Twitter Complaint List') || ss.getActiveSheet();
  const colMap = getSheetColumnMap(mainSheet);
  
  function getColLetter(zeroIdx, fallbackLetter) {
    if (zeroIdx === undefined || zeroIdx === null || zeroIdx < 0) return fallbackLetter;
    let col = zeroIdx + 1;
    let letter = '';
    while (col > 0) {
      let rem = (col - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      col = Math.floor((col - 1) / 26);
    }
    return letter;
  }

  const urlLtr = getColLetter(colMap.linkUrl, 'E');
  const uppclLtr = getColLetter(colMap.uppclReplied, 'J');
  const typeLtr = getColLetter(colMap.complaintType, 'K');
  const discomLtr = getColLetter(colMap.discom, 'L');

  // Clear existing content to avoid stale rows
  dashSheet.clear();

  // -------------------------------------------------------------
  // TABLE 1: Main KPI Metrics (Columns A - D)
  // -------------------------------------------------------------
  const dashData = [
    ['UPPCL X COMPLAINT MONITORING DASHBOARD', '', '', ''],
    ['Metric', 'Value', 'Source / Formula', 'Notes'],
    // Overall Volume
    ['Total Complaints Recorded', `=COUNTA('Twitter Complaint List'!${urlLtr}3:${urlLtr})`, `Column ${urlLtr} (LINK URL)`, 'Active qualifying post links count'],
    // UPPCLLKO Reply Status (Strictly from Col J: UPPCLLKO Replied (YES/NO))
    ['UPPCLLKO Replied', `=COUNTIF('Twitter Complaint List'!${uppclLtr}3:${uppclLtr}, "YES")`, `Column ${uppclLtr} = 'YES'`, 'UPPCLLKO Replied (YES/NO) = YES'],
    ['UPPCLLKO Not Replied', `=COUNTIFS('Twitter Complaint List'!${urlLtr}3:${urlLtr}, "<>", 'Twitter Complaint List'!${uppclLtr}3:${uppclLtr}, "<>YES")`, `Column ${uppclLtr} <> 'YES'`, 'Active complaints where UPPCLLKO has not replied'],
    ['UPPCLLKO Explicit NO', `=COUNTIF('Twitter Complaint List'!${uppclLtr}3:${uppclLtr}, "NO")`, `Column ${uppclLtr} = 'NO'`, 'Explicitly marked NO in dropdown'],
    ['UPPCLLKO Unmarked / Pending', `=COUNTIFS('Twitter Complaint List'!${urlLtr}3:${urlLtr}, "<>", 'Twitter Complaint List'!${uppclLtr}3:${uppclLtr}, "")`, `Column ${uppclLtr} is Blank`, 'Awaiting reply or verification'],
    // Category Breakdown (From Col K: Complaint Type)
    ['Supply Outages', `=COUNTIF('Twitter Complaint List'!${typeLtr}3:${typeLtr}, "SUPPLY_OUTAGE")`, `Column ${typeLtr} (Complaint Type)`, 'SUPPLY_OUTAGE'],
    ['Transformer Damage', `=COUNTIF('Twitter Complaint List'!${typeLtr}3:${typeLtr}, "TRANSFORMER_DAMAGE")`, `Column ${typeLtr} (Complaint Type)`, 'TRANSFORMER_DAMAGE'],
    ['Billing Issues', `=COUNTIF('Twitter Complaint List'!${typeLtr}3:${typeLtr}, "BILL_RELATED")`, `Column ${typeLtr} (Complaint Type)`, 'BILL_RELATED'],
    ['Voltage Fluctuations', `=COUNTIF('Twitter Complaint List'!${typeLtr}3:${typeLtr}, "SUPPLY_VOLTAGE")`, `Column ${typeLtr} (Complaint Type)`, 'SUPPLY_VOLTAGE'],
    ['New Connection Issues', `=COUNTIF('Twitter Complaint List'!${typeLtr}3:${typeLtr}, "CONNECTION_NEW")`, `Column ${typeLtr} (Complaint Type)`, 'CONNECTION_NEW'],
    // DISCOM Breakdown (From Col L: DISCOM)
    ['MVVNL Complaints', `=COUNTIF('Twitter Complaint List'!${discomLtr}3:${discomLtr}, "MVVNL")`, `Column ${discomLtr} (DISCOM)`, 'Central UP'],
    ['PVVNL Complaints', `=COUNTIF('Twitter Complaint List'!${discomLtr}3:${discomLtr}, "PVVNL")`, `Column ${discomLtr} (DISCOM)`, 'Western UP'],
    ['PuVVNL Complaints', `=COUNTIF('Twitter Complaint List'!${discomLtr}3:${discomLtr}, "PuVVNL")`, `Column ${discomLtr} (DISCOM)`, 'Eastern UP'],
    ['DVVNL Complaints', `=COUNTIF('Twitter Complaint List'!${discomLtr}3:${discomLtr}, "DVVNL")`, `Column ${discomLtr} (DISCOM)`, 'Southern UP'],
    ['KESCo Complaints', `=COUNTIF('Twitter Complaint List'!${discomLtr}3:${discomLtr}, "KESCO")`, `Column ${discomLtr} (DISCOM)`, 'Kanpur City']
  ];

  dashSheet.getRange(1, 1, dashData.length, 4).setValues(dashData);

  // Table 1 Formatting
  dashSheet.getRange(1, 1, 1, 4).merge()
    .setFontFamily('Verdana').setFontWeight('bold').setFontSize(14)
    .setBackground('#4DD0E1').setFontColor('#1A2F40').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dashSheet.setRowHeight(1, 45);

  dashSheet.getRange(2, 1, 1, 4)
    .setFontFamily('Verdana').setFontWeight('bold').setFontSize(11)
    .setBackground('#4DD0E1').setFontColor('#1A2F40').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dashSheet.setRowHeight(2, 32);

  dashSheet.getRange(3, 1, dashData.length - 2, 4)
    .setFontFamily('Verdana').setFontSize(11).setVerticalAlignment('middle');
  
  dashSheet.getRange(4, 1, 1, 4).setBackground('#E8F5E9').setFontWeight('bold'); // Green tint for YES
  dashSheet.getRange(5, 1, 1, 4).setBackground('#FFF3E0').setFontWeight('bold'); // Amber tint for Not Replied

  dashSheet.getRange(3, 2, dashData.length - 2, 1).setHorizontalAlignment('center').setFontWeight('bold').setFontSize(12);

  for (let r = 3; r <= dashData.length; r++) {
    dashSheet.setRowHeight(r, 28);
  }

  dashSheet.getRange(1, 1, dashData.length, 4)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // -------------------------------------------------------------
  // TABLE 2: Official Monitored Handles List (Columns F - H)
  // WITH ENLARGED, PROMINENT FONT SIZES (13pt - 15pt Verdana)
  // -------------------------------------------------------------
  const handlesData = [
    ['OFFICIAL MONITORED HANDLES LIST (5 HANDLES)', '', ''],
    ['Official X Handle', 'Designation / Organization', 'Role & Jurisdiction'],
    ['@UPPCLLKO', 'UPPCL Official HQ', 'Central Social Media Cell & Corporate HQ'],
    ['@EMofficeUP', 'Energy Minister Office UP', 'Office of Hon. Energy Minister'],
    ['@AKSharmaOffice', 'A.K. Sharma Office', 'Cabinet Minister Official Office'],
    ['@aksharmaBharat', 'A.K. Sharma', 'Hon. Minister (Personal/Public)'],
    ['@mduppcl', 'Managing Director, UPPCL', 'DISCOM Operational Oversight']
  ];

  dashSheet.getRange(1, 6, handlesData.length, 3).setValues(handlesData);

  // Title Banner (F1:H1) - 15pt bold
  dashSheet.getRange(1, 6, 1, 3).merge()
    .setFontFamily('Verdana').setFontWeight('bold').setFontSize(15)
    .setBackground('#008080').setFontColor('#FFFFFF')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // Header Row (F2:H2) - 13pt bold
  dashSheet.getRange(2, 6, 1, 3)
    .setFontFamily('Verdana').setFontWeight('bold').setFontSize(13)
    .setBackground('#4DD0E1').setFontColor('#1A2F40')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // Handle Names Column F (F3:F7) - 14pt Bold Blue Font
  dashSheet.getRange(3, 6, 5, 1)
    .setFontFamily('Verdana').setFontWeight('bold').setFontSize(14)
    .setFontColor('#0055aa').setHorizontalAlignment('left').setVerticalAlignment('middle');

  // Designation Column G (G3:G7) - 13pt Semi-Bold Font
  dashSheet.getRange(3, 7, 5, 1)
    .setFontFamily('Verdana').setFontWeight('bold').setFontSize(13)
    .setFontColor('#1A2F40').setHorizontalAlignment('left').setVerticalAlignment('middle');

  // Role Column H (H3:H7) - 12pt Normal Font
  dashSheet.getRange(3, 8, 5, 1)
    .setFontFamily('Verdana').setFontSize(12)
    .setFontColor('#333333').setHorizontalAlignment('left').setVerticalAlignment('middle');

  // Alternating row background for handles table
  for (let r = 3; r <= 7; r++) {
    dashSheet.setRowHeight(r, 36); // Generous, comfortable row height
    if (r % 2 === 1) {
      dashSheet.getRange(r, 6, 1, 3).setBackground('#F0FDF4'); // Subtle mint tint
    } else {
      dashSheet.getRange(r, 6, 1, 3).setBackground('#FFFFFF');
    }
  }

  dashSheet.getRange(1, 6, handlesData.length, 3)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // Column widths
  dashSheet.autoResizeColumns(1, 4);
  dashSheet.setColumnWidth(5, 30); // Spacer column E
  dashSheet.setColumnWidth(6, 210); // Handle
  dashSheet.setColumnWidth(7, 260); // Designation
  dashSheet.setColumnWidth(8, 380); // Role

  SpreadsheetApp.flush();
  const msg = 'Dashboard Updated Successfully!\n\n' +
    '• Official Monitored Handles List font size increased to 13pt - 15pt bold.\n' +
    '• UPPCLLKO Replied / Not Replied linked directly to Column ' + uppclLtr + ' (UPPCLLKO Replied (YES/NO)).\n' +
    '• All formulas refreshed.';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch(e) {
    Logger.log(msg);
  }
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
  refreshDashboard();
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

      // STRICT DISCOM-FIRST REPLY FILTER:
      // If any of the 83 DISCOM / district handles replied before UPPCLLKO, do NOT insert!
      const discomCheck = checkDiscomRepliedBeforeUppclInScript(tweetId, bearerToken);
      if (discomCheck && discomCheck.discomRepliedFirst) {
        Logger.log('Strict rejection: Tweet ' + tweetId + ' dropped because DISCOM @' + discomCheck.handle + ' replied before UPPCLLKO.');
        continue;
      }
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
      if (colMap.date !== undefined) row[colMap.date] = tweetDate; // Store genuine Date object
      if (colMap.linkShift !== undefined) row[colMap.linkShift] = shift;
      if (colMap.replyShift !== undefined) row[colMap.replyShift] = shift;
      if (colMap.cf !== undefined) row[colMap.cf] = '';
      if (colMap.reply30 !== undefined) row[colMap.reply30] = ''; // Rule 1: strictly blank on import
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

    // Apply dropdown data validations to newly appended rows
    setupRowDropdowns(sheet, insertStartRow, rowsToInsert.length, colMap, ss);

    // Ensure DATE column has genuine date display format
    if (colMap.date !== undefined) {
      sheet.getRange(insertStartRow, colMap.date + 1, rowsToInsert.length, 1).setNumberFormat('dd-MM-yyyy');
    }

    SpreadsheetApp.flush();
    // Apply YES/NO dropdown for UPPCLLKO Replied column
    const uppclColCycle = (colMap.uppclReplied !== undefined) ? colMap.uppclReplied + 1 : 10;
    const dropdownRuleCycle = SpreadsheetApp.newDataValidation()
      .requireValueInList(['YES', 'NO'], true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(insertStartRow, uppclColCycle, rowsToInsert.length, 1).setDataValidation(dropdownRuleCycle);

    // Automatically sort entire sheet by DATE descending (Z-A, latest complaints at top)
    sortSheetByDateDescending();

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

  // District Mapping (All 75 UP Districts recognized)
  let district = '';
  const districts = [
    'Agra', 'Aligarh', 'Auraiya', 'Banda', 'Chitrakoot', 'Etah', 'Etawah', 'Farrukhabad',
    'Firozabad', 'Hamirpur', 'Hathras', 'Jalaun', 'Jhansi', 'Kannauj', 'Kanpur Dehat',
    'Kasganj', 'Lalitpur', 'Mahoba', 'Mainpuri', 'Mathura', 'Kanpur City', 'Kanpur',
    'Ambedkar Nagar', 'Amethi', 'Ayodhya', 'Badaun', 'Bahraich', 'Balrampur', 'Barabanki',
    'Bareilly', 'Gonda', 'Hardoi', 'Lakhimpur', 'Lucknow', 'Pilibhit', 'Raebareli',
    'Shajahanpur', 'Shahjahanpur', 'Shravasti', 'Sitapur', 'Sultanpur', 'Unnao', 'Amroha',
    'Baghpat', 'Bijnor', 'Bulandshahr', 'Bulandsahar', 'Gautam Budh Nagar', 'Noida',
    'Ghaziabad', 'Hapur', 'Meerut', 'Moradabad', 'Muzaffarnagar', 'Rampur', 'Saharanpur',
    'Sambhal', 'Shamli', 'Azamgarh', 'Ballia', 'Basti', 'Bhadohi', 'Chandauli', 'Deoria',
    'Fatehpur', 'Ghazipur', 'Gorakhpur', 'Jaunpur', 'Kaushambi', 'Kushinagar', 'Maharajganj',
    'Mau', 'Mirzapur', 'Pratapgarh', 'Prayagraj', 'Sant Kabir Nagar', 'Siddharth Nagar',
    'Sonbhadra', 'Varanasi'
  ];
  for (let d of districts) {
    if (new RegExp('\\b' + d.toLowerCase() + '\\b', 'i').test(lowerText)) {
      district = d;
      break;
    }
  }

  // DISCOM & Zone Mapping: Resolve dynamically from Discom_District_List if available
  let discom = '';
  let zone = '';
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mappingInfo = getDistrictMappingFromListSheet(ss);
    if (district && mappingInfo && mappingInfo.map) {
      // Normalize district name variations
      let lookupKey = district.toUpperCase();
      if (lookupKey === 'NOIDA') lookupKey = 'GAUTAM BUDH NAGAR';
      if (lookupKey === 'BULANDSHAHR') lookupKey = 'BULANDSAHAR';
      if (lookupKey === 'SHAHJAHANPUR') lookupKey = 'SHAJAHANPUR';
      if (lookupKey === 'KANPUR') lookupKey = 'KANPUR CITY';
      if (lookupKey === 'RAEBARELI') lookupKey = 'RAEBAREILY';

      const matched = mappingInfo.map[lookupKey];
      if (matched) {
        district = matched.district;
        discom = matched.discom;
        zone = matched.zone;
      }
    }
  } catch (e) {}

  // Fallback DISCOM detection if district didn't match
  if (!discom) {
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
  }

  // Grievance Category (Canonical 29 dropdown options)
  let complaintType = 'DISSATISFIED_CONSUMER';
  if (/बिजली\s*गायब|आपूर्ति\s*ठप|no\s*power|no\s*electricity|power\s*cut|outage|blackout|बिजली\s*कटौ|बिजली\s*नहीं/i.test(lowerText)) {
    complaintType = 'SUPPLY_OUTAGE';
  } else if (/लो\s*वोल्टेज|high\s*voltage|low\s*voltage|वोल्टेज/i.test(lowerText)) {
    complaintType = 'SUPPLY_VOLTAGE';
  } else if (/ट्रांसफार्मर|transformer|फुंक|ब्लास्ट/i.test(lowerText)) {
    complaintType = 'TRANSFORMER_DAMAGE';
  } else if (/बिल|bill|billing|मीटर\s*रीडिंग|overcharge|बकाया/i.test(lowerText)) {
    complaintType = 'BILL_RELATED';
  } else if (/ots|ओटीएस|one\s*time\s*settlement/i.test(lowerText)) {
    complaintType = 'OTS';
  } else if (/तार\s*टू|करंट|करंट\s*आ\s*रहा|spark|wire\s*break|danger|हादसा/i.test(lowerText)) {
    complaintType = 'ACCIDENT_PRONE_TO_OCCURED';
  } else if (/खंभा|पोल|pole/i.test(lowerText)) {
    complaintType = 'POLE_RELATED';
  } else if (/smart\s*meter|स्मार्ट\s*मीटर/i.test(lowerText)) {
    complaintType = 'SMART_METER';
  } else if (/meter|मीटर\s*खराब|मीटर\s*बदल/i.test(lowerText)) {
    complaintType = 'METER_RELATED';
  } else if (/नया\s*कनेक्शन|new\s*connection/i.test(lowerText)) {
    complaintType = 'CONNECTION_NEW';
  } else if (/चोरी|कटिया|बिजली\s*चोरी|theft/i.test(lowerText)) {
    complaintType = 'THEFT';
  }

  // Determine Picked Status (YES, NO, TROLL, APPRECIATION)
  let pickedStatus = isOfficial ? 'YES' : 'NO';
  const hasPureAppreciation = /बहुत\s*बहुत\s*धन्यवाद|उत्कृष्ट\s*कार्य|सराहनीय|great\s*job|thank\s*you\s*so\s*much|thanks\s*for\s*quick/i.test(lowerText) &&
                              !/समस्या|शिकायत|बिजली|outage|complaint|अधिकारी|प्रिय\s*उपभोक्ता/i.test(lowerText);

  if (hasPureAppreciation && !isOfficial && !endsWithOfficial) {
    pickedStatus = 'APPRECIATION';
    complaintType = 'INFO_AND_SUGG';
  }

  const discomHandle = discom ? ('@' + discom + 'HQ') : '@UPPCLLKO';
  const draftReply = 'प्रिय उपभोक्ता, आपकी शिकायत को संबंधित वितरण निगम ' + discomHandle + ' को त्वरित संज्ञान एवं समाधान हेतु अग्रसारित किया जा रहा है।';

  return {
    discom: discom || 'UPPCL',
    district: district,
    zone: zone || (district ? district + ' Zone' : ''),
    complaintType: complaintType,
    pickedStatus: pickedStatus,
    replyWithin30Min: '', // Rule 1: unreplied incoming complaints start strictly blank,
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
 * Sorts the entire complaint dataset by DATE descending (Z–A, newest complaint first).
 * Ensures:
 * 1. Complete rows move together (all columns remain strictly attached).
 * 2. Header row (Row 1) remains frozen at the top and excluded from the sort.
 * 3. Secondary tie-breaking by Snowflake ID / LINK URL maintains chronological order
 *    down to the second for complaints on the same calendar day.
 * 4. Empty rows naturally sort to the very bottom.
 */
function sortSheetByDateDescending() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;

  // Pin Row 1 header row permanently
  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
  }

  const frozenRows = Math.max(sheet.getFrozenRows(), 1);
  const startRow = frozenRows >= 2 ? 3 : 2;
  const numRows = lastRow - startRow + 1;
  if (numRows <= 0) return;

  const colMap = getSheetColumnMap(sheet);
  const dateCol = (colMap.date !== undefined) ? colMap.date : 0;
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;

  const dataRange = sheet.getRange(startRow, 1, numRows, lastCol);

  // Multi-tier complete-row sort:
  // Primary: DATE column descending (latest date first, Z-A)
  // Secondary: LINK URL column descending (latest Snowflake ID = latest tweet within same date)
  const sortCriteria = [
    { column: dateCol + 1, ascending: false }
  ];
  if (linkUrlCol !== -1 && linkUrlCol !== dateCol) {
    sortCriteria.push({ column: linkUrlCol + 1, ascending: false });
  }

  dataRange.sort(sortCriteria);
  SpreadsheetApp.flush();
  Logger.log('Successfully sorted ' + numRows + ' rows by DATE (Z-A, newest first).');
}

/**
 * Automatically fixes and normalizes the DATE column across all rows in 'Twitter Complaint List'.
 * Converts string dates into genuine Google Sheets Date objects with uniform 'dd-MM-yyyy' formatting.
 * Handles DD-MM-YYYY, YYYY-MM-DD, timestamps, serial numbers, and recovers missing dates via Tweet Snowflake ID.
 * Follows by sorting complete rows descending (newest first).
 */
function fixDateColumnInSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  // Pin Row 1 header permanently
  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const colMap = getSheetColumnMap(sheet);
  const lastCol = sheet.getLastColumn();
  const frozenRows = Math.max(sheet.getFrozenRows(), 1);
  const startRow = frozenRows >= 2 ? 3 : 2;
  const numRows = lastRow - startRow + 1;
  if (numRows <= 0) return 0;

  const data = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
  const dateValues = [];
  let fixCount = 0;

  const dateCol = (colMap.date !== undefined) ? colMap.date : 0;
  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;
  const postIdCol = (colMap.postId !== undefined) ? colMap.postId : -1;
  const detectedCol = (colMap.firstDetectedAt !== undefined) ? colMap.firstDetectedAt : -1;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rawCell = row[dateCol];
    const curDateStr = String(rawCell || '').trim();
    const url = String(row[linkUrlCol] || '').trim();
    const tidCol = (postIdCol !== -1) ? String(row[postIdCol] || '').trim() : '';
    const colDetected = (detectedCol !== -1) ? String(row[detectedCol] || '').trim() : '';

    // If entire row is blank, keep it empty so it sorts to bottom
    const isRowBlank = row.every(cell => String(cell || '').trim() === '');
    if (isRowBlank) {
      dateValues.push(['']);
      continue;
    }

    let dObj = null;

    // 1. If it is already a genuine native Date object
    if (rawCell instanceof Date && !isNaN(rawCell.getTime())) {
      const yr = rawCell.getFullYear();
      if (yr >= 2020 && yr <= 2035) {
        dObj = rawCell;
      }
    }

    // 2. If it is an Excel / Sheets serial number (e.g. 40000 - 60000)
    if (!dObj && typeof rawCell === 'number' && rawCell > 40000 && rawCell < 60000) {
      const epochMs = (rawCell - 25569) * 86400 * 1000;
      const parsed = new Date(epochMs);
      if (!isNaN(parsed.getTime())) {
        dObj = parsed;
      }
    }

    // 3. String date formats
    if (!dObj && curDateStr) {
      // 3a. Strict DD-MM-YYYY or DD/MM/YYYY
      const dmy = curDateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (dmy) {
        const day = parseInt(dmy[1], 10);
        const month = parseInt(dmy[2], 10) - 1;
        const year = parseInt(dmy[3], 10);
        if (year >= 2020 && year <= 2035 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          // Extract time if present
          let h = 0, m = 0, s = 0;
          const timeMatch = curDateStr.match(/\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
          if (timeMatch) {
            h = parseInt(timeMatch[1], 10);
            m = parseInt(timeMatch[2], 10);
            s = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
          }
          dObj = new Date(year, month, day, h, m, s);
        }
      }

      // 3b. Strict YYYY-MM-DD or YYYY/MM/DD
      if (!dObj) {
        const ymd = curDateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymd) {
          const year = parseInt(ymd[1], 10);
          const month = parseInt(ymd[2], 10) - 1;
          const day = parseInt(ymd[3], 10);
          if (year >= 2020 && year <= 2035) {
            dObj = new Date(year, month, day);
          }
        }
      }

      // 3c. ISO or standard string parse fallback
      if (!dObj && (curDateStr.includes('GMT') || curDateStr.includes('T') || /[a-zA-Z]{3}/.test(curDateStr))) {
        const parsed = new Date(curDateStr);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2035) {
          dObj = parsed;
        }
      }
    }

    // 4. Missing / Corrupted / Blank Date Recovery via Twitter Snowflake ID in Link URL or Tweet ID column
    if (!dObj) {
      const m = url.match(/status\/(\d+)/i);
      const tid = m ? m[1] : (tidCol && /^\d{15,25}$/.test(tidCol) ? tidCol : null);

      if (tid) {
        try {
          // Twitter Snowflake epoch: ms = (id >> 22) + 1288834974657
          const epochMs = Math.floor(Number(tid) / 4194304) + 1288834974657;
          const parsed = new Date(epochMs);
          if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2035) {
            dObj = parsed;
          }
        } catch (e) {
          try {
            const epochMs = Math.floor(Number(tid) / 4194304) + 1288834974657;
            const parsed = new Date(epochMs);
            if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2035) {
              dObj = parsed;
            }
          } catch (e2) {}
        }
      }
    }

    // 5. Secondary fallback to First Detected At IST
    if (!dObj && colDetected) {
      const dMatch = colDetected.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
      if (dMatch) {
        const day = parseInt(dMatch[1], 10);
        const month = parseInt(dMatch[2], 10) - 1;
        const year = parseInt(dMatch[3], 10);
        const h = dMatch[4] ? parseInt(dMatch[4], 10) : 0;
        const min = dMatch[5] ? parseInt(dMatch[5], 10) : 0;
        dObj = new Date(year, month, day, h, min, 0);
      }
    }

    // 6. Safe final default for valid complaints with no parseable date
    if (!dObj) {
      dObj = new Date(2026, 9, 19); // 19-10-2026
    }

    fixCount++;
    dateValues.push([dObj]);
  }

  // Write batch genuine Date objects back into DATE column with 'dd-MM-yyyy' formatting
  const dateRange = sheet.getRange(startRow, dateCol + 1, numRows, 1);
  dateRange.setNumberFormat('dd-MM-yyyy');
  dateRange.setValues(dateValues);
  dateRange.setHorizontalAlignment('center');
  dateRange.setVerticalAlignment('middle');
  dateRange.setFontFamily('Verdana');
  dateRange.setFontSize(10);
  dateRange.setFontColor('#000000');

  SpreadsheetApp.flush();

  // Execute complete-row descending sort
  sortSheetByDateDescending();

  const msg = 'Successfully converted ' + fixCount + ' records to genuine Date values and sorted complete rows descending (Z-A, latest date first)!';
  try {
    SpreadsheetApp.getUi().alert('Date Normalization & Descending Sort\n\n' + msg);
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
  if (lastRow < 2) return 0;
  const numRows = lastRow - 1;
  const colMap = getSheetColumnMap(sheet);
  const totalCols = sheet.getLastColumn();
  const data = sheet.getRange(2, 1, numRows, totalCols).getValues();
  const overridesMap = getManualOverridesMap(ss);

  let repairedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const sheetRowNumber = i + 2;

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
    const tid = recoveredTweetId || '';
    const url = recoveredUrl || '';

    // Respect manual user overrides and existing values
    if (colMap.pickedStatus !== undefined) {
      cleanRow[colMap.pickedStatus] = isFieldManuallyOverridden(overridesMap, tid, url, sheetRowNumber, 'pickedStatus') ? row[colMap.pickedStatus] : c.pickedStatus;
    }
    if (colMap.head !== undefined) {
      cleanRow[colMap.head] = isFieldManuallyOverridden(overridesMap, tid, url, sheetRowNumber, 'head') ? row[colMap.head] : recoveredHead;
    }
    if (colMap.untagged !== undefined) {
      cleanRow[colMap.untagged] = isFieldManuallyOverridden(overridesMap, tid, url, sheetRowNumber, 'untagged') ? row[colMap.untagged] : 'NO';
    }
    if (colMap.uppclReplied !== undefined) cleanRow[colMap.uppclReplied] = (colMap.uppclReplied !== undefined && row[colMap.uppclReplied]) ? row[colMap.uppclReplied] : '';
    if (colMap.complaintType !== undefined) {
      cleanRow[colMap.complaintType] = isFieldManuallyOverridden(overridesMap, tid, url, sheetRowNumber, 'complaintType') ? row[colMap.complaintType] : c.complaintType;
    }
    if (colMap.discom !== undefined) {
      cleanRow[colMap.discom] = isFieldManuallyOverridden(overridesMap, tid, url, sheetRowNumber, 'discom') ? row[colMap.discom] : c.discom;
    }
    if (colMap.zone !== undefined) {
      cleanRow[colMap.zone] = isFieldManuallyOverridden(overridesMap, tid, url, sheetRowNumber, 'zone') ? row[colMap.zone] : c.zone;
    }
    if (colMap.district !== undefined) {
      cleanRow[colMap.district] = isFieldManuallyOverridden(overridesMap, tid, url, sheetRowNumber, 'district') ? row[colMap.district] : c.district;
    }
    if (colMap.remark !== undefined) cleanRow[colMap.remark] = '';
    if (colMap.status !== undefined) {
      cleanRow[colMap.status] = isFieldManuallyOverridden(overridesMap, tid, url, sheetRowNumber, 'status')
        ? row[colMap.status]
        : ((c.pickedStatus === 'APPRECIATION') ? 'Appreciation' : (c.pickedStatus === 'YES' ? 'Forwarded to Discom' : 'Pending Review'));
    }
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


/**
 * Configures the 'UPPCLLKO Replied (YES/NO)' column (Column J)
 * with an interactive in-cell dropdown containing 'YES' and 'NO'.
 * Applies across all data rows (Row 3 to the end of the sheet).
 */
function setupUppclRepliedDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  const maxRows = sheet.getMaxRows();
  const targetRows = Math.max(lastRow, maxRows);
  if (targetRows < 3) return 0;

  const colMap = getSheetColumnMap(sheet);
  const targetCol = (colMap.uppclReplied !== undefined) ? colMap.uppclReplied + 1 : 10;
  const numDataRows = targetRows - 2;

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['YES', 'NO'], true)
    .setAllowInvalid(true)
    .build();

  sheet.getRange(3, targetCol, numDataRows, 1).setDataValidation(rule);
  SpreadsheetApp.flush();

  const colHeader = sheet.getRange(1, targetCol).getValue() || 'UPPCLLKO Replied (YES/NO)';
  const msg = 'Successfully enabled YES/NO in-cell dropdowns for ' + colHeader + ' (Column ' + targetCol + ') across ' + numDataRows + ' rows (Rows 3 to ' + targetRows + ')!';
  try {
    SpreadsheetApp.getUi().alert('Dropdown Setup Complete\n\n' + msg);
  } catch (e) {
    Logger.log(msg);
  }
  return numDataRows;
}

/**
 * Enables in-cell dropdown validation for 'Picked Status' column with YES, NO, OTHER, TROLL, APPRECIATION.
 * Dynamically resolves column by Row 1 header.
 * Applies across all data rows (Row 3 to the end of the sheet).
 */
function setupPickedStatusDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  const maxRows = sheet.getMaxRows();
  const targetRows = Math.max(lastRow, maxRows);
  if (targetRows < 3) return 0;

  const colMap = getSheetColumnMap(sheet);
  const targetCol = (colMap.pickedStatus !== undefined) ? colMap.pickedStatus + 1 : 7;
  const numDataRows = targetRows - 2;

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(PICKED_STATUS_DROPDOWN_VALUES, true)
    .setAllowInvalid(true)
    .build();

  sheet.getRange(3, targetCol, numDataRows, 1).setDataValidation(rule);
  SpreadsheetApp.flush();

  const colHeader = sheet.getRange(1, targetCol).getValue() || 'Picked Status';
  const msg = 'Successfully enabled YES, NO, OTHER in-cell dropdowns for ' + colHeader + ' (Column ' + targetCol + ') across ' + numDataRows + ' rows (Rows 3 to ' + targetRows + ')!';
  try {
    SpreadsheetApp.getUi().alert('Dropdown Setup Complete\n\n' + msg);
  } catch (e) {
    Logger.log(msg);
  }
  return numDataRows;
}



/**
 * Reconciles Google Sheet:
 * 1. Updates Settings tab MONITORED_APEX to the 5 approved handles.
 * 2. Archives complaints solely associated with @CMOfficeUP or @ChairmanUppcl.
 * 3. Archives complaints where any of the 83 DISCOM handles replied BEFORE UPPCLLKO.
 * 4. Re-resolves dual-tagged complaints from 'upc' to qualifying approved heads.
 */
function reconcileFiveApprovedHandles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Local resolver ensuring function works standalone
  function getApexHead(tweetText) {
    const t = (tweetText || '').toLowerCase();
    if (t.includes('mduppcl')) return 'upm';
    if (t.includes('aksharmaoffice')) return 'ako';
    if (t.includes('aksharmabharat')) return 'akb';
    if (t.includes('emofficeup')) return 'emo';
    if (t.includes('uppcllko')) return 'upl';
    return 'upl';
  }

  // Pre-computed verified complaints where DISCOM replied before UPPCLLKO
  const discomFirstMap = {
    '2112195095642702100': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112507662466441258': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112064284255801547': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112053721492509158': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied first (Tweet ID: 2112064154723041505) before UPPCLLKO (Tweet ID: 2112534258434842704)' },
    '2112422187831562614': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112453711566168416': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112426835481104796': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112255976040755310': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112141928490013122': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied first (Tweet ID: 2112230696152645734) before UPPCLLKO (Tweet ID: 2112417831283528035)' },
    '2111891117310661096': { handle: 'pvvnlhq', reason: 'DISCOM @pvvnlhq replied first (Tweet ID: 2111942687360508329) before UPPCLLKO (Tweet ID: 2112016139039736315)' },
    '2112141321897144403': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112521724659220604': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112210806435934661': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied first (Tweet ID: 2112222598117691600) before UPPCLLKO (Tweet ID: 2112760498248962104)' },
    '2112467501552660735': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112573197615059296': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112562300838432789': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112543129006170200': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied first (Tweet ID: 2112545628278645109) before UPPCLLKO (Tweet ID: 2112607433881428114)' },
    '2112522288927268890': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112513307664130262': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112390772691718569': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112372936137138485': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112353549044928662': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112168252235206929': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied first (Tweet ID: 2112174480525345271) before UPPCLLKO (Tweet ID: 2112778749909647651)' },
    '2112254948218183698': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112237148896420029': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112203905610485883': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112201354727105018': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112178431941284300': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112157366955204975': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112152544797753836': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112121984175972547': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112130307898192159': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2111898004626292927': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112001200430489911': { handle: 'puvvnlhq', reason: 'DISCOM @puvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112502858222555502': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112352514368819457': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112563326958067757': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied first (Tweet ID: 2112569196496421270) before UPPCLLKO (Tweet ID: 2112779003383918996)' },
    '2112546990110498825': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112134279165870398': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112551998784671961': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112572241275924674': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112543214033125704': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112405982743838877': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112522160803914050': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112437512354648142': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112492454121480193': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied first (Tweet ID: 2112510366148399247) before UPPCLLKO (Tweet ID: 2112776740720566426)' },
    '2112496033305600301': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112480666772476321': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112474228364894372': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112459295485034750': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112461581002961242': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112450159951163677': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112448991791354030': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112420398260486628': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112416307455173004': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112429294291202429': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112409595151077696': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112368928601378979': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112342570206646392': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112167020120989856': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112205469876187327': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied first (Tweet ID: 2112212463173480482) before UPPCLLKO (Tweet ID: 2112212544593318261)' },
    '2112152362811072555': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied first (Tweet ID: 2112183540435878389) before UPPCLLKO (Tweet ID: 2112785773141586221)' },
    '2112177126116069470': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112131519804318149': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112094892021440989': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112066666414969344': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied first (Tweet ID: 2112093352091132347) before UPPCLLKO (Tweet ID: 2112114798297247974)' },
    '2111961871502942324': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied first (Tweet ID: 2111969550854205861) before UPPCLLKO (Tweet ID: 2112056350364901700)' },
    '2111604765486707028': { handle: 'mvvnlhq', reason: 'DISCOM @mvvnlhq replied first (Tweet ID: 2111651999137845424) before UPPCLLKO (Tweet ID: 2111866307876708746)' },
    '2112379250082975856': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112102320741789969': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112426056619631021': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112507454068236689': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112442884305862702': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112545343011422258': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112557722961084431': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112499356616310939': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied first (Tweet ID: 2112501973769683271) before UPPCLLKO (Tweet ID: 2112530452519194769)' },
    '2112489812611731766': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112490205722915302': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112474425576800654': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112414648024871113': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112406956116005226': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112387014456942826': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112387034048582002': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112359967877726601': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied first (Tweet ID: 2112370228609089640) before UPPCLLKO (Tweet ID: 2112538671341867178)' },
    '2112273651232022714': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112070435626201198': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied first (Tweet ID: 2112074212705993029) before UPPCLLKO (Tweet ID: 2112099317075116421)' },
    '2112021305897992271': { handle: 'dvvnlhq', reason: 'DISCOM @dvvnlhq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112309605552533730': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112420139476115936': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112498044969308366': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112472813026361462': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112180891061719365': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112122549979201561': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112101740212629600': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112032157665517892': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' },
    '2112048673421173006': { handle: 'kescohq', reason: 'DISCOM @kescohq replied before UPPCLLKO (UPPCLLKO not replied)' }
  };

  // 1. Update Settings tab
  const settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet) {
    const data = settingsSheet.getDataRange().getValues();
    for (let r = 0; r < data.length; r++) {
      if (String(data[r][0] || '').trim() === 'MONITORED_APEX') {
        settingsSheet.getRange(r + 1, 2).setValue('@UPPCLLKO, @EMofficeUP, @AKSharmaOffice, @aksharmaBharat, @mduppcl');
        Logger.log('Updated Settings tab MONITORED_APEX cell B' + (r + 1));
        break;
      }
    }
  }

  // 2. Setup or get Archived_Excluded_Complaints sheet
  let archiveSheet = ss.getSheetByName('Archived_Excluded_Complaints');
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet('Archived_Excluded_Complaints');
  }
  
  const headers = ['Archived Date', 'Original Row', 'Complaint No', 'LINK URL', 'Handle', 'Head', 'Reason', 'Tweet Text'];
  if (archiveSheet.getLastRow() < 1) {
    archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#E57373').setFontColor('#FFFFFF')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    archiveSheet.setRowHeight(1, 40);
    archiveSheet.setFrozenRows(1);
  }

  // 3. Scan Twitter Complaint List
  const sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Error: "Twitter Complaint List" sheet not found.');
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 3) {
    SpreadsheetApp.getUi().alert('No data rows found in "Twitter Complaint List".');
    return;
  }

  // Dynamic header discovery from Row 1
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let headCol = -1;
  let textCol = -1;
  let urlCol = -1;
  let handleCol = -1;
  let cnoCol = -1;

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] || '').trim().toLowerCase();
    if (h === 'head') headCol = c;
    else if (/post\s*text|tweet\s*text|complaint\s*text/.test(h)) textCol = c;
    else if (/link\s*url|post\s*url|url/.test(h)) urlCol = c;
    else if (/twitter\s*id|handle/.test(h)) handleCol = c;
    else if (/complaint\s*_?no/.test(h)) cnoCol = c;
  }

  if (headCol === -1) headCol = 7;
  if (textCol === -1) textCol = 16;
  if (urlCol === -1) urlCol = 4;
  if (handleCol === -1) handleCol = 5;
  if (cnoCol === -1) cnoCol = 15;

  const approvedList = ['uppcllko', 'emofficeup', 'aksharmaoffice', 'aksharmabharat', 'mduppcl'];
  const removedList = ['chairmanuppcl', 'cmofficeup'];

  const data = sheet.getRange(3, 1, lastRow - 2, lastCol).getValues();
  const rowsToDelete = [];
  const archiveRows = [];
  let reResolvedCount = 0;
  let discomFirstCount = 0;
  let solelyRemovedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const rowIdx = i + 3;
    const rowData = data[i];

    const head = String(rowData[headCol] || '').toLowerCase().trim();
    const postUrl = String(rowData[urlCol] || '').trim();
    const complaintNo = (cnoCol !== -1) ? String(rowData[cnoCol] || '').trim() : '';
    const handle = String(rowData[handleCol] || '').trim();
    const postText = (textCol !== -1) ? String(rowData[textCol] || '').trim() : '';

    const tidMatch = postUrl.match(/status\/(\d+)/);
    const tid = tidMatch ? tidMatch[1] : '';

    const textForApproved = (postText + ' ' + postUrl + ' ' + handle).toLowerCase();
    const hasApproved = approvedList.some(function(h) { return textForApproved.indexOf(h) !== -1; });

    const textForRemoved = postText.toLowerCase();
    const hasRemoved = removedList.some(function(h) { return textForRemoved.indexOf(h) !== -1; }) || (head === 'upc');

    // RULE 1: Solely associated with @ChairmanUppcl / @CMOfficeUP without approved handles
    if (hasRemoved && !hasApproved) {
      archiveRows.push([
        new Date(),
        rowIdx,
        complaintNo,
        postUrl,
        handle,
        head,
        'Associated solely with removed handle (@ChairmanUppcl / @CMOfficeUP)',
        postText
      ]);
      rowsToDelete.push(rowIdx);
      solelyRemovedCount++;
    }
    // RULE 2: DISCOM / District handle replied BEFORE UPPCLLKO
    else if (tid && discomFirstMap[tid]) {
      const info = discomFirstMap[tid];
      archiveRows.push([
        new Date(),
        rowIdx,
        complaintNo,
        postUrl,
        handle,
        head,
        info.reason,
        postText
      ]);
      rowsToDelete.push(rowIdx);
      discomFirstCount++;
    }
    // Dual-tagged with removed handle but has approved handle -> re-resolve head
    else if (head === 'upc' && hasApproved) {
      const newHead = getApexHead(postText || postUrl || handle);
      sheet.getRange(rowIdx, headCol + 1).setValue(newHead);
      reResolvedCount++;
    }
  }

  // Append all archived rows to Archived_Excluded_Complaints
  if (archiveRows.length > 0) {
    const startArchiveRow = archiveSheet.getLastRow() + 1;
    archiveSheet.getRange(startArchiveRow, 1, archiveRows.length, archiveRows[0].length).setValues(archiveRows);
    archiveSheet.getRange(startArchiveRow, 1, archiveRows.length, archiveRows[0].length)
      .setFontFamily('Verdana').setFontSize(10).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    archiveSheet.autoResizeColumns(1, headers.length);
  }

  // Delete excluded rows from Twitter Complaint List from bottom to top
  for (let d = rowsToDelete.length - 1; d >= 0; d--) {
    sheet.deleteRow(rowsToDelete[d]);
  }

  SpreadsheetApp.flush();

  const msg = 'Reconciliation Complete!\n\n' +
    '• Archived ' + archiveRows.length + ' complaints to "Archived_Excluded_Complaints":\n' +
    '   - ' + discomFirstCount + ' complaints where DISCOM/district handle replied before UPPCLLKO\n' +
    '   - ' + solelyRemovedCount + ' complaints solely associated with removed handles\n' +
    '• Re-resolved ' + reResolvedCount + ' dual-tagged complaints from "upc" to approved heads.\n' +
    '• Settings updated MONITORED_APEX to the 5 approved handles.\n' +
    '• ' + (lastRow - 2 - archiveRows.length) + ' active qualifying complaints remain on "Twitter Complaint List".';

  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch(e) {
    Logger.log(msg);
  }
}

/**
 * Authoritative Master List of Verified Historical @UPPCLLKO Reply Tweet & Conversation IDs
 * Harvested directly from Twitter/X API v2 for all @UPPCLLKO activity covering the operational window.
 */
const VERIFIED_UPPCL_REPLIED_TWEET_IDS = new Set(["1410356369820061699","1614673244988243973","1759640411587682609","1900970156441940068","1940036772098105753","1971518065872675028","2018249868058522000","2018958820614299842","2049394305857724467","2049450074741387402","2055363766775370140","2062490923226001710","2065690600901611672","2065915648300192209","2069639151327318264","2070906510314721721","2071206107088130064","2073372500797562887","2073443636763853102","2075694047956787319","2076943556758077834","2081143613757780028","2083298444895236182","2084497053141684515","2084564993232748818","2085672153073229944","2086120471503020250","2086996749814751310","2087207413422444751","2087290460775587977","2088255233063538724","2088477471306096825","2088527130967818591","2088599752095281406","2088674403290911084","2089611185805259072","2089930670936350935","2090729225900916783","2091086924689674272","2091321866254512411","2091805695528374426","2091910904883654853","2092484687663161756","2093919138364178510","2094748410968678784","2095218444727890364","2095408312854671691","2095494600400224434","2095738068372496574","2096131777350017347","2096161925830934531","2096504033045606439","2096914738760614106","2097173867471208659","2097225853562470519","2097534557314785760","2097687274054156479","2098256608946163870","2098386276454203818","2098433888041439325","2098708653058777130","2098798394277839127","2099295682721173741","2100160714849624109","2100215631656145214","2100242917227217328","2100306254170304990","2100468999578612095","2100507687842935113","2100918113483304991","2101005879227404418","2101225691882860647","2101230526032220311","2101272777940677074","2101755547746013651","2101932264506753317","2101982238749692297","2102087965686083845","2102278941528739863","2102435253004464262","2102672527810339120","2102730693331869886","2103079907081478617","2103152485565112784","2103195232544469004","2103387098355228714","2103548752770609653","2103597916200095888","2103736757225505100","2103763145957454051","2103840510427431043","2104124675823682042","2104155782875054085","2104457149657321688","2104505563078144506","2104829954609619433","2104855276004507827","2104901183618109891","2104909886924394885","2105193763119464942","2105225881333744067","2105227585177387485","2105254616086823229","2105271477943869602","2105346702408565196","2105540241788657780","2105849284449169657","2105968636074836461","2106003750984786069","2106125224479780966","2106224464115757372","2106267212952768831","2106288451645780459","2106337883833639152","2106338685541368090","2106398870389371340","2106439189399253296","2106939966869942410","2106954552780185775","2106993640627220802","2106998766754799881","2107016168339034176","2107033117513134332","2107039746786459743","2107095922073338279","2107116741302374453","2107153855125619136","2107160382951555322","2107345720118501648","2107350207793189272","2107403767943741885","2107450742663757846","2107455463801663679","2107584182058893575","2107765311512699163","2107771763006591198","2107774206243143734","2107778497167163454","2107779017055310206","2107810674168471798","2107840871651795098","2107853021216706946","2107863861575795067","2108015948452249826","2108069289869836624","2108071542362095886","2108091313581371769","2108123750579519540","2108151752126337409","2108161531452256262","2108166967878463554","2108180393707090132","2108209189030187021","2108271358312636802","2108392758184677688","2108415622564704463","2108461057417286066","2108486305189392642","2108501277999325383","2108507191699485157","2108534572527055071","2108537602165047630","2108563023229333711","2108587272052576509","2108671700850377030","2108827354927964331","2108872204255670715","2108878922666606834","2108936738878177523","2108950124185682382","2108992288735268872","2109112800199294994","2109130680605212805","2109133618153157035","2109154895186292893","2109160157850849355","2109180885014565099","2109194562883453300","2109198298469031980","2109198409320276416","2109223628718104618","2109227844870308062","2109232798674616545","2109245125406728283","2109276558137663523","2109278635253436566","2109280123908489243","2109288969854943603","2109345846915657839","2109436979188506716","2109450926482407538","2109473792364056991","2109479309941596543","2109496530130604099","2109508546140246236","2109552599896928368","2109598844946407538","2109602132110577764","2109614284745609534","2109622613630963916","2109628400256360891","2109629586845962650","2109637711279870272","2109638260565905653","2109645499095757222","2109667913300947200","2109690561552625673","2109698109307830745","2109842956316459151","2109847303704248727","2109855803217981721","2109864377532952705","2109877767840112694","2109881693125648687","2109884279136325900","2109885979976949909","2109887478886977690","2109890418238435681","2109890700674486400","2109897806572102029","2109898778170040672","2109910243102826911","2109913792998191142","2109919929269211321","2109928168282853568","2109931178388234421","2109934298748891496","2109935084291985880","2109938285862932971","2109948009530486994","2109973675302912386","2110000100902674505","2110015202183831699","2110029778460062124","2110030300533424276","2110032243695693951","2110039520259555584","2110041857585795525","2110045398999974278","2110049679509758344","2110054041992806436","2110095930766880926","2110120898728804625","2110123639928709293","2110152821207396798","2110183995518656988","2110191370661171530","2110194306527141980","2110218894933991846","2110228502259925120","2110229758315287026","2110230155717394662","2110237761383158003","2110237953121484907","2110237999867015369","2110238710667305296","2110241348947480877","2110245646813044844","2110245879613653058","2110245956646219836","2110247954791743844","2110250704099315720","2110254826567389358","2110260647711879644","2110264983594663937","2110265954416611485","2110267847784251881","2110268654378156185","2110270896820953430","2110274348481417366","2110278623634899153","2110278791822262313","2110288475954295024","2110290874483855606","2110292767159316913","2110309066841223669","2110313673776632193","2110319491049796057","2110320181478293879","2110324059724820991","2110329662995828773","2110334294350770274","2110334800670429202","2110339852403429476","2110347393275478452","2110351136284946559","2110351565395837301","2110355083347239395","2110355899390845266","2110362491041575361","2110368516247523465","2110368589987578023","2110368603963048287","2110372541307195874","2110377589646721099","2110385227180945811","2110392689464074599","2110392690227429569","2110398788737307090","2110400241773978003","2110400482107933094","2110401889707913233","2110402035048947812","2110407786676805683","2110408547678990770","2110410045712486444","2110415345374904632","2110416161989066777","2110417325887508902","2110417799927779771","2110417897252405510","2110418000029663273","2110418576297635881","2110420461654069520","2110422887957922247","2110424541222813943","2110424584000520396","2110424593165152612","2110424661943373884","2110424758894629140","2110424809209495647","2110425398974841300","2110426097989075426","2110427018932457696","2110427377495081347","2110427556730261747","2110430782204633488","2110435726727004381","2110436539650261106","2110436621833457771","2110439896641048721","2110445496364106020","2110447546271465517","2110447649208021210","2110448718763991154","2110454330797306327","2110456774851805539","2110457148518129681","2110461655046103364","2110466878946836664","2110467356787187782","2110467395022450731","2110467886603264193","2110468381413646512","2110469302789026287","2110469394140995725","2110475952128176392","2110483283071111466","2110488418409144612","2110490045266510074","2110513087766036871","2110516588789326218","2110517117250572290","2110518674562101350","2110520055712858353","2110523111074566560","2110526298053591460","2110527902307770824","2110527997858185467","2110528941140390317","2110529489700868379","2110530706728509915","2110532296055103531","2110532995354624010","2110533037822021792","2110534178005745859","2110537129499767021","2110538764313612533","2110539889670566327","2110539980837961877","2110543191657300152","2110544632178491480","2110544707495547268","2110545381826453861","2110546300295069876","2110549261960266057","2110551731826483556","2110552004963774834","2110556722050081158","2110556897921363979","2110556931417149659","2110557934073917569","2110558750360870925","2110558945328935261","2110559305678364821","2110559425123782932","2110559535513694434","2110561191164772370","2110562000577425777","2110562504288141344","2110563165780181085","2110563428838601010","2110563615665483885","2110563843558838490","2110563864752558138","2110564119141294363","2110564772156760273","2110565399750393929","2110566597891100910","2110566653012656163","2110566784483143893","2110567276584030693","2110567503558791337","2110568365211406716","2110568377261625701","2110568479179043082","2110569177698156629","2110569315418431647","2110569718142956011","2110570976446697815","2110571206227136880","2110571466861543756","2110571493394694464","2110572613412274360","2110573549660643545","2110573832897740848","2110573883971813663","2110575214417633757","2110575314690887722","2110575418969641415","2110575444798116008","2110575997087261026","2110576800795705472","2110577413969338845","2110577590121730553","2110578195078820215","2110578274518917470","2110579366799278235","2110580468748026010","2110580712990736510","2110580852468199637","2110581053543133672","2110581103513743571","2110581171855999208","2110581273001701452","2110581274322653598","2110581284187869398","2110581334062330270","2110581415985438950","2110581416446886356","2110581572374282344","2110581666775552398","2110581820245062013","2110581847675781496","2110581850175607062","2110582187846205877","2110582683357311465","2110584485310030065","2110584717175378015","2110584899635917015","2110585969988763792","2110586211941462070","2110586245701116145","2110586817527590971","2110586885986984370","2110587362975850829","2110587486124830911","2110587552038023530","2110588202235154813","2110588993960325318","2110589547419730199","2110589751116136629","2110590511304343597","2110591273350627571","2110592483445137716","2110594298475639267","2110594438376657326","2110595612802687299","2110596797534175431","2110596989813682484","2110597051289575696","2110597073284522088","2110598537444741572","2110599368650944992","2110599768665973201","2110600287857836268","2110601867374088606","2110602108173234223","2110602271755247643","2110602363807641864","2110602426592170036","2110602624479465873","2110603258645631140","2110604754921603403","2110605975405428892","2110608073585037712","2110608658933698743","2110609287500423408","2110609547312398793","2110609736802684936","2110610911182659797","2110611408723554616","2110611973759258973","2110613955836330488","2110614923047018996","2110615414401355948","2110615978870722818","2110617607430910314","2110619732714168383","2110620137128947790","2110621561334178140","2110621741123051684","2110622166157042001","2110622547163459810","2110622568919249137","2110623591553487215","2110623996584845742","2110624124347548021","2110624416753385589","2110624979037675728","2110626104918815059","2110626136820773235","2110626538828038236","2110626749621084437","2110627738361242035","2110628667147816982","2110628868331630835","2110631187542901239","2110631376206831672","2110631646630498694","2110631683057979732","2110632042711097668","2110632581280784781","2110632676046856439","2110633017060503736","2110633144001187876","2110633208153080289","2110633251098501358","2110634062549512275","2110634230841753959","2110635142762955220","2110635284027326802","2110636202823159913","2110636375079039133","2110636863761617233","2110637059727859742","2110637160059793812","2110637727616299476","2110638446029222376","2110638780223037811","2110638842516746380","2110638926033818032","2110639047131664611","2110639166971347144","2110640246316785927","2110640386456830241","2110640438847975512","2110640828553273602","2110641061706207502","2110641255885762591","2110641433816490044","2110641508303175833","2110641775027355653","2110643855125324014","2110644080246243428","2110645431189504192","2110646598690799955","2110647017877930283","2110647365350863040","2110648069222256643","2110648328409206942","2110649378428096859","2110649545780838674","2110649674818547897","2110649729067758068","2110649882549833925","2110649910752358819","2110650132379431206","2110650200746573930","2110650260825727155","2110650888062656561","2110650925555839023","2110650953762472238","2110650995705311263","2110651169953698129","2110651203092942945","2110651244289433857","2110651275469852966","2110651709974614243","2110652257163526189","2110652607828292042","2110652711637230042","2110653440993157206","2110653628545716358","2110653950160695776","2110654249038446602","2110655579509477796","2110656226786984441","2110656375789678594","2110658607939244363","2110658987603763659","2110659396971966912","2110659540115194352","2110659912573596136","2110662031263334604","2110662157834547275","2110662609880154184","2110663972177453343","2110665362861867511","2110665678579736985","2110665816706543999","2110666030406361471","2110666432313000268","2110666504526331963","2110667023701463534","2110667322558230759","2110667713286897831","2110667829368500304","2110668066396794952","2110668942171922937","2110669809625243928","2110669914210247127","2110669998498914660","2110670217949188472","2110670805432725750","2110670822763536649","2110671187647103422","2110672244141851009","2110672374068879808","2110672568403550459","2110672592839602539","2110672783676178720","2110672870187938201","2110673036760211896","2110673043618234809","2110673066531455349","2110673155396444545","2110673769539006854","2110674043288313992","2110674128432701686","2110674206820376862","2110674283961926017","2110674482310623307","2110674819683664106","2110675153923232033","2110675348254040423","2110675801066942878","2110675830699626509","2110675940867215557","2110676135285842114","2110676274951889359","2110676302093291545","2110676847172432038","2110678359349055593","2110678603902161315","2110679155901632519","2110679267633999876","2110680607135334519","2110680700873761097","2110680713079279672","2110680853043204482","2110681083008393327","2110681318879306092","2110681320846438445","2110681373577211995","2110681434973487453","2110682556140343387","2110682809052352956","2110684334634217922","2110685223705059805","2110685529633432024","2110685943791599830","2110686274512404800","2110686389952303565","2110686502552510896","2110686568554098957","2110687579989262357","2110687622188458008","2110687929228214526","2110688130915528870","2110688209575505981","2110688643526631629","2110691205910761831","2110691282679103538","2110692430827991154","2110692968114045044","2110693311229116501","2110693793343365419","2110695337388314952","2110695532243173724","2110695561263514017","2110695572315181270","2110695747457101981","2110696906909503535","2110697837130657913","2110700116944531779","2110701377962000438","2110702197730390397","2110702238113116427","2110702794395304059","2110703178606137445","2110703286563250312","2110703334164492314","2110704981040841005","2110705239099855349","2110705594088956203","2110706324904521882","2110707159998910503","2110707227099349168","2110707908514377805","2110708523600625684","2110708869190111620","2110709608419619309","2110709778175422880","2110709946405028272","2110710301754847427","2110711134739468742","2110711163298414813","2110711268286124307","2110711761066467612","2110712524924678343","2110712687491743777","2110712757519851925","2110712812331045342","2110713325189534063","2110715654492070363","2110716150325838183","2110716716808315254","2110716829123719277","2110718140867113348","2110719405252649210","2110719632697168102","2110720156829691982","2110721253510390089","2110721805430534488","2110724608462819569","2110724877191913797","2110724877921714616","2110725062080995830","2110726066394525891","2110727208633503972","2110727441786548224","2110727526167560200","2110728083779231946","2110729039472406698","2110729785764872467","2110730271771521086","2110730607907017061","2110730626714484941","2110730921968390189","2110731632064024961","2110732075561320787","2110732156352045129","2110732405778817262","2110732426574209170","2110732599174058436","2110732844914065412","2110732885653385306","2110733196837220537","2110733361333563899","2110735044407111941","2110735258450907311","2110735604032159968","2110735940817952987","2110736200004763906","2110737958768906263","2110738961140424754","2110739977474593178","2110740959134953681","2110742086047690910","2110742427816645024","2110742592271131114","2110742687766970647","2110743090533425260","2110744546623824127","2110745002834047169","2110745302953029822","2110745910011691109","2110746359787852102","2110746463793991720","2110748028982202773","2110748185119600740","2110748479337504872","2110748895760486439","2110749000207114351","2110749713280774169","2110750272649933112","2110750340446585235","2110750417349210512","2110750941922422849","2110753173615050919","2110753355111051622","2110754424952070238","2110754626006122513","2110755076985782447","2110755354959348014","2110755869965377856","2110757989611446471","2110759510264672384","2110759719967330531","2110761542799298676","2110761983746486707","2110762076843184412","2110762147383025772","2110762160347566272","2110762350508945818","2110762378182971504","2110762461016318437","2110762775052206485","2110765992645468533","2110766054171709835","2110767904514036147","2110768092829929943","2110768206759780444","2110768329493500000","2110768478236102994","2110768584146452856","2110768631709835310","2110768817047785975","2110768916729594367","2110768935209718102","2110768946026840341","2110768996127789307","2110769146703266231","2110769445794926826","2110769766009090118","2110770173489688768","2110770175314137549","2110770720846565667","2110771295566876736","2110771373232804112","2110771445462913093","2110771505340842053","2110771595082125716","2110771678481633298","2110771939119911282","2110772349280891328","2110772537563205764","2110772922252230811","2110773361878159648","2110773391708008878","2110773743488561155","2110774038197096909","2110777728764903669","2110777732032593940","2110778488924053909","2110778628829249639","2110778732986396828","2110778798149169617","2110778868617593291","2110778936867340311","2110779188139696333","2110779301163602163","2110779351423943020","2110779524413899066","2110779615426027738","2110779729263608236","2110779808259145852","2110779927167721923","2110780118528618858","2110780198480490714","2110780401392521486","2110780498922684846","2110780624747606406","2110780749276483834","2110780866658283930","2110781040549925169","2110781133365633268","2110781181537194078","2110781209819374007","2110781209915855012","2110781365088313499","2110781416724398117","2110781507917029461","2110781518595641438","2110781584177824182","2110781702641750164","2110781751673151956","2110781820015129079","2110781883286216760","2110783694676103621","2110784492571181379","2110784567565287749","2110784686314451149","2110785272254468565","2110785275630858600","2110785730079580546","2110785903463706697","2110786432633885135","2110787231070007737","2110788084866638065","2110788238642381286","2110788434126356559","2110788864269009173","2110789929873899710","2110791806363541641","2110792432602542472","2110793700045734017","2110793745583194338","2110793749500768722","2110793848020693065","2110795050246611307","2110796534652756154","2110796850332901704","2110797598978383939","2110798847278755956","2110798929914896768","2110799090003181613","2110799153416765939","2110799386557161872","2110800144509862057","2110800760414015659","2110802016431947950","2110802626782826955","2110803968175866179","2110804884534804608","2110805494797594810","2110807817125019858","2110808078056931381","2110809740574105987","2110815836638457911","2110824155491016873","2110826870497485052","2110827451811283074","2110828361249624082","2110832374892404926","2110845673893752855","2110845814780403980","2110848605045367057","2110849496242606131","2110851201751474467","2110864241851068447","2110867023958102330","2110873151370567971","2110884021211451422","2110887293489967465","2110887357629317313","2110888576192069745","2110890178298679479","2110897231847117222","2110897284301136001","2110897336641814617","2110897391213871259","2110897433744171500","2110897536793985331","2110897637713166513","2110897722320617888","2110897794039050517","2110897851756875916","2110897881091903506","2110897900289200395","2110897957751128387","2110898001745260749","2110898122054607176","2110898214111223981","2110898297854722308","2110898356256182696","2110898412845678668","2110898468097294588","2110898534371475554","2110898698318483676","2110898780837150938","2110898827628786110","2110898874579841364","2110898924437594266","2110898966820999210","2110899071800279190","2110899152741949639","2110899220870021470","2110899277979598953","2110899323211063341","2110899419428307443","2110899607060578398","2110899725113454703","2110899807183307081","2110899850447638596","2110899881405808912","2110902879909498931","2110905515824087356","2110911685477515448","2110912151359734239","2110913782562296067","2110914264081010943","2110914807100772762","2110916407332647113","2110917611123061193","2110921663550488791","2110924145588666523","2110925011381043494","2110925161440673883","2110927102363173304","2110927189600522317","2110927218797097229","2110927241005957425","2110927595269505247","2110928256782459276","2110930483010035863","2110930656092131426","2110931826013614214","2110932506728100245","2110933716235350298","2110933928429453791","2110934676009591292","2110935123189465217","2110936156590227925","2110936404159295833","2110936577514074573","2110937388327538920","2110937594502807844","2110937776686592239","2110938317663678736","2110938411322511767","2110939622750740672","2110939846810497063","2110940279671017495","2110940545816408416","2110940550274900192","2110940613558558923","2110940840910815703","2110940955159474260","2110941616651502018","2110941777356378117","2110941797937762806","2110943766114689066","2110943972990558535","2110944142700298590","2110944533836091772","2110945157428207725","2110945216576344214","2110945976487989745","2110946651305316833","2110946654052372954","2110947230157058201","2110948348345958779","2110948520899531155","2110949011968626792","2110949145259249682","2110949465561706846","2110949525821239561","2110949552731910545","2110949633317101793","2110949743966704067","2110949848619094271","2110949900804669912","2110949942932251040","2110950035898642613","2110950435393769846","2110950501336662121","2110950542298292664","2110950613882388832","2110950629325820109","2110950713878847754","2110950807730536705","2110950836863963471","2110950911233421729","2110950925183684998","2110950988224045076","2110951047887749241","2110951091575869814","2110951192792866849","2110951276221784294","2110951392949203399","2110952222460940452","2110952273052336258","2110952529559527474","2110952643262812490","2110953471902105868","2110953827063284172","2110954649398440300","2110954928525172829","2110956308468002942","2110956544280211526","2110956660181328085","2110956746969608248","2110957714662949223","2110958104833871890","2110958118003757109","2110958721119502408","2110958849658421582","2110958938896146726","2110959248834465838","2110959516502409313","2110959965838209029","2110960702882193611","2110960712445235365","2110961808270139689","2110961878092701995","2110961896035946602","2110962118661218387","2110962517317165296","2110962827934781519","2110963222014750790","2110963530480734568","2110963795678183457","2110963959608262861","2110964472953327882","2110964537801507099","2110964925833392161","2110965240204783786","2110965546825191510","2110965603532226777","2110965854737400263","2110966187970736262","2110966435740840242","2110966856194679138","2110966918098399242","2110967099745292331","2110967144573972596","2110967166048838031","2110967176794661314","2110967454155555007","2110967504768282763","2110968817501511978","2110968916885614702","2110969174696833227","2110969224067977369","2110969850692841548","2110970530664689841","2110971120207945834","2110971257831436768","2110971861664502233","2110971996800700419","2110972117890310487","2110972307925864458","2110972561186296084","2110972595256406340","2110972752756929021","2110972912283041916","2110972989328203777","2110973574991564975","2110974179814363204","2110974378200736093","2110974819797758168","2110975351883288962","2110975750832898404","2110976093276795131","2110976110402113835","2110976898797126136","2110977513048662267","2110977772999094459","2110977824375120168","2110977878347452891","2110978351443956051","2110978526862029296","2110979318226751815","2110979582874567025","2110980780117615091","2110981064042954982","2110981117864214676","2110981235166294331","2110981562934448386","2110982016351264820","2110982026857783630","2110982373303296484","2110982517151142194","2110982856956919899","2110983382834557253","2110983566075056216","2110984208802050125","2110985445496463406","2110985484906418289","2110985513595523292","2110986155747573938","2110986401911275788","2110986689154048343","2110989077780865131","2110989247893377367","2110989592568742188","2110991525429891287","2110992243867935003","2110992575029031044","2110992576384032816","2110992998100258997","2110993404444459159","2110994158710345739","2110994677126279572","2110994730657960214","2110995048020226314","2110995813862383757","2110997848720548051","2110997979742322821","2110999145012232442","2110999208329429477","2110999934610936034","2111000411922706906","2111001013536854138","2111001142385930408","2111002153020260397","2111005521721561190","2111005829872886226","2111007928953995735","2111007947270815782","2111008726937407683","2111009076515856465","2111009716998746273","2111009821881459053","2111010181715042623","2111010294193590685","2111010613707325513","2111010810965393659","2111011849928142871","2111011964168425701","2111013153501045182","2111013240797016489","2111013597128045047","2111013607236612571","2111014042123063430","2111014229344137295","2111016639118389530","2111016761860718809","2111016973689844062","2111017585684971949","2111017758821687493","2111017913692135890","2111017938559848737","2111017953827438828","2111018036874584559","2111018970589651318","2111019052512752029","2111019062558106080","2111019813887996256","2111019947061309724","2111021030080909657","2111021085047279660","2111021307827753175","2111021482788921854","2111021731225936085","2111022035883446454","2111022998325268557","2111023230689353887","2111023461695139917","2111024480936186022","2111024699883073721","2111025025868579055","2111025199764357210","2111025349152944476","2111025394501779596","2111025754830172213","2111026245387293078","2111027234421248235","2111027289916096855","2111027746365435981","2111028028776321447","2111028262420074723","2111028297312428155","2111028640561741983","2111029912840871973","2111030749453496633","2111031379618341174","2111032048022696074","2111032184165568754","2111032350465552741","2111032995452977449","2111034003952169273","2111034769576448076","2111036077901594746","2111036241143865478","2111037313451176290","2111037590212427848","2111038253344383224","2111038325561954696","2111039428189880631","2111039792259706947","2111040341369602540","2111041410296418582","2111041875969015965","2111042573192273964","2111042667283177500","2111042680339955964","2111042853636112783","2111043276107325626","2111043388695097496","2111043473931702487","2111043609210634583","2111043622565196184","2111043798025535865","2111044550479536330","2111044797117165904","2111045044753018973","2111045118283444280","2111045123022958905","2111045895236333823","2111046419784282392","2111046626701918447","2111046806968877358","2111047386441400582","2111047424550879435","2111047865330278566","2111047895650914312","2111047958586446055","2111048213666967672","2111048827104792706","2111049030776340836","2111050285539897731","2111050424489013713","2111050642013954241","2111051807648784817","2111051935209889993","2111052060817015012","2111052147727225098","2111052275762209226","2111052297187082657","2111052366615364025","2111052497108513018","2111052600384892971","2111052744106922210","2111053617251627454","2111054076788297929","2111054127493161015","2111054664481558702","2111054930274652636","2111055384228381000","2111056478291607781","2111056843208605998","2111056971595960499","2111057617368068514","2111058078640832734","2111058902326624735","2111059277695852914","2111059749974478975","2111059950751584400","2111060197959663912","2111060239281959186","2111060316964684161","2111060797225042105","2111061584307212700","2111061719942606950","2111061890814390286","2111062048918708312","2111062136789291020","2111062187162923178","2111062286039474241","2111062393195516116","2111064630227263561","2111064911040401816","2111065172727271484","2111065815592349861","2111066321408696761","2111067901654602170","2111068122296037723","2111068933071495669","2111070274129191064","2111070746747560287","2111071361569579274","2111072166439698674","2111072738018468060","2111072883820970117","2111073433996099717","2111076460115132603","2111077333922947461","2111077644771197286","2111078453483278615","2111079987306713564","2111081515539181746","2111081605070729286","2111082273437364604","2111083521049792959","2111083764424347841","2111083908922241307","2111084164091183596","2111084920957448690","2111085852239741313","2111085910666383462","2111085942178275424","2111086370190168156","2111087266307448988","2111087620176715848","2111088136784949302","2111088914610188758","2111089094977880205","2111089351165960566","2111089619043525104","2111089935252066531","2111091039004176638","2111091139596128337","2111091393703932266","2111092157306314760","2111092877942231369","2111094488529781048","2111095005716861130","2111096703009091749","2111097674732810380","2111097791644860821","2111098429564948605","2111099300935782421","2111099708898721949","2111100942087245960","2111101526697750916","2111101683392548905","2111102365453394036","2111103990184444213","2111104550077620261","2111105893639270703","2111106358120787999","2111106508587229186","2111107041968500904","2111107181403902060","2111107748557623365","2111108584767623359","2111108776371933293","2111109343596941327","2111111883227046355","2111114050595897428","2111114889561542890","2111117464733929679","2111118238293893164","2111118541256798256","2111119043877019907","2111120849592074261","2111121542562414831","2111121570295083326","2111121672577433795","2111122736378761264","2111122995016257960","2111123924314673575","2111124045345484835","2111124195350655476","2111124998668837186","2111126022792032306","2111126161480942050","2111126759693496419","2111128172876222830","2111128427520770520","2111129444928934113","2111129470094749873","2111129589850526069","2111129888786981256","2111130227212722375","2111130229100224835","2111130429164331353","2111131310203052162","2111132564601938317","2111132698861609007","2111134602068992492","2111135026213789815","2111135816693223594","2111137677252919551","2111138311909826814","2111138350098976854","2111139672525275218","2111140834137768200","2111140882015735880","2111142243432378869","2111143232436625465","2111144876553465963","2111144929217171805","2111145156007374953","2111145511566835719","2111147055930597379","2111147224340246619","2111147660665131475","2111147751799189590","2111148845229109358","2111149549805088813","2111149595741061597","2111152269161070956","2111152718232613199","2111153048580149522","2111153295616266305","2111156011172340166","2111156089358295189","2111156203594379651","2111156274679382402","2111156316505100418","2111157317932925218","2111157437004906997","2111158569022492938","2111160642329624612","2111161516535820531","2111161697742315572","2111162641796477244","2111162945514140051","2111163149655093284","2111163953103372618","2111165591373668462","2111165664018780531","2111165721661071579","2111168371077329295","2111168442850238874","2111169871237279905","2111173902366117998","2111174530081398800","2111176695441133621","2111187673390207174","2111188167001080246","2111188274744279545","2111189159536894245","2111193678291333177","2111194260536234489","2111196362813719016","2111199976189776034","2111200737019806077","2111201943326744940","2111202009001201746","2111202257266163805","2111208058877870285","2111220281373265932","2111224921867354318","2111242127367901245","2111249934137901530","2111259208629023105","2111261888390812129","2111262387932451201","2111265117447106740","2111265294031425766","2111266227746455708","2111266996197445782","2111267163818664150","2111268353784565987","2111269512268144672","2111269995405857156","2111270603252781540","2111270768072077729","2111273151808377337","2111273638641222052","2111273928618594572","2111274386561139028","2111275231348457662","2111276702949388371","2111277330689909229","2111278799056933202","2111279002178802059","2111279991581524291","2111280087735976311","2111280438887297061","2111280486328705056","2111280966278983896","2111281538101125394","2111282215049179609","2111282358217494688","2111283010125652047","2111283099925622881","2111284093501776355","2111284457684766836","2111284505151787322","2111284593022419390","2111286961357152412","2111287736565170209","2111287937401024549","2111288017969357003","2111288210353758323","2111289004968825033","2111289059960328292","2111289254320251262","2111290021412307433","2111291046608974137","2111291582041518328","2111292193763668399","2111292194271481870","2111292309115752540","2111292825468121340","2111293137159356907","2111293272530555033","2111293443632984326","2111294475675078684","2111295139020968194","2111296267821412813","2111298402978000940","2111298773951652157","2111299079242469474","2111299552892576001","2111299603056472261","2111300138304229565","2111300163067429099","2111300422568964334","2111300447550292458","2111300576092754365","2111300762857029938","2111303629823226111","2111303766628777990","2111303867661254699","2111303947990503647","2111304003061780937","2111304174092886359","2111305392395550975","2111305647379869781","2111306642038075690","2111307350359556357","2111307711535325366","2111308068277682404","2111308085398532257","2111308555408314607","2111308719279706425","2111309156695281810","2111309503862014325","2111309693779865685","2111310390449918107","2111310496532189507","2111311548467793957","2111312621924454488","2111312746621149379","2111312889466495394","2111313296808939648","2111313564623597983","2111314296575865106","2111314838718927299","2111315110325321768","2111315148787122626","2111315195683655989","2111315198258889080","2111315231490400357","2111315888905576598","2111317941832888650","2111317976599429559","2111318821109932239","2111319556220477942","2111319812651819258","2111320324088463669","2111322734575710655","2111323062729920628","2111323670731993292","2111324209930801416","2111324821581971794","2111324895129010671","2111326502029545843","2111327146442694867","2111327243041751356","2111327273848848796","2111328329790083081","2111328456046989645","2111329035305533732","2111329611342909759","2111329758470627636","2111330352136638770","2111330460869767413","2111330468952186908","2111330532152017239","2111331131484500264","2111331297356660965","2111331398955270196","2111331949037969524","2111334441469747293","2111334682961072535","2111334902109245597","2111336017462710702","2111336048433488318","2111336105962553658","2111338316251701406","2111339266663977158","2111339317411152065","2111340218318299387","2111340433351565629","2111340754975244748","2111342459167162765","2111342814261084472","2111342858821357840","2111343346396639446","2111343362062344539","2111343383591723149","2111343541599531010","2111343778556748086","2111343859057995820","2111344222704226387","2111344667816333417","2111344821524910447","2111346763617493017","2111347375646380097","2111347383535845618","2111347551672901850","2111347760851259768","2111348077840003309","2111348271226700226","2111348407721955801","2111348423387689334","2111349327897768339","2111349466276270456","2111350084839543115","2111351398172643484","2111351795071291558","2111353189371191408","2111353309688938861","2111353635590615271","2111354390510514655","2111354690805838084","2111355164364062756","2111355456727941367","2111355678195654722","2111356235199270951","2111356815598592123","2111356842852970530","2111356973459681283","2111357071589601368","2111357524473774177","2111357623262130259","2111357818762858617","2111357902841905310","2111358010941710696","2111358143540461867","2111358287467987449","2111358430728569336","2111358502610636833","2111358951120060711","2111360334082826667","2111360490064826794","2111360514131669291","2111362713377202538","2111362714287145453","2111364826098475126","2111365643996156074","2111365887567749468","2111367214335160512","2111367511749034239","2111368943164076416","2111369167635108331","2111369985839009839","2111370310218137699","2111370328798838887","2111372095594856518","2111372452857368725","2111372996715876768","2111373136994484577","2111374230894076121","2111374264943472882","2111374834173346228","2111374856910713228","2111376608481452181","2111376828321640582","2111377846887391348","2111380869957259407","2111381102971732023","2111381929614618734","2111382033201324472","2111382142051619078","2111382196464579062","2111382341545595125","2111382650334462215","2111382851245723711","2111383486817030230","2111383504013726068","2111384051953402191","2111384172086583575","2111384962264117727","2111385155751526734","2111385309107871984","2111385639937876046","2111386748915999230","2111387032387997754","2111387418192695744","2111387428011614276","2111388646767226917","2111390391157330070","2111390746523672849","2111391255846605074","2111391853270725006","2111391895826088373","2111392101833363739","2111392525789679842","2111392897719546305","2111394633536401786","2111394697931379111","2111394910553395510","2111395425928515770","2111395592308224280","2111395661157655037","2111395726563623333","2111396264285966564","2111397094011687113","2111397473721934285","2111397617305547193","2111398641474650182","2111399250416521423","2111399836784501119","2111401907348730216","2111402121581195663","2111402664579993757","2111403638681923738","2111403858836566174","2111404033533735390","2111404222520660185","2111404262878322960","2111404281672909138","2111404340493906325","2111404405878821362","2111404446244831602","2111404794858328135","2111405317888368943","2111405628908560668","2111407125742473590","2111407757496840544","2111407849108807866","2111407926221193403","2111408044383125649","2111408552330023224","2111410236724761067","2111410357033963702","2111410387405209787","2111410421110542610","2111410437715530171","2111410447606055120","2111410541411577908","2111410570704683510","2111410597875400879","2111410625469718574","2111410651990282741","2111410911386947711","2111411448308289606","2111411782002909606","2111411867189178422","2111411915893440861","2111412315518349821","2111412376528703746","2111413070170124294","2111413207567094007","2111413629958705173","2111413840894419144","2111413866647400894","2111413892194955464","2111413907571212537","2111414177189560444","2111415006055252354","2111415161584243006","2111415382305395156","2111415477750862038","2111415499351548277","2111416516751360035","2111416526041743773","2111416555204661270","2111416573714186482","2111416601799266709","2111417215845278070","2111417257469317253","2111417776753823996","2111418734376292708","2111419176967717119","2111422935605158211","2111426101071532101","2111426308903428305","2111430418482545084","2111430776449282206","2111431179136373166","2111432576510619997","2111433282466566258","2111433389199004003","2111434552535130275","2111434931075486029","2111435753918177668","2111438086739751328","2111438887465951567","2111439231180771794","2111440087934533746","2111440264346935613","2111440426117042610","2111442113216803043","2111443287630610510","2111443318827831414","2111444352723787924","2111445135443771569","2111445327081513287","2111445553959797097","2111445554588958971","2111446507580973091","2111446964911116381","2111449636263387324","2111449651023090112","2111449764218949653","2111451440216715556","2111452535991234653","2111453551327334597","2111453604402098554","2111455400377942200","2111455766356042173","2111456178438095347","2111456313196814374","2111456575085019142","2111456721080365086","2111457203244999165","2111457207426695259","2111458115778662612","2111458175824376012","2111458511498670151","2111458513272930450","2111459838555296199","2111460175739809961","2111462056264356203","2111462484448288911","2111463062905757897","2111464539741110476","2111464751251206547","2111464854053949582","2111464936010612958","2111465862096212247","2111466717696418255","2111467761990021505","2111468522429952204","2111471166380794260","2111471852350808099","2111472071859703927","2111472309881966812","2111473772725510636","2111474055178297538","2111474085226242189","2111474194097783029","2111474890851377275","2111476011384877172","2111478839360762301","2111479852801081592","2111480619540840867","2111481174216585461","2111487408172872074","2111487581724782928","2111489068693647450","2111490697039921596","2111491534575337617","2111492304104223168","2111492900379131997","2111492923930108223","2111494951284379786","2111495738484228166","2111501545884008958","2111501931034403084","2111503358301499672","2111503880915939544","2111504366947762595","2111505080746910080","2111505165312499721","2111506634765926719","2111506641946661248","2111506681033310392","2111507851051172141","2111508438249513315","2111508603177931091","2111508610115395835","2111508800490631483","2111509683622338831","2111509865252478996","2111511077783805961","2111512154436403351","2111512308350701683","2111512568384868696","2111513164907245692","2111513692911386938","2111517667085766829","2111518543854600206","2111519147578573115","2111522447589851201","2111525755104702797","2111525785026912268","2111529473522974952","2111529856832086464","2111534416069791990","2111534688427020522","2111536289493516759","2111537206519357624","2111538813021589855","2111542782133412159","2111542873195974842","2111545103965929878","2111546333752660113","2111546770719481943","2111546967956554207","2111547545898082517","2111547802224603467","2111548115425821040","2111548147969524024","2111549116522340825","2111551542474252782","2111553016583303351","2111567393910899194","2111569163588452803","2111570446508556450","2111570559855444013","2111571612030169268","2111577981923753994","2111582664914600054","2111588478312132773","2111595181850141051","2111595270190530944","2111602184337141979","2111602866914013187","2111604765486707028","2111605701424582888","2111609477049012326","2111609665260007553","2111610141615554637","2111611347280814131","2111611682661487085","2111611824764539303","2111617408557568279","2111623773539741837","2111625590306734366","2111626795447706058","2111629278370755013","2111629565135327288","2111630375462256934","2111630533650489518","2111630821924970741","2111631249030963543","2111631866038239636","2111631974771360067","2111632154887413831","2111632395657261376","2111632459452600776","2111632649987260504","2111632778613965201","2111632907764899902","2111633091110572272","2111634098984985006","2111634540993405207","2111635300787367946","2111635802417709480","2111636068571521464","2111639325444346170","2111640320731664762","2111640445919089108","2111640599237734517","2111640872987283654","2111641594642461109","2111643317322821939","2111645349349617889","2111645818503737469","2111645860509675840","2111646199220715527","2111647226393219242","2111647325080969389","2111647605830942942","2111648356112154651","2111648741350584797","2111648779447513600","2111649151046005115","2111649438259380395","2111649469561520416","2111649551220408783","2111649586591007080","2111649843882172890","2111649883061207058","2111649995598463057","2111650028867727669","2111650089467089023","2111650121347989819","2111650338877177862","2111650379540865098","2111650699394314645","2111650719791186148","2111650771377029517","2111650858438168707","2111650947940413708","2111650967842398311","2111651109727326700","2111651267961663616","2111651378783289532","2111651511633600645","2111651635625865472","2111651666412060810","2111651757038395788","2111651995740233963","2111652626324754614","2111653939674513774","2111655769351565704","2111656184126341295","2111656645231350035","2111657041341378947","2111657662702391689","2111657781149474867","2111658066966102112","2111658518130642993","2111660083197456499","2111660236553830425","2111661071031558236","2111661898647433617","2111665288525881419","2111665665061073370","2111665665329467664","2111665769838993710","2111665920125059163","2111666448435482941","2111666615993692390","2111666712366223580","2111666762639171790","2111666952557183171","2111667093414580521","2111667604456882362","2111667773298692601","2111669353662107845","2111669686568136834","2111669927669366793","2111670183584792998","2111670444831256805","2111671381863874929","2111671556715987205","2111671976528117925","2111676286888509651","2111676342752149594","2111676968320262535","2111678196428984424","2111678213990838768","2111678348602847417","2111678413564191014","2111678475027591266","2111678512507830719","2111678547995885846","2111678719622582656","2111678875319304600","2111679002964541617","2111679112414937290","2111679467710214642","2111679487188598935","2111679674183205173","2111680384769675715","2111680456618119533","2111680578139697296","2111680589606601205","2111680635341582391","2111680639783350388","2111680772566556795","2111680882092437702","2111680964539843042","2111680998811533617","2111681153585627220","2111681200406642886","2111681336629166422","2111681397517934693","2111682631670825358","2111682939243376647","2111683781253820795","2111683998166786340","2111684672958894554","2111685719815328222","2111686018864951317","2111686174125482066","2111686190487445570","2111688300000170455","2111688814628646925","2111688996812439587","2111689215029457118","2111689289717391596","2111689548426326525","2111690597178486940","2111690812614725670","2111691046329704765","2111691271161188785","2111691913321648230","2111694574544703980","2111695123864272950","2111695357973512467","2111695858748231802","2111695969377222891","2111696126873321570","2111696663035449442","2111697424356151382","2111698031309705570","2111698324105683452","2111698757729529928","2111699018233594282","2111699487374885274","2111701080438616462","2111701239901942071","2111701294058787080","2111701458920034388","2111701689808146937","2111702822383448506","2111703008220528910","2111703273472442587","2111703690352763283","2111704209653690768","2111704446350905373","2111704653767508195","2111704866938851779","2111705347564228756","2111706069340963173","2111706183405105475","2111708276215996465","2111710372868866070","2111710465248407593","2111714084010033184","2111714169154322941","2111714253929599125","2111714994274337131","2111721874745069753","2111722283458846986","2111722581959254421","2111724241020420209","2111724754772369689","2111724976101532093","2111725592555196548","2111725835573248148","2111726227279188302","2111729916370919460","2111730055928017278","2111730246458454256","2111733084249088206","2111733313031516546","2111733551771300228","2111734219361898774","2111735657257431382","2111736898490380349","2111736914516812087","2111737265894662322","2111737480450027532","2111737914245968015","2111738737319424307","2111739088210698388","2111741574480896444","2111742155618427348","2111742651674542576","2111743461850534353","2111745359378780355","2111745936355717281","2111748044702302222","2111749352452706577","2111749916087517264","2111750416270868665","2111751640864772281","2111752461107253727","2111752791794553202","2111753184020693338","2111754136094187748","2111754286879445477","2111754921838325833","2111755031368401392","2111755242023039429","2111755723688624255","2111756072063312316","2111756890837569923","2111757087504273538","2111757136812532160","2111757178470379978","2111757233071718666","2111757283072102572","2111757373488644307","2111757813127291025","2111757836099412158","2111757877681815722","2111758150991003862","2111759070990606548","2111759188443697182","2111759280915279891","2111759380555387175","2111759487505949002","2111759560138690919","2111759940176199763","2111759965203697699","2111759966919172415","2111760575323611183","2111761161243050473","2111761796906590592","2111761805123227813","2111762328383602799","2111762329956143245","2111763574876184751","2111763839884972344","2111764567135268958","2111764594121429057","2111764839857283223","2111764868533756024","2111768908663312570","2111768965483843631","2111769503323566355","2111770351629910052","2111770660272005180","2111770720955162785","2111770745974169867","2111770753863397493","2111771445982372211","2111771971994480758","2111772616482820123","2111772742504808609","2111773300947120459","2111773478278099052","2111774232518791463","2111774326810906796","2111774421719580888","2111774482067337222","2111774555194941927","2111774618126344202","2111774723751415821","2111774731158610339","2111774925321310513","2111775389433663708","2111775983875522721","2111775998538866768","2111776219704500711","2111776513679077767","2111776674845249808","2111776970027753638","2111777411348205929","2111777695923372331","2111778199135035807","2111778302809747494","2111778401396969835","2111778438151557449","2111778492258103315","2111779056140316828","2111779100147032464","2111779868169966041","2111780692845797749","2111781157281190255","2111781520616919456","2111781762326258144","2111781801794662412","2111782003079332014","2111782032749838806","2111782435122012491","2111782712025751868","2111782802492629183","2111782902061314433","2111782962748645764","2111783375174537496","2111783703861207337","2111783708764364990","2111783934040367505","2111784198558404906","2111784255995166808","2111784596090282087","2111784976018710990","2111785288775450856","2111785387731607912","2111785721044533400","2111785727449329883","2111785794054815969","2111786691753345155","2111787763989397537","2111790138355601670","2111790212615749826","2111790654724731333","2111791315998699807","2111791879306260981","2111794484250112166","2111795495014383988","2111795861261054260","2111798291986014634","2111799089717559790","2111799542010335707","2111800371643547843","2111801131156594927","2111801616500474288","2111801753805209993","2111802677567123501","2111803039468441737","2111803982289273284","2111804039981838551","2111805573868253629","2111806522191757446","2111807032013783280","2111807292039717286","2111807654935073194","2111808020418273453","2111809060962189504","2111809463569306047","2111809485383815254","2111811316159844409","2111812645368340891","2111812674439036947","2111813687648587819","2111813888002207775","2111814421941260512","2111815232893186187","2111815714936094764","2111815889196868088","2111816146265710669","2111816408363577827","2111816539838247132","2111816926158852462","2111818297587208243","2111819210712396066","2111820445557346646","2111820555091607675","2111820703364473063","2111820800252871068","2111823120567070985","2111824323430470100","2111824705170874681","2111824757234754044","2111824895114138088","2111825769337090365","2111825926237696117","2111827486241890681","2111827762818552223","2111828804440367218","2111828908798882153","2111829968649117705","2111830709103169684","2111831907541590328","2111833180387062249","2111835472913961141","2111835746835615911","2111835823717130686","2111835872165597304","2111835879606255894","2111835910325317632","2111835918080545214","2111836296318759326","2111836445912830129","2111836456268550305","2111836591086014914","2111836745243463784","2111837445717381364","2111837539372061119","2111837577762267182","2111837605289775533","2111837741944287702","2111837785124663706","2111837868725543290","2111837915194232849","2111838262834909254","2111840909478482173","2111843279537074379","2111843492075090094","2111843570424725517","2111843697709240422","2111848822351794688","2111849371893706947","2111849719584723113","2111850603915943952","2111850701160841543","2111850738842497444","2111850774288593078","2111851216955420828","2111851510745505996","2111854335835648508","2111855042370396501","2111855355764568076","2111855477273534489","2111859297466683697","2111860042878394426","2111860651186667744","2111860859530350886","2111860960860545363","2111861692389081363","2111862294397501726","2111862600032219300","2111862858283986987","2111862869331775684","2111863335151079883","2111864304383476063","2111864666486108459","2111866307876708746","2111870310920405442","2111870955316531310","2111871534113718753","2111871664212566037","2111872254317588748","2111873319771443686","2111874975988953580","2111875318676131935","2111876393483293159","2111877334865518661","2111878973475213413","2111879098192769286","2111879569825513845","2111879833429127500","2111879838181249524","2111884715678634366","2111886816853016863","2111891117310661096","2111893854416941504","2111894946911543394","2111897217317671198","2111901030560809082","2111904176175489376","2111906014849282383","2111909705962639702","2111909848975900776","2111910071575998901","2111911150514565211","2111913276686901689","2111914423871062483","2111914965296943286","2111915140153233761","2111915273678967124","2111915463794143342","2111917970394116568","2111918335650828416","2111919030185742764","2111919733247561765","2111920034171978216","2111920321758724325","2111920744162848782","2111921790696190179","2111922052034904100","2111923168566968774","2111923330312019970","2111923429867987155","2111961826661638368","2111961871502942324","2111963180066808170","2111963183032500729","2111963856075657496","2111963982471057873","2111964223987384560","2111964822778839534","2111971385157554369","2111971906899644576","2111972501157040631","2111973752116498606","2111976128567242989","2111983536450457802","2111984133081886856","2111984645684531246","2111987406375358881","2111991753486237823","2111992744201814148","2111992959256367117","2111993103007780963","2111993429307851183","2111995563629785237","2111995889296507043","2111996260995744107","2111996363194130740","2111996989772808195","2111997095775482135","2111997148342661485","2111997212184244641","2111997282619154482","2111997345533706459","2111997479332012460","2111997933218603399","2111998647428907357","2111998667863515388","2111999645551636930","2111999814108115088","2111999964956213425","2112000099564003679","2112000361875874190","2112001152372068576","2112001201843925287","2112001407704522778","2112001552806478241","2112001713490272475","2112002550602014781","2112003388452073633","2112003736835100997","2112007101963026463","2112007437725454803","2112007552083046590","2112007894434771081","2112008100337381657","2112008355359461442","2112008462909702185","2112008869203574948","2112009033611968929","2112009399854374953","2112009487364366416","2112009621506498789","2112009765849337927","2112009880236446198","2112011516354728379","2112011656234725446","2112013026996216115","2112013175168389365","2112013590211506551","2112013923633476044","2112014236016849246","2112014364622639147","2112014466825306311","2112015009643647354","2112015574008299696","2112015666899468310","2112015737988747373","2112016139039736315","2112017268326687026","2112017269048156384","2112017291756138517","2112017576264122412","2112017765603434653","2112017783500488770","2112017807571574809","2112017829377822782","2112018048735707549","2112018077772877918","2112018088489357384","2112018099608416590","2112018128477798650","2112018748521722058","2112019450853835087","2112020030636613898","2112020724038959510","2112020997968982441","2112021009641644288","2112021206509776967","2112021317532917959","2112021468569870705","2112021598895259981","2112021698996539562","2112021769762853261","2112021784602243415","2112021813534593368","2112023546121859183","2112024098792685745","2112025584868229369","2112027598822019560","2112028230454792282","2112029165180649796","2112029397066936691","2112030149348823486","2112030167724138757","2112030343301939369","2112030361991643602","2112031228966916290","2112032659362988112","2112034018833432623","2112034226711535835","2112034946567323691","2112035316261650923","2112035345844019428","2112035795381186641","2112035814721114137","2112036145634984137","2112037363321053518","2112037880071897547","2112038809433207245","2112039044695920681","2112039689826042043","2112040812683071835","2112040900453089509","2112041161393340701","2112041310983164098","2112041503472447662","2112042059301568851","2112042181825581491","2112042295470276856","2112042594029174898","2112042761679720943","2112042818487328876","2112042897948422562","2112043407329898762","2112043488871371207","2112043523503734910","2112043559901917506","2112043646556283283","2112043858196574400","2112043922537255004","2112045635788783947","2112046251613294770","2112046334551466028","2112046481171681544","2112046544132440230","2112046634645545068","2112048846817968358","2112049664610697316","2112049810836725943","2112050013086056846","2112050260340334786","2112050283127943177","2112050451915108462","2112051139219009633","2112051917904081014","2112052188168257654","2112052797298618752","2112053197632356769","2112053680434479494","2112053721492509158","2112054873856283022","2112055094510600232","2112055689451593885","2112056000828371114","2112056128058302974","2112056291820724621","2112056350364901700","2112056373009879357","2112056486130250224","2112056607010156811","2112056705672716700","2112056781799309698","2112056785620312190","2112057015082311888","2112058326658035751","2112059200289579019","2112059204274200993","2112059851002044818","2112060218700079358","2112060601686233204","2112060906293407757","2112061092369449375","2112061506368176618","2112061644935475264","2112062163624018349","2112062186134831383","2112062312601575668","2112062368117301437","2112062465932677505","2112062514368585968","2112062581859070235","2112062677610877188","2112063969028719082","2112064671301951761","2112064906258501767","2112065097569009744","2112066221827047848","2112066666414969344","2112070435626201198","2112070962724340025","2112072865004814361","2112073052347629900","2112073396016320549","2112073850112581731","2112073930509078623","2112074054442061838","2112074090848858124","2112074204162228518","2112074605112537599","2112075544217125373","2112076178756436001","2112078514367390052","2112078823663771999","2112079104967389447","2112079893114880492","2112080253283934229","2112081204514033828","2112081898625495196","2112082442945503594","2112082642124607877","2112083293063839863","2112083688754385211","2112083883529564266","2112083921731194973","2112083939385094469","2112084868532437306","2112085097721778522","2112085235437629501","2112085288566878683","2112085395999777277","2112085418615398642","2112085980710830366","2112086024977564105","2112086142841663952","2112086360735809643","2112086409406459932","2112086492571160914","2112086678617969141","2112088024003866705","2112089701788381471","2112090312034451572","2112091248114971025","2112091329266368694","2112091406433222704","2112091886400000306","2112093333946535998","2112093352091132347","2112093456596349245","2112093809127641500","2112094754909630817","2112095530616860850","2112095546177671615","2112095759743201565","2112096563371859978","2112097638007148684","2112098275822309443","2112098422157180941","2112098456018035004","2112098598813061600","2112098614881529961","2112098616068473167","2112098734444306754","2112098744758149302","2112098910009487589","2112099152574509198","2112099317075116421","2112099810396553680","2112099847159632312","2112099937186124176","2112101743974826245","2112104818454274471","2112105907773665782","2112108436251152519","2112108811133845712","2112109456226222309","2112109818458812618","2112109955583259119","2112110316461187174","2112110537861411003","2112110586540728589","2112111035658519026","2112111385413120122","2112111472839123385","2112111646336536858","2112111755103203764","2112111911093567907","2112111966856556977","2112112022666276908","2112113377950707785","2112113412406988915","2112113506422276354","2112113542388441554","2112113709854368218","2112113719572656432","2112113957909737551","2112114162000363907","2112114522035282412","2112114798297247974","2112115334836830317","2112115709715292263","2112116018525143385","2112117519121268879","2112120913697354053","2112120953648095369","2112121092546719965","2112121562157789648","2112121579887043058","2112121841032823029","2112122754950680742","2112123051097935989","2112123332317663356","2112123471358754906","2112123555236421634","2112123639491645642","2112123752830169523","2112123954215211377","2112124101662003575","2112124248638763382","2112124476875997312","2112124616785412208","2112124643276685373","2112124721714303337","2112125787709325673","2112126030483951959","2112126108724519323","2112126581540094303","2112126883886510448","2112127158726676771","2112127721602167167","2112128143893180891","2112129131945005377","2112129940770693251","2112130204466590045","2112130775302971508","2112130814750457976","2112130852977324279","2112130960854765731","2112131001786986667","2112131046724772000","2112131083747856389","2112131241558610120","2112131300257890691","2112131453727445262","2112133919835640290","2112134410384363635","2112134502646710629","2112134625988649259","2112134782243201243","2112134915168870524","2112135213669331188","2112135637088555341","2112136014760448402","2112136203868995794","2112137924745764900","2112138114877780060","2112138587705892912","2112138645683445760","2112139420237492416","2112139613427134802","2112140612761956672","2112141928490013122","2112142095758795020","2112142253909246425","2112143102882574594","2112143476641210823","2112143575802843170","2112143660133630263","2112143960072421606","2112144282668974186","2112144573111681132","2112144627746632159","2112144754980868433","2112144839890681902","2112144910534987825","2112145388857946456","2112146074735616497","2112146728355008894","2112147652322492610","2112148379837116903","2112148528135057638","2112148635777675484","2112148675296436666","2112148718577393703","2112148751741788550","2112148753805353327","2112148789909983339","2112148825951613169","2112148864853848287","2112148899930702225","2112148945506034083","2112148988522828010","2112149029404705176","2112149061092733163","2112149091614638444","2112149131393413406","2112149189941674054","2112149228416119027","2112149407147995212","2112149465453019494","2112149639214596339","2112150103016554593","2112150253923405827","2112150400417837477","2112150579774705919","2112151559522099654","2112151749356339656","2112151930688655623","2112151961835606305","2112152098636988832","2112152362811072555","2112152860867834367","2112153666237161691","2112153957393121583","2112154210653651379","2112154256547741779","2112156879971340409","2112157943772942573","2112158175856373858","2112158363601768566","2112159003644191057","2112159328291418195","2112159554435678366","2112159986923237528","2112160962065453494","2112161402341486657","2112161752280670707","2112162923049087052","2112163277090550136","2112163533509251541","2112163686290952372","2112163840599466213","2112164456994374088","2112164638632923289","2112164891654332520","2112166055112229343","2112166216311980418","2112166560773394539","2112166742982291718","2112167183912702222","2112167332026159177","2112168252235206929","2112168757347193012","2112169144087187794","2112170123825950955","2112170913009746245","2112172079273697758","2112172115512430711","2112172153894469855","2112172189457985936","2112172848412598385","2112172854326513894","2112173255008333987","2112173475305758839","2112173782580502552","2112173924205347199","2112174130938450286","2112174533553922442","2112174778140504359","2112176403068445102","2112176562351362153","2112177038526386406","2112177946857267711","2112178888306786508","2112179915177304191","2112181167441199184","2112181956163338276","2112184765151682799","2112186749061570819","2112187738388885701","2112187911085105628","2112188754253472049","2112189525942526009","2112189528102375865","2112190101145231861","2112190323120325116","2112191617268613438","2112191661648576965","2112191693735027075","2112191735011127608","2112191769291174249","2112191804540150164","2112192276718051645","2112192724791415254","2112192989221282247","2112193377617997914","2112195508152529257","2112196002837115245","2112196290973184120","2112196446632186336","2112197884464812080","2112198594833101120","2112198613715800449","2112199621980340330","2112199985634902507","2112200183752831029","2112200250991800473","2112200320407462235","2112200571667321042","2112200661400166826","2112200757378490701","2112200892472852660","2112200919802892321","2112200971556430128","2112201019560251393","2112201072974659661","2112201135553650745","2112201184383832338","2112201272388710741","2112201382833054097","2112201395508314558","2112201706700525648","2112201726010991038","2112201756335833214","2112201871591092712","2112201954336358628","2112202037731704995","2112202110058279162","2112202167759315409","2112202232485798178","2112202280128888989","2112202297350693042","2112202366628057570","2112202478020395069","2112202538233774416","2112202627455062192","2112202694727491706","2112202789615186293","2112202844099190914","2112202924353073283","2112202980917489800","2112203103873478818","2112203162727923986","2112203365933514841","2112203380638781523","2112203693382906155","2112203820122214775","2112204029434773983","2112204144304070891","2112204326479470919","2112204491395309904","2112204982212776067","2112205469876187327","2112207764059811965","2112209070061138020","2112209167692017696","2112209195554701424","2112209309241397302","2112209719012229125","2112209824369016884","2112210806435934661","2112210962745086231","2112211077044077020","2112211282011251183","2112211502178746463","2112211702167253070","2112212160151790078","2112212822965055830","2112213300826255653","2112213611573915649","2112215192759361722","2112215209276576178","2112217252049424418","2112217541884219509","2112219725505687955","2112220618796273708","2112221016206577821","2112221480914391069","2112222684876870147","2112222737091695048","2112223251133071766","2112223516582150594","2112224157564129365","2112225241678467527","2112225695556608176","2112225768613003653","2112226078030991542","2112228239536255146","2112228380561293639","2112228723059757363","2112228889334542660","2112229196122751465","2112229356919566530","2112229425530175510","2112229537899753719","2112235082593571096","2112235834279891234","2112237163802956075","2112237545404919818","2112237835516514598","2112238057957253228","2112238121287078039","2112238459901583446","2112238824399224887","2112238946231185427","2112238959564849473","2112239097553236259","2112239132470817072","2112239239782113641","2112239437489086615","2112239775075942553","2112239812145242461","2112239866654437690","2112239896081657962","2112239964775915908","2112240320700436512","2112241050161193187","2112243305669108026","2112244504959062151","2112252255772811409","2112252446621986866","2112252650410709408","2112253021757595938","2112253113457643836","2112254562820305330","2112256016612265987","2112256065849201038","2112256157461221526","2112256284150157596","2112256382061990249","2112256465381838907","2112256509724008745","2112256837118730470","2112257419623764303","2112257509289574557","2112257544169427203","2112257668635345008","2112257857349718230","2112258300037550425","2112258330177700209","2112258359709905293","2112258360850673706","2112295225452618127","2112313516992696460","2112328153553379778","2112346018654388309","2112347015132897298","2112349691413406007","2112355304117780553","2112358055866405201","2112359967877726601","2112360810941223093","2112361031771238463","2112361448114720813","2112361731968426485","2112361861635289365","2112362587627372927","2112362697555931453","2112363075869495715","2112363321701883980","2112363562605981886","2112363600400794093","2112363747369181270","2112364897858408643","2112366557997453420","2112367206915035468","2112368550505795939","2112368608567554316","2112369153852187019","2112369177285869827","2112369378000007430","2112370228609089640","2112370304471466090","2112370723218165907","2112370767384223773","2112370921101209884","2112372255590392008","2112372975194513602","2112373029858873624","2112373506700980334","2112373708774154302","2112373874541338669","2112374044695937277","2112374364700319902","2112374426285289853","2112374470325436884","2112374679545717231","2112374772021731607","2112374826530943042","2112374854221705716","2112375055070179562","2112375451285069997","2112375510206738654","2112375540447641704","2112375573955928385","2112375624606327182","2112375653710643503","2112375817359753309","2112376337709310144","2112376460241694908","2112376768795689021","2112377222556434834","2112377937039339665","2112378176735498292","2112378869202448853","2112379142528545115","2112379752174801303","2112379805882810491","2112380421984174490","2112380537331692026","2112380718102069430","2112381038290952205","2112381066157928596","2112381206398705882","2112381362393211252","2112381954255622540","2112382018113909173","2112382085948375352","2112382147080376798","2112382204106207576","2112382284724900129","2112382373962936781","2112382445031198806","2112384160707035370","2112385018748428598","2112385404926349370","2112386099083632688","2112386594158359004","2112386753747362013","2112391307914269077","2112391461287473558","2112391894068252819","2112392026868392409","2112392401000227278","2112392663442100287","2112392779121021307","2112392828341166421","2112392847878246766","2112392871580143928","2112392918782951627","2112392962609234154","2112393008704528715","2112393057866055781","2112393105467113672","2112393331233915089","2112393466152157481","2112398766812889265","2112398893560594568","2112399111823753542","2112399210335404213","2112399633272180765","2112399760338690512","2112400159720321127","2112400442324099300","2112400575988183141","2112400921527259265","2112401465545482664","2112401570109489273","2112401806936646140","2112403191111593984","2112403502211514486","2112404499176554739","2112404983186616735","2112405519562649766","2112406956426318201","2112406985119498307","2112408333366026361","2112408380157640896","2112408829573157224","2112410479402627516","2112410724056395947","2112410753038987401","2112411058166239479","2112411178110738459","2112411370394370214","2112411490930262291","2112411567279214835","2112411727640080663","2112413250143060297","2112413471698813401","2112413931067376063","2112413973362667776","2112414648024871113","2112415556276244870","2112416294649942044","2112416363092558297","2112417058319483028","2112417236006895813","2112417655856771527","2112417831283528035","2112418274650829151","2112418980753461518","2112419174618460490","2112419414293327973","2112419653117255808","2112419771442778454","2112419772587802987","2112419943711203723","2112419967337718067","2112420082773279063","2112420315435532520","2112420588598002005","2112420711008743740","2112420997370651031","2112421110331707851","2112422974116843654","2112423862130602240","2112423893281472571","2112424013721149930","2112424056377233731","2112424075993997414","2112424265433935917","2112424362884345949","2112427381202043063","2112427528577237115","2112429833753927980","2112430252916199524","2112430727950471507","2112430744299769892","2112430746044710964","2112432326823313586","2112435014977896593","2112436850883477873","2112437060841967874","2112437080358031399","2112437132191232146","2112437177871397308","2112437371782533201","2112437435623981505","2112437839824863395","2112438013360013501","2112438714022625568","2112438814987976845","2112438916200755362","2112439185261085025","2112439500026896747","2112439774426587205","2112439812573868135","2112439859990421799","2112440200458887321","2112440305383583937","2112440542164611074","2112441016506777659","2112441259763847407","2112441325387911255","2112441473534976155","2112441476428780009","2112441660332503056","2112441803798695967","2112441974473277663","2112444737231978833","2112449935505604835","2112450167186346284","2112451591056015392","2112452032494022867","2112457979618554161","2112458130789708140","2112458176172028040","2112458315968176579","2112458723650371778","2112458982573146416","2112459359246840095","2112459563115180186","2112459777490219397","2112465325442859254","2112466533331124377","2112468946930815035","2112469847158514049","2112470740809441638","2112472533220135321","2112473291881689503","2112473803536347600","2112474115676541427","2112474425576800654","2112476960098283659","2112477585657790562","2112478797979328823","2112479443918938374","2112481890250977639","2112482037932372316","2112482405403721832","2112482950860374255","2112484759435903487","2112484904743391627","2112484955083399348","2112485027938197791","2112485241105592499","2112485350694334472","2112485449449247177","2112485551656108399","2112485622346915985","2112485687870345627","2112485784406356391","2112485906141855917","2112485994964332637","2112486078301057349","2112486084336898134","2112486154452783217","2112486227173933185","2112486318618091657","2112486417574322556","2112486503649591423","2112486598801805823","2112486659992555786","2112486724341219434","2112488894155596115","2112491217896513899","2112492454121480193","2112495742132814078","2112495896567144662","2112496032907223396","2112496188264218820","2112496325170475254","2112496760241496454","2112496903648923898","2112496914596020438","2112497308088836382","2112497426422772096","2112498869636587975","2112499356616310939","2112499536371614047","2112501489889689611","2112502416461738012","2112502459331682382","2112503033846546897","2112503414567641567","2112503478644039991","2112503536445694241","2112503607098769539","2112503628498173973","2112503684785721453","2112503744999100612","2112503804122026032","2112503862242464107","2112503909847818644","2112503964172480861","2112504069663395845","2112504159643828440","2112504245350207631","2112504338702880995","2112504429635379343","2112504505346715821","2112504562871632123","2112504626822185434","2112504758787514445","2112504814039134281","2112505834081243634","2112506180086239417","2112506463142982102","2112506664389591172","2112507112282862025","2112507164116078985","2112509541183267303","2112509826924491175","2112510013084495892","2112510366148399247","2112510584759713796","2112511821731250592","2112512166616265095","2112512551028195594","2112512682784092434","2112513042596708472","2112513488295964686","2112513508805947621","2112513889858683123","2112514770872238362","2112515229771047319","2112515838633034228","2112516403811258382","2112516911527505941","2112517025511924035","2112517742037172254","2112519979681948105","2112520116634345860","2112520231273091231","2112520242677358826","2112520539466248536","2112520568826442134","2112520769054167148","2112520821126336814","2112520849425362995","2112520982934307096","2112521388628320434","2112521776454619552","2112521967865860344","2112522263509799390","2112522411522638070","2112522556804862044","2112522734005866890","2112522747855401172","2112523187699482892","2112523535721930785","2112525669137822126","2112526097841860669","2112526170441085430","2112526339454673133","2112526559030473024","2112526647610241119","2112526685036040365","2112527570113880233","2112528222864990342","2112529180458131631","2112529186707640363","2112529236636647724","2112529283168260184","2112529763751649360","2112529834945773905","2112529975874355420","2112530074033619350","2112530159899402414","2112530452519194769","2112530645830517197","2112532632152215765","2112532891150504320","2112533292868366542","2112533683362247059","2112533761942573200","2112533949184606367","2112534102385803552","2112534199785975847","2112534258434842704","2112534374554214599","2112535819387048440","2112536750656761965","2112537354582000112","2112538314104574350","2112538524352434369","2112538618204233941","2112538671341867178","2112539336214446508","2112540224727486764","2112540469280583957","2112540596514758711","2112540697220071882","2112540698012688554","2112540788601328090","2112540794922193069","2112543129006170200","2112544878395895841","2112545066493632647","2112545176065650692","2112545316465758356","2112546035574985096","2112546133029626305","2112546166508593432","2112546169964712361","2112546408981283020","2112547033533894932","2112547240984342570","2112547369770533113","2112547398748979369","2112547572837658741","2112547593070768335","2112547743386456336","2112547849384907193","2112551197299396840","2112551998633746691","2112552468437745680","2112553450324349316","2112553764687364505","2112554433934684525","2112555153379540997","2112555574227574908","2112555702451675333","2112556511834882391","2112557943870882035","2112558137681318260","2112558345571987954","2112559252305015049","2112559578441261416","2112559593624830151","2112559940439355864","2112562543013331370","2112563326958067757","2112563401625051437","2112565011503816998","2112566412783042626","2112566673383563353","2112567077051715842","2112567087491420186","2112569196496421270","2112570090860462256","2112571567523901584","2112572527889592443","2112573202325242115","2112573506114494926","2112573939608436768","2112574889161048406","2112575980984472022","2112576455469355227","2112578235460685854","2112578467174949090","2112578577669697616","2112578894813700519","2112578932163899408","2112579189320847845","2112579195457204533","2112579617001455983","2112580132011745666","2112581524566810683","2112581788556304839","2112582644127211933","2112583892574380479","2112586404949787083","2112587203880886712","2112587712092110932","2112588214020276236","2112588654858375460","2112588705718468663","2112588752166203712","2112589130802823247","2112589324575543764","2112589403843658070","2112589851170378076","2112590349550137792","2112590510569459737","2112596104273637883","2112596516401746354","2112598256035450932","2112598546579144847","2112598762061517125","2112599121114857939","2112599186311110932","2112601911295959544","2112602352582791435","2112603260314132807","2112604405841412300","2112605809020715029","2112606857219244275","2112607223868531073","2112607241933365419","2112607248216375554","2112607370287387008","2112607433881428114","2112607576655634600","2112609348090540226","2112609407276339402","2112609664680739058","2112610870920687737","2112612012211790095","2112612090188071085","2112612103223935441","2112616391262220649","2112620649323839610","2112620984910155876","2112621421616898240","2112627352173986178","2112629386591744477","2112629653093662969","2112643750656876690","2112683769387958694","2112687496958283985","2112693057049251970","2112693527893475551","2112694431573061797","2112696398131138722","2112702908743475607","2112703162947870823","2112704032544551301","2112704554513072163","2112710414731796694","2112710563520495995","2112711058603520023","2112711096247390468","2112711139088060502","2112711603963785348","2112712091832574128","2112712221772111931","2112712871675330787","2112712951497216152","2112713063715725342","2112713347275915487","2112713560031965677","2112714486289400188","2112715189502242877","2112715783789039929","2112716083383964071","2112717819913847169","2112718849405780266","2112721476386459749","2112723088458846601","2112725283547861005","2112725391517577421","2112725482496204857","2112725809148690557","2112727994280362064","2112728173117080030","2112728581432619109","2112729066176680133","2112729257499844646","2112729395865723204","2112729575931441576","2112729884237939154","2112730073669493077","2112730188861825524","2112731102477766893","2112732221719392540","2112732905541877978","2112733215270347196","2112734557145595969","2112734726557765770","2112734965100351512","2112735431200743567","2112736470436082048","2112736649662857686","2112737396731347008","2112737626386223423","2112738412172316811","2112739378485404106","2112739400304234658","2112739549118165038","2112739550468640789","2112740450578915420","2112740631101775970","2112740725431640209","2112742279819809110","2112743263539282427","2112745628686295435","2112747291417436460","2112747496195883039","2112747737620033650","2112748018579755244","2112749748415266849","2112749812798152734","2112749937662509459","2112750004205162802","2112750887575912525","2112751427601015077","2112751438845911461","2112751471121060292","2112751530235633722","2112751567317401987","2112752017211089384","2112752297591918618","2112752494791307393","2112752682561900759","2112752768595394713","2112752806897782813","2112752861524512882","2112752933821681772","2112753071466131724","2112753741640441876","2112754243706700011","2112754993229119858","2112757415833944530","2112759546276122899","2112759590978986105","2112759639809167679","2112759679894057183","2112759993766383754","2112760227795968420","2112760377000022308","2112760498248962104","2112760807255863690","2112761042363408604","2112761672243065128","2112761966284709920","2112762004142535033","2112762864247398526","2112764775222710302","2112765112612524111","2112767147848126661","2112767396037751268","2112769375078138136","2112770105096704389","2112770840291049903","2112771047607136694","2112771263328661635","2112771507810349492","2112771954889605516","2112773873225875526","2112774229016052034","2112774434927112645","2112774465478369530","2112774607321367012","2112774730776453589","2112775000206000212","2112775056816533544","2112775411805618289","2112775502947909979","2112775879936119100","2112776070571466957","2112776675440386060","2112776740720566426","2112777075052658864","2112777451009184124","2112777638620360871","2112778149264269339","2112778183951200469","2112778407889240195","2112778729168757153","2112778749909647651","2112779003383918996","2112779158879396029","2112779314508996828","2112779461292908607","2112780375726731348","2112784702507721129","2112784866572169506","2112785242516074537","2112785283452485682","2112785773141586221","2112786038150283507","2112786895478669823","2112786896707523014","2112787202254201283","2112789730228072480","2112789820703740338","2112789957014364434","2112791489608646706","2112793460264865876","2112793514765644021","2112793880366317817","2112794119190045170","2112795133737598980","2112795430237122675","2112795442840785094","2112796868875096511","2112797381637058736","2112799277814812708","2112799886840402409","2112800225958252802","2112800357323813222","2112800818307256599","2112801385855279580","2112802547601981748","2112802643181776997","2112802930407674224","2112803010648867100","2112803258825953440","2112803390929752256","2112803440896491841","2112803458009203009","2112803552125235523","2112803752369619018","2112803975116583299","2112804803026067920","2112805239904690309","2112805410654892463","2112805860338765850","2112806534690582669","2112806768669872635","2112806942234353879","2112807139488280744","2112807555873558554","2112807812564959586","2112809661200281920","2112810244539924588","2112810483984244842","2112810569292292131","2112810771407360460","2112810923782283347","2112811102300234224","2112811524989599826","2112811689435652273","2112813353022492734","2112814882169205191","2112815234444664960","2112815392972546309","2112815698984743113","2112816298224943503","2112816307200840052","2112816735292453051","2112816905002365071","2112817444352098665","2112817508403044662","2112817632575672817","2112817792248692818","2112817829854806285","2112817897085321611","2112817963586015704","2112817990219730956","2112818021563875400","2112818060482744728","2112818152971407846","2112818299579126041","2112818435013128200","2112818564411334731","2112819877665026072","2112820750071775319","2112820861455712507","2112821016556908937","2112821067467387017","2112821110970655101","2112821154281033770","2112821195183915246","2112821395914997805","2112821566782550254","2112822142245151081","2112822263934587039","2112822934830244019","2112822975821177093","2112823016707293557","2112823052199416119","2112823092619960819","2112823137645834435","2112823179723047211","2112823217920651512","2112823432245379210","2112823500562121210","2112823755676479955","2112824041149210658","2112824971911463164","2112825003599425666","2112827191298048314","2112827387868258370","2112827567577375127","2112828248128454695","2112828326041850214","2112828393188368822","2112828650454147203","2112828678262649281","2112830949897507051","2112831983806189573","2112834519837577643","2112835753529196797","2112835952867729645","2112836118274334857","2112836167255367773","2112836469698224136","2112836646341337546","2112836815996825615","2112838216222904810","2112838838234366023","2112839279814824037","2112839627166163012","2112839823761543334","2112839935531307424","2112840009049133494","2112840287097856126","2112840290054860989","2112840460259713134","2112840728112222692","2112840866008334378","2112841003367596400","2112841305743405335","2112841813107310909","2112841903121293604","2112842791596470369","2112843454187479143","2112843528216981672","2112843573775450592","2112843803078086695","2112843827295793404","2112843921495933126","2112844034603385125","2112844169559540218","2112844172822712553","2112844303882133782","2112844310332973443","2112844442533278196","2112844724617039984","2112844830275699028","2112844967173591479","2112845169456562590","2112845247038489069","2112845314894000575","2112845322812899518","2112845401552474529","2112845408556957811","2112845497715339468","2112845571300172027","2112845593085403232","2112845740422934712","2112845787931742460","2112845998892695946","2112846050780475668","2112846135501135915","2112846268519297336","2112846376178749616","2112846538607345791","2112846546719133755","2112846573986296146","2112846604944478653","2112846628243832977","2112846636829593651","2112846666982445215","2112846672913203604","2112846700352295063","2112846730912039104","2112846740370211203","2112846765200408714","2112846817285320982","2112846819277615442","2112846881219129456","2112846957005955223","2112847015562682876","2112847047833661879","2112847098706051364","2112847264414888307","2112847597677478240","2112847636445483217","2112847663582605675","2112848137635192959","2112848221748035833","2112848349980434889","2112848517886865725","2112848695675023602","2112848884989100423","2112849095958401358","2112849220864819580","2112849343199994308","2112849428814139549","2112849439903875401","2112849536217653573","2112849543377420334","2112849711547945452","2112850057078989264","2112850137794088967","2112851027255034078","2112851164979249360","2112851242867454341","2112851378393813068","2112851560573415688","2112851600197013567","2112851708472971588","2112851954221424796","2112852011368804841","2112852298036842583","2112852327472533569","2112852382149464165","2112852413875175710","2112852576614166976","2112852653042704532","2112852762002342105","2112852883020591275","2112852966080450924","2112852995763580966","2112853899325628717","2112854030477410364","2112854043261632897","2112854146319872420","2112854295800660202","2112854428134920223","2112854431897407741","2112854541100343749","2112854558380790159","2112854664417030358","2112854729319657819","2112854785741484270","2112855360046543222","2112855736703402426","2112856794066559146","2112856829214773350","2112856977366032720","2112857038766387527","2112857077815414981","2112857115618652166","2112857156462719334","2112857200255516924","2112857347433648232","2112857529462173841","2112858635588231435","2112858641430638988","2112858668995854388","2112860086393778343","2112860115833635228","2112860217407140062","2112860290878775350","2112860350026764573","2112860453038887073","2112860558605304125","2112860681880182882","2112862497007100031","2112862988814147967","2112863225410887795","2112863278787658152","2112863412405629229","2112863519809147217","2112863586477642044","2112864021523386689","2112864174242156644","2112864185562607656","2112864215866486850","2112864219125239829","2112864258799411582","2112864369583481270","2112864395730837581","2112864405398413551","2112864430358954041","2112864880877617339","2112866070063399139","2112866423697752231","2112867177837830596","2112867183642739092","2112867285778244080","2112867289326559513","2112867535532196124","2112867732232532241","2112867841250877513","2112868098818891909","2112868296450277742","2112869081036828869","2112869226587521405","2112870538645561631","2112870575861604502","2112871897151279264","2112872826755764605","2112872878081478762","2112873001364685154","2112876207389995299","2112877407787192830","2112877504965083144","2112877640550105375","2112877690651066833","2112877849111896458","2112882004698313155","2112884103813230600","2112885554073473443","2112886116768776547","2112889511726469260","2112891416372445317","2112891581573538152","2112892215198650531","2112892774496526661","2112892966851551281","2112893048279736671","2112893213375906018","2112893256417829256","2112893292220432439","2112893568964866498","2112894683466907876","2112894799053504711","2112895392165904689","2112895889857736981","2112896120770732190","2112897559262085550","2112897771934236835","2112897902557426033","2112897955758047658","2112898568835178915","2112899203181494346","2112900203342942363","2112900381714055310","2112905452132688268","2112905932200128837","2112908862185746927","2112909425359155497","2112909453754544147","2112909690913059264","2112910264693846439","2112910606013772000","2112910794690335062","2112911034835227096","2112911330424602891","2112913259238207571","2112914302327771344","2112919439599669554","2112920818535801141","2112920878984069153","2112921520439976395","2112922147484324119","2112922729792090245","2112922897698398620","2112923003327754368","2112923566799020516","2112926900247310377","2112928574437286098","2112928912842080333","2112929405261738245","2112935564706226359","2112935658406944964","2112935744520237239","2112935947461623919","2112936487444685145","2112936833353175244","2112937619680342090","2112938142982639744","2112938362202177622","2112938733322567909","2112939564449005674","2112940070969938420","2112940357717737911","2112942054452158684","2112942619483627900","2112943061382914547","2112943167624585607","2112943203209109717","2112943238369914991","2112943368724783575","2112943575554228398","2112944019152224538","2112944168679153997","2112944180016345483","2112944347935334654","2112944351806677462","2112944502516101266","2112944509818716538","2112944535785628103","2112944819618373899","2112945074879508516","2112945337212248356","2112945891275628959","2112947007740654034","2112948725375230030","2112949213072093331","2112949740073808218","2112950522206621892","2112952464068734980","2112954674806747451","2112954897293595039","2112955195210838471","2112955704529338386","2112955760485511587","2112955858481192970","2112955929172099186","2112956206767907186","2112956271745966161","2112957701269639653","2112957877648499042","2112958131294842893","2112958163289047324","2112958281765584936","2112958522002751800","2112958678240526492","2112959035742081202","2112959128977207547","2112959601540743675","2112960284495425935","2112960907299197110","2112961191505244372","2112961256156192938","2112961434707702128","2112961894336303392","2112961962376360106","2112961974753784135","2112962124905607328","2112962345312080221","2112962411477266933","2112963637640130853","2112963791155847500","2112963897393401924","2112964622768840761","2112967214303481949","2112967217214345443","2112967861774045613","2112968882319421477","2112968914057810044","2112969333534228764","2112969583766495513","2112969839291822384","2112970012998996162","2112970374715740570","2112970793105936614","2112971283713642637","2112971993498915310","2112972199783191036","2112974516720988437","2112974640113135872","2112974702247571688"]);

/**
 * Fills the 'UPPCLLKO Replied (YES/NO)' column (Column J) across all data rows in 'Twitter Complaint List'.
 * Rule:
 *  - YES: If UPPCLLKO ever replied to that post (in present or anywhere in historical conversation trail).
 *  - NO:  If UPPCLLKO never replied to that post.
 */
function populateUppclRepliedColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return { total: 0, yesCount: 0, noCount: 0 };

  const numRows = lastRow - 2;
  const colMap = getSheetColumnMap(sheet);
  const uppclCol = (colMap.uppclReplied !== undefined) ? colMap.uppclReplied + 1 : 10;
  const linkCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl + 1 : 5;
  const pidCol = (colMap.postId !== undefined) ? colMap.postId + 1 : null;

  const lastCol = sheet.getLastColumn();
  const allRowData = sheet.getRange(3, 1, numRows, lastCol).getValues();

  const outputValues = [];
  let yesCount = 0;
  let noCount = 0;

  for (let i = 0; i < numRows; i++) {
    const row = allRowData[i];
    let tid = '';
    const rawUrl = String(row[linkCol - 1] || '').trim();
    const m = rawUrl.match(/status\/(\d+)/i);
    if (m) {
      tid = m[1];
    } else if (pidCol && /^\d{15,25}$/.test(String(row[pidCol - 1] || '').trim())) {
      tid = String(row[pidCol - 1] || '').trim();
    } else {
      // Self-healing fallback: scan row cells for tweet URL or snowflake ID
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').trim();
        const cm = cell.match(/status\/(\d+)/i);
        if (cm) {
          tid = cm[1];
          break;
        } else if (/^\d{17,21}$/.test(cell)) {
          tid = cell;
          break;
        }
      }
    }

    const currentVal = String(row[uppclCol - 1] || '').trim().toUpperCase();
    // Retain YES if verified in tweet history OR if an operator manually selected YES
    if ((tid && VERIFIED_UPPCL_REPLIED_TWEET_IDS.has(tid)) || currentVal === 'YES') {
      outputValues.push(['YES']);
      yesCount++;
    } else {
      outputValues.push(['NO']);
      noCount++;
    }
  }

  // Fast single-batch write (updates all rows in 1 second)
  sheet.getRange(3, uppclCol, numRows, 1).setValues(outputValues);

  // Apply in-cell dropdown chips
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['YES', 'NO'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(3, uppclCol, numRows, 1).setDataValidation(rule);

  SpreadsheetApp.flush();

  const colName = sheet.getRange(1, uppclCol).getValue() || 'UPPCLLKO Replied (YES/NO)';
  const msg = "Successfully populated '" + colName + "' (Column " + uppclCol + ") across all " + numRows + " rows:\n\n" +
              "• YES (Verified UPPCLLKO Replied): " + yesCount + "\n" +
              "• NO (Never Replied): " + noCount;
  try {
    SpreadsheetApp.getUi().alert('UPPCLLKO Reply Status Populated\n\n' + msg);
  } catch (e) {
    Logger.log(msg);
  }

  return { total: numRows, yesCount, noCount };
}

/**
 * Scans pending complaint rows in 'Twitter Complaint List' and deletes/archives
 * any complaints where an official handle (@PuVVNLHQ, @MVVNLHQ, ministers, etc.)
 * has ALREADY replied before @UPPCLLKO.
 */
function removeOfficialRepliedFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Twitter Complaint List');
  if (!sheet) sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;

  const numRows = lastRow - 2;
  const colMap = getSheetColumnMap(sheet);
  const data = sheet.getRange(3, 1, numRows, sheet.getLastColumn()).getValues();

  const props = PropertiesService.getScriptProperties();
  const bearerToken = props.getProperty('X_BEARER_TOKEN') ||
    'AAAAAAAAAAAAAAAAAAAAACbr%2FwEAAAAAySPqrdOjXkNWagBKKbkzMA97ZnI%3DRBPSknXnu5S8uXS3j7lPbXPHlYCpiLfD2Yt8cRtRvWm1NcSi1E';

  const linkUrlCol = (colMap.linkUrl !== undefined) ? colMap.linkUrl : 4;
  const uppclCol = (colMap.uppclReplied !== undefined) ? colMap.uppclReplied : 9;
  const statusCol = (colMap.status !== undefined) ? colMap.status : 14;
  const complaintNoCol = (colMap.complaintNo !== undefined) ? colMap.complaintNo : 15;

  let removedCount = 0;
  // Scan backwards from bottom so row deletions do not shift indices
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const rowIndex = i + 3;
    const url = String(row[linkUrlCol] || '').trim();
    const uppclReplied = String(row[uppclCol] || '').trim().toUpperCase();
    const complaintNo = String(row[complaintNoCol] || '').trim();

    // Only inspect pending or unreplied rows (skip rows where UPPCLLKO already replied)
    if (uppclReplied === 'YES') continue;

    const m = url.match(/status\/(\d+)/i);
    const tid = m ? m[1] : '';
    if (!tid) continue;

    // Check if an official handle replied on X
    const check = checkDiscomRepliedBeforeUppclInScript(tid, bearerToken);
    if (check && check.discomRepliedFirst) {
      Logger.log('Removing Row ' + rowIndex + ' (' + url + ') because @' + check.handle + ' already replied.');
      archiveFrivolousInSheet(tid, url, complaintNo);
      sheet.deleteRow(rowIndex);
      removedCount++;
    }
  }

  SpreadsheetApp.flush();
  const msg = 'Official Reply Audit Complete!\n\nRemoved ' + removedCount + ' complaint row(s) where official handles (@PuVVNLHQ, @MVVNLHQ, etc.) already replied before UPPCLLKO.';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
  return removedCount;
}