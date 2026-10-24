/**
 * UPPCL Grievance Command Centre - Intelligent Classification & District Routing Engine
 * Handles bilingual (Hindi + English + Hinglish) grievance analysis,
 * authoritative district-to-DISCOM resolution, priority assignment, and SLA targets.
 */

// Authoritative Canonical Mapping (All 75 Districts of Uttar Pradesh)
const CANONICAL_DISTRICTS = {
  // PUVVNL (Purvanchal Vidyut Vitran Nigam Ltd - HQ: Varanasi)
  'VARANASI': { name: 'Varanasi', discom: 'PUVVNL' },
  'PRAYAGRAJ': { name: 'Prayagraj', discom: 'PUVVNL' },
  'GORAKHPUR': { name: 'Gorakhpur', discom: 'PUVVNL' },
  'AZAMGARH': { name: 'Azamgarh', discom: 'PUVVNL' },
  'JAUNPUR': { name: 'Jaunpur', discom: 'PUVVNL' },
  'GHAZIPUR': { name: 'Ghazipur', discom: 'PUVVNL' },
  'CHANDAULI': { name: 'Chandauli', discom: 'PUVVNL' },
  'BALLIA': { name: 'Ballia', discom: 'PUVVNL' },
  'MAU': { name: 'Mau', discom: 'PUVVNL' },
  'DEORIA': { name: 'Deoria', discom: 'PUVVNL' },
  'KUSHINAGAR': { name: 'Kushinagar', discom: 'PUVVNL' },
  'MAHARAJGANJ': { name: 'Maharajganj', discom: 'PUVVNL' },
  'BASTI': { name: 'Basti', discom: 'PUVVNL' },
  'SANT KABIR NAGAR': { name: 'Sant Kabir Nagar', discom: 'PUVVNL' },
  'SIDDHARTHNAGAR': { name: 'Siddharthnagar', discom: 'PUVVNL' },
  'MIRZAPUR': { name: 'Mirzapur', discom: 'PUVVNL' },
  'SONBHADRA': { name: 'Sonbhadra', discom: 'PUVVNL' },
  'BHADOHI': { name: 'Bhadohi', discom: 'PUVVNL' },
  'PRATAPGARH': { name: 'Pratapgarh', discom: 'PUVVNL' },
  'KAUSHAMBI': { name: 'Kaushambi', discom: 'PUVVNL' },
  'FATEHPUR': { name: 'Fatehpur', discom: 'PUVVNL' },

  // MVVNL (Madhyanchal Vidyut Vitran Nigam Ltd - HQ: Lucknow)
  'LUCKNOW': { name: 'Lucknow', discom: 'MVVNL' },
  'AYODHYA': { name: 'Ayodhya', discom: 'MVVNL' },
  'BAREILLY': { name: 'Bareilly', discom: 'MVVNL' },
  'SITAPUR': { name: 'Sitapur', discom: 'MVVNL' },
  'HARDOI': { name: 'Hardoi', discom: 'MVVNL' },
  'UNNAO': { name: 'Unnao', discom: 'MVVNL' },
  'LAKHIMPUR KHERI': { name: 'Lakhimpur Kheri', discom: 'MVVNL' },
  'RAE BARELI': { name: 'Rae Bareli', discom: 'MVVNL' },
  'BARABANKI': { name: 'Barabanki', discom: 'MVVNL' },
  'AMETHI': { name: 'Amethi', discom: 'MVVNL' },
  'SULTANPUR': { name: 'Sultanpur', discom: 'MVVNL' },
  'AMBEDKAR NAGAR': { name: 'Ambedkar Nagar', discom: 'MVVNL' },
  'GONDA': { name: 'Gonda', discom: 'MVVNL' },
  'BAHRAICH': { name: 'Bahraich', discom: 'MVVNL' },
  'BALRAMPUR': { name: 'Balrampur', discom: 'MVVNL' },
  'SHRAVASTI': { name: 'Shravasti', discom: 'MVVNL' },
  'BADAUN': { name: 'Badaun', discom: 'MVVNL' },
  'PILIBHIT': { name: 'Pilibhit', discom: 'MVVNL' },
  'SHAHJAHANPUR': { name: 'Shahjahanpur', discom: 'MVVNL' },

  // DVVNL (Dakshinanchal Vidyut Vitran Nigam Ltd - HQ: Agra)
  'AGRA': { name: 'Agra', discom: 'DVVNL' },
  'ALIGARH': { name: 'Aligarh', discom: 'DVVNL' },
  'MATHURA': { name: 'Mathura', discom: 'DVVNL' },
  'FIROZABAD': { name: 'Firozabad', discom: 'DVVNL' },
  'MAINPURI': { name: 'Mainpuri', discom: 'DVVNL' },
  'ETAWAH': { name: 'Etawah', discom: 'DVVNL' },
  'FARRAKHABAD': { name: 'Farrukhabad', discom: 'DVVNL' },
  'KANNAUJ': { name: 'Kannauj', discom: 'DVVNL' },
  'AURAIYA': { name: 'Auraiya', discom: 'DVVNL' },
  'ETAH': { name: 'Etah', discom: 'DVVNL' },
  'HATHRAS': { name: 'Hathras', discom: 'DVVNL' },
  'KASGANJ': { name: 'Kasganj', discom: 'DVVNL' },
  'JHANSI': { name: 'Jhansi', discom: 'DVVNL' },
  'LALITPUR': { name: 'Lalitpur', discom: 'DVVNL' },
  'JALAUN': { name: 'Jalaun', discom: 'DVVNL' },
  'BANDA': { name: 'Banda', discom: 'DVVNL' },
  'CHITRAKOOT': { name: 'Chitrakoot', discom: 'DVVNL' },
  'HAMIRPUR': { name: 'Hamirpur', discom: 'DVVNL' },
  'MAHOBA': { name: 'Mahoba', discom: 'DVVNL' },
  'KANPUR DEHAT': { name: 'Kanpur Dehat', discom: 'DVVNL' },

  // PVVNL (Pashchimanchal Vidyut Vitran Nigam Ltd - HQ: Meerut)
  'MEERUT': { name: 'Meerut', discom: 'PVVNL' },
  'GAUTAM BUDDHA NAGAR': { name: 'Gautam Buddha Nagar', discom: 'PVVNL' },
  'GHAZIABAD': { name: 'Ghaziabad', discom: 'PVVNL' },
  'BULANDSHAHR': { name: 'Bulandshahr', discom: 'PVVNL' },
  'HAPUR': { name: 'Hapur', discom: 'PVVNL' },
  'BAGHPAT': { name: 'Baghpat', discom: 'PVVNL' },
  'SAHARANPUR': { name: 'Saharanpur', discom: 'PVVNL' },
  'MUZAFFARNAGAR': { name: 'Muzaffarnagar', discom: 'PVVNL' },
  'SHAMLI': { name: 'Shamli', discom: 'PVVNL' },
  'MORADABAD': { name: 'Moradabad', discom: 'PVVNL' },
  'BIJNOR': { name: 'Bijnor', discom: 'PVVNL' },
  'RAMPUR': { name: 'Rampur', discom: 'PVVNL' },
  'AMROHA': { name: 'Amroha', discom: 'PVVNL' },
  'SAMBHAL': { name: 'Sambhal', discom: 'PVVNL' },

  // KESCo (Kanpur Electricity Supply Company - HQ: Kanpur)
  'KANPUR NAGAR': { name: 'Kanpur Nagar', discom: 'KESCo' }
};

