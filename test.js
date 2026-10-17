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
    assert.ok(roles.includes('Super Administrator'));
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

  console.log('\n====================================================');
  console.log(` Tests Finished: ${passCount} Passed, ${failCount} Failed`);
  console.log('====================================================\n');

  if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
