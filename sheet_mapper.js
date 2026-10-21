/**
 * ==============================================================================
 * UPPCL SOCIAL MEDIA CELL — CENTRALIZED SHEET COLUMN MAPPER & HEADER RESOLVER
 * ==============================================================================
 * Authoritative single source of truth for Google Sheets column mapping.
 * Dynamically resolves spreadsheet columns by header name rather than fixed
 * numerical indices or hardcoded column letters.
 *
 * Capabilities:
 * - Safe header normalization (case, whitespace, punctuation insensitive)
 * - Configured canonical fields with exhaustive alias definitions
 * - Ambiguity and duplication detection
 * - Dynamic index & column letter derivation (A, B, ..., Z, AA, AB, ...)
 * - Safe field accessor and setter with row-level heuristic auto-recovery
 * - Comprehensive column inventory generator for audits and diagnostics
 * ==============================================================================
 */

/**
 * Normalizes header string:
 * - Trims whitespace
 * - Converts to lowercase
 * - Strips all non-alphanumeric characters
 * Examples:
 *   " LINK URL"                   -> "linkurl"
 *   "UPPCLLKO Replied (YES/NO)"   -> "uppcllkorepliedyesno"
 *   "REPLY_WITHIN_30_MIN_BY_Laqshya Media" -> "replywithin30minbylaqshyamedia"
 *   "DATE"                        -> "date"
 */
function normalizeHeaderName(rawHeader) {
  if (rawHeader === null || rawHeader === undefined) return '';
  return String(rawHeader)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Converts 0-based column index to Excel column letter (0 -> 'A', 25 -> 'Z', 26 -> 'AA')
 */
function indexToColumnLetter(index) {
  if (index < 0 || typeof index !== 'number') return '';
  let temp, letter = '';
  let col = index + 1;
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - temp - 1) / 26);
  }
  return letter;
}

/**
 * Converts Excel column letter to 0-based column index ('A' -> 0, 'Z' -> 25, 'AA' -> 26)
 */
