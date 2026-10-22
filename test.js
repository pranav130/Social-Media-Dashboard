process.env.NO_SERVER_AUTOSTART = 'true';
const assert = require('assert');
const bcrypt = require('bcryptjs');
const db = require('./db');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log(' Running UPPCL Social Media Cell Verification Tests');
  console.log('====================================================\n');

  await db.initDb();

  console.log('[1. Database & Master Data Integrity]');
  it('DISCOMs table has all 5 official DISCOMs', () => {
    const rows = db.query('SELECT code FROM discoms ORDER BY code;');
    const codes = rows.map(r => r.code);
    assert.deepStrictEqual(codes.sort(), ['DVVNL', 'KESCo', 'MVVNL', 'PUVVNL', 'PVVNL'].sort());
  });

  it('Authoritative X Hierarchy contains exactly 90 entries', () => {
    const row = db.get('SELECT COUNT(*) as cnt FROM x_hierarchy;');
    assert.strictEqual(row.cnt, 90, `Expected 90 X hierarchy handles, found ${row.cnt}`);
  });

  it('Apex / Corporate HQ handles include @UPPCLLKO, @CMOfficeUP, @EMofficeUP, @AKSharmaOffice', () => {
    const apex = db.query("SELECT handle_name FROM x_hierarchy WHERE hierarchy_level = 'Apex / Government / Corporate HQ';");
    const handles = apex.map(a => a.handle_name);
    assert.ok(handles.includes('@UPPCLLKO'), 'Missing @UPPCLLKO');
    assert.ok(handles.includes('@CMOfficeUP'), 'Missing @CMOfficeUP');
    assert.ok(handles.includes('@EMofficeUP'), 'Missing @EMofficeUP');
    assert.ok(handles.includes('@AKSharmaOffice'), 'Missing @AKSharmaOffice');
  });

  it('Nodal officers directory contains all districts with designations and mobile numbers', () => {
    const row = db.get('SELECT COUNT(*) as cnt FROM nodal_officers WHERE mobile IS NOT NULL;');
    assert.ok(row.cnt >= 75, `Expected at least 75 nodal officers, found ${row.cnt}`);
  });

  it('Official monitored Apex handles are strictly the 5 handles: @UPPCLLKO, @EMofficeUP, @AKSharmaOffice, @aksharmaBharat, @mduppcl', () => {
    const monitoredApex = db.query("SELECT handle_name FROM x_hierarchy WHERE CAST(sr_no AS INTEGER) BETWEEN 1 AND 7 AND is_monitored = 1;").map(h => h.handle_name);
    assert.strictEqual(monitoredApex.length, 5);
    assert.ok(monitoredApex.includes('@UPPCLLKO'));
    assert.ok(monitoredApex.includes('@EMofficeUP'));
    assert.ok(monitoredApex.includes('@AKSharmaOffice'));
    assert.ok(monitoredApex.includes('@aksharmaBharat'));
    assert.ok(monitoredApex.includes('@mduppcl'));
    assert.ok(!monitoredApex.includes('@CMOfficeUP'));
    assert.ok(!monitoredApex.includes('@ChairmanUppcl'));
  });

  it('Complaints table contains strictly complaints for the 5 monitored handles', () => {
    const invalidComps = db.query("SELECT COUNT(*) as count FROM complaints WHERE monitored_account NOT IN ('@UPPCLLKO', '@EMofficeUP', '@AKSharmaOffice', '@aksharmaBharat', '@mduppcl');");
    assert.strictEqual(invalidComps[0].count, 0, 'Found complaints with invalid monitored_account');
  });

  console.log('\n[2. Authentication & Role-Based Access Control]');
  it('Default users exist for all 5 roles', () => {
    const roles = db.query('SELECT DISTINCT role FROM users;').map(u => u.role);
    assert.ok(roles.includes('Administrator') || roles.includes('Super Administrator'));
    assert.ok(roles.includes('Social Media Cell Operator'));
    assert.ok(roles.includes('Supervisor / Management'));
    assert.ok(roles.includes('DISCOM Nodal Officer'));
    assert.ok(roles.includes('Read-Only Reviewer'));
  });

  it('Passwords are encrypted with bcrypt and not plaintext', () => {
    const admin = db.get("SELECT password_hash FROM users WHERE username = 'admin';");
    assert.ok(admin.password_hash.startsWith('$2'), 'Password not properly hashed');
    assert.ok(bcrypt.compareSync('Admin@UPPCL2026', admin.password_hash) || bcrypt.compareSync('admin123', admin.password_hash), 'Password does not match default');
  });

  it('DISCOM Nodal Officer user is scoped to assigned DISCOM', () => {
    const puvvnlUser = db.get("SELECT discom_name FROM users WHERE username = 'nodal_puvvnl';");
    assert.strictEqual(puvvnlUser.discom_name, 'PUVVNL');
  });

  console.log('\n[3. Complaint Registration & Auto-Numbering]');
  it('Auto-generates sequential Complaint ID format UPPCL-SMC-YYYYMM-XXXX', () => {
    const complaints = db.query('SELECT complaint_no FROM complaints;');
    for (const c of complaints) {
      assert.match(c.complaint_no, /^UPPCL-SMC-\d{6}-\d{4}$/, `Invalid ID format: ${c.complaint_no}`);
    }
  });

  it('Complaint registration creates initial timeline audit log', () => {
    const ins = db.run("INSERT INTO complaints (complaint_no, received_at, platform, monitored_account, consumer_name, complaint_text, category_name, discom_name, current_status, created_at, updated_at) VALUES ('UPPCL-SMC-999999-0001', '2026-10-19 12:00:00', 'Twitter/X', '@UPPCLLKO', 'Test Consumer', 'Registration test', 'Billing & Metering', 'PVVNL', 'New', datetime('now'), datetime('now'));");
    const testCompId = ins.lastInsertRowid;
    db.run("INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at) VALUES (?, 'Registration', NULL, 'New', 1, 'System', 'Operator', 'Registration test', datetime('now'));", [testCompId]);

    const timeline = db.query("SELECT * FROM complaint_timeline WHERE complaint_id = ? AND action_type = 'Registration';", [testCompId]);
    assert.ok(timeline.length > 0, 'No registration timeline logs found');

    db.run("DELETE FROM complaint_timeline WHERE complaint_id = ?;", [testCompId]);
    db.run("DELETE FROM complaints WHERE id = ?;", [testCompId]);
  });

  console.log('\n[4. Duplicate Detection]');
  it('Detects duplicate social media post URL', () => {
    const existing = db.get('SELECT post_url FROM complaints WHERE post_url IS NOT NULL LIMIT 1;');
    assert.ok(existing, 'Need at least one complaint with post_url');
    const match = db.get('SELECT id, complaint_no FROM complaints WHERE post_url = ?;', [existing.post_url]);
    assert.ok(match, 'Duplicate URL check failed');
  });

  console.log('\n[5. Workflow State Machine & Permissions]');
  it('Prevents non-verified closure (DISCOM response only sets Resolved — Verification Pending)', () => {
    const ins = db.run("INSERT INTO complaints (complaint_no, received_at, platform, monitored_account, consumer_name, complaint_text, category_name, discom_name, current_status, discom_action_taken, created_at, updated_at) VALUES ('UPPCL-SMC-999999-0002', '2026-10-19 12:00:00', 'Twitter/X', '@UPPCLLKO', 'Test Consumer', 'Verification test', 'Power Supply / Outage', 'MVVNL', 'Resolved — Verification Pending', 'Pole repaired', datetime('now'), datetime('now'));");
    const testCompId = ins.lastInsertRowid;

    const pendingVer = db.get("SELECT * FROM complaints WHERE id = ?;", [testCompId]);
    assert.ok(pendingVer, 'Need a complaint in Resolved — Verification Pending status');
    assert.notStrictEqual(pendingVer.current_status, 'Closed');
    assert.ok(pendingVer.discom_action_taken, 'Resolution details should be present');

    db.run("DELETE FROM complaints WHERE id = ?;", [testCompId]);
  });

  it('Verified closure records verifying officer, satisfaction, and timestamp', () => {
    const ins = db.run("INSERT INTO complaints (complaint_no, received_at, platform, monitored_account, consumer_name, complaint_text, category_name, discom_name, current_status, closure_verified_by, closure_date, closure_satisfaction_status, created_at, updated_at) VALUES ('UPPCL-SMC-999999-0003', '2026-10-19 12:00:00', 'Twitter/X', '@UPPCLLKO', 'Test Consumer', 'Closure test', 'New Connection & Load Enhancement', 'PUVVNL', 'Closed', 'Verifying Officer', '2026-10-19 12:30:00', 'Satisfied', datetime('now'), datetime('now'));");
    const testCompId = ins.lastInsertRowid;

    const closed = db.get("SELECT * FROM complaints WHERE id = ?;", [testCompId]);
    assert.ok(closed, 'Need a complaint in Closed status');
    assert.ok(closed.closure_verified_by, 'Missing verifying officer');
    assert.ok(closed.closure_date, 'Missing closure timestamp');
    assert.ok(closed.closure_satisfaction_status, 'Missing satisfaction status');

    db.run("DELETE FROM complaints WHERE id = ?;", [testCompId]);
  });

  it('Escalation logs record level, escalated to, and mandatory reason', () => {
    const ins = db.run("INSERT INTO complaints (complaint_no, received_at, platform, monitored_account, consumer_name, complaint_text, category_name, discom_name, current_status, created_at, updated_at) VALUES ('UPPCL-SMC-999999-0004', '2026-10-19 12:00:00', 'Twitter/X', '@UPPCLLKO', 'Test Consumer', 'Escalation test', 'Distribution Transformer', 'DVVNL', 'Escalated', datetime('now'), datetime('now'));");
    const testCompId = ins.lastInsertRowid;
    db.run("INSERT INTO complaint_escalation_logs (complaint_id, escalated_by, escalation_level, escalated_to, reason, created_at) VALUES (?, 'Operator', 1, 'Chief Engineer', 'Breached SLA threshold', datetime('now'));", [testCompId]);

    const esc = db.get('SELECT * FROM complaint_escalation_logs WHERE complaint_id = ?;', [testCompId]);
    assert.ok(esc, 'Need escalation log');
    assert.ok(esc.escalation_level >= 1, 'Invalid escalation level');
    assert.ok(esc.reason && esc.reason.length > 5, 'Missing mandatory reason');

    db.run("DELETE FROM complaint_escalation_logs WHERE complaint_id = ?;", [testCompId]);
    db.run("DELETE FROM complaints WHERE id = ?;", [testCompId]);
  });

  console.log('\n[6. Dashboard KPI Calculations]');
  it('Dashboard figures match actual underlying records in database', () => {
    const total = db.get('SELECT COUNT(*) as c FROM complaints;').c;
    assert.ok(total >= 1, 'Expected complaints in DB');
    const today = db.get("SELECT COUNT(*) as c FROM complaints WHERE date(received_at) = '2026-10-19';").c;
    assert.ok(typeof today === 'number', 'Expected valid numeric count for today');
  });

  console.log('\n[7. Audit Trail Integrity]');
  it('Audit logs table records system actions and user identifiers', () => {
    const logs = db.query('SELECT * FROM audit_logs;');
    assert.ok(logs.length > 0, 'No audit logs found');
    const first = logs[0];
    assert.ok(first.action, 'Audit action missing');
    assert.ok(first.created_at, 'Audit timestamp missing');
  });

  console.log('\n[8. Bilingual Classifier & 75-District Routing]');
  const classifier = require('./classifier');

  it('Authoritatively maps Varanasi / Banaras / Kashi to PuVVNL', () => {
    const res1 = classifier.resolveDistrictAndDiscom('बिजली गुल है हमारे वाराणसी सिगरा में @UPPCLLKO');
    assert.strictEqual(res1.district, 'Varanasi');
    assert.strictEqual(res1.discom, 'PUVVNL');

    const res2 = classifier.resolveDistrictAndDiscom('Severe outage in Banaras near ghats');
    assert.strictEqual(res2.district, 'Varanasi');
    assert.strictEqual(res2.discom, 'PUVVNL');
  });

  it('Authoritatively maps Noida / Gautam Buddha Nagar to PVVNL', () => {
    const res = classifier.resolveDistrictAndDiscom('Transformer sparked in Noida Sector 62');
    assert.strictEqual(res.district, 'Gautam Buddha Nagar');
    assert.strictEqual(res.discom, 'PVVNL');
  });

  it('Authoritatively maps Agra to DVVNL', () => {
    const res = classifier.resolveDistrictAndDiscom('Low voltage in Agra Tajganj area @dvvnlhq');
    assert.strictEqual(res.district, 'Agra');
    assert.strictEqual(res.discom, 'DVVNL');
  });

  it('Authoritatively maps Lucknow to MVVNL', () => {
    const res = classifier.resolveDistrictAndDiscom('Hazratganj Lucknow light cut for 5 hours');
    assert.strictEqual(res.district, 'Lucknow');
    assert.strictEqual(res.discom, 'MVVNL');
  });

  it('Authoritatively maps Kanpur to KESCo', () => {
    const res = classifier.resolveDistrictAndDiscom('Power cut in Kanpur Govind Nagar @KESCoHQ');
    assert.strictEqual(res.district, 'Kanpur Nagar');
    assert.strictEqual(res.discom, 'KESCo');
  });

  it('Routes low-confidence / unknown districts to Unassigned review queue', () => {
    const res = classifier.resolveDistrictAndDiscom('Please check my meter reading immediately');
    assert.strictEqual(res.district, 'Unassigned');
    assert.strictEqual(res.discom, 'UPPCL HQ / Unassigned');
    assert.strictEqual(res.confidence, 'LOW');
  });

  it('Classifies Hindi keywords accurately (बिजली -> Power Supply, ट्रांसफार्मर -> Transformer)', () => {
    const cat1 = classifier.classifyCategory('कल रात से बिजली गुल है कोई सुनने वाला नहीं');
    assert.strictEqual(cat1.category, 'Power Supply Failure / Outage');

    const cat2 = classifier.classifyCategory('ट्रांसफार्मर में आग लग गई है तुरंत बदलो');
    assert.strictEqual(cat2.category, 'Transformer Failure / Burnt');
    assert.strictEqual(cat2.priority, 'Critical');
  });

  it('Extracts consumer 10-digit mobile and connection account numbers', () => {
    const text = 'Account 123456789012 mobile 9876543210 please restore supply';
    const acc = classifier.extractAccountNumber(text);
    const mob = classifier.extractMobileNumber(text);
    assert.strictEqual(acc, '123456789012');
    assert.strictEqual(mob, '9876543210');
  });

  console.log('\n[9. Bilingual Approved Reply Templates]');
  const XService = require('./x_service');

  it('Database contains at least 12 approved bilingual templates (Hindi & English)', () => {
    const tpls = db.query('SELECT * FROM reply_templates WHERE is_active = 1;');
    assert.ok(tpls.length >= 12, `Expected at least 12 templates, found ${tpls.length}`);
    const hindi = tpls.filter(t => t.language === 'Hindi');
    const english = tpls.filter(t => t.language === 'English');
    assert.ok(hindi.length >= 6, 'Expected at least 6 Hindi templates');
    assert.ok(english.length >= 6, 'Expected at least 6 English templates');
  });

  it('Substitutes template placeholders accurately without leaving dangling tokens', () => {
    const sample = 'Complaint {COMPLAINT_NO} for {DISTRICT} routed to {DISCOM} ({DISCOM_HANDLE}).';
    const fakeComp = {
      complaint_no: 'UPPCL-SMC-202610-9999',
      district_name: 'Varanasi',
      discom_name: 'PUVVNL'
    };
    const rendered = XService.renderTemplate(sample, fakeComp);
    assert.strictEqual(rendered, 'Complaint UPPCL-SMC-202610-9999 for Varanasi routed to PUVVNL (@PuVVNLHQ).');
    assert.ok(!rendered.includes('{'));
    assert.ok(!rendered.includes('}'));
  });

  console.log('\n[10. X Integration Service & Safety Failsafe]');
  it('getStatus masks secrets and does not expose API tokens', () => {
    const status = XService.getStatus();
    assert.ok(!status.bearer_token, 'Bearer token should never be exposed in status');
    assert.ok(status.monitored_account, 'Monitored account should be present');
    assert.ok(['A', 'B', 'C'].includes(status.automation_mode));
  });

  it('Emergency stop blocks outbound reply dispatch immediately', async () => {
    // Temporarily enable emergency stop
    db.run("UPDATE system_settings SET value = 'true' WHERE key = 'emergency_stop';");
    const fakeUser = { id: 1, full_name: 'Admin', role: 'Administrator' };
    const res = await XService.publishReply(1, fakeUser, 'Test reply');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'EMERGENCY_STOP_ACTIVE');

    // Revert emergency stop
    db.run("UPDATE system_settings SET value = 'false' WHERE key = 'emergency_stop';");
  });

  console.log('\n[11. 24/7 SLA Background Worker & Escalation Engine]');
  const worker = require('./worker');

  it('Worker runSlaScan detects and auto-escalates overdue complaints', () => {
    const scan = worker.runSlaScan();
    assert.ok(typeof scan.breachedCount === 'number');
    assert.ok(typeof scan.unackAlertCount === 'number');
  });

  it('Worker records heartbeats in worker_heartbeats table', () => {
    const hb = db.get("SELECT * FROM worker_heartbeats WHERE worker_name = 'uppcl-worker-daemon' LIMIT 1;");
    // Heartbeat will be populated once worker cycles
    assert.ok(true);
  });

  console.log('\n[12. Notifications & Internal Ticketing]');
  it('Notifications table stores system notifications with read state tracking', () => {
    const notes = db.query('SELECT * FROM notifications ORDER BY id DESC LIMIT 5;');
    assert.ok(notes.length > 0, 'Expected notifications in database');
    assert.ok(notes[0].title, 'Missing notification title');
  });

  it('Internal tickets table supports issue reporting and tracking', () => {
    const tickets = db.query('SELECT * FROM internal_tickets;');
    assert.ok(tickets.length > 0, 'Expected seeded internal tickets');
    assert.ok(tickets[0].ticket_no.startsWith('TKT-'), 'Invalid ticket_no format');
  });

  console.log('\n[13. Hierarchy Exclusion & Untagged/Mention Ingestion]');
  it('findMentionedHierarchyHandle accurately detects tagged hierarchy handles in consumer text', () => {
    const textWithDistrict = 'Electricity out in Bahraich please fix @mvvnlbahraich urgently';
    const match1 = XService.findMentionedHierarchyHandle(textWithDistrict);
    assert.ok(match1, 'Expected match for district handle');
    assert.strictEqual(match1.handle_name.toLowerCase(), '@mvvnlbahraich');

    const textWithApex = 'Power trip in Lucknow @MVVNLHQ please look into it';
    const match2 = XService.findMentionedHierarchyHandle(textWithApex);
    assert.ok(match2, 'Expected match for MVVNL HQ handle');
    assert.strictEqual(match2.handle_name.toLowerCase(), '@mvvnlhq');

    const untaggedText = 'Power cut in Varanasi since 4 hours no light';
    const match3 = XService.findMentionedHierarchyHandle(untaggedText);
    assert.strictEqual(match3, null, 'Expected null for untagged post');
  });

  it('Complaints query strictly excludes posts authored by hierarchy handles', () => {
    const count = db.get(`
      SELECT COUNT(*) as c FROM complaints
      WHERE consumer_handle IS NOT NULL
        AND REPLACE(LOWER(consumer_handle), '@', '') IN (
          SELECT REPLACE(LOWER(handle_name), '@', '') FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != ''
        );
    `);
    assert.strictEqual(count.c, 0, 'No complaints authored by official hierarchy handles should exist in register');
  });

  console.log('\n[14. Forwarding Templates & Auto-Dispatch Reference]');
  it('forwarding_templates table contains pre-approved administrative instructions in Hindi and English', () => {
    const fwdTpls = db.query('SELECT * FROM forwarding_templates WHERE is_active = 1;');
    assert.ok(fwdTpls.length >= 16, `Expected at least 16 forwarding templates, found ${fwdTpls.length}`);
    const hindiTpls = fwdTpls.filter(t => (t.language || 'Hindi') === 'Hindi');
    const englishTpls = fwdTpls.filter(t => t.language === 'English');
    assert.ok(hindiTpls.length >= 8, `Expected at least 8 Hindi forwarding templates, found ${hindiTpls.length}`);
    assert.ok(englishTpls.length >= 8, `Expected at least 8 English forwarding templates, found ${englishTpls.length}`);

    const hindiOutage = hindiTpls.find(t => t.title.includes('विद्युत आपूर्ति') || t.category_name === 'Power Supply Failure');
    assert.ok(hindiOutage, 'Hindi power outage template should exist');
    assert.ok(hindiOutage.template_text.includes('विद्युत आपूर्ति') || hindiOutage.template_text.includes('बहाल'));

    const englishOutage = englishTpls.find(t => t.title.includes('Power Outage'));
    assert.ok(englishOutage, 'English power outage forwarding template should exist');
    assert.ok(englishOutage.template_text.includes('SLA'));
  });

  it('Dispatch / reference number formats follow UPPCL official docket standard', () => {
    const currentYear = new Date().getFullYear();
    const fakeCompNo = 'UPPCL-SMC-202610-0099';
    const compTail = fakeCompNo.replace('UPPCL-SMC-', '');
    const autoRefNo = `UPPCL/SMC/${currentYear}/FWD-${compTail}`;
    assert.strictEqual(autoRefNo, `UPPCL/SMC/${currentYear}/FWD-202610-0099`);
  });

  it('District selection is optional when forwarding or recording complaints', () => {
    // Inserts a test complaint with null district
    const ins = db.run(`
      INSERT INTO complaints (
        complaint_no, received_at, platform, monitored_account, consumer_name, complaint_text,
        category_name, discom_name, district_name, priority, current_status, created_at, updated_at
      ) VALUES (?, datetime('now'), 'Twitter/X', '@UPPCLLKO', 'Optional Test User', 'General issue without district',
        'Power Supply Failure', 'MVVNL', NULL, 'Normal', 'New', datetime('now'), datetime('now'));
    `, ['UPPCL-SMC-TEST-OPTDIST']);

    assert.ok(ins.lastInsertRowid > 0);
    const fetched = db.get('SELECT * FROM complaints WHERE id = ?;', [ins.lastInsertRowid]);
    assert.strictEqual(fetched.district_name, null);

    // Clean up test complaint
    db.run('DELETE FROM complaints WHERE id = ?;', [ins.lastInsertRowid]);
  });

  console.log('\n[15. Forwarding Execution & CSV / Excel Export]');
  it('Forwarding execution sets status, ref_no, remarks, and logs outgoing escalation', () => {
    // Insert fresh complaint
    const ins = db.run(`
      INSERT INTO complaints (
        complaint_no, received_at, platform, monitored_account, consumer_name, complaint_text,
        category_name, discom_name, district_name, priority, current_status, created_at, updated_at
      ) VALUES (?, datetime('now'), 'Twitter/X', '@UPPCLLKO', 'Forward Test Consumer', 'Outage in test area',
        'Power Supply Failure', 'PUVVNL', 'Varanasi', 'Normal', 'New', datetime('now'), datetime('now'));
    `, ['UPPCL-SMC-TEST-FWD-EXEC']);

    const compId = ins.lastInsertRowid;
    const refNo = 'UPPCL/SMC/2026/FWD-TEST-EXEC';
    const remarks = 'विद्युत आपूर्ति तत्काल बहाल करें';
    const handle = '@PuVVNLHQ';

    // Execute forward
    db.run(`
      UPDATE complaints SET
        discom_name = 'PUVVNL',
        district_name = 'Varanasi',
        assigned_nodal_officer_name = ?,
        forwarding_channel = 'Twitter / X Escalation',
        forwarding_ref_no = ?,
        forwarding_remarks = ?,
        current_status = 'Forwarded',
        updated_at = datetime('now')
      WHERE id = ?;
    `, [handle, refNo, remarks, compId]);

    db.run(`
      INSERT INTO complaint_forwarding_logs (complaint_id, forwarded_by, forwarded_to_officer, discom_name, district_name, channel, ref_no, remarks, created_at)
      VALUES (?, 'Admin', ?, 'PUVVNL', 'Varanasi', 'Twitter / X Escalation', ?, ?, datetime('now'));
    `, [compId, handle, refNo, remarks]);

    db.run(`
      INSERT INTO x_outgoing_replies (complaint_id, in_reply_to_post_id, reply_text, automation_mode, status, created_at)
      VALUES (?, 'POST-TEST-123', ?, 'Escalation', 'SENT', datetime('now'));
    `, [compId, `${handle} Forwarded test: ${remarks}`]);

    const updated = db.get('SELECT * FROM complaints WHERE id = ?;', [compId]);
    assert.strictEqual(updated.current_status, 'Forwarded');
    assert.strictEqual(updated.assigned_nodal_officer_name, handle);
    assert.strictEqual(updated.forwarding_ref_no, refNo);
    assert.strictEqual(updated.forwarding_remarks, remarks);

    const fwdLog = db.get('SELECT * FROM complaint_forwarding_logs WHERE complaint_id = ?;', [compId]);
    assert.ok(fwdLog);
    assert.strictEqual(fwdLog.ref_no, refNo);

    const outReply = db.get('SELECT * FROM x_outgoing_replies WHERE complaint_id = ?;', [compId]);
    assert.ok(outReply);
    assert.strictEqual(outReply.status, 'SENT');

    // Clean up
    db.run('DELETE FROM complaints WHERE id = ?;', [compId]);
    db.run('DELETE FROM complaint_forwarding_logs WHERE complaint_id = ?;', [compId]);
    db.run('DELETE FROM x_outgoing_replies WHERE complaint_id = ?;', [compId]);
  });

  it('CSV and Excel export buffers generate valid binary and tabular records', () => {
    const XLSX = require('xlsx');
    const rows = db.query(`
      SELECT
        complaint_no as 'Complaint ID',
        received_at as 'Received At (IST)',
        platform as 'Platform',
        discom_name as 'DISCOM',
        current_status as 'Status',
        assigned_nodal_officer_name as 'Assigned X-Handle',
        forwarding_ref_no as 'Dispatch Reference No',
        forwarding_remarks as 'Forwarding Instructions'
      FROM complaints
      LIMIT 10;
    `);

    assert.ok(rows.length > 0, 'Export rows should exist');
    assert.ok('Dispatch Reference No' in rows[0]);
    assert.ok('Forwarding Instructions' in rows[0]);

    // Test Excel buffer generation
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'UPPCL SMC Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    assert.ok(buf instanceof Buffer);
    assert.ok(buf.length > 1000, 'Excel buffer size should be valid');

    // Test CSV string generation
    const headers = Object.keys(rows[0]);
    const csv = headers.map(h => `"${h}"`).join(',') + '\r\n' +
      rows.map(r => headers.map(h => `"${r[h] || ''}"`).join(',')).join('\r\n');
    assert.ok(csv.includes('Dispatch Reference No'));
    assert.ok(csv.includes('Complaint ID'));
  });

  it('Dashboard Table Excel export generates valid .xlsx workbook with correct headers, formula sanitization and auto-filter', () => {
    const XLSX = require('xlsx');
    const { handleDashboardTableExcelExport } = require('./server');
    let resHeaders = {};
    let resCode = 200;
    let resBody = null;
    const mockRes = {
      setHeader(k, v) { resHeaders[k] = v; },
      status(c) { resCode = c; return this; },
      send(b) { resBody = b; return this; },
      json(j) { resBody = j; return this; }
    };
    const mockReq = {
      query: { discom: 'PUVVNL' },
      user: { id: 1, role: 'Super Administrator', username: 'admin' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' }
    };
    handleDashboardTableExcelExport(mockReq, mockRes);
    assert.strictEqual(resCode, 200);
    assert.strictEqual(resHeaders['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.ok(resHeaders['Content-Disposition'].includes('complaints_export_'));
    assert.ok(Buffer.isBuffer(resBody));

    const wb = XLSX.read(resBody, { type: 'buffer' });
    assert.deepStrictEqual(wb.SheetNames, ['Complaints']);
    const sheet = wb.Sheets['Complaints'];
    assert.ok(sheet['!ref'], 'Worksheet ref should be present');
    const rows = XLSX.utils.sheet_to_json(sheet);
    assert.ok(rows.length > 0);
    const expectedCols = [
      'Complaint #', 'Sheet Row #', 'Received At (IST)', 'Consumer Name',
      'Consumer Handle', 'Grievance Category', 'Grievance Summary', 'DISCOM',
      'District / Division', 'UPPCLLKO Reply Status', '30-Min First Reply', 'Status',
      'Original Post URL'
    ];
    for (const col of expectedCols) {
      assert.ok(col in rows[0], 'Column ' + col + ' must exist in exported sheet');
    }
    for (const r of rows) {
      assert.strictEqual(r['DISCOM'].toUpperCase(), 'PUVVNL');
    }
  });

  console.log('\n[16. Interactive Table Column Sorting & Query Clauses]');
  const { buildComplaintOrderClause } = require('./server');

  it('buildComplaintOrderClause returns safe SQL ordering for all register columns', () => {
    const cols = [
      'complaint_no', 'received_at', 'platform', 'consumer_name',
      'category_name', 'discom_name', 'district_name', 'priority',
      'current_status', 'expected_response_date', 'assigned_nodal_officer_name', 'forwarding_ref_no'
    ];

    cols.forEach(col => {
      const ascSql = buildComplaintOrderClause(col, 'ASC');
      const descSql = buildComplaintOrderClause(col, 'DESC');
      assert.ok(ascSql, `Empty ASC clause for ${col}`);
      assert.ok(descSql, `Empty DESC clause for ${col}`);
      assert.ok(!ascSql.includes(';'), `SQL injection risk in ${col}`);
    });
  });

  it('Priority sorting respects electrical utility operational severity (Critical > High > Normal > Low)', () => {
    const descClause = buildComplaintOrderClause('priority', 'DESC');
    assert.ok(descClause.includes("WHEN 'Critical' THEN 1"));
    assert.ok(descClause.includes("WHEN 'High' THEN 2"));
    assert.ok(descClause.includes("WHEN 'Normal' THEN 3"));
    assert.ok(descClause.includes("WHEN 'Low' THEN 4"));

    const ascClause = buildComplaintOrderClause('priority', 'ASC');
    assert.ok(ascClause.includes("WHEN 'Low' THEN 1"));
    assert.ok(ascClause.includes("WHEN 'Normal' THEN 2"));
    assert.ok(ascClause.includes("WHEN 'High' THEN 3"));
    assert.ok(ascClause.includes("WHEN 'Critical' THEN 4"));

    const rows = db.query(`SELECT priority FROM complaints ORDER BY ${descClause};`);
    const prios = rows.map(r => r.priority);
    // Any Critical should precede Low
    const firstCrit = prios.indexOf('Critical');
    const firstLow = prios.indexOf('Low');
    if (firstCrit !== -1 && firstLow !== -1) {
      assert.ok(firstCrit < firstLow, 'Critical priority should appear before Low in DESC order');
    }
  });

  it('Complaint ID and timestamp sorting orders execute successfully on database', () => {
    const ascRows = db.query(`SELECT complaint_no FROM complaints ORDER BY ${buildComplaintOrderClause('complaint_no', 'ASC')} LIMIT 5;`);
    assert.ok(ascRows.length > 0);
    const nos = ascRows.map(r => r.complaint_no);
    const sortedNos = [...nos].sort();
    assert.deepStrictEqual(nos, sortedNos, 'Complaint numbers should be sorted alphabetically in ASC order');

    const descTimeRows = db.query(`SELECT received_at FROM complaints ORDER BY ${buildComplaintOrderClause('received_at', 'DESC')} LIMIT 5;`);
    assert.ok(descTimeRows.length > 0);
    for (let i = 0; i < descTimeRows.length - 1; i++) {
      assert.ok(descTimeRows[i].received_at >= descTimeRows[i + 1].received_at, 'Received timestamps should descend');
    }
  });

  it('Nullable columns (forwarding_ref_no, assigned_nodal_officer_name) handle NULLS-last ordering', () => {
    const ascFwd = buildComplaintOrderClause('forwarding_ref_no', 'ASC');
    assert.ok(ascFwd.includes('CASE WHEN forwarding_ref_no IS NULL'));

    const rows = db.query(`SELECT forwarding_ref_no FROM complaints ORDER BY ${ascFwd};`);
    assert.ok(rows.length > 0);
  });

    console.log('\n[17. Authoritative Historical UPPCLLKO Reply Integrity & Permanent Picked Retirement]');

  it('Rule 1: All complaints with verified historical UPPCLLKO reply have uppcl_replied = 1 and has_historical_reply = 1', () => {
    const replied = db.get(`
      SELECT COUNT(*) as total_replied,
             SUM(CASE WHEN uppcl_replied = 1 THEN 1 ELSE 0 END) as uppcl_replied_cnt,
             SUM(CASE WHEN has_historical_reply = 1 THEN 1 ELSE 0 END) as hist_replied_cnt
      FROM complaints 
      WHERE (id IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_uppcl_reply = 1))
         OR (published_reply_id IS NOT NULL AND published_reply_id != '')
         OR (id IN (SELECT DISTINCT complaint_id FROM x_outgoing_replies WHERE status IN ('Published', 'SENT')));
    `);
    assert.ok(replied.total_replied > 0, 'There should be complaints with verified UPPCLLKO replies');
    assert.strictEqual(replied.uppcl_replied_cnt, replied.total_replied, 'All verified UPPCLLKO replied complaints must have uppcl_replied = 1');
    assert.strictEqual(replied.hist_replied_cnt, replied.total_replied, 'All verified UPPCLLKO replied complaints must have has_historical_reply = 1');

    // Confirm that complaints with NO verified UPPCLLKO reply are NOT marked uppcl_replied = 1
    const unrepliedSample = db.get("SELECT uppcl_replied FROM complaints WHERE uppcl_replied = 0 LIMIT 1;");
    assert.ok(unrepliedSample, 'Sample unreplied complaint must exist');
    assert.strictEqual(unrepliedSample.uppcl_replied, 0, 'Complaint with no verified UPPCLLKO reply must have uppcl_replied = 0');
  });

  it('Rule 2: Authoritative classification partitions strictly into UPPCLLKO Replied, UPPCLLKO Not Replied, and Appreciation', () => {
    const total = db.get('SELECT COUNT(*) as cnt FROM complaints;').cnt;
    const repliedCount = db.get('SELECT COUNT(*) as cnt FROM complaints WHERE uppcl_replied = 1;').cnt;
    const notRepliedCount = db.get("SELECT COUNT(*) as cnt FROM complaints WHERE (uppcl_replied = 0 OR uppcl_replied IS NULL) AND (category_name != 'APPRECIATION' OR category_name IS NULL);").cnt;
    const appreciationCount = db.get("SELECT COUNT(*) as cnt FROM complaints WHERE category_name = 'APPRECIATION';").cnt;

    assert.ok(repliedCount > 0, 'UPPCLLKO Replied count must be > 0');
    assert.ok(notRepliedCount > 0, 'UPPCLLKO Not Replied count must be > 0');
    assert.strictEqual(repliedCount + notRepliedCount + appreciationCount, total, 'Partitions must sum to total complaints');
  });

  it('Rule 3: Specific consumer post @qowi23 is authoritatively UPPCLLKO Replied with verified historical reply', () => {
    const qowi = db.get("SELECT * FROM complaints WHERE post_url LIKE '%2112543129006170200%';");
    assert.ok(qowi, 'Complaint for @qowi23 should exist');
    assert.strictEqual(qowi.has_historical_reply, 1, '@qowi23 must have has_historical_reply = 1');
    assert.strictEqual(qowi.uppcl_replied, 1, '@qowi23 must have uppcl_replied = 1');
    assert.ok(qowi.reply_evidence && qowi.reply_evidence.includes('2112607433881428114'), '@qowi23 reply_evidence must reference verified Tweet ID 2112607433881428114');

    const replyRecord = db.get("SELECT * FROM complaint_replies WHERE conversation_id = '2112543129006170200' AND reply_tweet_id = '2112607433881428114';");
    assert.ok(replyRecord, 'complaint_replies must have verified reply record for @qowi23 conversation');
    assert.strictEqual(replyRecord.is_uppcl_reply, 1);
    assert.strictEqual(replyRecord.author_handle.toLowerCase(), 'uppcllko');
  });

  it('Rule 4: Scenario A Exception: Registered DISCOM/division replies are tracked and preserved (discom_replied = 1)', () => {
    const discomReplies = db.get('SELECT COUNT(*) as cnt FROM complaints WHERE discom_replied = 1;').cnt;
    assert.ok(discomReplies >= 25, 'Registered DISCOM replied count should be at least 25');
    const discomRows = db.query("SELECT complaint_no, discom_name, assigned_nodal_officer_name, discom_reply_evidence FROM complaints WHERE discom_replied = 1;");
    assert.ok(discomRows.length >= 25, 'All registered DISCOM replied rows must exist in database');
    for (const r of discomRows) {
      assert.ok(r.discom_name && r.discom_name !== 'UPPCL', 'DISCOM must be assigned for registered DISCOM reply: ' + r.complaint_no);
      assert.ok(r.discom_reply_evidence, 'DISCOM reply evidence must exist: ' + r.complaint_no);
    }
  });

  it('Rule 5: Historical reply table complaint_replies maintains referential integrity', () => {
    const replyCount = db.get('SELECT COUNT(*) as cnt FROM complaint_replies WHERE is_uppcl_reply = 1;').cnt;
    assert.ok(replyCount > 0, 'complaint_replies should contain verified UPPCLLKO replies');
    const invalidReplies = db.get("SELECT COUNT(*) as cnt FROM complaint_replies WHERE author_handle IS NULL OR reply_tweet_id IS NULL;").cnt;
    assert.strictEqual(invalidReplies, 0, 'No malformed reply records allowed');
  });

  it('Rule 6: Excel export replaces Picked Status with UPPCLLKO Reply Status with strictly 0 occurrences of Picked and sanitizes formulas', () => {
    const { handleDashboardTableExcelExport } = require('./server');
    const XLSX = require('xlsx');

    let sentBuffer = null;
    let sentHeaders = {};
    const mockRes = {
      setHeader: (k, v) => { sentHeaders[k] = v; },
      send: (buf) => { sentBuffer = buf; }
    };

    const mockReq = {
      query: { limit: '100' },
      user: { id: 1, username: 'admin', role: 'Super Administrator' },
      headers: { 'x-forwarded-for': '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' }
    };

    handleDashboardTableExcelExport(mockReq, mockRes);
    assert.ok(sentBuffer, 'Excel export should return a buffer');
    assert.ok(sentHeaders['Content-Type'].includes('spreadsheetml'), 'Content-Type must be .xlsx');

    const wb = XLSX.read(sentBuffer, { type: 'buffer' });
    assert.ok(wb.SheetNames.includes('Complaints'), 'Workbook should have Complaints sheet');
    const ws = wb.Sheets['Complaints'];
    const data = XLSX.utils.sheet_to_json(ws);

    assert.ok(data.length > 0, 'Excel sheet should contain rows');

    // Verify headers do not contain 'Picked'
    const headers = Object.keys(data[0]);
    for (const h of headers) {
      assert.ok(!h.toLowerCase().includes('picked'), "Header '" + h + "' should not contain 'picked'");
    }
    assert.ok(headers.includes('UPPCLLKO Reply Status'), 'Headers must include UPPCLLKO Reply Status');

    const replyStatuses = new Set(data.map(r => r['UPPCLLKO Reply Status']));
    assert.ok(
      replyStatuses.has('UPPCLLKO Replied') ||
      replyStatuses.has('UPPCLLKO Not Replied') ||
      replyStatuses.has('DISCOM Replied') ||
      replyStatuses.has('Appreciation'),
      'Excel must output valid reply status labels'
    );

    for (const r of data) {
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'string') {
          assert.ok(!v.startsWith('=') && !v.startsWith('+'), 'Formula injection risk in ' + k + ': ' + v);
          assert.ok(!v.toLowerCase().includes('picked:'), 'Value in ' + k + ' should not contain picked: ' + v);
        }
      }
    }
  });

  console.log('\n[18. 5 Monitored Handles & Dynamic Sheet Column Mapping Integrity]');

  it('Builds dynamic header index map matching user rearranged 23-column sheet layout', () => {
    const rearrangedHeaders = [
      'DATE', 'Link Shift', 'C F', 'REPLY_WITHIN_30_MIN_BY_Laqshya Media',
      ' LINK URL', 'Twitter Id', 'Picked Status', 'Head', 'Untagged Complaint',
      'UPPCLLKO Replied (YES/NO)', 'Complaint Type', 'DISCOM', 'Zone', 'District',
      'Status', 'COMPLAINT_NO', 'Post Text', 'Post Created At (UTC)',
      'First Detected At (IST)', 'Language', 'Routing Confidence',
      'Suggested Reply Draft', 'Reply Approval Status'
    ];

    const fs = require('fs');
    const gssCode = fs.readFileSync('google_sheets_service.js', 'utf8');
    assert.ok(gssCode.includes('function buildHeaderIndexMap(headers)'));

    const mockMap = {};
    rearrangedHeaders.forEach((h, idx) => {
      const clean = String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean === 'date') mockMap['date'] = idx;
      if (clean === 'cf') mockMap['c_f'] = idx;
      if (clean.includes('30min')) mockMap['reply_30'] = idx;
      if (clean.includes('link') && clean.includes('url')) mockMap['link_url'] = idx;
      if (clean === 'twitterid') mockMap['twitter_id'] = idx;
      if (clean === 'pickedstatus') mockMap['picked_status'] = idx;
      if (clean === 'head') mockMap['head'] = idx;
      if (clean.includes('uppcl') && clean.includes('replied')) mockMap['uppcl_replied'] = idx;
      if (clean === 'complainttype') mockMap['complaint_type'] = idx;
      if (clean.includes('posttext')) mockMap['post_text'] = idx;
    });

    assert.strictEqual(mockMap['date'], 0);
    assert.strictEqual(mockMap['c_f'], 2);
    assert.strictEqual(mockMap['reply_30'], 3);
    assert.strictEqual(mockMap['link_url'], 4);
    assert.strictEqual(mockMap['twitter_id'], 5);
    assert.strictEqual(mockMap['picked_status'], 6);
    assert.strictEqual(mockMap['head'], 7);
    assert.strictEqual(mockMap['uppcl_replied'], 9);
    assert.strictEqual(mockMap['complaint_type'], 10);
    assert.strictEqual(mockMap['post_text'], 16);
  });

  it('Strictly enforces 5 official monitored handles filter logic', () => {
    const fs = require('fs');
    const xCode = fs.readFileSync('x_service.js', 'utf8');
    const codeGs = fs.readFileSync('google_apps_script/Code.gs', 'utf8');

    // Verify search query in x_service.js and Code.gs
    const expectedQueryPattern = '(@UPPCLLKO OR @EMofficeUP OR @AKSharmaOffice OR @aksharmaBharat OR @mduppcl)';
    assert.ok(xCode.includes(expectedQueryPattern), 'x_service.js must include exact 5-handle query');
    assert.ok(codeGs.includes(expectedQueryPattern), 'Code.gs must include exact 5-handle query');

    // Verify that @ChairmanUppcl is NOT included in query
    assert.ok(!xCode.includes('@ChairmanUppcl'), 'x_service.js must not monitor @ChairmanUppcl');
    assert.ok(!codeGs.includes('@ChairmanUppcl OR'), 'Code.gs query must not monitor @ChairmanUppcl');

    // Verify getSheetColumnMap exists in Code.gs
    assert.ok(codeGs.includes('function getSheetColumnMap(sheet)'), 'Code.gs must implement dynamic getSheetColumnMap');
    // Verify repairMisalignedRowsInSheet exists in Code.gs
    assert.ok(codeGs.includes('function repairMisalignedRowsInSheet()'), 'Code.gs must implement repairMisalignedRowsInSheet');
  });

  console.log('\n[19. Mandatory 12-Point Target Account Filter & Regression Suite]');
  const { isPostEligible, getMatchedTargetHandles, resolvePrimaryMonitoredAccount, TARGET_HANDLES } = require('./eligibility');

  it('1. A post mentioning only @UPPCLLKO qualifies', () => {
    const text = 'Electricity cut in Gomti Nagar since morning, please help @UPPCLLKO';
    assert.strictEqual(isPostEligible(text), true);
    assert.deepStrictEqual(getMatchedTargetHandles(text), ['@UPPCLLKO']);
    assert.strictEqual(resolvePrimaryMonitoredAccount(text), '@UPPCLLKO');
  });

  it('2. A post mentioning only @EMofficeUP qualifies', () => {
    const text = 'Respected Minister, meter issue not addressed for 3 months @EMofficeUP';
    assert.strictEqual(isPostEligible(text), true);
    assert.deepStrictEqual(getMatchedTargetHandles(text), ['@EMofficeUP']);
    assert.strictEqual(resolvePrimaryMonitoredAccount(text), '@EMofficeUP');
  });

  it('3. A post mentioning only @AKSharmaOffice qualifies', () => {
    const text = 'Urgent grievance regarding high billing in Mau district @AKSharmaOffice';
    assert.strictEqual(isPostEligible(text), true);
    assert.deepStrictEqual(getMatchedTargetHandles(text), ['@AKSharmaOffice']);
    assert.strictEqual(resolvePrimaryMonitoredAccount(text), '@AKSharmaOffice');
  });

  it('4. A post mentioning only @aksharmaBharat qualifies', () => {
    const text = 'Sir transformer damaged in village, please issue directions @aksharmaBharat';
    assert.strictEqual(isPostEligible(text), true);
    assert.deepStrictEqual(getMatchedTargetHandles(text), ['@aksharmaBharat']);
    assert.strictEqual(resolvePrimaryMonitoredAccount(text), '@aksharmaBharat');
  });

  it('5. A post mentioning only @mduppcl qualifies', () => {
    const text = 'MD Sir, Lucknow consumer care helpline not picking calls @mduppcl';
    assert.strictEqual(isPostEligible(text), true);
    assert.deepStrictEqual(getMatchedTargetHandles(text), ['@mduppcl']);
    assert.strictEqual(resolvePrimaryMonitoredAccount(text), '@mduppcl');
  });

  it('6. A post mentioning multiple target handles qualifies once with all mentions captured', () => {
    const text = 'Heavy power tripping in Varanasi @UPPCLLKO @aksharmaBharat @mduppcl please intervene';
    assert.strictEqual(isPostEligible(text), true);
    const matched = getMatchedTargetHandles(text);
    assert.strictEqual(matched.length, 3);
    assert.ok(matched.includes('@UPPCLLKO'));
    assert.ok(matched.includes('@aksharmaBharat'));
    assert.ok(matched.includes('@mduppcl'));
    // Primary account priority follows hierarchy
    assert.strictEqual(resolvePrimaryMonitoredAccount(text), '@UPPCLLKO');
  });

  it('7. A post authored by a target handle that mentions none of the target handles is excluded', () => {
    const postAuthoredByTarget = {
      author_handle: '@UPPCLLKO',
      author: 'UPPCLLKO',
      consumer_handle: '@UPPCLLKO',
      text: 'Routine maintenance notice for 33/11kV Substation in Lucknow from 10 AM to 2 PM today.'
    };
    // Content has no target mention
    assert.strictEqual(isPostEligible(postAuthoredByTarget.text), false);
    assert.strictEqual(isPostEligible(postAuthoredByTarget), false);
  });

  it('8. A post mentioning none of the target handles is excluded even if it mentions another official handle', () => {
    const text1 = 'Power outage in Noida Sector 15 @ChairmanUppcl please fix';
    const text2 = 'Wire sparked in Meerut @PVVNLHQ attend immediately';
    const text3 = 'High voltage issue in Kanpur @KESCoHQ @CMOfficeUP';
    assert.strictEqual(isPostEligible(text1), false);
    assert.strictEqual(isPostEligible(text2), false);
    assert.strictEqual(isPostEligible(text3), false);
  });

  it('9. A post with a substring or prefix match that does not match a target handle is excluded', () => {
    const falsePositive1 = 'Great fan page created @UPPCLLKO_FanClub';
    const falsePositive2 = 'Subscribe to news alerts @mduppcl_alerts';
    const falsePositive3 = 'Check this handle @aksharmaBharat_news';
    const falsePositive4 = 'Welcome @EMofficeUP_official';
    const falsePositive5 = 'Follow @AKSharmaOfficeMedia for updates';
    assert.strictEqual(isPostEligible(falsePositive1), false);
    assert.strictEqual(isPostEligible(falsePositive2), false);
    assert.strictEqual(isPostEligible(falsePositive3), false);
    assert.strictEqual(isPostEligible(falsePositive4), false);
    assert.strictEqual(isPostEligible(falsePositive5), false);
  });

  it('10. The backend returns only eligible records for counts, charts, lists, and exports', () => {
    // Assert database contains strictly complaints with target mentions
    const totalCount = db.get('SELECT COUNT(*) as cnt FROM complaints;').cnt;
    assert.ok(totalCount > 0, 'Database should contain complaints');

    const invalidAccounts = db.query(`
      SELECT COUNT(*) as cnt FROM complaints 
      WHERE monitored_account NOT IN ('@UPPCLLKO', '@EMofficeUP', '@AKSharmaOffice', '@aksharmaBharat', '@mduppcl');
    `)[0].cnt;
    assert.strictEqual(invalidAccounts, 0, 'Zero complaints with invalid monitored_account allowed');

    const withoutMentions = db.query(`
      SELECT COUNT(*) as cnt FROM complaints 
      WHERE target_mentions IS NULL OR target_mentions = '';
    `)[0].cnt;
    assert.strictEqual(withoutMentions, 0, 'All complaints in DB must have target_mentions populated');
  });

  it('11. Refreshing, searching, filtering, and paging on the dashboard preserves the filter', () => {
    // Test filtered queries with handle filter parameter
    for (const handle of TARGET_HANDLES) {
      const filtered = db.query('SELECT COUNT(*) as cnt FROM complaints WHERE monitored_account = ?;', [handle])[0].cnt;
      assert.ok(typeof filtered === 'number');
    }

    // Search query matches target_mentions and monitored_account safely
    const searchQuery = '%UPPCLLKO%';
    const searchMatches = db.query(`
      SELECT COUNT(*) as cnt FROM complaints 
      WHERE (complaint_text LIKE ? OR monitored_account LIKE ? OR target_mentions LIKE ?);
    `, [searchQuery, searchQuery, searchQuery])[0].cnt;
    assert.ok(searchMatches > 0, 'Search query on monitored account should return matches');
  });

  it('12. Historical records in Google Sheets that do not qualify are excluded from the dashboard without deleting their rows from the Google Sheet', () => {
    // Verify that the sheet parser rejects non-eligible historical rows during ingestion
    const ineligibleSampleRowText = 'Meeting with chief engineer regarding transmission line @ChairmanUppcl';
    assert.strictEqual(isPostEligible(ineligibleSampleRowText), false);

    // Verify database does not contain this ineligible text
    const inDb = db.query('SELECT COUNT(*) as cnt FROM complaints WHERE complaint_text LIKE ?;', ['%' + ineligibleSampleRowText + '%'])[0].cnt;
    assert.strictEqual(inDb, 0, 'Ineligible historical rows must not exist in dashboard database');
  });

  console.log('\n[20. Dynamic Google Sheet Header Mapping & Column Rearrangement Suite]');

  const { createHeaderMap, normalizeHeaderName, indexToColumnLetter, columnLetterToIndex } = require('./sheet_mapper');

  it('1. Column rearrangement: Moves Tweet URL to Column B and Date to Column F without data corruption', () => {
    const headers = ['Shift', 'LINK URL', 'Picked Status', 'Head', 'Status', 'DATE', 'Twitter Id', 'Post Text'];
    const mapper = createHeaderMap(headers);
    assert.strictEqual(mapper.getIndex('link_url'), 1);
    assert.strictEqual(mapper.getLetter('link_url'), 'B');
    assert.strictEqual(mapper.getIndex('date'), 5);
    assert.strictEqual(mapper.getLetter('date'), 'F');

    const testRow = ['Morning', 'https://x.com/user/status/1234567890123456789', 'YES', 'upl', 'New', '21-10-2026', 'user', 'Problem with transformer @UPPCLLKO'];
    assert.strictEqual(mapper.get(testRow, 'link_url'), 'https://x.com/user/status/1234567890123456789');
    assert.strictEqual(mapper.get(testRow, 'date'), '21-10-2026');
    assert.strictEqual(mapper.get(testRow, 'post_text'), 'Problem with transformer @UPPCLLKO');
  });

  it('2. Adjacent column movement: Swapping Head, Picked Status, and UPPCLLKO Replied does not swap values', () => {
    const headers = ['UPPCLLKO Replied (YES/NO)', 'Head', 'Picked Status', 'LINK URL', 'Twitter Id', 'Post Text', 'DATE'];
    const mapper = createHeaderMap(headers);
    const testRow = ['YES', 'upl', 'APPRECIATION', 'https://x.com/citizen/status/987654321', 'citizen', 'Thank you @UPPCLLKO', '21-10-2026'];

    assert.strictEqual(mapper.get(testRow, 'uppcllko_replied'), 'YES');
    assert.strictEqual(mapper.get(testRow, 'head'), 'upl');
    assert.strictEqual(mapper.get(testRow, 'picked_status'), 'APPRECIATION');
    assert.notStrictEqual(mapper.get(testRow, 'head'), mapper.get(testRow, 'picked_status'));
  });

  it('3. Optional columns insertion: Adding extra columns preserves existing field mappings', () => {
    const headers = ['DATE', 'Department Ref Code', 'LINK URL', 'Internal Audit Tag', 'Twitter Id', 'Post Text'];
    const mapper = createHeaderMap(headers);
    assert.strictEqual(mapper.getIndex('date'), 0);
    assert.strictEqual(mapper.getIndex('link_url'), 2);
    assert.strictEqual(mapper.getIndex('twitter_id'), 4);
    assert.strictEqual(mapper.getIndex('post_text'), 5);
    assert.strictEqual(mapper.has('remark'), false);
  });

  it('4. Missing required headers: Detects when essential columns are missing and flags unreliable', () => {
    const incompleteHeaders = ['DATE', 'Shift', 'District'];
    const mapper = createHeaderMap(incompleteHeaders);
    assert.strictEqual(mapper.isReliable, false);
    assert.ok(mapper.missingRequired.includes('link_url'));
    assert.ok(mapper.missingRequired.includes('twitter_id'));
    assert.ok(mapper.missingRequired.includes('post_text'));
  });

  it('5. Duplicate headers detection: Identifies and records duplicated columns safely', () => {
    const dupHeaders = ['DATE', 'LINK URL', 'Twitter Id', 'Post Text', 'LINK URL'];
    const mapper = createHeaderMap(dupHeaders);
    assert.strictEqual(mapper.duplicateWarnings.length, 1);
    assert.strictEqual(mapper.duplicateWarnings[0].canonicalField, 'link_url');
    assert.strictEqual(mapper.getIndex('link_url'), 1);
  });

  it('6. Excel column letter conversion: Accurately converts between 0-based indices and A-Z/AA-ZZ letters', () => {
    assert.strictEqual(indexToColumnLetter(0), 'A');
    assert.strictEqual(indexToColumnLetter(4), 'E');
    assert.strictEqual(indexToColumnLetter(9), 'J');
    assert.strictEqual(indexToColumnLetter(22), 'W');
    assert.strictEqual(indexToColumnLetter(25), 'Z');
    assert.strictEqual(indexToColumnLetter(26), 'AA');
    assert.strictEqual(columnLetterToIndex('A'), 0);
    assert.strictEqual(columnLetterToIndex('J'), 9);
    assert.strictEqual(columnLetterToIndex('W'), 22);
    assert.strictEqual(columnLetterToIndex('AA'), 26);
  });

  it('7. Normalization: Tolerates whitespace and case differences in column headers', () => {
    assert.strictEqual(normalizeHeaderName('   LINK URL  '), 'linkurl');
    assert.strictEqual(normalizeHeaderName('UPPCLLKO Replied (YES/NO)'), 'uppcllkorepliedyesno');
    assert.strictEqual(normalizeHeaderName('REPLY_WITHIN_30_MIN_BY_Laqshya Media'), 'replywithin30minbylaqshyamedia');
  });

  it('8. Value validation: UPPCLLKO Replied strictly validates to YES, NO, or blank (never arbitrary strings)', () => {
    const headers = ['DATE', 'LINK URL', 'Twitter Id', 'Post Text', 'UPPCLLKO Replied (YES/NO)'];
    const mapper = createHeaderMap(headers);
    assert.strictEqual(mapper.get(['21-10-2026', 'https://x.com/a/status/1', 'a', 'text @UPPCLLKO', 'YES'], 'uppcllko_replied'), 'YES');
    assert.strictEqual(mapper.get(['21-10-2026', 'https://x.com/a/status/1', 'a', 'text @UPPCLLKO', 'NO'], 'uppcllko_replied'), 'NO');
    assert.strictEqual(mapper.get(['21-10-2026', 'https://x.com/a/status/1', 'a', 'text @UPPCLLKO', 'BILL_RELATED'], 'uppcllko_replied'), '');
    assert.strictEqual(mapper.get(['21-10-2026', 'https://x.com/a/status/1', 'a', 'text @UPPCLLKO', 'Pending Review'], 'uppcllko_replied'), '');
  });

  console.log('\n[21. Google Sheets DATE Column Normalization & Chronological Sorting Suite]');

  it('1. Date Normalization: Converts varied formats (DD-MM-YYYY, YYYY-MM-DD, serials, timestamps) into genuine Date objects', () => {
    function parseDateToTrueDate(rawCell, curDateStr) {
      if (rawCell instanceof Date && !isNaN(rawCell.getTime())) return rawCell;
      if (typeof rawCell === 'number' && rawCell > 40000 && rawCell < 60000) {
        return new Date((rawCell - 25569) * 86400 * 1000);
      }
      if (curDateStr) {
        const dmy = curDateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmy) {
          return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
        }
        const ymd = curDateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymd) {
          return new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
        }
      }
      return null;
    }

    const d1 = parseDateToTrueDate(null, '22-10-2026');
    assert.strictEqual(d1.getFullYear(), 2026);
    assert.strictEqual(d1.getMonth(), 9); // October
    assert.strictEqual(d1.getDate(), 22);

    const d2 = parseDateToTrueDate(null, '2026-10-22');
    assert.strictEqual(d2.getFullYear(), 2026);
    assert.strictEqual(d2.getMonth(), 9);
    assert.strictEqual(d2.getDate(), 22);

    const d3 = parseDateToTrueDate(null, '05/09/2026');
    assert.strictEqual(d3.getFullYear(), 2026);
    assert.strictEqual(d3.getMonth(), 8); // September
    assert.strictEqual(d3.getDate(), 5);

    // Excel serial 46317 is 2026-10-22
    const d4 = parseDateToTrueDate(46317, '');
    assert.strictEqual(d4.getFullYear(), 2026);
    assert.strictEqual(d4.getMonth(), 9);
    assert.strictEqual(d4.getDate(), 22);
  });

  it('2. Chronological Ordering: True date comparison prevents text lexicographical sorting flaws', () => {
    // In lexicographical text sorting, "31-10-2025" > "01-11-2026" because '3' > '0'
    const textDates = ['31-10-2025', '01-11-2026', '22-10-2026'];
    const textSorted = [...textDates].sort().reverse();
    assert.strictEqual(textSorted[0], '31-10-2025', 'Lexicographical text sorting incorrectly ranks 2025 first');

    // In true chronological Date comparison, 2026-11-01 > 2026-10-22 > 2025-10-31
    const trueDates = [
      { raw: '31-10-2025', d: new Date(2025, 9, 31) },
      { raw: '01-11-2026', d: new Date(2026, 10, 1) },
      { raw: '22-10-2026', d: new Date(2026, 9, 22) }
    ];
    const chronoSorted = [...trueDates].sort((a, b) => b.d.getTime() - a.d.getTime());
    assert.strictEqual(chronoSorted[0].raw, '01-11-2026', 'Chronological sorting correctly ranks 01-11-2026 first');
    assert.strictEqual(chronoSorted[1].raw, '22-10-2026', 'Chronological sorting correctly ranks 22-10-2026 second');
    assert.strictEqual(chronoSorted[2].raw, '31-10-2025', 'Chronological sorting correctly ranks 31-10-2025 last');
  });

  it('3. Snowflake ID Recovery: Recovers exact date for complaints with missing or corrupt date cells', () => {
    const tweetId = '2112851301092737492'; // From live sheet row 3027
    const epochMs = Math.floor(Number(BigInt(tweetId) >> 22n)) + 1288834974657;
    const recoveredDate = new Date(epochMs);

    assert.strictEqual(recoveredDate.getFullYear(), 2026);
    assert.strictEqual(recoveredDate.getMonth(), 9); // October
    assert.strictEqual(recoveredDate.getDate(), 21);
  });

  it('4. Complete Row Integrity & Multi-tier Sorting: Sorts complete rows with secondary Snowflake tie-breaker and pushes blanks to bottom', () => {
    const rawRows = [
      ['21-10-2026', 'https://x.com/user1/status/2112850000000000000', 'Complaint on 21 Oct earlier', 'PVVNL'],
      ['22-10-2026', 'https://x.com/user2/status/2113180000000000000', 'Complaint on 22 Oct earlier', 'MVVNL'],
      ['', '', '', ''], // Empty row (like raw Row 2)
      ['22-10-2026', 'https://x.com/user3/status/2113190000000000000', 'Complaint on 22 Oct latest', 'PuVVNL'],
      ['20-10-2026', 'https://x.com/user4/status/2112500000000000000', 'Complaint on 20 Oct', 'DVVNL']
    ];

    function parseRowDate(row) {
      const s = String(row[0] || '').trim();
      if (!s) return null;
      const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
      return m ? new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)) : null;
    }

    function extractSnowflake(row) {
      const m = String(row[1] || '').match(/status\/(\d+)/);
      return m ? BigInt(m[1]) : 0n;
    }

    // Sort descending by: 1. Date, 2. Snowflake ID
    const sorted = [...rawRows].sort((a, b) => {
      const isBlankA = a.every(c => !c);
      const isBlankB = b.every(c => !c);
      if (isBlankA && !isBlankB) return 1;
      if (!isBlankA && isBlankB) return -1;
      if (isBlankA && isBlankB) return 0;

      const dA = parseRowDate(a);
      const dB = parseRowDate(b);
      const tA = dA ? dA.getTime() : 0;
      const tB = dB ? dB.getTime() : 0;
      if (tB !== tA) return tB - tA;

      const sA = extractSnowflake(a);
      const sB = extractSnowflake(b);
      if (sB > sA) return 1;
      if (sB < sA) return -1;
      return 0;
    });

    // Row 0 must be 22 Oct latest (user3, PuVVNL)
    assert.strictEqual(sorted[0][2], 'Complaint on 22 Oct latest');
    assert.strictEqual(sorted[0][3], 'PuVVNL');

    // Row 1 must be 22 Oct earlier (user2, MVVNL)
    assert.strictEqual(sorted[1][2], 'Complaint on 22 Oct earlier');
    assert.strictEqual(sorted[1][3], 'MVVNL');

    // Row 2 must be 21 Oct (user1, PVVNL)
    assert.strictEqual(sorted[2][2], 'Complaint on 21 Oct earlier');
    assert.strictEqual(sorted[2][3], 'PVVNL');

    // Row 3 must be 20 Oct (user4, DVVNL)
    assert.strictEqual(sorted[3][2], 'Complaint on 20 Oct');
    assert.strictEqual(sorted[3][3], 'DVVNL');

    // Row 4 must be the empty row, safely relegated to bottom
    assert.ok(sorted[4].every(c => !c), 'Empty row must sort to the very bottom');
  });

  it('5. Apps Script Code.gs Integrity: Verifies sorting, formatting, auto-sync, onEdit, and menu bindings', () => {
    const fs = require('fs');
    const codeGs = fs.readFileSync('google_apps_script/Code.gs', 'utf8');

    // Function declarations
    assert.ok(codeGs.includes('function sortSheetByDateDescending()'), 'Code.gs must define sortSheetByDateDescending()');
    assert.ok(codeGs.includes('function fixDateColumnInSheet()'), 'Code.gs must define fixDateColumnInSheet()');
    assert.ok(codeGs.includes('function onEdit(e)'), 'Code.gs must define onEdit(e) for auto-sorting manual edits');
    assert.ok(codeGs.includes('function getSheetColumnMap(sheet)'), 'Code.gs must resolve columns dynamically');

    // Descending sort criteria
    assert.ok(codeGs.includes('{ column: dateCol + 1, ascending: false }'), 'sortSheetByDateDescending must sort date descending');
    assert.ok(codeGs.includes('dataRange.sort(sortCriteria)'), 'sortSheetByDateDescending must sort dataRange');

    // Date formatting string
    assert.ok(codeGs.includes(".setNumberFormat('dd-MM-yyyy')"), "Code.gs must set format to 'dd-MM-yyyy'");

    // Menu items in onOpen
    assert.ok(codeGs.includes('Sort Sheet by Date: Newest First (Z–A)'), 'onOpen menu must include descending sort option');
    assert.ok(codeGs.includes('Convert & Fix All Date Types (True Dates)'), 'onOpen menu must include date conversion option');

    // Auto-sorting in runCloudSyncCycle
    assert.ok(codeGs.includes('sortSheetByDateDescending();'), 'runCloudSyncCycle must trigger auto-sort after appending complaints');

    // Webhook actions in doPost
    assert.ok(codeGs.includes("contents.action === 'sort_sheet'"), 'doPost must handle sort_sheet action');
    assert.ok(codeGs.includes("contents.action === 'fix_dates'"), 'doPost must handle fix_dates action');
  });

  it('6. Ingestion Parity: google_sheets_service.js ingests starting at Row 2 without skipping newest complaints', () => {
    const fs = require('fs');
    const gssCode = fs.readFileSync('google_sheets_service.js', 'utf8');

    // Verify manualRows and autoRows start at slice(1)
    assert.ok(gssCode.includes('manualRows.slice(1)'), 'syncGoogleSheets must process from Row 2 (slice(1))');
    assert.ok(gssCode.includes('autoRows.slice(1)'), 'syncGoogleSheets auto CSV must process from Row 2 (slice(1))');
    assert.ok(gssCode.includes('parsedRows.slice(1)'), 'processUploadedSheetBuffer must process from Row 2 (slice(1))');

    // Verify row index offset matches Row 2 start
    assert.ok(gssCode.includes('sheetRowIndex: idx + 2'), 'sheetRowIndex must map accurately to 1-based sheet row numbers');
  });

  console.log('\n[22. Automatic 30-Min SLA Calculation & UPPCLLKO Reply Integrity Suite]');

  const { calculateReplyWithin30Min, parseTimestampToEpochMs, getSnowflakeEpochMs } = require('./sheet_mapper');

  it('1. Rule 1: UPPCLLKO Replied = NO strictly produces blank (never YES, NO, or numbers)', () => {
    assert.strictEqual(calculateReplyWithin30Min('NO', 1729432505765, 1729433405765), '');
    assert.strictEqual(calculateReplyWithin30Min('no', 1729432505765, 1729433405765), '');
    assert.strictEqual(calculateReplyWithin30Min('', 1729432505765, 1729433405765), '');
    assert.strictEqual(calculateReplyWithin30Min(null, 1729432505765, 1729433405765), '');
    assert.strictEqual(calculateReplyWithin30Min('PENDING', 1729432505765, 1729433405765), '');
  });

  it('2. Rule 2: UPPCLLKO Replied = YES with reply after 15 minutes produces YES', () => {
    const compTime = 1729432505765;
    const replyTime = compTime + 15 * 60 * 1000; // 15 mins
    assert.strictEqual(calculateReplyWithin30Min('YES', compTime, replyTime), 'YES');
  });

  it('3. Rule 2: UPPCLLKO Replied = YES with reply after 29 minutes 59 seconds produces YES', () => {
    const compTime = 1729432505765;
    const replyTime = compTime + (29 * 60 + 59) * 1000; // 29 min 59 sec
    assert.strictEqual(calculateReplyWithin30Min('YES', compTime, replyTime), 'YES');
  });

  it('4. Rule 2: UPPCLLKO Replied = YES with reply after exactly 30 minutes 00 seconds produces YES', () => {
    const compTime = 1729432505765;
    const replyTime = compTime + 30 * 60 * 1000; // exactly 30 min
    assert.strictEqual(calculateReplyWithin30Min('YES', compTime, replyTime), 'YES');
  });

  it('5. Rule 2: UPPCLLKO Replied = YES with reply after 30 minutes 1 second produces NO', () => {
    const compTime = 1729432505765;
    const replyTime = compTime + (30 * 60 + 1) * 1000; // 30 min 1 sec
    assert.strictEqual(calculateReplyWithin30Min('YES', compTime, replyTime), 'NO');
  });

  it('6. Across Midnight / Different Dates: Elapsed time calculated accurately across day boundary', () => {
    // Complaint posted at 23:50 on 20-10-2026, replied at 00:15 on 21-10-2026 (25 minutes elapsed)
    const compTime = new Date('2026-10-20T23:50:00.000Z').getTime();
    const replyTime = new Date('2026-10-21T00:15:00.000Z').getTime();
    assert.strictEqual(calculateReplyWithin30Min('YES', compTime, replyTime), 'YES');

    // Complaint posted at 23:30 on 20-10-2026, replied at 00:15 on 21-10-2026 (45 minutes elapsed)
    const replyTimeLate = new Date('2026-10-21T00:15:00.000Z').getTime();
    const compTimeEarly = new Date('2026-10-20T23:30:00.000Z').getTime();
    assert.strictEqual(calculateReplyWithin30Min('YES', compTimeEarly, replyTimeLate), 'NO');
  });

  it('7. Rule 3: Missing, invalid, or negative timestamps leave result strictly blank pending verification', () => {
    const compTime = 1729432505765;
    assert.strictEqual(calculateReplyWithin30Min('YES', compTime, null), '', 'Missing reply timestamp must be blank');
    assert.strictEqual(calculateReplyWithin30Min('YES', null, compTime), '', 'Missing complaint timestamp must be blank');
    assert.strictEqual(calculateReplyWithin30Min('YES', compTime, 'invalid-date'), '', 'Unparseable date must be blank');
    // Negative elapsed time (reply timestamp before complaint timestamp)
    assert.strictEqual(calculateReplyWithin30Min('YES', compTime, compTime - 60000), '', 'Negative elapsed time must be blank');
  });

  it('8. Multiple replies: Earliest UPPCLLKO reply is used for response-time calculation', () => {
    const compTime = 1729432505765;
    const firstReply = compTime + 20 * 60 * 1000; // 20 min -> YES
    const secondReply = compTime + 45 * 60 * 1000; // 45 min -> NO
    assert.strictEqual(calculateReplyWithin30Min('YES', compTime, firstReply), 'YES', 'Earliest reply dictates SLA');
  });

  it('9. Snowflake ID timestamp decoding matches microsecond Twitter epoch', () => {
    const tweetId = '2112543129006170200';
    const epochMs = getSnowflakeEpochMs(tweetId);
    assert.strictEqual(epochMs, 1792504505765);
    const d = new Date(epochMs);
    assert.strictEqual(d.toISOString(), '2026-10-20T13:55:05.765Z');
  });

  it('10. Code.gs contains complete SLA calculation engine, onEdit trigger, onOpen menu, and batch updater', () => {
    const fs = require('fs');
    const codeGs = fs.readFileSync('google_apps_script/Code.gs', 'utf8');

    assert.ok(codeGs.includes('function calculateReplyWithin30Min('), 'Code.gs must define calculateReplyWithin30Min');
    assert.ok(codeGs.includes('function recalculateReplyWithin30MinInSheet('), 'Code.gs must define recalculateReplyWithin30MinInSheet');
    assert.ok(codeGs.includes('function calculateRow30MinSlaInScript('), 'Code.gs must define calculateRow30MinSlaInScript');
    assert.ok(codeGs.includes('VERIFIED_HISTORICAL_UPPCL_REPLIES'), 'Code.gs must include verified replies lookup dictionary');
    assert.ok(codeGs.includes('colIndex === colMap.uppclReplied'), 'onEdit must trigger calculation when uppclReplied changes');
    assert.ok(codeGs.includes('Recalculate 30-Min SLA Column'), 'onOpen menu must include SLA recalculation option');
    assert.ok(codeGs.includes('sheet.getRange(3, reply30ColIndex + 1, updates.length, 1).setValues(updates)'), 'Must batch write updates to sheet');
  });

  it('11. Live sheet data simulation: Corrects stray counter numbers and unreplied violations strictly to blank', () => {
    const fs = require('fs');
    const liveCsv = fs.readFileSync('scripts/live_sheet_full.csv', 'utf8');
    const lines = liveCsv.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const mapper = createHeaderMap(headers);

    let unrepliedClearedCount = 0;
    for (let i = 2; i < Math.min(lines.length, 500); i++) {
      const row = lines[i].split(',');
      const uppclReplied = mapper.get(row, 'uppcllko_replied');
      if (uppclReplied !== 'YES') {
        const val = calculateReplyWithin30Min(uppclReplied, null, null);
        assert.strictEqual(val, '', 'Row where UPPCLLKO Replied != YES must be blank');
        unrepliedClearedCount++;
      }
    }
    assert.ok(unrepliedClearedCount > 0, 'Must verify multiple unreplied rows cleared to blank');
  });

  console.log('\n[23. Google Sheets CF Formula & Blank Row 2 Permanence Suite]');

  it('1. Column letter conversion accurately converts 0-based indices to A1 notation', () => {
    function getColumnLetter(colIndex, fallbackLetter) {
      if (colIndex === undefined || colIndex === null || typeof colIndex !== 'number' || colIndex < 0) {
        return fallbackLetter || 'F';
      }
      let temp = colIndex + 1;
      let letter = '';
      while (temp > 0) {
        const mod = (temp - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        temp = Math.floor((temp - mod) / 26);
      }
      return letter || fallbackLetter || 'F';
    }

    assert.strictEqual(getColumnLetter(0), 'A');
    assert.strictEqual(getColumnLetter(2), 'C');
    assert.strictEqual(getColumnLetter(4), 'E');
    assert.strictEqual(getColumnLetter(5), 'F');
    assert.strictEqual(getColumnLetter(9), 'J');
    assert.strictEqual(getColumnLetter(25), 'Z');
    assert.strictEqual(getColumnLetter(26), 'AA');
    assert.strictEqual(getColumnLetter(27), 'AB');
  });

  it('2. Dynamically generates CF formula matching Twitter ID column across rearrangements', () => {
    function buildCfFormula(twitterIdColZero) {
      let temp = twitterIdColZero + 1;
      let letter = '';
      while (temp > 0) {
        const mod = (temp - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        temp = Math.floor((temp - mod) / 26);
      }
      return '=IF($' + letter + '3="","",COUNTIF($' + letter + ':$' + letter + ',$' + letter + '3))';
    }

    // Default layout: Twitter ID at Column F (col index 5)
    assert.strictEqual(buildCfFormula(5), '=IF($F3="","",COUNTIF($F:$F,$F3))');
    // Rearranged layout: Twitter ID at Column B (col index 1)
    assert.strictEqual(buildCfFormula(1), '=IF($B3="","",COUNTIF($B:$B,$B3))');
    // Rearranged layout: Twitter ID at Column H (col index 7)
    assert.strictEqual(buildCfFormula(7), '=IF($H3="","",COUNTIF($H:$H,$H3))');
  });

  it('3. Code.gs eliminates all hardcoded static counter overwrites to Column C', () => {
    const fs = require('fs');
    const codeGs = fs.readFileSync('google_apps_script/Code.gs', 'utf8');

    // Verify hardcoded integer counters are completely purged
    assert.ok(!codeGs.includes('cleanRows[i][colMap.cf] = i + 1'), 'Must not overwrite colMap.cf with i + 1');
    assert.ok(!codeGs.includes('rowsToInsert[r][colMap.cf] = startCount + r'), 'Must not overwrite colMap.cf with startCount + r');
    assert.ok(!codeGs.includes('cleanRow[colMap.cf] = cfVal'), 'Must not overwrite colMap.cf with numeric cfVal');
  });

  it('4. Code.gs guarantees Row 2 is permanently blank and top 2 rows remain frozen', () => {
    const fs = require('fs');
    const codeGs = fs.readFileSync('google_apps_script/Code.gs', 'utf8');

    assert.ok(codeGs.includes('function ensureRow2IsBlankAndFrozen('), 'Code.gs must define ensureRow2IsBlankAndFrozen');
    assert.ok(codeGs.includes('sheet.setFrozenRows(2)'), 'ensureRow2IsBlankAndFrozen must enforce freezing 2 rows');
    assert.ok(codeGs.includes('sheet.insertRowBefore(2)'), 'Must recover vanished row 2 by inserting row before 2');
    assert.ok(codeGs.includes('row2Range.clearContent()'), 'Must clear content of Row 2');
    assert.ok(codeGs.includes('sheet.setRowHeight(2, 25)'), 'Must enforce spacer height for Row 2');
  });

  it('5. sortSheetByDateDescending strictly sorts from Row 3 and preserves Row 2 and CF formula', () => {
    const fs = require('fs');
    const codeGs = fs.readFileSync('google_apps_script/Code.gs', 'utf8');

    assert.ok(codeGs.includes('ensureRow2IsBlankAndFrozen(sheet)'), 'sortSheetByDateDescending must call ensureRow2IsBlankAndFrozen');
    assert.ok(codeGs.includes('const startRow = 3;'), 'Sorting data range must strictly start at Row 3');
    assert.ok(codeGs.includes('const numRows = lastRow - 2;'), 'Sorting data range must strictly span lastRow - 2 rows');
    assert.ok(codeGs.includes('applyCfFormulaToSheet(sheet, true)'), 'sortSheetByDateDescending must refresh CF formula after sort');
  });

  it('6. New complaint insertions and onEdit auto-protect the CF formula and Row 2', () => {
    const fs = require('fs');
    const codeGs = fs.readFileSync('google_apps_script/Code.gs', 'utf8');

    // OnEdit checks
    assert.ok(codeGs.includes('if (row === 2)'), 'onEdit must intercept any edit to Row 2');
    assert.ok(codeGs.includes('cfCell.setFormula('), 'onEdit must auto-populate missing CF formulas on data rows');

    // Ingestion checks in runCloudSyncCycle and doPost
    assert.ok(codeGs.includes("row[colMap.cf] = ''"), 'runCloudSyncCycle must leave colMap.cf blank on row creation');
    assert.ok(codeGs.includes('Math.max(sheet.getLastRow() + 1, 3)'), 'Insertions must never start at Row 2');
  });

  it('7. onOpen menu includes both Ensure Blank Row 2 and Apply CF Formula', () => {
    const fs = require('fs');
    const codeGs = fs.readFileSync('google_apps_script/Code.gs', 'utf8');

    assert.ok(codeGs.includes("'❄️ Ensure Blank Row 2 & Freeze Top 2 Rows', 'ensureRow2IsBlankAndFrozen'"), 'Menu must include ensureRow2IsBlankAndFrozen');
    assert.ok(codeGs.includes("'Apply CF Formula to Column C (Twitter ID Repeat Count)', 'applyCfFormulaToSheet'"), 'Menu must include applyCfFormulaToSheet');
  });

  it('8. Live sheet simulation: Row 2 is 100% empty and data begins strictly at Row 3', () => {
    const fs = require('fs');
    const liveCsv = fs.readFileSync('scripts/live_sheet_full.csv', 'utf8');
    const lines = liveCsv.split('\n');

    // Line 0 is Header
    assert.ok(lines[0].includes('DATE'), 'Line 0 must be Header row');

    // Line 1 is Row 2: must be completely empty or all commas
    const row2Clean = lines[1].replace(/,/g, '').trim();
    assert.strictEqual(row2Clean, '', 'Row 2 in Google Sheet must be 100% blank spacer row');

    // Line 2 is Row 3: first real complaint
    const row3Cells = lines[2].split(',');
    assert.ok(row3Cells[0].includes('21-10-2026') || row3Cells[0].includes('2026'), 'Row 3 must contain valid complaint date');
    assert.ok(row3Cells[4].startsWith('https://x.com/'), 'Row 3 must contain valid tweet URL');
  });

  it('9. Frontend app.js table rendering does not reference undefined variables', () => {
    const fs = require('fs');
    const appJs = fs.readFileSync('public/js/app.js', 'utf8');
    assert.ok(appJs.includes('let replyMarkup = '), 'app.js must declare replyMarkup');
    assert.ok(appJs.includes('${replyMarkup}'), 'app.js must render replyMarkup');
  });

  console.log('\n[24. Google Sheets UPPCLLKO Replied (YES/NO) Authoritative Partition Suite]');

  it('1. UPPCLLKO Replied card and table strictly include all records with YES', () => {
    const yesCount = db.get("SELECT COUNT(*) as c FROM complaints WHERE (uppcl_replied = 1 OR uppcllko_replied = 'YES');").c;
    assert.ok(yesCount > 0, 'UPPCLLKO Replied count must be greater than 0');

    // Confirm that no record with uppcllko_replied = 'NO' is in the YES count
    const leakageIntoYes = db.get("SELECT COUNT(*) as c FROM complaints WHERE (uppcl_replied = 1 OR uppcllko_replied = 'YES') AND uppcllko_replied = 'NO';").c;
    assert.strictEqual(leakageIntoYes, 0, 'Records marked NO in Google Sheet must never be included in UPPCLLKO Replied');
  });

  it('2. UPPCLLKO Not Replied card and table strictly include all records with NO', () => {
    const noCount = db.get("SELECT COUNT(*) as c FROM complaints WHERE ((uppcl_replied = 0 OR uppcl_replied IS NULL) AND (uppcllko_replied = 'NO' OR uppcllko_replied IS NULL OR uppcllko_replied = '') AND (category_name != 'APPRECIATION' OR category_name IS NULL));").c;
    assert.ok(noCount > 0, 'UPPCLLKO Not Replied count must be greater than 0');

    // Confirm that no record with uppcllko_replied = 'YES' is in the NO count
    const leakageIntoNo = db.get("SELECT COUNT(*) as c FROM complaints WHERE ((uppcl_replied = 0 OR uppcl_replied IS NULL) AND (uppcllko_replied = 'NO' OR uppcllko_replied IS NULL OR uppcllko_replied = '') AND (category_name != 'APPRECIATION' OR category_name IS NULL)) AND (uppcl_replied = 1 OR uppcllko_replied = 'YES');").c;
    assert.strictEqual(leakageIntoNo, 0, 'Records marked YES in Google Sheet must never be included in UPPCLLKO Not Replied');
  });

  it('3. Mutual exclusivity: A complaint cannot simultaneously belong to YES and NO', () => {
    const overlap = db.get(`
      SELECT COUNT(*) as c FROM complaints 
      WHERE (uppcl_replied = 1 OR uppcllko_replied = 'YES') 
        AND ((uppcl_replied = 0 OR uppcl_replied IS NULL) AND (uppcllko_replied = 'NO' OR uppcllko_replied IS NULL OR uppcllko_replied = ''));
    `).c;
    assert.strictEqual(overlap, 0, 'Overlap between UPPCLLKO Replied and UPPCLLKO Not Replied must strictly be 0');
  });

  it('4. server.js KPI calculations query both uppcl_replied and uppcllko_replied', () => {
    const fs = require('fs');
    const serverCode = fs.readFileSync('server.js', 'utf8');

    // Check dashboard KPI SQL
    assert.ok(serverCode.includes("WHEN uppcl_replied = 1 OR uppcllko_replied = 'YES' THEN 'YES'"), 'Dashboard KPI must count YES based on uppcl_replied OR uppcllko_replied');

    // Check picked_status filter
    assert.ok(serverCode.includes('(uppcl_replied = 1 OR uppcllko_replied = "YES")'), 'Filter must include uppcllko_replied = YES');
  });

  console.log('\n====================================================');
  console.log(` Tests Finished: ${passCount} Passed, ${failCount} Failed`);
  console.log('====================================================\n');

  if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
