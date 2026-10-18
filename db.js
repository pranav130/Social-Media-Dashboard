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
      district_name TEXT NOT NULL,
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

  try {
    const fwdRows = dbInstance.exec('SELECT COUNT(*) FROM forwarding_templates;')[0]?.values[0][0] || 0;
    if (fwdRows === 0) {
      const defaultFwdTemplates = [
        {
          title: 'Power Outage & Feeder Breakdown (विद्युत आपूर्ति बहाली)',
          category_name: 'Power Supply Failure',
          priority: 'Critical',
          template_text: 'Urgent: Consumer reports prolonged power outage / feeder tripping in this area. Kindly depute line staff to inspect substation/feeder and ensure prompt restoration of electricity supply within SLA.'
        },
        {
          title: 'Transformer Burnt / Replacement (ट्रांसफार्मर खराबी / प्रतिस्थापन)',
          category_name: 'Transformer Issues',
          priority: 'Critical',
          template_text: 'Priority Action: Damaged / burnt distribution transformer or oil leakage reported at site. Depute junior engineer immediately for spot assessment and execute replacement/repair on war footing.'
        },
        {
          title: 'Voltage Fluctuation & Phase Fault (लो वोल्टेज / फेज दोष)',
          category_name: 'Voltage Issues',
          priority: 'High',
          template_text: 'Field Action Required: Consumer reported abnormal low voltage / single-phasing causing disruption to appliances. Please check distribution transformer tapping, feeder load balance, and rectify neutral issues.'
        },
        {
          title: 'Public Safety Hazard & Broken Wire (खतरनाक तार / सुरक्षा आपातकाल)',
          category_name: 'Safety & Accidents',
          priority: 'Critical',
          template_text: 'Safety Emergency: Dangerous broken/snapped live conductor or pole sparking reported posing severe public danger. Isolate affected section immediately and deploy emergency breakdown gang for rectification.'
        },
        {
          title: 'Billing Grievance & Meter Check (बिलिंग विवाद / मीटर जांच)',
          category_name: 'Billing Issues',
          priority: 'Normal',
          template_text: 'Meter & Billing Inspection: Consumer disputing excessive bill / stopped meter / reading mismatch. Please arrange prompt site verification by sub-divisional staff, check MRI data if required, and rectify bill.'
        },
        {
          title: 'New Connection Release Delay (नया संयोजन / मीटर निर्गमन)',
          category_name: 'New Connection',
          priority: 'Normal',
          template_text: 'Expedite Service Release: Consumer grievance regarding delay in meter installation / release of new service line under Jhatpat portal. Check application status and release connection promptly.'
        },
        {
          title: 'Overhead Line Clearance & Tree Trimming (लाइन रखरखाव)',
          category_name: 'Infrastructure / Line Maintenance',
          priority: 'Normal',
          template_text: 'Maintenance Required: Overhead line defect / loose conductor / tree branches touching live lines causing intermittent tripping. Please schedule necessary shutdown and execute maintenance.'
        },
        {
          title: 'Site Inspection & Action Taken Report (सामान्य स्थल निरीक्षण एवं आख्या)',
          category_name: 'General Grievance',
          priority: 'Normal',
          template_text: 'Forwarded for spot inspection and necessary grievance redressal. Please communicate the Action Taken Report (ATR) along with site photos to UPPCL Social Media Cell.'
        }
      ];

      for (const t of defaultFwdTemplates) {
        dbInstance.run(
          'INSERT INTO forwarding_templates (title, category_name, template_text, priority, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime("now"));',
          [t.title, t.category_name, t.template_text, t.priority]
        );
      }
    }
  } catch (e) {
    console.warn('Error seeding forwarding_templates:', e.message);
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
  db.run(sql);
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
  getDbInstance
};