function columnLetterToIndex(letter) {
  if (!letter || typeof letter !== 'string') return -1;
  const clean = letter.trim().toUpperCase();
  let index = 0;
  for (let i = 0; i < clean.length; i++) {
    index = index * 26 + (clean.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Master Dictionary of Canonical Fields and their recognized aliases.
 * Ordered from most specific alias to general alias to prevent partial mismatch.
 */
const CANONICAL_FIELD_DEFINITIONS = {
  date: {
    label: 'Date',
    required: true,
    aliases: ['date', 'receiveddate', 'complaintdate', 'postdate', 'firstdetecteddate', 'logdate']
  },
  link_shift: {
    label: 'Link Shift',
    required: false,
    aliases: ['linkshift', 'shift', 'workshift', 'shiftname', 'operationalshift']
  },
  reply_shift: {
    label: 'Reply Shift',
    required: false,
    aliases: ['replyshift', 'responseshift']
  },
  c_f: {
    label: 'C F',
    required: false,
    aliases: ['cf', 'cfstatus', 'carryforward', 'cfaction']
  },
  reply_within_30_min: {
    label: 'REPLY_WITHIN_30_MIN_BY_Laqshya Media',
    required: false,
    aliases: [
      'replywithin30minbylaqshyamedia',
      'replywithin30minbylaqshya',
      'replywithin30min',
      'replywithin30mins',
      'reply30min',
      'reply30mins',
      'reply30',
      'laqshyareply30',
      'firstreplywithin30min'
    ]
  },
  link_url: {
    label: 'LINK URL',
    required: true,
    aliases: [
      'linkurl',
      'posturl',
      'tweeturl',
      'tweetlink',
      'url',
      'link',
      'postlink',
      'xlink',
      'xurl',
      'twitterurl'
    ]
  },
  twitter_id: {
    label: 'Twitter Id',
    required: true,
    aliases: [
      'twitterid',
      'twitterhandle',
      'consumerhandle',
      'handle',
      'userhandle',
      'authorhandle',
      'authorid',
      'consumername',
      'twittername'
    ]
  },
  picked_status: {
    label: 'Picked Status',
    required: false,
    aliases: ['pickedstatus', 'picked', 'pickstatus', 'isappreciation']
  },
  head: {
    label: 'Head',
    required: true,
    aliases: ['head', 'accounthead', 'headcode', 'monitoredhead', 'assignedhead', 'grievancehead']
  },
  untagged_complaint: {
    label: 'Untagged Complaint',
    required: false,
    aliases: ['untaggedcomplaint', 'untagged', 'isuntagged', 'untaggedstatus']
  },
  uppcllko_replied: {
    label: 'UPPCLLKO Replied (YES/NO)',
    required: false,
    aliases: [
      'uppcllkorepliedyesno',
      'uppcllkoreplied',
      'uppclreplied',
      'uppcllkoreply',
      'uppclreply',
      'officialuppclreplied',
      'officialreplied'
    ]
  },
  complaint_type: {
    label: 'Complaint Type',
    required: false,
    aliases: [
      'complainttype',
      'category',
      'complaintcategory',
      'issuetype',
      'grievancetype',
      'type'
    ]
  },
  discom: {
    label: 'DISCOM',
    required: false,
    aliases: ['discom', 'discomname', 'utility', 'distributioncompany', 'zoneoffice']
  },
  zone: {
    label: 'Zone',
    required: false,
    aliases: ['zone', 'zonename', 'electricalzone']
  },
  district: {
    label: 'District',
    required: false,
    aliases: ['district', 'districtname', 'dist', 'city']
  },
  status: {
    label: 'Status',
    required: false,
    aliases: [
      'status',
      'complaintstatus',
      'processingstatus',
      'currentstatus',
      'actionstatus',
      'resolutionstatus'
    ]
  },
  complaint_no: {
    label: 'COMPLAINT_NO',
    required: false,
    aliases: [
      'complaintno',
      'cno',
      'complaintnumber',
      'grievanceno',
      'grievancenumber',
      'ticketno',
      'refno'
    ]
  },
  post_text: {
    label: 'Post Text',
    required: true,
    aliases: [
      'posttext',
      'tweettext',
      'complainttext',
      'complaintdetail',
      'complaintdescription',
      'text',
      'content',
      'postcontent',
      'tweetcontent'
    ]
  },
  post_created_at_utc: {
    label: 'Post Created At (UTC)',
    required: false,
    aliases: [
      'postcreatedatutc',
      'createdatutc',
      'tweetcreatedatutc',
      'posttimeutc',
      'createdat'
    ]
  },
  first_detected_at_ist: {
    label: 'First Detected At (IST)',
    required: false,
    aliases: [
      'firstdetectedatist',
      'firstdetectedat',
      'firstdetected',
      'detectedatist',
      'receivedatist',
      'detectedtime'
    ]
  },
  language: {
    label: 'Language',
    required: false,
    aliases: ['language', 'lang', 'postlanguage']
  },
  routing_confidence: {
    label: 'Routing Confidence',
    required: false,
    aliases: ['routingconfidence', 'confidence', 'airoutingconfidence']
  },
  draft_reply: {
    label: 'Suggested Reply Draft',
    required: false,
    aliases: [
      'suggestedreplydraft',
      'replydraft',
      'draftreply',
      'draft',
      'suggestedreply',
      'proposedreply'
    ]
  },
  approval_status: {
    label: 'Reply Approval Status',
    required: false,
    aliases: [
      'replyapprovalstatus',
      'approvalstatus',
      'approval',
      'replyapproval'
    ]
  },
  reply_within_60_min: {
    label: 'REPLY_WITHIN_60_MIN_BY_DISCOM',
    required: false,
    aliases: [
      'replywithin60minbydiscom',
      'replywithin60min',
      'reply60min',
      'reply60',
      'discomreplywithin60min'
    ]
  },
  remark: {
    label: 'Remark',
    required: false,
    aliases: ['remark', 'remarks', 'forwardingremarks', 'operatorremark', 'notes']
  },
  reply_post_url: {
    label: 'Reply Post URL',
    required: false,
    aliases: ['replyposturl', 'replyurl', 'officialreplyurl', 'replylink']
  },
  reply_post_id: {
    label: 'Reply Post ID',
    required: false,
    aliases: ['replypostid', 'replyid', 'officialreplyid']
  },
  reply_posted_at: {
    label: 'Reply Posted At',
    required: false,
    aliases: ['replypostedat', 'replytime', 'repliedat']
  }
};

/**
 * Creates and validates a dynamic header mapping instance from a worksheet's header row.
 *
 * @param {Array<string>} headers - The raw header row array (e.g. rows[0])
 * @param {Object} options - Custom configuration options
 * @returns {Object} SheetMapper instance with lookup and row extraction methods
 */
function createHeaderMap(headers, options = {}) {
  if (!headers || !Array.isArray(headers) || headers.length === 0) {
    throw new Error('Header row is empty or not an array. Cannot establish column mapping.');
  }

  const rawHeaders = headers.map(h => (h !== null && h !== undefined ? String(h).trim() : ''));
  const normalizedHeaders = rawHeaders.map(h => normalizeHeaderName(h));

  const fieldToCol = {};       // canonicalField -> { index, letter, rawHeader }
  const indexToField = {};     // index -> canonicalField
  const unmappedColumns = [];  // indices not mapped to canonical fields
  const duplicateWarnings = [];

  // Reverse alias lookup table: normalizedAlias -> canonicalField
  const aliasToField = new Map();
  for (const [canonicalField, def] of Object.entries(CANONICAL_FIELD_DEFINITIONS)) {
    for (const alias of def.aliases) {
      if (!aliasToField.has(alias)) {
        aliasToField.set(alias, canonicalField);
      }
    }
  }

  // 1. Primary pass: Exact normalized alias match
  normalizedHeaders.forEach((normH, idx) => {
    if (!normH) {
      unmappedColumns.push({ index: idx, letter: indexToColumnLetter(idx), raw: rawHeaders[idx], reason: 'EMPTY_HEADER' });
      return;
    }

    if (aliasToField.has(normH)) {
      const canonicalField = aliasToField.get(normH);
      if (fieldToCol[canonicalField] === undefined) {
        fieldToCol[canonicalField] = {
          index: idx,
          letter: indexToColumnLetter(idx),
          rawHeader: rawHeaders[idx]
        };
        indexToField[idx] = canonicalField;
      } else {
        duplicateWarnings.push({
          canonicalField,
          existingIndex: fieldToCol[canonicalField].index,
          duplicateIndex: idx,
          rawHeader: rawHeaders[idx]
        });
      }
    } else {
      unmappedColumns.push({
        index: idx,
        letter: indexToColumnLetter(idx),
        raw: rawHeaders[idx],
        reason: 'UNRECOGNIZED_HEADER'
      });
    }
  });

  // 2. Secondary fuzzy pass for any unmapped canonical fields
  for (const [canonicalField, def] of Object.entries(CANONICAL_FIELD_DEFINITIONS)) {
    if (fieldToCol[canonicalField] !== undefined) continue;

    // Check if any unmapped column contains all primary keywords
    for (let i = 0; i < unmappedColumns.length; i++) {
      const unmapped = unmappedColumns[i];
      if (indexToField[unmapped.index] !== undefined) continue;

      const norm = normalizeHeaderName(unmapped.raw);
      if (!norm) continue;

      // Match heuristic
      const match = def.aliases.some(alias => {
        if (norm === alias) return true;
        if (alias.length >= 5 && norm.includes(alias)) return true;
        return false;
      });

      if (match) {
        fieldToCol[canonicalField] = {
          index: unmapped.index,
          letter: unmapped.letter,
          rawHeader: unmapped.raw
        };
        indexToField[unmapped.index] = canonicalField;
        unmappedColumns.splice(i, 1);
        break;
      }
    }
  }

  // 3. Validation: Check required fields
  const missingRequired = [];
  for (const [canonicalField, def] of Object.entries(CANONICAL_FIELD_DEFINITIONS)) {
    if (def.required && fieldToCol[canonicalField] === undefined) {
      missingRequired.push(canonicalField);
    }
  }

  const isReliable = missingRequired.length === 0;

  // Build the SheetMapper instance
  const mapper = {
    totalColumns: rawHeaders.length,
    rawHeaders: [...rawHeaders],
    fieldToCol,
    indexToField,
    unmappedColumns,
    duplicateWarnings,
    missingRequired,
    isReliable,

    /**
     * Check whether a canonical field is mapped
     */
    has(canonicalField) {
      return fieldToCol[canonicalField] !== undefined;
    },

    /**
     * Returns 0-based column index of a canonical field, or -1 if unmapped
     */
    getIndex(canonicalField) {
      return fieldToCol[canonicalField] !== undefined ? fieldToCol[canonicalField].index : -1;
    },

    /**
     * Returns Excel column letter (e.g. 'A', 'E', 'J') of a canonical field, or null
     */
    getLetter(canonicalField) {
      return fieldToCol[canonicalField] !== undefined ? fieldToCol[canonicalField].letter : null;
    },

    /**
     * Returns the exact raw header string found in the sheet for a canonical field
     */
    getRawHeader(canonicalField) {
      return fieldToCol[canonicalField] !== undefined ? fieldToCol[canonicalField].rawHeader : null;
    },

    /**
     * Reads a cell value from a row using dynamic header mapping
     * with format-aware row auto-recovery for misplaced values.
     */
    get(row, canonicalField, defaultVal = '') {
      if (!row || !Array.isArray(row)) return defaultVal;

      const colInfo = fieldToCol[canonicalField];
      let val = (colInfo !== undefined && row[colInfo.index] !== undefined && row[colInfo.index] !== null)
        ? String(row[colInfo.index]).trim()
        : '';

      // Validate UPPCLLKO Replied strictly to 'YES' or 'NO'
      if (canonicalField === 'uppcllko_replied') {
        const uVal = val.toUpperCase();
        if (uVal === 'YES') return 'YES';
        if (uVal === 'NO') return 'NO';
        return defaultVal;
      }

      // Intelligent Row-Level Self-Healing / Auto-Recovery:
      // If a cell is blank or format-invalid due to row misalignment, recover safely from row
      if (canonicalField === 'link_url') {
        if (!val.startsWith('http')) {
          for (let c = 0; c < row.length; c++) {
            const cell = String(row[c] || '').trim();
            if (/^https?:\/\/(?:x|twitter)\.com\/\S+/i.test(cell)) {
              return cell;
            }
          }
        }
      } else if (canonicalField === 'twitter_id') {
        if (!val || val === '@' || val.toLowerCase() === '@citizen') {
          // Try to derive from URL
          const urlVal = this.get(row, 'link_url');
          if (urlVal) {
            const match = urlVal.match(/https?:\/\/(?:x|twitter)\.com\/([^\/\?]+)/i);
            if (match && !['i', 'intent', 'status'].includes(match[1].toLowerCase())) {
              return match[1];
            }
          }
        }
      } else if (canonicalField === 'head') {
        // Valid heads are 3 letters: upl, emo, emm, ako, akm, akb, akc, upm
        const cleanHead = val.toLowerCase();
        const validHeads = new Set(['upl', 'emo', 'emm', 'ako', 'akm', 'akb', 'akc', 'upm']);
        if (!validHeads.has(cleanHead)) {
          // Look for valid head in other columns (e.g. col 6 if columns were shifted)
          for (let c = 0; c < row.length; c++) {
            const cell = String(row[c] || '').trim().toLowerCase();
            if (validHeads.has(cell)) {
              return cell;
            }
          }
        }
      } else if (canonicalField === 'post_text') {
        if (!val || val.length < 5) {
          // Look for long text in the row (e.g. col 20 or col 19 if columns were shifted)
          for (let c = row.length - 1; c >= 0; c--) {
            const cell = String(row[c] || '').trim();
            if (cell.length > 20 && !cell.startsWith('http') && !/^\d{15,25}$/.test(cell)) {
              return cell;
            }
          }
        }
      } else if (canonicalField === 'discom') {
        const cleanDiscom = val.toUpperCase();
        const validDiscoms = ['PVVNL', 'PUVVNL', 'MVVNL', 'DVVNL', 'KESCO', 'UPPCL'];
        if (!validDiscoms.some(d => cleanDiscom.includes(d))) {
          for (let c = 0; c < row.length; c++) {
            const cell = String(row[c] || '').trim().toUpperCase();
            if (validDiscoms.some(d => cell === d || cell === d + 'HQ')) {
              return cell.replace('HQ', '');
            }
          }
        }
      }

      return val || defaultVal;
    },

    /**
     * Sets a value in the row array at the derived column index
     */
    set(row, canonicalField, value) {
      if (!row || !Array.isArray(row)) return false;
      const colInfo = fieldToCol[canonicalField];
      if (colInfo === undefined) return false;
      row[colInfo.index] = value;
      return true;
    },

    /**
     * Extracts an entire normalized application record from a spreadsheet row
     */
    extractRecord(row) {
      return {
        date: this.get(row, 'date'),
        link_shift: this.get(row, 'link_shift'),
        reply_shift: this.get(row, 'reply_shift'),
        c_f: this.get(row, 'c_f'),
        reply_within_30_min: this.get(row, 'reply_within_30_min'),
        link_url: this.get(row, 'link_url'),
        twitter_id: this.get(row, 'twitter_id'),
        picked_status: this.get(row, 'picked_status'),
        head: this.get(row, 'head'),
        untagged_complaint: this.get(row, 'untagged_complaint'),
        uppcllko_replied: this.get(row, 'uppcllko_replied'),
        complaint_type: this.get(row, 'complaint_type'),
        discom: this.get(row, 'discom'),
        zone: this.get(row, 'zone'),
        district: this.get(row, 'district'),
        status: this.get(row, 'status'),
        complaint_no: this.get(row, 'complaint_no'),
        post_text: this.get(row, 'post_text'),
        post_created_at_utc: this.get(row, 'post_created_at_utc'),
        first_detected_at_ist: this.get(row, 'first_detected_at_ist'),
        language: this.get(row, 'language'),
        routing_confidence: this.get(row, 'routing_confidence'),
        draft_reply: this.get(row, 'draft_reply'),
        approval_status: this.get(row, 'approval_status'),
        reply_within_60_min: this.get(row, 'reply_within_60_min'),
        remark: this.get(row, 'remark'),
        reply_post_url: this.get(row, 'reply_post_url'),
        reply_post_id: this.get(row, 'reply_post_id'),
        reply_posted_at: this.get(row, 'reply_posted_at')
      };
    },

    /**
     * Generates a complete structured inventory of all columns for audit reporting
     */
    generateInventory() {
      const inventory = [];
      rawHeaders.forEach((rawH, idx) => {
        const canonical = indexToField[idx] || null;
        const colLetter = indexToColumnLetter(idx);
        const norm = normalizedHeaders[idx];
        const isReq = canonical ? (CANONICAL_FIELD_DEFINITIONS[canonical]?.required || false) : false;

        inventory.push({
          index: idx,
          columnLetter: colLetter,
          exactHeader: rawH,
          normalizedHeader: norm,
          canonicalField: canonical,
          required: isReq,
          verified: canonical !== null
        });
      });
      return inventory;
    }
  };

  return mapper;
}

module.exports = {
  normalizeHeaderName,
  indexToColumnLetter,
  columnLetterToIndex,
  CANONICAL_FIELD_DEFINITIONS,
  createHeaderMap
};
