const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'uppcl_smc.db');

let dbInstance = null;
let SQL = null;
let saveTimeout = null;

function getDbInstance() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

function saveToDiskSync() {
  if (!dbInstance) return;
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error saving SQLite DB to disk:', err);
  }
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveToDiskSync();
  }, 100);
}

async function initDb() {
  if (dbInstance) return dbInstance;
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(fileBuffer);
      console.log('Loaded existing database from:', DB_PATH);
    } catch (e) {
      console.warn('Failed to load existing DB file, creating a fresh one:', e.message);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
    console.log('Created fresh SQLite database in memory');
  }

  // Create tables and schema
  createSchema();
  saveToDiskSync();
  return dbInstance;
}

function createSchema() {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL,
      discom_name TEXT,
      designation TEXT,
      mobile TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS discoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      headquarters TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      discom_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS social_platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS x_hierarchy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sr_no TEXT,
      hierarchy_level TEXT NOT NULL,
      discom_name TEXT,
      district_name TEXT,
      handle_name TEXT NOT NULL,
      account_url TEXT NOT NULL,
      parent_handle TEXT,
      is_monitored INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      remarks TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS facebook_handles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sr_no TEXT,
      discom_name TEXT,
      district_name TEXT,
      fb_handle_name TEXT,
      fb_url TEXT,
      is_monitored INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS nodal_officers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discom_name TEXT NOT NULL,
      district_name TEXT NOT NULL,
      officer_name TEXT,
      designation TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT,
      twitter_handle TEXT,
      facebook_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS jurisdiction_org (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discom_name TEXT NOT NULL,
      zone_name TEXT NOT NULL,
      circle_name TEXT,
      division_name TEXT,
      officer_name TEXT,
      mobile TEXT
    );

    CREATE TABLE IF NOT EXISTS complaint_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT,
      sla_hours INTEGER DEFAULT 48,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS complaint_subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_no TEXT UNIQUE NOT NULL,
      received_at TEXT NOT NULL,
      platform TEXT NOT NULL,
      monitored_account TEXT NOT NULL,
      hierarchy_handle_id INTEGER,
      hierarchy_handle_name TEXT,
      is_tagged INTEGER DEFAULT 1,
      consumer_name TEXT,
      consumer_handle TEXT,
      consumer_profile_url TEXT,
      post_url TEXT,
      complaint_text TEXT NOT NULL,
      category_name TEXT NOT NULL,
      subcategory_name TEXT,
      discom_name TEXT NOT NULL,
      district_name TEXT,
      zone_name TEXT,
      circle_name TEXT,
      division_name TEXT,
      subdivision_name TEXT,
      consumer_account_no TEXT,
      consumer_mobile TEXT,
      priority TEXT NOT NULL DEFAULT 'Normal',
      current_status TEXT NOT NULL DEFAULT 'New',
      assigned_operator_id INTEGER,
      assigned_operator_name TEXT,
      assigned_nodal_officer_id INTEGER,
      assigned_nodal_officer_name TEXT,
      assigned_nodal_officer_mobile TEXT,
      forwarding_date TEXT,
      forwarding_channel TEXT,
      forwarding_ref_no TEXT,
      forwarding_remarks TEXT,
      expected_response_date TEXT,
      is_overdue INTEGER DEFAULT 0,
      escalation_level INTEGER DEFAULT 0,
      escalation_reason TEXT,
      discom_response_date TEXT,
      discom_action_taken TEXT,
      discom_evidence_url TEXT,
      discom_reported_by TEXT,
      closure_date TEXT,
      closure_verified_by TEXT,
      closure_verification_notes TEXT,
      closure_satisfaction_status TEXT,
      duplicate_of_complaint_id INTEGER,
      invalid_reason TEXT,
      reopen_reason TEXT,
      last_action_date TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaint_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      remarks TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaint_forwarding_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      forwarded_by TEXT NOT NULL,
      forwarded_to_officer TEXT NOT NULL,
      discom_name TEXT NOT NULL,
      district_name TEXT,
      channel TEXT NOT NULL,
      ref_no TEXT,
      remarks TEXT,
      expected_response_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaint_followup_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      followed_up_by TEXT NOT NULL,
      officer_contacted TEXT NOT NULL,
      channel TEXT NOT NULL,
      remarks TEXT NOT NULL,
      next_followup_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaint_escalation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      escalated_by TEXT NOT NULL,
      escalation_level INTEGER NOT NULL,
      escalated_to TEXT NOT NULL,
      reason TEXT NOT NULL,
      remarks TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaint_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      uploaded_by TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reply_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category_name TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'acknowledgement',
      language TEXT NOT NULL DEFAULT 'en',
      body TEXT NOT NULL,
      variables_json TEXT,
      version INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forwarding_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category_name TEXT,
      template_text TEXT NOT NULL,
      priority TEXT DEFAULT 'Normal',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      complaint_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'system',
      link_url TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS internal_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      user_role TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Normal',
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      resolver_name TEXT,
      resolution_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS x_incoming_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT UNIQUE NOT NULL,
      conversation_id TEXT,
      author_id TEXT,
      author_username TEXT,
      author_name TEXT,
      post_text TEXT NOT NULL,
      post_url TEXT,
      created_at_x TEXT,
      ingested_at TEXT NOT NULL,
      matched_handle TEXT,
      classification_category TEXT,
      classification_district TEXT,
      classification_discom TEXT,
      classification_confidence REAL DEFAULT 1.0,
      complaint_id INTEGER,
      status TEXT NOT NULL DEFAULT 'Ingested'
    );

    CREATE TABLE IF NOT EXISTS x_outgoing_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      in_reply_to_post_id TEXT NOT NULL,
      template_id INTEGER,
      reply_text TEXT NOT NULL,
      automation_mode TEXT NOT NULL DEFAULT 'Draft and Review',
      status TEXT NOT NULL DEFAULT 'Pending',
      x_reply_id TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      next_retry_at TEXT,
      sent_by_user_id INTEGER,
      sent_by_username TEXT,
      created_at TEXT NOT NULL,
      published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS worker_heartbeats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_name TEXT NOT NULL UNIQUE,
      last_heartbeat TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Healthy',
      metadata_json TEXT
    );

        CREATE TABLE IF NOT EXISTS complaint_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      conversation_id TEXT,
      reply_tweet_id TEXT UNIQUE,
      author_handle TEXT NOT NULL,
      author_name TEXT,
      author_id TEXT,
      reply_text TEXT,
      is_uppcl_reply INTEGER DEFAULT 0,
      is_discom_reply INTEGER DEFAULT 0,
      replied_at TEXT,
      verified_source TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cr_comp_id ON complaint_replies(complaint_id);
    CREATE INDEX IF NOT EXISTS idx_cr_author ON complaint_replies(author_handle);
    CREATE INDEX IF NOT EXISTS idx_cr_is_uppcl ON complaint_replies(complaint_id, is_uppcl_reply);
    CREATE INDEX IF NOT EXISTS idx_cr_tweet_id ON complaint_replies(reply_tweet_id);

    CREATE TABLE IF NOT EXISTS frivolous_complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_url TEXT UNIQUE,
      tweet_id TEXT,
      complaint_no TEXT,
      deleted_at TEXT NOT NULL,
      deleted_by_name TEXT,
      reason TEXT DEFAULT 'Marked as Frivolous'
    );

    CREATE INDEX IF NOT EXISTS idx_frivolous_tid ON frivolous_complaints(tweet_id);
    CREATE INDEX IF NOT EXISTS idx_frivolous_url ON frivolous_complaints(post_url);

    CREATE INDEX IF NOT EXISTS idx_comp_status ON complaints(current_status);
    CREATE INDEX IF NOT EXISTS idx_comp_discom ON complaints(discom_name);
    CREATE INDEX IF NOT EXISTS idx_comp_district ON complaints(district_name);
    CREATE INDEX IF NOT EXISTS idx_comp_priority ON complaints(priority);
    CREATE INDEX IF NOT EXISTS idx_comp_rec_at ON complaints(received_at);
    CREATE INDEX IF NOT EXISTS idx_comp_post_url ON complaints(post_url);
    CREATE INDEX IF NOT EXISTS idx_timeline_comp ON complaint_timeline(complaint_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_x_post_id ON x_incoming_posts(post_id);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_ticket_status ON internal_tickets(status);
  `;
  dbInstance.run(schemaSql);

  // Safe migrations for existing tables
  tryAddColumn('users', 'assigned_districts TEXT');
  tryAddColumn('complaints', 'original_post_id TEXT');
  tryAddColumn('complaints', 'conversation_id TEXT');
  tryAddColumn('complaints', 'author_id TEXT');
  tryAddColumn('complaints', 'reply_draft TEXT');
  tryAddColumn('complaints', 'reply_status TEXT DEFAULT "None"');
  tryAddColumn('complaints', 'published_reply_id TEXT');
  tryAddColumn('complaints', 'first_acknowledged_at TEXT');
  tryAddColumn('complaints', 'assigned_at TEXT');
  tryAddColumn('complaints', 'uppcl_replied INTEGER DEFAULT 0');
  tryAddColumn('complaints', 'reply_evidence TEXT');
  tryAddColumn('complaints', 'first_replied_at TEXT');
  tryAddColumn('complaints', 'discom_tagged_in_reply TEXT');
  tryAddColumn('complaints', 'has_historical_reply INTEGER DEFAULT 0');
  tryAddColumn('complaints', 'discom_replied INTEGER DEFAULT 0');
  tryAddColumn('complaints', 'discom_reply_evidence TEXT');
  tryAddColumn('complaints', 'last_reply_author TEXT');
  tryAddColumn('complaints', 'uppcllko_replied TEXT DEFAULT NULL');
  tryAddColumn('complaints', 'uppcllko_replied_verified_at TEXT DEFAULT NULL');
  tryAddColumn('complaints', 'post_created_at_utc TEXT');
  tryAddColumn('complaints', 'first_detected_at_ist TEXT');
  tryAddColumn('complaints', 'language TEXT');
  tryAddColumn('complaints', 'routing_confidence TEXT');

  // Pre-load verified historical replies from data/verified_replies_seed.json
  try {
    const repliesSeedFile = path.join(__dirname, 'data', 'verified_replies_seed.json');
    if (fs.existsSync(repliesSeedFile)) {
      const existingCount = dbInstance.exec("SELECT COUNT(*) FROM complaint_replies;")[0]?.values[0][0] || 0;
      if (existingCount < 500) {
        const seedReplies = JSON.parse(fs.readFileSync(repliesSeedFile, 'utf8'));
        if (Array.isArray(seedReplies) && seedReplies.length > 0) {
          for (const r of seedReplies) {
            dbInstance.run(`
              INSERT OR IGNORE INTO complaint_replies
              (complaint_id, conversation_id, reply_tweet_id, author_handle, author_name, author_id, reply_text, is_uppcl_reply, is_discom_reply, replied_at, verified_source, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `, [
              r.complaint_id,
              r.conversation_id,
              r.reply_tweet_id,
              r.author_handle,
              r.author_name,
              r.author_id,
              r.reply_text,
              r.is_uppcl_reply || 0,
              r.is_discom_reply || 0,
              r.replied_at,
              r.verified_source || 'SEED_VERIFIED',
              r.created_at || new Date().toISOString()
            ]);
          }
        }
      }
    }
  } catch (sErr) {
    console.warn('Verified replies seed error:', sErr.message);
  }

  // Ensure authoritative @qowi23 complaint exists
  try {
    const qowiCount = dbInstance.exec("SELECT COUNT(*) FROM complaints WHERE post_url LIKE '%2112543129006170200%';")[0]?.values[0][0] || 0;
    if (qowiCount === 0) {
      dbInstance.run(`
        INSERT OR IGNORE INTO complaints
        (id, complaint_no, received_at, platform, monitored_account, is_tagged,
         consumer_name, consumer_handle, post_url, complaint_text, category_name, subcategory_name, discom_name,
         district_name, zone_name, priority, current_status, has_historical_reply, uppcl_replied, uppcllko_replied,
         reply_evidence, first_replied_at, target_mentions, reply_within_30_min, original_post_id, conversation_id,
         created_at, updated_at)
        VALUES
        (33343, 'UPPCL-SMC-202610-3343', '2026-10-20 19:25:05', 'Twitter/X', '@UPPCLLKO', 1,
         'Qowi', '@qowi23', 'https://x.com/qowi23/status/2112543129006170200', 'Power outage complaint @UPPCLLKO @PuVVNLHQ',
         'SUPPLY_OUTAGE', 'SUPPLY_OUTAGE', 'PuVVNL', 'Varanasi', 'Varanasi Zone', 'Normal', 'Assigned to DISCOM',
         1, 1, 'YES', 'Verified historical @UPPCLLKO reply in thread (Tweet ID: 2112607433881428114)',
         '2026-10-20 23:40:37', '["@UPPCLLKO"]', 'NO', '2112543129006170200', '2112543129006170200',
         '2026-10-20 19:25:05', '2026-10-20 19:25:05');
      `);
    }
  } catch (qErr) {
    console.warn('Qowi seed error:', qErr.message);
  }

  // Ensure conversation_id and original_post_id are extracted from post_url
  try {
    const compRows = dbInstance.exec("SELECT id, post_url FROM complaints WHERE (conversation_id IS NULL OR conversation_id = '') AND post_url IS NOT NULL;");
    if (compRows.length && compRows[0].values) {
      for (const [id, url] of compRows[0].values) {
        const m = (url || '').match(/status\/(\d+)/i);
        if (m) {
          dbInstance.run("UPDATE complaints SET conversation_id = ?, original_post_id = ? WHERE id = ?;", [m[1], m[1], id]);
        }
      }
    }
  } catch (e) {}

  try {
    // Authoritative Historical UPPCLLKO Reply Rule:
    // If UPPCLLKO replied even once anywhere in conversation history -> uppcl_replied = 1, has_historical_reply = 1
    // NEVER assume UPPCLLKO replied based on reply_within_30_min SLA flag.
    dbInstance.run(`
      -- 1. All complaints with verified UPPCLLKO reply (genuine reply record, published reply ID, or sent reply)
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

      -- 2. Complaints where UPPCLLKO has not replied
      UPDATE complaints
      SET has_historical_reply = 0,
          uppcl_replied = 0,
          picked_status = NULL,
          reply_evidence = NULL
      WHERE (id NOT IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_uppcl_reply = 1))
        AND (published_reply_id IS NULL OR published_reply_id = '')
        AND (id NOT IN (SELECT DISTINCT complaint_id FROM x_outgoing_replies WHERE status IN ('Published', 'SENT')));

      -- 3. Scenario A: Registered DISCOM reply tracking (Preserve DISCOM Redressal Tracking)
      UPDATE complaints
      SET discom_replied = 1,
          discom_reply_evidence = COALESCE(
            (SELECT 'Verified registered DISCOM reply in thread (Tweet ID: ' || reply_tweet_id || ')' 
             FROM complaint_replies 
             WHERE complaint_id = complaints.id AND is_discom_reply = 1 
             ORDER BY id DESC LIMIT 1),
            'Verified registered DISCOM reply on record'
          )
      WHERE (id IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_discom_reply = 1))
         OR (reply_within_60_min IS NOT NULL AND reply_within_60_min != '' AND reply_within_60_min != 'NO' AND reply_within_60_min != '-');

      UPDATE complaints
      SET discom_replied = 0,
          discom_reply_evidence = NULL
      WHERE (id NOT IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_discom_reply = 1))
        AND (reply_within_60_min IS NULL OR reply_within_60_min = '' OR reply_within_60_min = 'NO' OR reply_within_60_min = '-');

      UPDATE complaints
      SET discom_tagged_in_reply = '@' || UPPER(discom_name) || 'HQ'
      WHERE discom_name IN ('PVVNL', 'PUVVNL', 'MVVNL', 'DVVNL', 'KESCO')
        AND (discom_tagged_in_reply IS NULL OR discom_tagged_in_reply = '');
    `);
  } catch (mErr) {
    console.warn('Reply evidence migration warning:', mErr.message);
  }
  tryAddColumn('notifications', 'complaint_id INTEGER');
  tryAddColumn('reply_templates', 'template_body TEXT');
  tryAddColumn('reply_templates', 'template_code TEXT');
  tryAddColumn('reply_templates', 'description TEXT');
  try {
    dbInstance.run('UPDATE reply_templates SET template_body = body WHERE template_body IS NULL AND body IS NOT NULL;');
  } catch (e) {}
  try {
    // Purge any accidental complaints authored by official hierarchy handles
    dbInstance.run(`DELETE FROM complaints WHERE consumer_handle IS NOT NULL AND REPLACE(LOWER(consumer_handle), '@', '') IN (SELECT REPLACE(LOWER(handle_name), '@', '') FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != '');`);
  } catch (e) {}

  tryAddColumn('forwarding_templates', "language TEXT DEFAULT 'Hindi'");

  try {
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS frivolous_complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_url TEXT UNIQUE,
        tweet_id TEXT,
        complaint_no TEXT,
        deleted_at TEXT NOT NULL,
        deleted_by_name TEXT,
        reason TEXT DEFAULT 'Marked as Frivolous'
      );
      CREATE INDEX IF NOT EXISTS idx_frivolous_tid ON frivolous_complaints(tweet_id);
      CREATE INDEX IF NOT EXISTS idx_frivolous_url ON frivolous_complaints(post_url);
    `);
  } catch (e) {
    console.warn('Migration frivolous_complaints error:', e.message);
  }

  // Pre-load from persistent frivolous_ledger.json
  try {
    const ledgerFile = path.join(__dirname, 'data', 'frivolous_ledger.json');
    if (fs.existsSync(ledgerFile)) {
      const items = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
      if (Array.isArray(items)) {
        for (const item of items) {
          dbInstance.run(`
            INSERT OR IGNORE INTO frivolous_complaints (post_url, tweet_id, complaint_no, deleted_at, deleted_by_name, reason)
            VALUES (?, ?, ?, ?, ?, ?);
          `, [item.post_url || null, item.tweet_id || null, item.complaint_no || null, item.deleted_at || new Date().toISOString(), item.deleted_by || 'Staff', item.reason || 'Marked as Frivolous']);
        }
      }
    }
  } catch (e) {
    console.warn('Frivolous ledger seed error:', e.message);
  }

  try {
    const totalCount = dbInstance.exec("SELECT COUNT(*) FROM forwarding_templates;")[0]?.values[0][0] || 0;
    const englishCount = dbInstance.exec("SELECT COUNT(*) FROM forwarding_templates WHERE language = 'English';")[0]?.values[0][0] || 0;
    const hindiSample = dbInstance.exec("SELECT COUNT(*) FROM forwarding_templates WHERE title LIKE '%विद्युत%';")[0]?.values[0][0] || 0;
    if (totalCount < 16 || englishCount < 8 || hindiSample === 0) {
      dbInstance.run('DELETE FROM forwarding_templates;');
      const allTemplates = [
        // --- 1. HINDI INSTRUCTIONS (प्राथमिकता - हिंदी निर्देश) ---
        {
          title: 'विद्युत आपूर्ति बाधित — तत्काल बहाल करें',
          category_name: 'Power Supply Failure',
          language: 'Hindi',
          priority: 'Critical',
          template_text: 'अति-आवश्यक: संबंधित क्षेत्र में विद्युत आपूर्ति बाधित/ट्रिपिंग की शिकायत दर्ज है। कृपया तत्काल संबंधित उपकेंद्र/फीडर की पेट्रोलिंग कराकर आपूर्ति बहाल कराएं एवं नियत समय सीमा में निस्तारण सुनिश्चित करें।'
        },
        {
          title: 'ट्रांसफार्मर क्षतिग्रस्त/जलना — युद्धस्तर पर प्रतिस्थापन',
          category_name: 'Transformer Issues',
          language: 'Hindi',
          priority: 'Critical',
          template_text: 'प्राथमिकता निर्देश: संबंधित स्थल पर वितरण ट्रांसफार्मर के क्षतिग्रस्त/जलने अथवा तेल रिसाव की शिकायत प्राप्त हुई है। कृपया अवर अभियंता/तकनीकी टीम को स्थलीय निरीक्षण हेतु निर्देशित कर मानक समयावधि में ट्रांसफार्मर का प्रतिस्थापन/मरम्मत सुनिश्चित कराएं।'
        },
        {
          title: 'लो वोल्टेज एवं फेज समस्या — स्थलीय जांच व निवारण',
          category_name: 'Voltage Issues',
          language: 'Hindi',
          priority: 'High',
          template_text: 'आवश्यक स्थलीय कार्यवाही: उपभोक्ता द्वारा अत्यधिक लो-वोल्टेज एवं सिंगल फेज आपूर्ति की शिकायत की गई है। कृपया ट्रांसफार्मर टैपिंग, लोड संतुलन एवं न्यूट्रल की तत्काल जांच कर समस्या का स्थायी समाधान कराएं।'
        },
        {
          title: 'टूटा तार / स्पार्किंग सुरक्षा आपातकाल — तत्काल दुरुस्त करें',
          category_name: 'Safety & Accidents',
          language: 'Hindi',
          priority: 'Critical',
          template_text: 'सुरक्षा आपातकाल: संबंधित स्थल पर जर्जर/टूटे तार अथवा पोल से स्पार्किंग की शिकायत प्राप्त हुई है, जिससे जनहानि का खतरा है। कृपया संबंधित लाइन को तत्काल आइसोलेट कर आपातकालीन गैंग भेजकर युद्धस्तर पर सुरक्षा कार्य पूर्ण कराएं।'
        },
        {
          title: 'बिलिंग एवं मीटर विवाद — स्थलीय जांच व संशोधित बिल जारी करें',
          category_name: 'Billing Issues',
          language: 'Hindi',
          priority: 'Normal',
          template_text: 'बिलिंग/मीटर स्थलीय सत्यापन: उपभोक्ता द्वारा अत्यधिक बिल/अस्वाभाविक मीटर रीडिंग/मीटर खराब होने की शिकायत दर्ज की गई है। कृपया उपखंडीय अधिकारी द्वारा स्थलीय जांच कराकर नियमानुसार संशोधित बिल जारी कराएं।'
        },
        {
          title: 'नया संयोजन निर्गमन में विलंब — शीघ्र संयोजन दें',
          category_name: 'New Connection',
          language: 'Hindi',
          priority: 'Normal',
          template_text: 'शीघ्र संयोजन निर्गमन: उपभोक्ता द्वारा झटपट पोर्टल के अंतर्गत नए विद्युत संयोजन/मीटर स्थापना में अनावश्यक विलंब की शिकायत की गई है। कृपया आवेदन की अद्यतन स्थिति जांचकर प्राथमिकता पर संयोजन निर्गत कराएं।'
        },
        {
          title: 'लाइन रखरखाव एवं पेड़ छंटाई — आवश्यक शटडाउन लेकर कार्य करें',
          category_name: 'Infrastructure / Line Maintenance',
          language: 'Hindi',
          priority: 'Normal',
          template_text: 'लाइन रखरखाव कार्यवाही: वृक्षों की डालियों के एलटी/11 केवी लाइन से स्पर्श होने के कारण बार-बार फॉल्ट/ट्रिपिंग की सूचना है। कृपया आवश्यक शटडाउन लेकर डालियों की छंटाई एवं लाइन दुरुस्तीकरण कार्य कराएं।'
        },
        {
          title: 'स्थल निरीक्षण एवं आख्या (ATR) — मय फोटोग्राफ्स प्रेषित करें',
          category_name: 'General Grievance',
          language: 'Hindi',
          priority: 'Normal',
          template_text: 'उक्त प्रकरण में स्थलीय निरीक्षण कर उपभोक्ता की शिकायत का त्वरित निस्तारण कराएं तथा कृत कार्यवाही की विस्तृत आख्या (ATR) मय फोटोग्राफ्स यूपीपीसीएल सोशल मीडिया सेल को प्रेषित करें।'
        },

        // --- 2. ENGLISH INSTRUCTIONS ---
        {
          title: 'Power Outage & Feeder Breakdown (English)',
          category_name: 'Power Supply Failure',
          language: 'English',
          priority: 'Critical',
          template_text: 'Urgent: Consumer reports prolonged power outage / feeder tripping in this area. Kindly depute line staff to inspect substation/feeder and ensure prompt restoration of electricity supply within SLA.'
        },
        {
          title: 'Transformer Burnt / Replacement (English)',
          category_name: 'Transformer Issues',
          language: 'English',
          priority: 'Critical',
          template_text: 'Priority Action: Damaged / burnt distribution transformer or oil leakage reported at site. Depute junior engineer immediately for spot assessment and execute replacement/repair on war footing.'
        },
        {
          title: 'Voltage Fluctuation & Phase Fault (English)',
          category_name: 'Voltage Issues',
          language: 'English',
          priority: 'High',
          template_text: 'Field Action Required: Consumer reported abnormal low voltage / single-phasing causing disruption to appliances. Please check distribution transformer tapping, feeder load balance, and rectify neutral issues.'
        },
        {
          title: 'Public Safety Hazard & Broken Wire (English)',
          category_name: 'Safety & Accidents',
          language: 'English',
          priority: 'Critical',
          template_text: 'Safety Emergency: Dangerous broken/snapped live conductor or pole sparking reported posing severe public danger. Isolate affected section immediately and deploy emergency breakdown gang for rectification.'
        },
        {
          title: 'Billing Grievance & Meter Check (English)',
          category_name: 'Billing Issues',
          language: 'English',
          priority: 'Normal',
          template_text: 'Meter & Billing Inspection: Consumer disputing excessive bill / stopped meter / reading mismatch. Please arrange prompt site verification by sub-divisional staff, check MRI data if required, and rectify bill.'
        },
        {
          title: 'New Connection Release Delay (English)',
          category_name: 'New Connection',
          language: 'English',
          priority: 'Normal',
          template_text: 'Expedite Service Release: Consumer grievance regarding delay in meter installation / release of new service line under Jhatpat portal. Check application status and release connection promptly.'
        },
        {
          title: 'Overhead Line Clearance & Tree Trimming (English)',
          category_name: 'Infrastructure / Line Maintenance',
          language: 'English',
          priority: 'Normal',
          template_text: 'Maintenance Required: Overhead line defect / loose conductor / tree branches touching live lines causing intermittent tripping. Please schedule necessary shutdown and execute maintenance.'
        },
        {
          title: 'Site Inspection & Action Taken Report (English)',
          category_name: 'General Grievance',
          language: 'English',
          priority: 'Normal',
          template_text: 'Forwarded for spot inspection and necessary grievance redressal. Please communicate the Action Taken Report (ATR) along with site photos to UPPCL Social Media Cell.'
        }
      ];

      for (const t of allTemplates) {
        dbInstance.run(
          'INSERT INTO forwarding_templates (title, category_name, template_text, language, priority, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, datetime("now"));',
          [t.title, t.category_name, t.template_text, t.language, t.priority]
        );
      }
    }
  } catch (e) {
    console.warn('Error seeding forwarding_templates:', e.message);
  }

  try {
    const cols = dbInstance.exec("PRAGMA table_info(complaints);")[0]?.values || [];
    const distCol = cols.find(c => c[1] === 'district_name');
    if (distCol && distCol[3] === 1) {
      const colNames = cols.map(c => c[1]).join(', ');
      dbInstance.run('PRAGMA foreign_keys=off;');
      dbInstance.run('ALTER TABLE complaints RENAME TO _complaints_old;');
      dbInstance.run(`
        CREATE TABLE complaints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          complaint_no TEXT UNIQUE NOT NULL,
          received_at TEXT NOT NULL,
          platform TEXT NOT NULL,
          monitored_account TEXT NOT NULL,
          hierarchy_handle_id INTEGER,
          hierarchy_handle_name TEXT,
          is_tagged INTEGER DEFAULT 1,
          consumer_name TEXT,
          consumer_handle TEXT,
          consumer_profile_url TEXT,
          post_url TEXT,
          complaint_text TEXT NOT NULL,
          category_name TEXT NOT NULL,
          subcategory_name TEXT,
          discom_name TEXT NOT NULL,
          district_name TEXT,
          zone_name TEXT,
          circle_name TEXT,
          division_name TEXT,
          subdivision_name TEXT,
          consumer_account_no TEXT,
          consumer_mobile TEXT,
          priority TEXT NOT NULL DEFAULT 'Normal',
          current_status TEXT NOT NULL DEFAULT 'New',
          assigned_operator_id INTEGER,
          assigned_operator_name TEXT,
          assigned_nodal_officer_id INTEGER,
          assigned_nodal_officer_name TEXT,
          assigned_nodal_officer_mobile TEXT,
          forwarding_date TEXT,
          forwarding_channel TEXT,
          forwarding_ref_no TEXT,
          forwarding_remarks TEXT,
          expected_response_date TEXT,
          is_overdue INTEGER DEFAULT 0,
          escalation_level INTEGER DEFAULT 0,
          escalation_reason TEXT,
          discom_response_date TEXT,
          discom_action_taken TEXT,
          discom_evidence_url TEXT,
          discom_reported_by TEXT,
          closure_date TEXT,
          closure_verified_by TEXT,
          closure_verification_notes TEXT,
          closure_satisfaction_status TEXT,
          duplicate_of_complaint_id INTEGER,
          invalid_reason TEXT,
          reopen_reason TEXT,
          last_action_date TEXT,
          created_by TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          original_post_id TEXT,
          conversation_id TEXT,
          author_id TEXT,
          reply_draft TEXT,
          reply_status TEXT DEFAULT 'None',
          published_reply_id TEXT,
          first_acknowledged_at TEXT,
          assigned_at TEXT
        );
      `);
      dbInstance.run(`INSERT INTO complaints (${colNames}) SELECT ${colNames} FROM _complaints_old;`);
      dbInstance.run('DROP TABLE _complaints_old;');
      dbInstance.run('PRAGMA foreign_keys=on;');
    }
  } catch (err) {
    console.warn('Complaint table district_name migration error:', err.message);
  }
}