// Plain lookup map for backward compatibility
const DISTRICT_DISCOM_MAP = {};
for (const [key, val] of Object.entries(CANONICAL_DISTRICTS)) {
  DISTRICT_DISCOM_MAP[key] = val.discom;
}
DISTRICT_DISCOM_MAP['KANPUR'] = 'KESCo';

// Common District Synonyms, Abbreviations, and Devanagari Hindi Aliases
const DISTRICT_ALIASES = {
  // English / Hinglish Aliases
  'NOIDA': 'GAUTAM BUDDHA NAGAR',
  'GREATER NOIDA': 'GAUTAM BUDDHA NAGAR',
  'GB NAGAR': 'GAUTAM BUDDHA NAGAR',
  'G B NAGAR': 'GAUTAM BUDDHA NAGAR',
  'BANARAS': 'VARANASI',
  'KASHI': 'VARANASI',
  'ALLAHABAD': 'PRAYAGRAJ',
  'ILAHABAD': 'PRAYAGRAJ',
  'FAIZABAD': 'AYODHYA',
  'KANPUR': 'KANPUR NAGAR',
  'KANPUR CITY': 'KANPUR NAGAR',
  'KANPUR URBAN': 'KANPUR NAGAR',
  'KHERI': 'LAKHIMPUR KHERI',
  'LAKHIMPUR': 'LAKHIMPUR KHERI',
  'KASHI NAGAR': 'KUSHINAGAR',
  'SANT RAVIDAS NAGAR': 'BHADOHI',
  'FARUKHABAD': 'FARRAKHABAD',

  // Devanagari Hindi Aliases
  'वाराणसी': 'VARANASI',
  'बनारस': 'VARANASI',
  'काशी': 'VARANASI',
  'लखनऊ': 'LUCKNOW',
  'लखनउ': 'LUCKNOW',
  'आगरा': 'AGRA',
  'कानपुर': 'KANPUR NAGAR',
  'नोएडा': 'GAUTAM BUDDHA NAGAR',
  'ग्रेटर नोएडा': 'GAUTAM BUDDHA NAGAR',
  'गौतम बुद्ध नगर': 'GAUTAM BUDDHA NAGAR',
  'प्रयागराज': 'PRAYAGRAJ',
  'इलाहाबाद': 'PRAYAGRAJ',
  'गोरखपुर': 'GORAKHPUR',
  'मेरठ': 'MEERUT',
  'गाजियाबाद': 'GHAZIABAD',
  'बरेली': 'BAREILLY',
  'अयोध्या': 'AYODHYA',
  'फैजाबाद': 'AYODHYA',
  'झांसी': 'JHANSI',
  'अलीगढ़': 'ALIGARH',
  'मथुरा': 'MATHURA',
  'सहारनपुर': 'SAHARANPUR',
  'मुरादाबाद': 'MORADABAD',
  'मुजफ्फरनगर': 'MUZAFFARNAGAR',
  'मिर्जापुर': 'MIRZAPUR',
  'जौनपुर': 'JAUNPUR',
  'गाजीपुर': 'GHAZIPUR',
  'बलिया': 'BALLIA',
  'बस्ती': 'BASTI',
  'देवरिया': 'DEORIA',
  'उन्नाव': 'UNNAO',
  'सीतापुर': 'SITAPUR',
  'हरदोई': 'HARDOI',
  'बांदा': 'BANDA',
  'इटावा': 'ETAWAH',
  'फिरोजाबाद': 'FIROZABAD',
  'हाथरस': 'HATHRAS',
  'बुलंदशहर': 'BULANDSHAHR',
  'हापुड़': 'HAPUR',
  'बागपत': 'BAGHPAT',
  'शामली': 'SHAMLI',
  'बिजनौर': 'BIJNOR',
  'रामपुर': 'RAMPUR',
  'संभल': 'SAMBHAL',
  'अमरोहा': 'AMROHA',
  'गोंडा': 'GONDA',
  'बहराइच': 'BAHRAICH',
  'बलरामपुर': 'BALRAMPUR',
  'श्रावस्ती': 'SHRAVASTI',
  'बदायूं': 'BADAUN',
  'पीलीभीत': 'PILIBHIT',
  'शाहजहांपुर': 'SHAHJAHANPUR',
  'रायबरेली': 'RAE BARELI',
  'बाराबंकी': 'BARABANKI',
  'अमेठी': 'AMETHI',
  'सुल्तानपुर': 'SULTANPUR',
  'अम्बेडकर नगर': 'AMBEDKAR NAGAR',
  'फतेहपुर': 'FATEHPUR',
  'प्रतापगढ़': 'PRATAPGARH',
  'कौशाम्बी': 'KAUSHAMBI',
  'सोनभद्र': 'SONBHADRA',
  'भदोही': 'BHADOHI',
  'ललितपुर': 'LALITPUR',
  'जालौन': 'JALAUN',
  'चित्रकूट': 'CHITRAKOOT',
  'हमीरपुर': 'HAMIRPUR',
  'महोबा': 'MAHOBA',
  'मैनपुरी': 'MAINPURI',
  'कन्नौज': 'KANNAUJ',
  'औरैया': 'AURAIYA',
  'एटा': 'ETAH',
  'कासगंज': 'KASGANJ',
  'फर्रुखाबाद': 'FARRAKHABAD',
  'महाराजगंज': 'MAHARAJGANJ',
  'कुशीनगर': 'KUSHINAGAR',
  'सिद्धार्थनगर': 'SIDDHARTHNAGAR',
  'संत कबीर नगर': 'SANT KABIR NAGAR',
  'मऊ': 'MAU',
  'चंदौली': 'CHANDAULI'
};

