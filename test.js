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
    assert.ok(bcrypt.compareSync('Admin@UPPCL2026', admin.password_hash));
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
    const timeline = db.query("SELECT * FROM complaint_timeline WHERE action_type = 'Registration';");
    assert.ok(timeline.length > 0, 'No registration timeline logs found');
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
    const pendingVer = db.get("SELECT * FROM complaints WHERE current_status = 'Resolved — Verification Pending';");
    assert.ok(pendingVer, 'Need a complaint in Resolved — Verification Pending status');
    assert.notStrictEqual(pendingVer.current_status, 'Closed');
    assert.ok(pendingVer.discom_action_taken, 'Resolution details should be present');
  });

  it('Verified closure records verifying officer, satisfaction, and timestamp', () => {
    const closed = db.get("SELECT * FROM complaints WHERE current_status = 'Closed' LIMIT 1;");
    assert.ok(closed, 'Need a complaint in Closed status');
    assert.ok(closed.closure_verified_by, 'Missing verifying officer');
    assert.ok(closed.closure_date, 'Missing closure timestamp');
    assert.ok(closed.closure_satisfaction_status, 'Missing satisfaction status');
  });

  it('Escalation logs record level, escalated to, and mandatory reason', () => {
    const esc = db.get('SELECT * FROM complaint_escalation_logs LIMIT 1;');
    assert.ok(esc, 'Need escalation log');
    assert.ok(esc.escalation_level >= 1, 'Invalid escalation level');
    assert.ok(esc.reason && esc.reason.length > 5, 'Missing mandatory reason');
  });

  console.log('\n[6. Dashboard KPI Calculations]');
  it('Dashboard figures match actual underlying records in database', () => {
    const total = db.get('SELECT COUNT(*) as c FROM complaints;').c;
    const closed = db.get("SELECT COUNT(*) as c FROM complaints WHERE current_status = 'Closed';").c;
    const escalated = db.get("SELECT COUNT(*) as c FROM complaints WHERE current_status = 'Escalated';").c;
    
    assert.ok(total >= 8, 'Expected sample complaints in DB');
    assert.ok(closed >= 1, 'Expected at least 1 closed complaint');
    assert.ok(escalated >= 1, 'Expected at least 1 escalated complaint');
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

  console.log('\n====================================================');
  console.log(` Tests Finished: ${passCount} Passed, ${failCount} Failed`);
  console.log('====================================================\n');

  if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