function tryAddColumn(tableName, colDef) {
  try {
    dbInstance.run(`ALTER TABLE ${tableName} ADD COLUMN ${colDef};`);
  } catch (e) {
    // Column already exists or table locked - expected on subsequent boots
  }
}

function normalizeParams(params) {
  if (!params) return [];
  return params.map(p => (p === undefined ? null : p));
}

function query(sql, params = []) {
  const db = getDbInstance();
  const stmt = db.prepare(sql);
  const safeParams = normalizeParams(params);
  if (safeParams.length) stmt.bind(safeParams);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  const db = getDbInstance();
  const safeParams = normalizeParams(params);
  db.run(sql, safeParams);
  const res = db.exec('SELECT last_insert_rowid() AS id, changes() AS changes;');
  const lastInsertRowid = res[0] && res[0].values[0] ? res[0].values[0][0] : 0;
  const changes = res[0] && res[0].values[0] ? res[0].values[0][1] : 0;
  scheduleSave();
  return { lastInsertRowid, changes };
}

function exec(sql) {
  const db = getDbInstance();
  db.exec(sql);
  scheduleSave();
}

function flush() {
  saveToDiskSync();
}

module.exports = {
  initDb,
  query,
  get,
  run,
  exec,
  flush,
  saveToDiskSync,
  getDbInstance
};