// Handle to District Mapping (from official 90 X hierarchy)
const HANDLE_DISTRICT_MAP = {
  '@puvvnlvaranasi': 'VARANASI',
  '@puvvnlprayagraj': 'PRAYAGRAJ',
  '@puvvnlgorakhpur': 'GORAKHPUR',
  '@puvvnlazamgarh': 'AZAMGARH',
  '@puvvnlmirzapur': 'MIRZAPUR',
  '@puvvnlbasti': 'BASTI',
  '@puvvnljaunpur': 'JAUNPUR',
  '@puvvnlghazipur': 'GHAZIPUR',
  '@puvvnlballia': 'BALLIA',
  '@puvvnldeoria': 'DEORIA',
  '@puvvnlkushinagar': 'KUSHINAGAR',
  '@mvvnllucknow': 'LUCKNOW',
  '@mvvnlayodhya': 'AYODHYA',
  '@mvvnlbareilly': 'BAREILLY',
  '@mvvnlsitapur': 'SITAPUR',
  '@mvvnlhardoi': 'HARDOI',
  '@mvvnlunnao': 'UNNAO',
  '@mvvnlgonda': 'GONDA',
  '@mvvnlbahraich': 'BAHRAICH',
  '@dvvnlagra': 'AGRA',
  '@dvvnlaligarh': 'ALIGARH',
  '@dvvnlmathura': 'MATHURA',
  '@dvvnljhansi': 'JHANSI',
  '@dvvnlfirozabad': 'FIROZABAD',
  '@dvvnlbanda': 'BANDA',
  '@dvvnletawah': 'ETAWAH',
  '@pvvnlmeerut': 'MEERUT',
  '@pvvnlnoida': 'GAUTAM BUDDHA NAGAR',
  '@pvvnlghaziabad': 'GHAZIABAD',
  '@pvvnlmoradabad': 'MORADABAD',
  '@pvvnlmuzaffarnagar': 'MUZAFFARNAGAR',
  '@pvvnlsaharanpur': 'SAHARANPUR',
  '@pvvnlbulandshahr': 'BULANDSHAHR',
  '@kescoheadquarter': 'KANPUR NAGAR'
};

