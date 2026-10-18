/**
 * ============================================================================
 * UPPCL GRIEVANCE COMMAND CENTRE — 24/7 BACKGROUND WORKER DAEMON
 * ============================================================================
 * 
 * Responsibilities:
 * 1. Periodic X API v2 ingestion of consumer posts mentioning monitored handles.
 * 2. Automated complaint categorization & district-to-DISCOM routing.
 * 3. Generation of official bilingual acknowledgement drafts using approved templates.
 * 4. Automated reply dispatch in Mode C (Approved Workflow Automation).
 * 5. SLA monitoring & auto-escalation for overdue complaints.
 * 6. 30–60 minute unacknowledged alert triggers & internal notification emission.
 * 7. Periodic heartbeat recording in `worker_heartbeats` for operational health.
 * 8. Emergency stop compliance (instant halt of automated outbound replies).
 */

const db = require('./db');
const XService = require('./x_service');

const WORKER_NAME = 'uppcl-worker-daemon';
let isRunning = false;
let loopTimeout = null;

function getIstTimestamp() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (3600000 * 5.5));
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const d = String(istDate.getDate()).padStart(2, '0');
  const h = String(istDate.getHours()).padStart(2, '0');
  const min = String(istDate.getMinutes()).padStart(2, '0');
  const s = String(istDate.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * Record or update heartbeat in database
 */
function recordHeartbeat(status, detailsObj) {
  try {
    const istTime = getIstTimestamp();
    const detailsStr = typeof detailsObj === 'string' ? detailsObj : JSON.stringify(detailsObj);
    
    const existing = db.get('SELECT id FROM worker_heartbeats WHERE worker_name = ? LIMIT 1;', [WORKER_NAME]);
    if (existing) {
      db.run(`
        UPDATE worker_heartbeats SET
          last_heartbeat = ?,
          status = ?,
          metadata_json = ?
        WHERE id = ?;
      `, [istTime, status, detailsStr, existing.id]);
    } else {
      db.run(`
        INSERT INTO worker_heartbeats (worker_name, last_heartbeat, status, metadata_json)
        VALUES (?, ?, ?, ?);
      `, [WORKER_NAME, istTime, status, detailsStr]);
    }
  } catch (err) {
    console.error(`[Worker] Failed to record heartbeat:`, err.message);
  }
}

/**
 * Scan open complaints for SLA breaches and unacknowledged alerts
 */
function runSlaScan() {
  const istTime = getIstTimestamp();
  const nowMs = Date.now();
  let breachedCount = 0;
  let unackAlertCount = 0;

  try {
    // 1. Scan for Overdue SLA breaches
    const activeComplaints = db.query(`
      SELECT id, complaint_no, district_name, discom_name, priority, current_status, expected_response_date, is_overdue, escalation_level
      FROM complaints
      WHERE current_status NOT IN ('Closed', 'Resolved — Verification Pending', 'Duplicate / Invalid')
        AND expected_response_date IS NOT NULL;
    `);

    for (const c of activeComplaints) {
      const expMs = new Date(c.expected_response_date).getTime();
      if (nowMs > expMs && c.is_overdue === 0) {
        // Mark overdue
        const newStatus = c.current_status === 'New' ? 'Escalated' : c.current_status;
        const newEscLevel = Math.max(1, (c.escalation_level || 0) + 1);

        db.run(`
          UPDATE complaints SET
            is_overdue = 1,
            escalation_level = ?,
            current_status = CASE WHEN current_status = 'New' THEN 'Escalated' ELSE current_status END,
            last_action_date = ?,
            updated_at = ?
          WHERE id = ?;
        `, [newEscLevel, istTime, istTime, c.id]);

        // Log escalation
        db.run(`
          INSERT INTO complaint_escalation_logs (complaint_id, escalated_by, escalation_level, escalated_to, reason, created_at)
          VALUES (?, '24/7 SLA Worker Daemon', ?, 'Superintending Engineer / DISCOM Head', 'Automated SLA breach: resolution overdue beyond expected response window', ?);
        `, [c.id, newEscLevel, istTime]);

        // Insert timeline
        db.run(`
          INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
          VALUES (?, 'Escalation', ?, ?, NULL, 'SLA Monitor System', 'System', 'Complaint flagged OVERDUE due to SLA window lapse', ?);
        `, [c.id, c.current_status, newStatus, istTime]);

        // Emit high-priority notification
        db.run(`
          INSERT INTO notifications (user_id, title, message, type, complaint_id, is_read, created_at)
          VALUES (NULL, ?, ?, 'WARNING', ?, 0, ?);
        `, [
          `SLA Overdue: ${c.complaint_no}`,
          `Complaint ${c.complaint_no} (${c.district_name || 'General'}, ${c.discom_name}) has breached its SLA response deadline.`,
          c.id,
          istTime
        ]);

        breachedCount++;
      }
    }

    // 2. Scan for Unacknowledged Complaints (older than configured threshold, e.g. 30 mins)
    const alertSetting = db.get("SELECT value FROM system_settings WHERE key = 'sla_unacknowledged_alert_mins';");
    const thresholdMins = alertSetting ? parseInt(alertSetting.value, 10) || 30 : 30;

    const unackComplaints = db.query(`
      SELECT id, complaint_no, district_name, received_at, reply_status
      FROM complaints
      WHERE current_status = 'New'
        AND (reply_status = 'PENDING' OR reply_status = 'DRAFT_GENERATED')
        AND first_acknowledged_at IS NULL;
    `);

    for (const u of unackComplaints) {
      const recMs = new Date(u.received_at).getTime();
      const ageMins = Math.round((nowMs - recMs) / 60000);

      if (ageMins >= thresholdMins) {
        // Check if an unacknowledged alert already exists for this complaint
        const existingNote = db.get("SELECT id FROM notifications WHERE complaint_id = ? AND title LIKE 'Unacknowledged Complaint%' LIMIT 1;", [u.id]);
        if (!existingNote) {
          db.run(`
            INSERT INTO notifications (user_id, title, message, type, complaint_id, is_read, created_at)
            VALUES (NULL, ?, ?, 'INFO', ?, 0, ?);
          `, [
            `Unacknowledged Complaint: ${u.complaint_no}`,
            `Complaint ${u.complaint_no} (${u.district_name || 'General'}) has been waiting for acknowledgment for ${ageMins} minutes.`,
            u.id,
            istTime
          ]);
          unackAlertCount++;
        }
      }
    }
  } catch (err) {
    console.error(`[Worker] SLA Scan Error:`, err.message);
  }

  return { breachedCount, unackAlertCount };
}

/**
 * Execute one worker cycle
 */
async function executeWorkerCycle() {
  await db.initDb();
  const cycleStart = Date.now();
  const istTime = getIstTimestamp();
  let pollResult = { new_posts: 0, status: 'idle' };

  try {
    // 1. Ingestion & Outbound Reply Polling
    pollResult = await XService.pollRecentPosts();
  } catch (xErr) {
    console.error(`[Worker] X polling error:`, xErr.message);
    pollResult = { error: xErr.message, new_posts: 0 };
  }

  // 2. SLA & Escalation Scan
  const slaResult = runSlaScan();

  const durationMs = Date.now() - cycleStart;

  // 3. Record Operational Heartbeat
  recordHeartbeat('ACTIVE', {
    last_run_ist: istTime,
    duration_ms: durationMs,
    poll_result: pollResult,
    sla_result: slaResult
  });

  console.log(`[Worker] Cycle completed in ${durationMs}ms: Ingested=${pollResult.new_posts || 0}, Breached=${slaResult.breachedCount}, UnackAlerts=${slaResult.unackAlertCount}`);
}

/**
 * Main worker loop
 */
async function runWorkerLoop() {
  if (!isRunning) return;

  try {
    await executeWorkerCycle();
  } catch (err) {
    console.error(`[Worker] Unexpected loop error:`, err);
    recordHeartbeat('ERROR', { error: err.message, timestamp: getIstTimestamp() });
  }

  // Determine interval from system settings (default 60s)
  let intervalSec = 60;
  try {
    const setting = db.get("SELECT value FROM system_settings WHERE key = 'ingestion_interval_seconds';");
    if (setting && setting.value) {
      intervalSec = Math.max(15, parseInt(setting.value, 10) || 60);
    }
  } catch (e) {}

  if (isRunning) {
    loopTimeout = setTimeout(runWorkerLoop, intervalSec * 1000);
  }
}

/**
 * Start the background worker
 */
async function startWorker() {
  console.log('===========================================================');
  console.log(' UPPCL GRIEVANCE COMMAND CENTRE — BACKGROUND WORKER DAEMON');
  console.log(` Process ID: ${process.pid}`);
  console.log(` Time (IST): ${getIstTimestamp()}`);
  console.log('===========================================================');

  await db.initDb();
  isRunning = true;
  recordHeartbeat('STARTING', { started_at: getIstTimestamp() });

  // Start initial cycle immediately
  runWorkerLoop();
}

/**
 * Graceful termination
 */
function stopWorker(signal) {
  console.log(`\n[Worker] Received ${signal}. Shutting down worker gracefully...`);
  isRunning = false;
  if (loopTimeout) clearTimeout(loopTimeout);
  recordHeartbeat('STOPPED', { stopped_at: getIstTimestamp(), signal });
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', () => stopWorker('SIGINT'));
process.on('SIGTERM', () => stopWorker('SIGTERM'));

// If run directly from CLI
if (require.main === module) {
  startWorker().catch(err => {
    console.error('[Worker] Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = {
  startWorker,
  stopWorker,
  executeWorkerCycle,
  runSlaScan
};