// Categorization Keywords (Bilingual: English + Hindi Devanagari + Romanized Hinglish)
const CATEGORY_RULES = [
  {
    category: 'Transformer Failure / Burnt',
    priority: 'Critical',
    sla_hours: 24,
    keywords: [
      'transformer', 'ट्रांसफार्मर', 'ट्रांसफॉर्मर', 'tf', 'dtr', 'dp blast',
      'blast', 'धमाका', 'smoke', 'dhuan', 'धुआं', 'transformer burnt',
      'transformer fuk', 'fuk gaya', 'फुंक गया', 'oil leakage', 'transformer repair',
      'burnt transformer', 'replace transformer'
    ]
  },
  {
    category: 'Safety Hazard & Electricity Theft',
    priority: 'Critical',
    sla_hours: 24,
    keywords: [
      'fire', 'aag', 'आग', 'spark', 'sparking', 'chingari', 'चिंगारी',
      'live wire', 'wire broken', 'taar toot', 'तार टूट', 'toota taar',
      'pole gir', 'pole fall', 'pole broken', 'खंभा', 'current', 'करंट',
      'electrocution', 'accident', 'short circuit', 'theft', 'chori', 'चोरी',
      'katiya', 'कटिया', 'illegal connection', 'safety hazard', 'danger', 'खतरा'
    ]
  },
  {
    category: 'Power Supply Failure / Outage',
    priority: 'High',
    sla_hours: 48,
    keywords: [
      'outage', 'power cut', 'no power', 'no light', 'light nahi', 'लाइट नहीं',
      'बिजली नहीं', 'bijli nahi', 'bijli gul', 'बिजली गुल', 'blackout', 'अंधेरा',
      'andhera', 'tripping', 'load shedding', 'supply off', 'power failure',
      'line fault', 'phase missing', 'single phase', 'light chali gayi',
      'no electricity', 'cutoff', 'cut off', 'breakdown', 'shuddown', 'shutdown'
    ]
  },
  {
    category: 'Voltage Issues',
    priority: 'High',
    sla_hours: 48,
    keywords: [
      'low voltage', 'लो वोल्टेज', 'high voltage', 'हाई वोल्टेज', 'dim light',
      'voltage', 'वोल्टेज', 'fluctuation', 'dim bulb', 'motor not running',
      'voltage drop', 'overvoltage', 'undervoltage', 'surging'
    ]
  },
  {
    category: 'Billing & Payment',
    priority: 'Normal',
    sla_hours: 72,
    keywords: [
      'bill', 'बिल', 'extra bill', 'high bill', 'wrong bill', 'overcharge',
      'payment', 'भुगतान', 'receipt', 'recharge', 'smart meter recharge',
      'bill correction', 'billing issue', 'surcharge', 'late fee', 'due date',
      'disconnection notice', 'ledger', 'balance'
    ]
  },
  {
    category: 'Meter Related',
    priority: 'Normal',
    sla_hours: 72,
    keywords: [
      'meter', 'मीटर', 'meter kharab', 'meter fast', 'meter slow',
      'meter reading', 'reading wrong', 'meter display', 'meter burnt',
      'meter change', 'defective meter', 'smart meter', 'mru', 'check meter'
    ]
  },
  {
    category: 'New Connection',
    priority: 'Low',
    sla_hours: 96,
    keywords: [
      'new connection', 'नया कनेक्शन', 'connection apply', 'jhatpat', 'झटपट',
      'load increase', 'load reduction', 'name change', 'meter shifting',
      'feasibility', 'estimate', 'demand note', 'connection pending'
    ]
  },
  {
    category: 'Staff Conduct',
    priority: 'Low',
    sla_hours: 96,
    keywords: [
      'bribe', 'rishwat', 'रिश्वत', 'corrupt', 'misbehave', 'staff conduct',
      'lineman rude', 'je not picking', 'sdo not available', '1912 no answer',
      'helpline no response', 'complaint ignored', 'negligence'
    ]
  }
];

function testTermInText(term, text) {
  if (!term || !text) return false;
  // If term has non-ASCII characters (Devanagari Hindi)
  if (/[^\x00-\x7F]/.test(term)) {
    return text.includes(term);
  }
  const regex = new RegExp(`\\b${term}\\b`, 'i');
  return regex.test(text);
}

class Classifier {
  /**
   * Classify text into category, priority, and SLA
   */
  static classifyCategory(text) {
    if (!text || typeof text !== 'string') {
      return {
        category: 'Service Quality',
        category_name: 'Service Quality',
        priority: 'Normal',
        sla_hours: 72,
        confidence: 0.5
      };
    }

    const lower = text.toLowerCase();

    for (const rule of CATEGORY_RULES) {
      for (const kw of rule.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          return {
            category: rule.category,
            category_name: rule.category,
            priority: rule.priority,
            sla_hours: rule.sla_hours,
            matched_keyword: kw,
            confidence: 0.95
          };
        }
      }
    }

    return {
      category: 'Service Quality',
      category_name: 'Service Quality',
      priority: 'Normal',
      sla_hours: 72,
      confidence: 0.6
    };
  }

  /**
   * Extract District and assign DISCOM from text, consumer bio, or tagged handle
   */
  static extractDistrictAndDiscom(text, monitoredAccount = '') {
    const raw = (text || '') + ' ' + (monitoredAccount || '');

    // 1. Check tagged handle first (Highest precision)
    if (monitoredAccount) {
      const handleLower = monitoredAccount.toLowerCase();
      if (HANDLE_DISTRICT_MAP[handleLower]) {
        const canonicalKey = HANDLE_DISTRICT_MAP[handleLower];
        const canon = CANONICAL_DISTRICTS[canonicalKey];
        return {
          district_name: canon ? canon.name : canonicalKey,
          discom_name: canon ? canon.discom : (DISTRICT_DISCOM_MAP[canonicalKey] || 'PUVVNL'),
          source: 'handle_match',
          confidence: 0.99
        };
      }
    }

    // 2. Check for Alias Variations (both Hindi & English)
    for (const [alias, canonicalKey] of Object.entries(DISTRICT_ALIASES)) {
      if (testTermInText(alias, raw)) {
        const canon = CANONICAL_DISTRICTS[canonicalKey];
        return {
          district_name: canon ? canon.name : canonicalKey,
          discom_name: canon ? canon.discom : (DISTRICT_DISCOM_MAP[canonicalKey] || 'PUVVNL'),
          source: 'alias_match',
          confidence: 0.92
        };
      }
    }

    // 3. Check for Canonical District Names
    for (const [canonicalKey, canon] of Object.entries(CANONICAL_DISTRICTS)) {
      if (testTermInText(canonicalKey, raw) || testTermInText(canon.name, raw)) {
        return {
          district_name: canon.name,
          discom_name: canon.discom,
          source: 'text_match',
          confidence: 0.90
        };
      }
    }

    // 4. Ambiguous / Low confidence -> Route to "Unassigned / Needs Review" queue
    return {
      district_name: 'Unassigned',
      discom_name: 'UPPCL HQ / Unassigned',
      source: 'unresolved',
      confidence: 0.30
    };
  }

  /**
   * Extract Consumer Account or Phone Number if present in text
   */
  static extractConsumerDetails(text) {
    let accountNo = null;
    let mobile = null;

    if (!text) return { accountNo, mobile };

    // UPPCL 10 or 12 digit connection / account numbers
    const acctMatch = text.match(/\b([1-9]\d{9}|[1-9]\d{11})\b/);
    if (acctMatch) {
      accountNo = acctMatch[1];
    }

    // 10 digit Indian mobile numbers (starts with 6, 7, 8, or 9)
    const mobMatch = text.match(/\b([6-9]\d{9})\b/);
    if (mobMatch) {
      mobile = mobMatch[1];
    }

    return { accountNo, mobile };
  }

  static extractAccountNumber(text) {
    return this.extractConsumerDetails(text).accountNo;
  }

  static extractMobileNumber(text) {
    return this.extractConsumerDetails(text).mobile;
  }

  static resolveDistrictAndDiscom(text, monitoredAccount = '') {
    const res = this.extractDistrictAndDiscom(text, monitoredAccount);
    return {
      district: res.district_name,
      discom: res.discom_name,
      district_name: res.district_name,
      discom_name: res.discom_name,
      confidence: res.confidence < 0.5 ? 'LOW' : 'HIGH',
      source: res.source
    };
  }

  /**
   * Sanitize untrusted post content to avoid command injection or script execution
   */
  static sanitizeText(text) {
    if (!text) return '';
    return text
      .replace(/<[^>]*>?/gm, '') // Strip HTML tags
      .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '') // Strip control chars
      .trim();
  }

  /**
   * Run full classification pipeline on an incoming post
   */
  static processIncomingPost(post) {
    const cleanText = this.sanitizeText(post.text || '');
    const cat = this.classifyCategory(cleanText);
    const geo = this.extractDistrictAndDiscom(cleanText, post.matched_handle || '');
    const meta = this.extractConsumerDetails(cleanText);

    return {
      clean_text: cleanText,
      category_name: cat.category_name,
      priority: cat.priority,
      sla_hours: cat.sla_hours,
      district_name: geo.district_name,
      discom_name: geo.discom_name,
      confidence: Math.min(cat.confidence, geo.confidence),
      consumer_account_no: meta.accountNo,
      consumer_mobile: meta.mobile,
      is_unassigned: geo.district_name === 'Unassigned'
    };
  }
}

Classifier.Classifier = Classifier;
Classifier.CANONICAL_DISTRICTS = CANONICAL_DISTRICTS;
Classifier.DISTRICT_DISCOM_MAP = DISTRICT_DISCOM_MAP;
Classifier.DISTRICT_ALIASES = DISTRICT_ALIASES;
Classifier.HANDLE_DISTRICT_MAP = HANDLE_DISTRICT_MAP;
Classifier.CATEGORY_RULES = CATEGORY_RULES;

module.exports = Classifier;
