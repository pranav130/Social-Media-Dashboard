const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('./db');
const classifier = require('./classifier');
const XService = require('./x_service');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'uppcl_smc_secret_key_2026_secure_grievance_platform';

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File Upload Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${cleanName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPG, PNG, PDF, DOC, DOCX, XLSX, CSV, TXT'));
    }
  }
});

// Helper for IST Timestamps
function getIstTimestamp() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (3600000 * 5.5)); // +5:30
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const d = String(istDate.getDate()).padStart(2, '0');
  const h = String(istDate.getHours()).padStart(2, '0');
  const min = String(istDate.getMinutes()).padStart(2, '0');
  const s = String(istDate.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

// Audit Logger Helper
function logAudit(req, user, action, entityType, entityId, details) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userId = user ? user.id : null;
    const username = user ? user.username : 'anonymous';
    const userRole = user ? user.role : 'Guest';
    db.run(`
      INSERT INTO audit_logs (user_id, username, user_role, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [userId, username, userRole, action, entityType, String(entityId || ''), details, ip, getIstTimestamp()]);
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

// Authentication Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.get('SELECT id, username, full_name, email, role, discom_name, designation, mobile, is_active, assigned_districts FROM users WHERE id = ?;', [decoded.id]);
    if (!user || user.is_active !== 1) {
      return res.status(401).json({ error: 'Account inactive or not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

// Role Authorization Middleware
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'Super Administrator') return next(); // Super Admin bypass
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: `Forbidden: Access requires one of [${roles.join(', ')}]` });
  };
}

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

// Login Throttling tracker
const loginAttempts = new Map();

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const throttleKey = `${ip}_${username || ''}`;

  const attempts = loginAttempts.get(throttleKey) || { count: 0, lastTime: Date.now() };
  if (attempts.count >= 5 && Date.now() - attempts.lastTime < 60000) {
    return res.status(429).json({ error: 'Too many failed login attempts. Please wait 1 minute.' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.get('SELECT * FROM users WHERE username = ?;', [username.trim()]);
  if (!user || user.is_active !== 1) {
    attempts.count++;
    attempts.lastTime = Date.now();
    loginAttempts.set(throttleKey, attempts);
    logAudit(req, null, 'LOGIN_FAILED', 'USER', username, 'User not found or inactive');
    return res.status(401).json({ error: 'Invalid credentials or account deactivated' });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    attempts.count++;
    attempts.lastTime = Date.now();
    loginAttempts.set(throttleKey, attempts);
    logAudit(req, user, 'LOGIN_FAILED', 'USER', user.id, 'Incorrect password');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Clear throttle on success
  loginAttempts.delete(throttleKey);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, discom_name: user.discom_name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  logAudit(req, user, 'LOGIN_SUCCESS', 'USER', user.id, `User logged in from ${ip}`);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      discom_name: user.discom_name,
      designation: user.designation,
      mobile: user.mobile,
      assigned_districts: user.assigned_districts || ''
    }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  logAudit(req, req.user, 'LOGOUT', 'USER', req.user.id, 'User logged out');
  res.json({ message: 'Logged out successfully' });
});

app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const fullUser = db.get('SELECT password_hash FROM users WHERE id = ?;', [req.user.id]);
  if (!bcrypt.compareSync(current_password, fullUser.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?;', [newHash, getIstTimestamp(), req.user.id]);
  logAudit(req, req.user, 'PASSWORD_CHANGE', 'USER', req.user.id, 'Password changed');

  res.json({ message: 'Password updated successfully' });
});

// -------------------------------------------------------------
// COMPLAINT REGISTER & LIFECYCLE ROUTES
// -------------------------------------------------------------

// Helper to check if a complaint is overdue
function updateOverdueStatus(complaint) {
  if (['Closed', 'Resolved — Verification Pending', 'Duplicate / Invalid'].includes(complaint.current_status)) {
    return 0;
  }
  if (!complaint.expected_response_date) return 0;
  const exp = new Date(complaint.expected_response_date).getTime();
  const now = new Date().getTime();
  return now > exp ? 1 : 0;
}

// 1. Get Complaints (Search, Filter, Paginate, Role-Scoped)
app.get('/api/complaints', authMiddleware, (req, res) => {
  const {
    page = 1,
    limit = 25,
    search,
    status,
    discom,
    district,
    platform,
    x_handle,
    category,
    priority,
    overdue,
    reply_status,
    from_date,
    to_date,
    sort_by = 'received_at',
    sort_order = 'DESC'
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(limit, 10) || 25));
  const offset = (pageNum - 1) * pageSize;

  let whereClauses = [];
  let params = [];

  // Scoping: DISCOM Nodal Officer can only see complaints for their assigned DISCOM
  if (req.user.role === 'DISCOM Nodal Officer') {
    whereClauses.push('(discom_name = ? OR discom_name = ?)');
    params.push(req.user.discom_name, req.user.discom_name.toUpperCase());
  } else if ((req.user.role === 'Complaint Handler' || req.user.role === 'Social Media Cell Operator') && req.user.assigned_districts && req.user.assigned_districts.trim() && req.user.assigned_districts !== 'All') {
    const districts = req.user.assigned_districts.split(',').map(d => d.trim()).filter(Boolean);
    if (districts.length > 0) {
      const placeholders = districts.map(() => '?').join(',');
      whereClauses.push(`district_name IN (${placeholders})`);
      params.push(...districts);
    }
  } else if (discom && discom !== 'All') {
    whereClauses.push('discom_name = ?');
    params.push(discom);
  }

  if (district && district !== 'All') {
    whereClauses.push('district_name = ?');
    params.push(district);
  }

  if (platform && platform !== 'All') {
    whereClauses.push('platform = ?');
    params.push(platform);
  }

  if (x_handle && x_handle !== 'All') {
    whereClauses.push('(monitored_account = ? OR hierarchy_handle_name = ?)');
    params.push(x_handle, x_handle);
  }

  if (category && category !== 'All') {
    whereClauses.push('category_name = ?');
    params.push(category);
  }

  if (priority && priority !== 'All') {
    whereClauses.push('priority = ?');
    params.push(priority);
  }

  if (reply_status && reply_status !== 'All') {
    whereClauses.push('reply_status = ?');
    params.push(reply_status);
  }

  if (from_date) {
    whereClauses.push('received_at >= ?');
    params.push(from_date + ' 00:00:00');
  }

  if (to_date) {
    whereClauses.push('received_at <= ?');
    params.push(to_date + ' 23:59:59');
  }

  // Quick filters & Status
  if (status && status !== 'All') {
    if (status === 'my_assigned') {
      whereClauses.push('assigned_operator_id = ?');
      params.push(req.user.id);
    } else if (status === 'awaiting_forwarding') {
      whereClauses.push("current_status = 'New'");
    } else if (status === 'awaiting_discom') {
      whereClauses.push("current_status IN ('Forwarded', 'DISCOM Follow Up')");
    } else if (status === 'followup_due') {
      whereClauses.push("current_status = 'DISCOM Follow Up'");
    } else if (status === 'overdue') {
      whereClauses.push("is_overdue = 1");
    } else if (status === 'escalated') {
      whereClauses.push("current_status = 'Escalated'");
    } else if (status === 'draft_review') {
      whereClauses.push("reply_status = 'DRAFT_GENERATED'");
    } else if (status === 'needs_review' || status === 'unassigned') {
      whereClauses.push("district_name = 'Unassigned'");
    } else if (status === 'verification_pending') {
      whereClauses.push("current_status = 'Resolved — Verification Pending'");
    } else if (status === 'closed') {
      whereClauses.push("current_status = 'Closed'");
    } else {
      whereClauses.push('current_status = ?');
      params.push(status);
    }
  }

  if (overdue === '1') {
    whereClauses.push('is_overdue = 1');
  }

  // Search across multiple fields
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    whereClauses.push(`(
      complaint_no LIKE ? OR
      consumer_name LIKE ? OR
      consumer_handle LIKE ? OR
      complaint_text LIKE ? OR
      district_name LIKE ? OR
      division_name LIKE ? OR
      consumer_account_no LIKE ? OR
      forwarding_ref_no LIKE ?
    )`);
    params.push(term, term, term, term, term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count total
  const countRow = db.get(`SELECT COUNT(*) AS total FROM complaints ${whereSql};`, params);
  const total = countRow ? countRow.total : 0;

  // Sorting validation
  const allowedSortCols = ['received_at', 'priority', 'current_status', 'discom_name', 'district_name', 'complaint_no'];
  const safeSortCol = allowedSortCols.includes(sort_by) ? sort_by : 'received_at';
  const safeOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const querySql = `
    SELECT * FROM complaints
    ${whereSql}
    ORDER BY ${safeSortCol} ${safeOrder}
    LIMIT ? OFFSET ?;
  `;
  const pageParams = [...params, pageSize, offset];
  const rows = db.query(querySql, pageParams);

  // Compute dynamic overdue
  const enrichedRows = rows.map(r => ({
    ...r,
    computed_overdue: updateOverdueStatus(r)
  }));

  res.json({
    data: enrichedRows,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize) || 1
    }
  });
});

// 2. Duplicate Detection Endpoint
app.post('/api/complaints/check-duplicate', authMiddleware, (req, res) => {
  const { post_url, consumer_handle, complaint_text } = req.body;
  let matches = [];

  // Match 1: Exact URL
  if (post_url && post_url.trim()) {
    const urlMatch = db.get('SELECT id, complaint_no, received_at, consumer_name, current_status, discom_name, district_name FROM complaints WHERE post_url = ? LIMIT 1;', [post_url.trim()]);
    if (urlMatch) {
      return res.json({
        is_duplicate: true,
        match_type: 'POST_URL',
        message: `Identical social media URL found in complaint ${urlMatch.complaint_no} (${urlMatch.current_status})`,
        match: urlMatch
      });
    }
  }

  // Match 2: Consumer Handle within last 7 days
  if (consumer_handle && consumer_handle.trim()) {
    const handleMatch = db.get(`
      SELECT id, complaint_no, received_at, consumer_name, current_status, discom_name, district_name
      FROM complaints
      WHERE consumer_handle = ? AND received_at >= datetime('now', '-7 days')
      ORDER BY received_at DESC LIMIT 1;
    `, [consumer_handle.trim()]);
    if (handleMatch) {
      matches.push({ type: 'HANDLE_RECENCY', record: handleMatch });
    }
  }

  // Match 3: Similar text snippet
  if (complaint_text && complaint_text.trim().length > 25) {
    const snippet = `%${complaint_text.trim().substring(0, 40)}%`;
    const textMatch = db.get(`
      SELECT id, complaint_no, received_at, consumer_name, current_status, discom_name, district_name
      FROM complaints
      WHERE complaint_text LIKE ? AND received_at >= datetime('now', '-5 days')
      ORDER BY received_at DESC LIMIT 1;
    `, [snippet]);
    if (textMatch) {
      matches.push({ type: 'TEXT_SIMILARITY', record: textMatch });
    }
  }

  if (matches.length > 0) {
    return res.json({
      is_duplicate: true,
      match_type: matches[0].type,
      message: `Potential duplicate complaint detected: ${matches[0].record.complaint_no} (${matches[0].record.current_status})`,
      match: matches[0].record
    });
  }

  res.json({ is_duplicate: false });
});

// 3. Create Complaint
app.post('/api/complaints', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'), (req, res) => {
  const b = req.body;
  if (!b.complaint_text || !b.discom_name || !b.district_name || !b.category_name) {
    return res.status(400).json({ error: 'Complaint text, DISCOM, District, and Category are required.' });
  }

  // Auto-generate Complaint Number: UPPCL-SMC-YYYYMM-XXXX
  const istTime = getIstTimestamp();
  const yearMonth = istTime.substring(0, 7).replace('-', '');
  const lastComp = db.get("SELECT complaint_no FROM complaints WHERE complaint_no LIKE ? ORDER BY id DESC LIMIT 1;", [`UPPCL-SMC-${yearMonth}-%`]);

  let seq = 1;
  if (lastComp && lastComp.complaint_no) {
    const parts = lastComp.complaint_no.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) seq = lastNum + 1;
  }
  const complaintNo = `UPPCL-SMC-${yearMonth}-${String(seq).padStart(4, '0')}`;

  // Default SLA calculation based on priority
  let slaHours = 72;
  const p = (b.priority || 'Normal').toLowerCase();
  if (p === 'critical') slaHours = 24;
  else if (p === 'high') slaHours = 48;
  else if (p === 'low') slaHours = 96;

  let expectedDate = null;
  if (b.forwarding_date) {
    const fDate = new Date(b.forwarding_date);
    expectedDate = new Date(fDate.getTime() + slaHours * 3600000).toISOString().replace('T', ' ').substring(0, 19);
  }

  const initialStatus = b.forwarding_date ? 'Forwarded' : 'New';

  const insRes = db.run(`
    INSERT INTO complaints (
      complaint_no, received_at, platform, monitored_account, hierarchy_handle_id,
      hierarchy_handle_name, is_tagged, consumer_name, consumer_handle, consumer_profile_url,
      post_url, complaint_text, category_name, subcategory_name, discom_name,
      district_name, zone_name, circle_name, division_name, subdivision_name,
      consumer_account_no, consumer_mobile, priority, current_status, assigned_operator_id,
      assigned_operator_name, assigned_nodal_officer_id, assigned_nodal_officer_name,
      assigned_nodal_officer_mobile, forwarding_date, forwarding_channel, forwarding_ref_no,
      forwarding_remarks, expected_response_date, is_overdue, escalation_level,
      last_action_date, created_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?
    );
  `, [
    complaintNo,
    b.received_at || istTime,
    b.platform || 'Twitter/X',
    b.monitored_account || '@UPPCLLKO',
    b.hierarchy_handle_id || null,
    b.hierarchy_handle_name || null,
    b.is_tagged !== undefined ? (b.is_tagged ? 1 : 0) : 1,
    b.consumer_name || '',
    b.consumer_handle || '',
    b.consumer_profile_url || '',
    b.post_url || '',
    b.complaint_text.trim(),
    b.category_name,
    b.subcategory_name || '',
    b.discom_name,
    b.district_name,
    b.zone_name || '',
    b.circle_name || '',
    b.division_name || '',
    b.subdivision_name || '',
    b.consumer_account_no || '',
    b.consumer_mobile || '',
    b.priority || 'Normal',
    initialStatus,
    req.user.id,
    req.user.full_name,
    b.assigned_nodal_officer_id || null,
    b.assigned_nodal_officer_name || '',
    b.assigned_nodal_officer_mobile || '',
    b.forwarding_date || null,
    b.forwarding_channel || '',
    b.forwarding_ref_no || '',
    b.forwarding_remarks || '',
    expectedDate,
    istTime,
    req.user.full_name,
    istTime,
    istTime
  ]);

  const newId = insRes.lastInsertRowid;

  // Insert registration timeline
  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'Registration', NULL, 'New', ?, ?, ?, 'Complaint registered by operator', ?);
  `, [newId, req.user.id, req.user.full_name, req.user.role, istTime]);

  if (b.forwarding_date) {
    db.run(`
      INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
      VALUES (?, 'Forwarded', 'New', 'Forwarded', ?, ?, ?, ?, ?);
    `, [newId, req.user.id, req.user.full_name, req.user.role, b.forwarding_remarks || 'Forwarded upon registration', istTime]);

    db.run(`
      INSERT INTO complaint_forwarding_logs (complaint_id, forwarded_by, forwarded_to_officer, discom_name, district_name, channel, ref_no, remarks, expected_response_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      newId, req.user.full_name, b.assigned_nodal_officer_name || 'Nodal Officer',
      b.discom_name, b.district_name, b.forwarding_channel || 'e-Office', b.forwarding_ref_no || '',
      b.forwarding_remarks || '', expectedDate || '', istTime
    ]);
  }

  logAudit(req, req.user, 'COMPLAINT_CREATED', 'COMPLAINT', newId, `Registered complaint ${complaintNo}`);

  const created = db.get('SELECT * FROM complaints WHERE id = ?;', [newId]);
  res.status(201).json({ message: 'Complaint registered successfully', complaint: created });
});

// 4. Get Complaint Details & Timeline
app.get('/api/complaints/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  // Role Scoping for DISCOM Nodal Officer
  if (req.user.role === 'DISCOM Nodal Officer') {
    if (complaint.discom_name.toUpperCase() !== req.user.discom_name.toUpperCase()) {
      return res.status(403).json({ error: 'Access denied: You can only view complaints assigned to your DISCOM' });
    }
  }

  // Role Scoping for Complaint Handler with assigned districts
  if ((req.user.role === 'Complaint Handler' || req.user.role === 'Social Media Cell Operator') && req.user.assigned_districts && req.user.assigned_districts.trim() && req.user.assigned_districts !== 'All') {
    const allowed = req.user.assigned_districts.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (allowed.length > 0 && complaint.district_name && !allowed.includes(complaint.district_name.toLowerCase())) {
      return res.status(403).json({ error: `Access denied: You are not assigned to district ${complaint.district_name}` });
    }
  }

  const timeline = db.query('SELECT * FROM complaint_timeline WHERE complaint_id = ? ORDER BY id ASC;', [id]);
  const forwardingLogs = db.query('SELECT * FROM complaint_forwarding_logs WHERE complaint_id = ? ORDER BY id DESC;', [id]);
  const followupLogs = db.query('SELECT * FROM complaint_followup_logs WHERE complaint_id = ? ORDER BY id DESC;', [id]);
  const escalationLogs = db.query('SELECT * FROM complaint_escalation_logs WHERE complaint_id = ? ORDER BY id DESC;', [id]);
  const evidence = db.query('SELECT * FROM complaint_evidence WHERE complaint_id = ? ORDER BY id DESC;', [id]);
  const replies = db.query('SELECT * FROM x_outgoing_replies WHERE complaint_id = ? ORDER BY id DESC;', [id]);

  res.json({
    complaint: {
      ...complaint,
      computed_overdue: updateOverdueStatus(complaint)
    },
    timeline,
    forwardingLogs,
    followupLogs,
    escalationLogs,
    evidence,
    replies
  });
});

// 5. Forward Complaint to DISCOM / Nodal Officer
app.post('/api/complaints/:id/forward', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const b = req.body;
  if (!b.discom_name || !b.assigned_nodal_officer_name) {
    return res.status(400).json({ error: 'DISCOM and Nodal Officer are required for forwarding.' });
  }

  const istTime = getIstTimestamp();
  const fDate = b.forwarding_date || istTime;

  // Calculate expected response date
  let slaHours = 72;
  const p = (complaint.priority || 'Normal').toLowerCase();
  if (p === 'critical') slaHours = 24;
  else if (p === 'high') slaHours = 48;
  else if (p === 'low') slaHours = 96;

  const fObj = new Date(fDate);
  const expectedDate = b.expected_response_date || new Date(fObj.getTime() + slaHours * 3600000).toISOString().replace('T', ' ').substring(0, 19);

  const oldStatus = complaint.current_status;
  const newStatus = 'Forwarded';

  db.run(`
    UPDATE complaints SET
      discom_name = ?,
      district_name = COALESCE(?, district_name),
      assigned_nodal_officer_id = ?,
      assigned_nodal_officer_name = ?,
      assigned_nodal_officer_mobile = ?,
      forwarding_date = ?,
      forwarding_channel = ?,
      forwarding_ref_no = ?,
      forwarding_remarks = ?,
      expected_response_date = ?,
      current_status = ?,
      last_action_date = ?,
      updated_at = ?
    WHERE id = ?;
  `, [
    b.discom_name,
    b.district_name || null,
    b.assigned_nodal_officer_id || null,
    b.assigned_nodal_officer_name,
    b.assigned_nodal_officer_mobile || '',
    fDate,
    b.forwarding_channel || 'e-Office',
    b.forwarding_ref_no || '',
    b.forwarding_remarks || '',
    expectedDate,
    newStatus,
    istTime,
    istTime,
    id
  ]);

  db.run(`
    INSERT INTO complaint_forwarding_logs (complaint_id, forwarded_by, forwarded_to_officer, discom_name, district_name, channel, ref_no, remarks, expected_response_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `, [
    id, req.user.full_name, b.assigned_nodal_officer_name, b.discom_name, b.district_name || complaint.district_name,
    b.forwarding_channel || 'e-Office', b.forwarding_ref_no || '', b.forwarding_remarks || '', expectedDate, istTime
  ]);

  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'Forwarded', ?, ?, ?, ?, ?, ?, ?);
  `, [
    id, oldStatus, newStatus, req.user.id, req.user.full_name, req.user.role,
    `Forwarded to ${b.discom_name} (${b.assigned_nodal_officer_name}) via ${b.forwarding_channel || 'e-Office'}. Remarks: ${b.forwarding_remarks || 'None'}`,
    istTime
  ]);

  logAudit(req, req.user, 'COMPLAINT_FORWARDED', 'COMPLAINT', id, `Forwarded complaint ${complaint.complaint_no} to ${b.discom_name}`);

  res.json({ message: 'Complaint forwarded successfully', expected_response_date: expectedDate });
});

// 6. Record DISCOM Follow-Up
app.post('/api/complaints/:id/followup', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const b = req.body;
  if (!b.remarks || !b.officer_contacted) {
    return res.status(400).json({ error: 'Officer contacted and remarks are required' });
  }

  const istTime = getIstTimestamp();
  const oldStatus = complaint.current_status;
  const newStatus = 'DISCOM Follow Up';

  db.run(`
    UPDATE complaints SET
      current_status = ?,
      last_action_date = ?,
      updated_at = ?
    WHERE id = ?;
  `, [newStatus, istTime, istTime, id]);

  db.run(`
    INSERT INTO complaint_followup_logs (complaint_id, followed_up_by, officer_contacted, channel, remarks, next_followup_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `, [id, req.user.full_name, b.officer_contacted, b.channel || 'Phone Call', b.remarks, b.next_followup_date || null, istTime]);

  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'Follow-Up', ?, ?, ?, ?, ?, ?, ?);
  `, [id, oldStatus, newStatus, req.user.id, req.user.full_name, req.user.role, `Follow-up with ${b.officer_contacted} (${b.channel || 'Phone'}): ${b.remarks}`, istTime]);

  logAudit(req, req.user, 'COMPLAINT_FOLLOWUP', 'COMPLAINT', id, `Recorded follow-up for complaint ${complaint.complaint_no}`);

  res.json({ message: 'Follow-up logged successfully' });
});

// 7. Escalate Complaint
app.post('/api/complaints/:id/escalate', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const b = req.body;
  if (!b.reason || !b.reason.trim()) {
    return res.status(400).json({ error: 'Mandatory reason is required for escalation.' });
  }

  const istTime = getIstTimestamp();
  const oldStatus = complaint.current_status;
  const newStatus = 'Escalated';
  const level = parseInt(b.escalation_level, 10) || (complaint.escalation_level + 1);

  db.run(`
    UPDATE complaints SET
      current_status = ?,
      escalation_level = ?,
      escalation_reason = ?,
      last_action_date = ?,
      updated_at = ?
    WHERE id = ?;
  `, [newStatus, level, b.reason.trim(), istTime, istTime, id]);

  db.run(`
    INSERT INTO complaint_escalation_logs (complaint_id, escalated_by, escalation_level, escalated_to, reason, remarks, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `, [id, req.user.full_name, level, b.escalated_to || 'Chief Engineer / MD', b.reason.trim(), b.remarks || '', istTime]);

  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'Escalated', ?, ?, ?, ?, ?, ?, ?);
  `, [id, oldStatus, newStatus, req.user.id, req.user.full_name, req.user.role, `Escalated to Level ${level} (${b.escalated_to || 'Senior Management'}). Reason: ${b.reason}`, istTime]);

  logAudit(req, req.user, 'COMPLAINT_ESCALATED', 'COMPLAINT', id, `Escalated complaint ${complaint.complaint_no} to level ${level}`);

  res.json({ message: 'Complaint escalated successfully', escalation_level: level });
});

// 8. Submit DISCOM Response / Resolution
app.post('/api/complaints/:id/discom-response', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  // Role Scope: If DISCOM Nodal Officer, must belong to their DISCOM
  if (req.user.role === 'DISCOM Nodal Officer') {
    if (complaint.discom_name.toUpperCase() !== req.user.discom_name.toUpperCase()) {
      return res.status(403).json({ error: 'Unauthorized: You can only respond to complaints for your assigned DISCOM' });
    }
  }

  const b = req.body;
  if (!b.action_taken || !b.action_taken.trim()) {
    return res.status(400).json({ error: 'Action taken / resolution details are required.' });
  }

  const istTime = getIstTimestamp();
  const oldStatus = complaint.current_status;
  // DISCOM report transitions to 'Resolved — Verification Pending' (NOT verified closed directly)
  const newStatus = 'Resolved — Verification Pending';

  db.run(`
    UPDATE complaints SET
      current_status = ?,
      discom_response_date = ?,
      discom_action_taken = ?,
      discom_evidence_url = ?,
      discom_reported_by = ?,
      last_action_date = ?,
      updated_at = ?
    WHERE id = ?;
  `, [
    newStatus,
    istTime,
    b.action_taken.trim(),
    b.evidence_url || '',
    b.reported_by || req.user.full_name,
    istTime,
    istTime,
    id
  ]);

  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'DISCOM Resolution Reported', ?, ?, ?, ?, ?, ?, ?);
  `, [
    id, oldStatus, newStatus, req.user.id, req.user.full_name, req.user.role,
    `DISCOM reported resolution: ${b.action_taken.trim()}${b.evidence_url ? ' (Evidence URL provided)' : ''}. Awaiting Social Media Cell verification.`,
    istTime
  ]);

  logAudit(req, req.user, 'DISCOM_RESOLUTION_SUBMITTED', 'COMPLAINT', id, `DISCOM submitted resolution for complaint ${complaint.complaint_no}`);

  res.json({ message: 'Action taken report submitted successfully. Awaiting SMC verification.' });
});

// 9. Verify Closure (Social Media Cell Operator or Supervisor ONLY)
app.post('/api/complaints/:id/verify-closure', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const b = req.body;
  if (!b.verification_notes || !b.verification_notes.trim()) {
    return res.status(400).json({ error: 'Mandatory verification notes are required to close a complaint.' });
  }

  const istTime = getIstTimestamp();
  const oldStatus = complaint.current_status;
  const newStatus = 'Closed';

  db.run(`
    UPDATE complaints SET
      current_status = ?,
      closure_date = ?,
      closure_verified_by = ?,
      closure_verification_notes = ?,
      closure_satisfaction_status = ?,
      is_overdue = 0,
      last_action_date = ?,
      updated_at = ?
    WHERE id = ?;
  `, [
    newStatus,
    istTime,
    req.user.full_name,
    b.verification_notes.trim(),
    b.satisfaction_status || 'Satisfied',
    istTime,
    istTime,
    id
  ]);

  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'Verified & Closed', ?, ?, ?, ?, ?, ?, ?);
  `, [
    id, oldStatus, newStatus, req.user.id, req.user.full_name, req.user.role,
    `Resolution verified and closed by SMC. Feedback: ${b.satisfaction_status || 'Satisfied'}. Notes: ${b.verification_notes.trim()}`,
    istTime
  ]);

  logAudit(req, req.user, 'COMPLAINT_VERIFIED_CLOSED', 'COMPLAINT', id, `Verified and closed complaint ${complaint.complaint_no}`);

  res.json({ message: 'Complaint verified and closed successfully' });
});

// 10. Reopen Complaint
app.post('/api/complaints/:id/reopen', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const b = req.body;
  if (!b.reason || !b.reason.trim()) {
    return res.status(400).json({ error: 'Mandatory reason is required to reopen a complaint.' });
  }

  const istTime = getIstTimestamp();
  const oldStatus = complaint.current_status;
  const newStatus = 'Reopened';

  db.run(`
    UPDATE complaints SET
      current_status = ?,
      reopen_reason = ?,
      last_action_date = ?,
      updated_at = ?
    WHERE id = ?;
  `, [newStatus, b.reason.trim(), istTime, istTime, id]);

  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'Reopened', ?, ?, ?, ?, ?, ?, ?);
  `, [id, oldStatus, newStatus, req.user.id, req.user.full_name, req.user.role, `Reopened complaint. Reason: ${b.reason.trim()}`, istTime]);

  logAudit(req, req.user, 'COMPLAINT_REOPENED', 'COMPLAINT', id, `Reopened complaint ${complaint.complaint_no}`);

  res.json({ message: 'Complaint reopened successfully' });
});

// 11. Invalidate / Duplicate
app.post('/api/complaints/:id/invalidate', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const b = req.body;
  if (!b.reason || !b.reason.trim()) {
    return res.status(400).json({ error: 'Mandatory reason is required to invalidate a complaint.' });
  }

  const istTime = getIstTimestamp();
  const oldStatus = complaint.current_status;
  const newStatus = 'Duplicate / Invalid';

  db.run(`
    UPDATE complaints SET
      current_status = ?,
      invalid_reason = ?,
      duplicate_of_complaint_id = ?,
      is_overdue = 0,
      last_action_date = ?,
      updated_at = ?
    WHERE id = ?;
  `, [newStatus, b.reason.trim(), b.duplicate_of_id || null, istTime, istTime, id]);

  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'Invalidated', ?, ?, ?, ?, ?, ?, ?);
  `, [id, oldStatus, newStatus, req.user.id, req.user.full_name, req.user.role, `Marked Duplicate/Invalid: ${b.reason.trim()}${b.duplicate_of_id ? ` (Reference ID: ${b.duplicate_of_id})` : ''}`, istTime]);

  logAudit(req, req.user, 'COMPLAINT_INVALIDATED', 'COMPLAINT', id, `Invalidated complaint ${complaint.complaint_no}`);

  res.json({ message: 'Complaint marked as duplicate / invalid' });
});

// 12. Upload Evidence / Attachments
app.post('/api/complaints/:id/evidence', authMiddleware, upload.single('evidence_file'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file rejected by policy' });
  }

  const istTime = getIstTimestamp();
  const filePath = `/uploads/${req.file.filename}`;

  db.run(`
    INSERT INTO complaint_evidence (complaint_id, file_name, file_path, file_type, file_size, uploaded_by, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `, [
    id, req.file.originalname, filePath, req.file.mimetype, req.file.size,
    req.user.full_name, req.body.notes || 'Evidence attachment', istTime
  ]);

  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'Evidence Uploaded', ?, ?, ?, ?, ?, ?, ?);
  `, [id, complaint.current_status, complaint.current_status, req.user.id, req.user.full_name, req.user.role, `Attached file: ${req.file.originalname}`, istTime]);

  logAudit(req, req.user, 'EVIDENCE_UPLOADED', 'COMPLAINT', id, `Uploaded file ${req.file.originalname}`);

  res.json({ message: 'File uploaded successfully', file_path: filePath });
});

// -------------------------------------------------------------
// DASHBOARD & ANALYTICS ROUTES
// -------------------------------------------------------------

app.get('/api/dashboard/kpis', authMiddleware, (req, res) => {
  let whereClauses = [];
  let params = [];

  // Scoping for DISCOM Nodal Officer
  if (req.user.role === 'DISCOM Nodal Officer') {
    whereClauses.push('(discom_name = ? OR discom_name = ?)');
    params.push(req.user.discom_name, req.user.discom_name.toUpperCase());
  } else if (req.query.discom && req.query.discom !== 'All') {
    whereClauses.push('discom_name = ?');
    params.push(req.query.discom);
  }

  if (req.query.district && req.query.district !== 'All') {
    whereClauses.push('district_name = ?');
    params.push(req.query.district);
  }

  if (req.query.platform && req.query.platform !== 'All') {
    whereClauses.push('platform = ?');
    params.push(req.query.platform);
  }

  if (req.query.from_date) {
    whereClauses.push('received_at >= ?');
    params.push(req.query.from_date + ' 00:00:00');
  }

  if (req.query.to_date) {
    whereClauses.push('received_at <= ?');
    params.push(req.query.to_date + ' 23:59:59');
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalRow = db.get(`SELECT COUNT(*) AS c FROM complaints ${whereSql};`, params);
  const total = totalRow ? totalRow.c : 0;

  const today = getIstTimestamp().substring(0, 10);
  const todayWhere = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')} AND received_at LIKE '${today}%'`
    : `WHERE received_at LIKE '${today}%'`;
  const todayRow = db.get(`SELECT COUNT(*) AS c FROM complaints ${todayWhere};`, params);
  const receivedToday = todayRow ? todayRow.c : 0;

  // Status-wise counts
  const statusRows = db.query(`SELECT current_status, COUNT(*) as c FROM complaints ${whereSql} GROUP BY current_status;`, params);
  const countsByStatus = {};
  for (const r of statusRows) {
    countsByStatus[r.current_status] = r.c;
  }

  // Overdue count (actual breach where current date > expected_response_date and not closed/resolved)
  const overdueWhere = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')} AND current_status NOT IN ('Closed', 'Resolved — Verification Pending', 'Duplicate / Invalid') AND expected_response_date IS NOT NULL AND expected_response_date < datetime('now')`
    : `WHERE current_status NOT IN ('Closed', 'Resolved — Verification Pending', 'Duplicate / Invalid') AND expected_response_date IS NOT NULL AND expected_response_date < datetime('now')`;
  const overdueRow = db.get(`SELECT COUNT(*) AS c FROM complaints ${overdueWhere};`, params);
  const overdueCount = overdueRow ? overdueRow.c : 0;

  const newCount = countsByStatus['New'] || 0;
  const forwardedCount = countsByStatus['Forwarded'] || 0;
  const followupCount = countsByStatus['DISCOM Follow Up'] || 0;
  const pendingCount = forwardedCount + followupCount + (countsByStatus['Pending'] || 0);
  const escalatedCount = countsByStatus['Escalated'] || 0;
  const resolvedPendingVerification = countsByStatus['Resolved — Verification Pending'] || 0;
  const closedCount = countsByStatus['Closed'] || 0;
  const reopenedCount = countsByStatus['Reopened'] || 0;
  const duplicateCount = countsByStatus['Duplicate / Invalid'] || 0;

  const resolvedRate = total > 0 ? (((closedCount + resolvedPendingVerification) / total) * 100).toFixed(1) : 0;

  res.json({
    total,
    receivedToday,
    new: newCount,
    forwarded: forwardedCount,
    followup: followupCount,
    pending: pendingCount,
    overdue: overdueCount,
    escalated: escalatedCount,
    resolvedPendingVerification,
    closed: closedCount,
    reopened: reopenedCount,
    duplicate: duplicateCount,
    resolvedRate: Number(resolvedRate)
  });
});

app.get('/api/dashboard/charts', authMiddleware, (req, res) => {
  let whereClauses = [];
  let params = [];

  if (req.user.role === 'DISCOM Nodal Officer') {
    whereClauses.push('(discom_name = ? OR discom_name = ?)');
    params.push(req.user.discom_name, req.user.discom_name.toUpperCase());
  } else if (req.query.discom && req.query.discom !== 'All') {
    whereClauses.push('discom_name = ?');
    params.push(req.query.discom);
  }

  if (req.query.district && req.query.district !== 'All') {
    whereClauses.push('district_name = ?');
    params.push(req.query.district);
  }

  if (req.query.platform && req.query.platform !== 'All') {
    whereClauses.push('platform = ?');
    params.push(req.query.platform);
  }

  if (req.query.from_date) {
    whereClauses.push('received_at >= ?');
    params.push(req.query.from_date + ' 00:00:00');
  }

  if (req.query.to_date) {
    whereClauses.push('received_at <= ?');
    params.push(req.query.to_date + ' 23:59:59');
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 1. Daily Trend
  const trendRows = db.query(`
    SELECT substr(received_at, 1, 10) as day, COUNT(*) as count
    FROM complaints
    ${whereSql}
    GROUP BY day
    ORDER BY day ASC
    LIMIT 30;
  `, params);

  // 2. Platform Distribution
  const platformRows = db.query(`
    SELECT platform, COUNT(*) as count
    FROM complaints
    ${whereSql}
    GROUP BY platform
    ORDER BY count DESC;
  `, params);

  // 3. X Handle Distribution
  const handleRows = db.query(`
    SELECT COALESCE(monitored_account, hierarchy_handle_name, 'Other') as handle, COUNT(*) as count
    FROM complaints
    ${whereSql}
    GROUP BY handle
    ORDER BY count DESC
    LIMIT 10;
  `, params);

  // 4. DISCOM-wise Volume & Resolution
  const discomRows = db.query(`
    SELECT discom_name,
      COUNT(*) as total,
      SUM(CASE WHEN current_status = 'Closed' THEN 1 ELSE 0 END) as closed,
      SUM(CASE WHEN current_status IN ('Forwarded', 'DISCOM Follow Up', 'Escalated') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN current_status NOT IN ('Closed', 'Resolved — Verification Pending') AND expected_response_date < datetime('now') THEN 1 ELSE 0 END) as overdue
    FROM complaints
    ${whereSql}
    GROUP BY discom_name
    ORDER BY total DESC;
  `, params);

  // 5. Category-wise Distribution
  const categoryRows = db.query(`
    SELECT category_name, COUNT(*) as count
    FROM complaints
    ${whereSql}
    GROUP BY category_name
    ORDER BY count DESC;
  `, params);

  // 6. District Top 10
  const districtRows = db.query(`
    SELECT district_name, discom_name, COUNT(*) as count
    FROM complaints
    ${whereSql}
    GROUP BY district_name, discom_name
    ORDER BY count DESC
    LIMIT 10;
  `, params);

  // 7. Status Distribution
  const statusRows = db.query(`
    SELECT current_status, COUNT(*) as count
    FROM complaints
    ${whereSql}
    GROUP BY current_status
    ORDER BY count DESC;
  `, params);

  res.json({
    trend: trendRows,
    platforms: platformRows,
    handles: handleRows,
    discoms: discomRows,
    categories: categoryRows,
    districts: districtRows,
    statuses: statusRows
  });
});

// -------------------------------------------------------------
// REPORTS & EXPORT ROUTES
// -------------------------------------------------------------

app.get('/api/reports/list', authMiddleware, (req, res) => {
  const reports = [
    { id: 'daily_ops', name: 'Daily Operational Summary Report', desc: 'Summary of complaints received, forwarded, resolved and closed today.' },
    { id: 'x_hierarchy', name: 'X Hierarchy-wise Grievance Report', desc: 'Complaints grouped by official monitored accounts & district hierarchy.' },
    { id: 'discom_district', name: 'DISCOM & District-wise Performance Report', desc: 'Performance, resolution rates, and pending volumes across DISCOMs and districts.' },
    { id: 'category_wise', name: 'Category-wise Grievance Breakdown Report', desc: 'Analysis by category: Transformer, Power Outage, Billing, Metering, Safety.' },
    { id: 'pending_overdue', name: 'Pending & Overdue Complaints Report', desc: 'All active grievances that have breached or are near their SLA threshold.' },
    { id: 'discom_followup', name: 'DISCOM Follow-Up & Reminder Report', desc: 'Log of follow-ups, telephone calls, portal reminders sent to DISCOMs.' },
    { id: 'escalation_report', name: 'Escalation Hierarchy Report', desc: 'Details of complaints escalated to SE, CE, Director, MD, and Chairman levels.' },
    { id: 'resolved_vs_closed', name: 'Resolved vs Verified-Closed Redressal Report', desc: 'Audit comparing DISCOM proposed resolutions against SMC verified closures.' },
    { id: 'aging_report', name: 'Complaint Aging & Turnaround Analysis', desc: 'Complaints grouped by age: <24h, 24-48h, 48-72h, >72h.' },
    { id: 'audit_trail', name: 'System Security & User Activity Audit Trail', desc: 'Append-only chronological record of operator and system actions.' }
  ];
  res.json({ reports });
});

app.get('/api/reports/export', authMiddleware, (req, res) => {
  const { type = 'daily_ops', format = 'csv', from_date, to_date, discom, district } = req.query;

  let whereClauses = [];
  let params = [];

  if (req.user.role === 'DISCOM Nodal Officer') {
    whereClauses.push('(discom_name = ? OR discom_name = ?)');
    params.push(req.user.discom_name, req.user.discom_name.toUpperCase());
  } else if (discom && discom !== 'All') {
    whereClauses.push('discom_name = ?');
    params.push(discom);
  }

  if (district && district !== 'All') {
    whereClauses.push('district_name = ?');
    params.push(district);
  }

  if (from_date) {
    whereClauses.push('received_at >= ?');
    params.push(from_date + ' 00:00:00');
  }

  if (to_date) {
    whereClauses.push('received_at <= ?');
    params.push(to_date + ' 23:59:59');
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let exportData = [];
  let fileName = `UPPCL_SMC_${type}_${Date.now()}`;

  if (type === 'x_hierarchy') {
    const rows = db.query(`
      SELECT
        COALESCE(monitored_account, 'Other') as 'Monitored Account',
        COALESCE(hierarchy_handle_name, 'Direct') as 'Hierarchy Handle',
        discom_name as 'DISCOM',
        district_name as 'District',
        category_name as 'Category',
        current_status as 'Status',
        COUNT(*) as 'Total Received',
        SUM(CASE WHEN current_status = 'Closed' THEN 1 ELSE 0 END) as 'Verified Closed',
        SUM(CASE WHEN current_status IN ('Forwarded', 'DISCOM Follow Up', 'Escalated') THEN 1 ELSE 0 END) as 'Pending'
      FROM complaints
      ${whereSql}
      GROUP BY monitored_account, hierarchy_handle_name, discom_name, district_name, category_name, current_status;
    `, params);
    exportData = rows;
  } else if (type === 'discom_district') {
    const rows = db.query(`
      SELECT
        discom_name as 'DISCOM',
        district_name as 'District',
        COUNT(*) as 'Total Grievances',
        SUM(CASE WHEN current_status = 'Closed' THEN 1 ELSE 0 END) as 'Closed (Verified)',
        SUM(CASE WHEN current_status = 'Resolved — Verification Pending' THEN 1 ELSE 0 END) as 'Resolved (Verification Due)',
        SUM(CASE WHEN current_status IN ('Forwarded', 'DISCOM Follow Up') THEN 1 ELSE 0 END) as 'Pending at DISCOM',
        SUM(CASE WHEN current_status = 'Escalated' THEN 1 ELSE 0 END) as 'Escalated',
        SUM(CASE WHEN expected_response_date < datetime('now') AND current_status NOT IN ('Closed', 'Resolved — Verification Pending') THEN 1 ELSE 0 END) as 'Overdue (Breached)'
      FROM complaints
      ${whereSql}
      GROUP BY discom_name, district_name
      ORDER BY discom_name, district_name;
    `, params);
    exportData = rows;
  } else if (type === 'category_wise') {
    const rows = db.query(`
      SELECT
        category_name as 'Category',
        subcategory_name as 'Subcategory',
        discom_name as 'DISCOM',
        COUNT(*) as 'Complaints',
        SUM(CASE WHEN current_status = 'Closed' THEN 1 ELSE 0 END) as 'Closed',
        SUM(CASE WHEN current_status NOT IN ('Closed', 'Duplicate / Invalid') THEN 1 ELSE 0 END) as 'Pending'
      FROM complaints
      ${whereSql}
      GROUP BY category_name, subcategory_name, discom_name;
    `, params);
    exportData = rows;
  } else if (type === 'audit_trail') {
    const rows = db.query(`
      SELECT
        id as 'Audit ID',
        created_at as 'Timestamp (IST)',
        username as 'User',
        user_role as 'Role',
        action as 'Action Performed',
        entity_type as 'Entity',
        entity_id as 'Reference ID',
        details as 'Details',
        ip_address as 'IP Address'
      FROM audit_logs
      ORDER BY id DESC
      LIMIT 1000;
    `);
    exportData = rows;
  } else {
    // Standard register export
    const rows = db.query(`
      SELECT
        complaint_no as 'Complaint ID',
        received_at as 'Received At (IST)',
        platform as 'Platform',
        monitored_account as 'Monitored Handle',
        hierarchy_handle_name as 'Jurisdiction Handle',
        consumer_name as 'Consumer Name',
        consumer_handle as 'Consumer Handle',
        discom_name as 'DISCOM',
        district_name as 'District',
        category_name as 'Category',
        subcategory_name as 'Subcategory',
        priority as 'Priority',
        current_status as 'Status',
        assigned_operator_name as 'Assigned Operator',
        assigned_nodal_officer_name as 'Nodal Officer',
        forwarding_date as 'Forwarded Date',
        forwarding_channel as 'Forwarding Channel',
        expected_response_date as 'Expected SLA Date',
        discom_action_taken as 'Action Taken',
        closure_date as 'Closure Date',
        closure_satisfaction_status as 'Satisfaction',
        complaint_text as 'Grievance Text',
        post_url as 'Original Post URL'
      FROM complaints
      ${whereSql}
      ORDER BY received_at DESC;
    `, params);
    exportData = rows;
  }

  logAudit(req, req.user, 'REPORT_EXPORTED', 'REPORT', type, `Exported ${exportData.length} records in ${format.toUpperCase()}`);

  if (format === 'excel' || format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'UPPCL SMC Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
    return res.send(buf);
  } else {
    // CSV export
    let csv = '';
    if (exportData.length > 0) {
      const headers = Object.keys(exportData[0]);
      csv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n';
      for (const row of exportData) {
        const line = headers.map(h => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',');
        csv += line + '\r\n';
      }
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    return res.send(csv);
  }
});

// -------------------------------------------------------------
// MASTER DATA & CONFIGURATION ROUTES
// -------------------------------------------------------------

// 1. Authoritative X Hierarchy
app.get('/api/master/x-hierarchy', authMiddleware, (req, res) => {
  const { level, discom, search } = req.query;
  let whereClauses = [];
  let params = [];

  if (level && level !== 'All') {
    whereClauses.push('hierarchy_level = ?');
    params.push(level);
  }
  if (discom && discom !== 'All') {
    whereClauses.push('discom_name = ?');
    params.push(discom);
  }
  if (search && search.trim()) {
    const t = `%${search.trim()}%`;
    whereClauses.push('(handle_name LIKE ? OR account_url LIKE ? OR district_name LIKE ? OR discom_name LIKE ?)');
    params.push(t, t, t, t);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const rows = db.query(`SELECT * FROM x_hierarchy ${whereSql} ORDER BY CAST(sr_no AS INTEGER) ASC;`, params);
  res.json({ data: rows });
});

app.post('/api/master/x-hierarchy', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const b = req.body;
  if (!b.handle_name || !b.account_url || !b.hierarchy_level) {
    return res.status(400).json({ error: 'Handle name, URL, and hierarchy level are required' });
  }

  const istTime = getIstTimestamp();
  const resIns = db.run(`
    INSERT INTO x_hierarchy (
      sr_no, hierarchy_level, discom_name, district_name, handle_name,
      account_url, parent_handle, is_monitored, is_active, remarks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?);
  `, [
    b.sr_no || '', b.hierarchy_level, b.discom_name || '', b.district_name || '',
    b.handle_name.trim(), b.account_url.trim(), b.parent_handle || '',
    b.is_monitored ? 1 : 0, b.remarks || '', istTime, istTime
  ]);

  logAudit(req, req.user, 'X_HIERARCHY_ADDED', 'X_HIERARCHY', resIns.lastInsertRowid, `Added X handle ${b.handle_name}`);
  res.status(201).json({ message: 'X handle added to hierarchy successfully' });
});

app.put('/api/master/x-hierarchy/:id', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  const istTime = getIstTimestamp();

  db.run(`
    UPDATE x_hierarchy SET
      hierarchy_level = COALESCE(?, hierarchy_level),
      discom_name = COALESCE(?, discom_name),
      district_name = COALESCE(?, district_name),
      handle_name = COALESCE(?, handle_name),
      account_url = COALESCE(?, account_url),
      parent_handle = COALESCE(?, parent_handle),
      is_monitored = COALESCE(?, is_monitored),
      is_active = COALESCE(?, is_active),
      remarks = COALESCE(?, remarks),
      updated_at = ?
    WHERE id = ?;
  `, [
    b.hierarchy_level, b.discom_name, b.district_name, b.handle_name,
    b.account_url, b.parent_handle, b.is_monitored !== undefined ? (b.is_monitored ? 1 : 0) : null,
    b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
    b.remarks, istTime, id
  ]);

  logAudit(req, req.user, 'X_HIERARCHY_UPDATED', 'X_HIERARCHY', id, `Updated X hierarchy item ${id}`);
  res.json({ message: 'Hierarchy handle updated successfully' });
});

app.post('/api/master/x-hierarchy/set-all-monitored', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const { all } = req.body;
  const istTime = getIstTimestamp();
  if (all) {
    db.run("UPDATE x_hierarchy SET is_monitored = 1, updated_at = ?;", [istTime]);
  } else {
    // Reset to default intake: Apex handles + DISCOM Corporate HQs
    db.run("UPDATE x_hierarchy SET is_monitored = 0, updated_at = ?;", [istTime]);
    db.run("UPDATE x_hierarchy SET is_monitored = 1, updated_at = ? WHERE CAST(sr_no AS INTEGER) BETWEEN 1 AND 7 OR CAST(sr_no AS INTEGER) BETWEEN 86 AND 90;", [istTime]);
  }
  logAudit(req, req.user, 'X_HIERARCHY_BULK_MONITOR', 'X_HIERARCHY', 0, `Updated monitored status for all handles (all=${all})`);
  res.json({ message: 'Hierarchy monitoring updated successfully' });
});

// 2. Facebook Handles Master
app.get('/api/master/facebook-handles', authMiddleware, (req, res) => {
  const rows = db.query('SELECT * FROM facebook_handles ORDER BY id ASC;');
  res.json({ data: rows });
});

// 3. Nodal Officers Directory
app.get('/api/master/nodal-officers', authMiddleware, (req, res) => {
  const { discom, district } = req.query;
  let whereClauses = [];
  let params = [];

  if (discom && discom !== 'All') {
    whereClauses.push('discom_name = ?');
    params.push(discom);
  }
  if (district && district !== 'All') {
    whereClauses.push('district_name = ?');
    params.push(district);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const rows = db.query(`SELECT * FROM nodal_officers ${whereSql} ORDER BY discom_name, district_name ASC;`, params);
  res.json({ data: rows });
});

app.post('/api/master/nodal-officers', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const b = req.body;
  if (!b.discom_name || !b.district_name || !b.mobile) {
    return res.status(400).json({ error: 'DISCOM, District, and Mobile are required' });
  }

  const istTime = getIstTimestamp();
  const ins = db.run(`
    INSERT INTO nodal_officers (
      discom_name, district_name, officer_name, designation, mobile,
      email, twitter_handle, facebook_url, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);
  `, [
    b.discom_name, b.district_name, b.officer_name || `Nodal Officer (${b.designation || 'SE'})`,
    b.designation || 'SE', b.mobile, b.email || '', b.twitter_handle || '', b.facebook_url || '',
    istTime, istTime
  ]);

  logAudit(req, req.user, 'NODAL_OFFICER_ADDED', 'NODAL_OFFICER', ins.lastInsertRowid, `Added nodal officer for ${b.discom_name} - ${b.district_name}`);
  res.status(201).json({ message: 'Nodal officer added successfully' });
});

app.put('/api/master/nodal-officers/:id', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  const istTime = getIstTimestamp();

  db.run(`
    UPDATE nodal_officers SET
      officer_name = COALESCE(?, officer_name),
      designation = COALESCE(?, designation),
      mobile = COALESCE(?, mobile),
      email = COALESCE(?, email),
      twitter_handle = COALESCE(?, twitter_handle),
      facebook_url = COALESCE(?, facebook_url),
      is_active = COALESCE(?, is_active),
      updated_at = ?
    WHERE id = ?;
  `, [
    b.officer_name, b.designation, b.mobile, b.email,
    b.twitter_handle, b.facebook_url,
    b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
    istTime, id
  ]);

  logAudit(req, req.user, 'NODAL_OFFICER_UPDATED', 'NODAL_OFFICER', id, `Updated nodal officer ${id}`);
  res.json({ message: 'Nodal officer updated successfully' });
});

// 4. Categories & Subcategories
app.get('/api/master/categories', authMiddleware, (req, res) => {
  const categories = db.query('SELECT * FROM complaint_categories WHERE is_active = 1 ORDER BY name ASC;');
  const subcategories = db.query('SELECT * FROM complaint_subcategories WHERE is_active = 1 ORDER BY name ASC;');

  const result = categories.map(cat => ({
    ...cat,
    subcategories: subcategories.filter(sub => sub.category_id === cat.id)
  }));

  res.json({ data: result });
});

// 5. DISCOMs & Districts Mapping
app.get('/api/master/discoms', authMiddleware, (req, res) => {
  const discoms = db.query('SELECT * FROM discoms WHERE is_active = 1 ORDER BY code ASC;');
  const districts = db.query('SELECT DISTINCT name, discom_name FROM districts WHERE is_active = 1 ORDER BY name ASC;');

  const mapped = discoms.map(d => ({
    ...d,
    districts: districts.filter(dist => dist.discom_name.toUpperCase() === d.code.toUpperCase())
  }));

  res.json({ data: mapped });
});

// 6. Organization Hierarchy (Zones, Circles, Divisions)
app.get('/api/master/jurisdiction', authMiddleware, (req, res) => {
  const { discom, zone, circle } = req.query;
  let sql = 'SELECT DISTINCT zone_name, circle_name, division_name, officer_name, mobile FROM jurisdiction_org WHERE 1=1';
  let params = [];

  if (discom && discom !== 'All') {
    sql += ' AND discom_name LIKE ?';
    params.push(`%${discom}%`);
  }
  if (zone) {
    sql += ' AND zone_name = ?';
    params.push(zone);
  }
  if (circle) {
    sql += ' AND circle_name = ?';
    params.push(circle);
  }

  sql += ' ORDER BY zone_name, circle_name, division_name ASC LIMIT 500;';
  const rows = db.query(sql, params);
  res.json({ data: rows });
});

// -------------------------------------------------------------
// USER MANAGEMENT & SYSTEM SETTINGS (ADMIN ONLY)
// -------------------------------------------------------------

app.get('/api/users', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const users = db.query('SELECT id, username, full_name, email, role, discom_name, designation, mobile, is_active, assigned_districts, created_at, updated_at FROM users ORDER BY id ASC;');
  res.json({ data: users });
});

app.post('/api/users', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const b = req.body;
  if (!b.username || !b.password || !b.full_name || !b.role) {
    return res.status(400).json({ error: 'Username, password, full name, and role are required' });
  }

  const existing = db.get('SELECT id FROM users WHERE username = ?;', [b.username.trim()]);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const hash = bcrypt.hashSync(b.password, 10);
  const istTime = getIstTimestamp();

  const ins = db.run(`
    INSERT INTO users (username, password_hash, full_name, email, role, discom_name, designation, mobile, assigned_districts, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);
  `, [
    b.username.trim(), hash, b.full_name.trim(), b.email || '', b.role,
    b.discom_name || 'All DISCOMs', b.designation || '', b.mobile || '',
    b.assigned_districts || '',
    istTime, istTime
  ]);

  logAudit(req, req.user, 'USER_CREATED', 'USER', ins.lastInsertRowid, `Created user ${b.username} with role ${b.role}`);
  res.status(201).json({ message: 'User created successfully' });
});

app.put('/api/users/:id', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  const istTime = getIstTimestamp();

  if (b.password && b.password.length >= 6) {
    const hash = bcrypt.hashSync(b.password, 10);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?;', [hash, id]);
  }

  db.run(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      email = COALESCE(?, email),
      role = COALESCE(?, role),
      discom_name = COALESCE(?, discom_name),
      designation = COALESCE(?, designation),
      mobile = COALESCE(?, mobile),
      assigned_districts = COALESCE(?, assigned_districts),
      is_active = COALESCE(?, is_active),
      updated_at = ?
    WHERE id = ?;
  `, [
    b.full_name, b.email, b.role, b.discom_name, b.designation, b.mobile,
    b.assigned_districts,
    b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
    istTime, id
  ]);

  logAudit(req, req.user, 'USER_UPDATED', 'USER', id, `Updated user ${id}`);
  res.json({ message: 'User updated successfully' });
});

app.get('/api/settings', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const settings = db.query('SELECT * FROM system_settings ORDER BY id ASC;');
  res.json({ data: settings });
});

app.put('/api/settings', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const { settings } = req.body;
  if (!Array.isArray(settings)) {
    return res.status(400).json({ error: 'Settings array required' });
  }

  const istTime = getIstTimestamp();
  for (const s of settings) {
    db.run('UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?;', [s.value, istTime, s.key]);
  }

  logAudit(req, req.user, 'SETTINGS_UPDATED', 'SETTINGS', 0, 'Updated system settings');
  res.json({ message: 'Settings saved successfully' });
});

app.get('/api/audit-logs', authMiddleware, requireRoles('Super Administrator', 'Supervisor / Management'), (req, res) => {
  const { page = 1, limit = 50, action, username } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(200, Math.max(10, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * pageSize;

  let whereClauses = [];
  let params = [];

  if (action && action !== 'All') {
    whereClauses.push('action = ?');
    params.push(action);
  }
  if (username && username.trim()) {
    whereClauses.push('username LIKE ?');
    params.push(`%${username.trim()}%`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = db.get(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql};`, params);
  const total = countRow ? countRow.total : 0;

  const logs = db.query(`SELECT * FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?;`, [...params, pageSize, offset]);

  res.json({
    data: logs,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize) || 1
    }
  });
});

// -------------------------------------------------------------
// COMPLAINT REPLY DISPATCH & WORKFLOW
// -------------------------------------------------------------

app.post('/api/complaints/:id/send-reply', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management', 'Complaint Handler'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  // Role scoping for handler
  if ((req.user.role === 'Complaint Handler' || req.user.role === 'Social Media Cell Operator') && req.user.assigned_districts && req.user.assigned_districts.trim() && req.user.assigned_districts !== 'All') {
    const allowed = req.user.assigned_districts.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (allowed.length > 0 && complaint.district_name && !allowed.includes(complaint.district_name.toLowerCase())) {
      return res.status(403).json({ error: `Access denied: You are not assigned to district ${complaint.district_name}` });
    }
  }

  const { reply_text } = req.body;
  const textToSend = (reply_text && reply_text.trim()) || complaint.reply_draft;
  if (!textToSend || !textToSend.trim()) {
    return res.status(400).json({ error: 'Reply text cannot be empty' });
  }

  const result = await XService.publishReply(id, req.user, textToSend);
  if (result.success) {
    logAudit(req, req.user, 'X_REPLY_SENT', 'COMPLAINT', id, `Sent X reply [${result.status}]: ${result.reply_id || ''}`);
    res.json({ message: 'Reply processed successfully', result });
  } else {
    logAudit(req, req.user, 'X_REPLY_FAILED', 'COMPLAINT', id, `Failed to send X reply: ${result.error}`);
    res.status(400).json({ error: result.error, code: result.code });
  }
});

// -------------------------------------------------------------
// REPLY TEMPLATES MANAGEMENT
// -------------------------------------------------------------

app.get('/api/templates', authMiddleware, (req, res) => {
  const { category, language } = req.query;
  let sql = 'SELECT * FROM reply_templates WHERE is_active = 1';
  const params = [];
  if (category && category !== 'All') {
    sql += ' AND category_name = ?';
    params.push(category);
  }
  if (language && language !== 'All') {
    sql += ' AND language = ?';
    params.push(language);
  }
  sql += ' ORDER BY category_name, language, title ASC;';
  const templates = db.query(sql, params);
  res.json({ data: templates });
});

app.post('/api/templates', authMiddleware, requireRoles('Super Administrator', 'Supervisor / Management'), (req, res) => {
  const b = req.body;
  const bodyText = (b.body || b.template_body || '').trim();
  if (!b.category_name || !b.title || !bodyText) {
    return res.status(400).json({ error: 'Category, title, and body are required' });
  }
  const istTime = getIstTimestamp();
  const code = (b.template_code || b.title.substring(0, 10).toUpperCase().replace(/\s+/g, '_')).trim();
  const ins = db.run(`
    INSERT INTO reply_templates (title, category_name, stage, language, body, template_body, template_code, description, variables_json, version, is_active, usage_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', 1, 1, 0, ?, ?);
  `, [
    b.title.trim(), b.category_name.trim(), b.stage || 'acknowledgement',
    b.language || 'Hindi', bodyText, bodyText, code, b.description || '', istTime, istTime
  ]);
  logAudit(req, req.user, 'TEMPLATE_CREATED', 'TEMPLATE', ins.lastInsertRowid, `Created template ${b.title}`);
  res.status(201).json({ message: 'Template created successfully' });
});

app.put('/api/templates/:id', authMiddleware, requireRoles('Super Administrator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  const istTime = getIstTimestamp();
  const bodyText = b.body || b.template_body;
  db.run(`
    UPDATE reply_templates SET
      template_code = COALESCE(?, template_code),
      category_name = COALESCE(?, category_name),
      language = COALESCE(?, language),
      title = COALESCE(?, title),
      body = COALESCE(?, body),
      template_body = COALESCE(?, template_body),
      description = COALESCE(?, description),
      is_active = COALESCE(?, is_active),
      updated_at = ?
    WHERE id = ?;
  `, [
    b.template_code, b.category_name, b.language, b.title, bodyText, bodyText,
    b.description, b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
    istTime, id
  ]);
  logAudit(req, req.user, 'TEMPLATE_UPDATED', 'TEMPLATE', id, `Updated template ${id}`);
  res.json({ message: 'Template updated successfully' });
});

app.delete('/api/templates/:id', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const istTime = getIstTimestamp();
  db.run('UPDATE reply_templates SET is_active = 0, updated_at = ? WHERE id = ?;', [istTime, id]);
  logAudit(req, req.user, 'TEMPLATE_DELETED', 'TEMPLATE', id, `Deactivated template ${id}`);
  res.json({ message: 'Template deactivated successfully' });
});

app.post('/api/templates/preview', authMiddleware, (req, res) => {
  try {
    const { template_id, template_body, body, complaint_id } = req.body;
    let text = template_body || body || '';
    if (template_id) {
      const t = db.get('SELECT body, template_body FROM reply_templates WHERE id = ?;', [template_id]);
      if (t) text = t.body || t.template_body || '';
    }
    if (!text) return res.status(400).json({ error: 'Template text or ID required' });

    if (complaint_id) {
      const c = db.get('SELECT * FROM complaints WHERE id = ?;', [complaint_id]);
      if (c) {
        text = XService.renderTemplate(text, c);
      }
    }
    res.json({ rendered_text: text });
  } catch (err) {
    console.error('Template preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// NOTIFICATIONS SYSTEM
// -------------------------------------------------------------

app.get('/api/notifications', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const rows = db.query(`
    SELECT * FROM notifications
    WHERE user_id = ? OR user_id IS NULL OR user_id = 0
    ORDER BY id DESC LIMIT 50;
  `, [userId]);

  const unreadCount = rows.filter(r => r.is_read === 0).length;
  res.json({ data: rows, unread_count: unreadCount });
});

app.post('/api/notifications/:id/read', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const istTime = getIstTimestamp();
  db.run('UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ?;', [istTime, id]);
  res.json({ message: 'Notification marked as read' });
});

app.post('/api/notifications/read-all', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const istTime = getIstTimestamp();
  db.run('UPDATE notifications SET is_read = 1, read_at = ? WHERE (user_id = ? OR user_id IS NULL OR user_id = 0) AND is_read = 0;', [istTime, userId]);
  res.json({ message: 'All notifications marked as read' });
});

// -------------------------------------------------------------
// INTERNAL SUPPORT TICKETING
// -------------------------------------------------------------

app.get('/api/internal-tickets', authMiddleware, (req, res) => {
  const { status } = req.query;
  let whereClauses = [];
  let params = [];

  // Scoping: non-admins only see tickets they raised
  if (!['Super Administrator', 'Supervisor / Management'].includes(req.user.role)) {
    whereClauses.push('created_by_user_id = ?');
    params.push(req.user.id);
  }

  if (status && status !== 'All') {
    whereClauses.push('status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const tickets = db.query(`SELECT * FROM internal_tickets ${whereSql} ORDER BY id DESC;`, params);
  res.json({ data: tickets });
});

app.post('/api/internal-tickets', authMiddleware, (req, res) => {
  const b = req.body;
  if (!b.subject || !b.description) {
    return res.status(400).json({ error: 'Subject and description are required' });
  }

  const istTime = getIstTimestamp();
  const seq = Date.now().toString().slice(-6);
  const ticketNo = `TKT-${seq}`;

  const ins = db.run(`
    INSERT INTO internal_tickets (
      ticket_no, subject, description, category, priority, status,
      complaint_id, created_by_user_id, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?);
  `, [
    ticketNo, b.subject.trim(), b.description.trim(), b.category || 'Bug / Technical Issue',
    b.priority || 'Normal', b.complaint_id || null, req.user.id, req.user.full_name, istTime, istTime
  ]);

  // Create notification for admins
  try {
    db.run(`
      INSERT INTO notifications (user_id, title, message, type, complaint_id, is_read, created_at)
      VALUES (NULL, ?, ?, 'INFO', ?, 0, ?);
    `, [`New Internal Ticket ${ticketNo}`, `${req.user.full_name} raised ticket: ${b.subject}`, b.complaint_id || null, istTime]);
  } catch (e) {}

  logAudit(req, req.user, 'INTERNAL_TICKET_CREATED', 'INTERNAL_TICKET', ins.lastInsertRowid, `Raised ticket ${ticketNo}`);
  res.status(201).json({ message: 'Internal ticket raised successfully', ticket_no: ticketNo });
});

app.put('/api/internal-tickets/:id', authMiddleware, requireRoles('Super Administrator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  const istTime = getIstTimestamp();

  db.run(`
    UPDATE internal_tickets SET
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      assigned_to_user_id = COALESCE(?, assigned_to_user_id),
      assigned_to_name = COALESCE(?, assigned_to_name),
      resolution_notes = COALESCE(?, resolution_notes),
      resolved_at = CASE WHEN ? = 'Resolved' OR ? = 'Closed' THEN ? ELSE resolved_at END,
      updated_at = ?
    WHERE id = ?;
  `, [
    b.status, b.priority, b.assigned_to_user_id, b.assigned_to_name,
    b.resolution_notes, b.status, b.status, istTime, istTime, id
  ]);

  logAudit(req, req.user, 'INTERNAL_TICKET_UPDATED', 'INTERNAL_TICKET', id, `Updated ticket ${id}`);
  res.json({ message: 'Ticket updated successfully' });
});

// -------------------------------------------------------------
// X SERVICE & AUTOMATION ADMIN ENDPOINTS
// -------------------------------------------------------------

app.get('/api/admin/x-status', authMiddleware, requireRoles('Super Administrator', 'Supervisor / Management'), (req, res) => {
  const status = XService.getStatus();
  res.json({ data: status });
});

app.post('/api/admin/x-config', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  const b = req.body;
  const istTime = getIstTimestamp();

  function setSetting(k, v) {
    if (v === undefined || v === null) return;
    const existing = db.get("SELECT id FROM system_settings WHERE key = ?;", [k]);
    if (existing) {
      db.run("UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?;", [String(v), istTime, k]);
    } else {
      db.run("INSERT INTO system_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?);", [k, String(v), 'X API Credential', istTime]);
    }
  }

  if (b.automation_mode && ['A', 'B', 'C'].includes(b.automation_mode)) {
    setSetting('automation_mode', b.automation_mode);
  }
  if (b.x_account_handle) setSetting('x_account_handle', b.x_account_handle.trim());
  if (b.x_account_id) setSetting('x_account_id', b.x_account_id.trim());
  if (b.ingestion_interval_seconds) setSetting('ingestion_interval_seconds', String(b.ingestion_interval_seconds));
  if (b.x_bearer_token !== undefined && b.x_bearer_token !== '') setSetting('x_bearer_token', b.x_bearer_token.trim());
  if (b.x_api_key !== undefined && b.x_api_key !== '') setSetting('x_api_key', b.x_api_key.trim());
  if (b.x_api_secret !== undefined && b.x_api_secret !== '') setSetting('x_api_secret', b.x_api_secret.trim());
  if (b.x_access_token !== undefined && b.x_access_token !== '') setSetting('x_access_token', b.x_access_token.trim());
  if (b.x_access_token_secret !== undefined && b.x_access_token_secret !== '') setSetting('x_access_token_secret', b.x_access_token_secret.trim());

  logAudit(req, req.user, 'X_CONFIG_UPDATED', 'SETTINGS', 0, 'Updated X configuration and automation settings');
  res.json({ message: 'X configuration updated successfully', current_status: XService.getStatus() });
});

app.post('/api/admin/emergency-stop', authMiddleware, requireRoles('Super Administrator', 'Supervisor / Management'), (req, res) => {
  const { active } = req.body;
  const isStop = active === true || active === 'true' || active === 1;
  const istTime = getIstTimestamp();

  db.run("UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'emergency_stop';", [isStop ? 'true' : 'false', istTime]);

  const auditAction = isStop ? 'EMERGENCY_STOP_ACTIVATED' : 'EMERGENCY_STOP_DEACTIVATED';
  logAudit(req, req.user, auditAction, 'SYSTEM', 0, `Emergency stop set to ${isStop}`);

  // Create high-priority notification
  try {
    db.run(`
      INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
      VALUES (NULL, ?, ?, ?, 0, ?);
    `, [
      isStop ? 'EMERGENCY STOP ACTIVATED' : 'Emergency Stop Deactivated',
      isStop ? `Automated X replies immediately halted by ${req.user.full_name}.` : `Automated replies resumed by ${req.user.full_name}.`,
      isStop ? 'CRITICAL' : 'INFO',
      istTime
    ]);
  } catch (e) {}

  res.json({ message: `Emergency stop ${isStop ? 'ACTIVATED' : 'DEACTIVATED'}`, emergency_stop: isStop });
});

app.post('/api/admin/sync-now', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator'), async (req, res) => {
  try {
    const result = await XService.pollRecentPosts();
    logAudit(req, req.user, 'MANUAL_X_SYNC', 'X_SYNC', 0, `Manual sync executed: ${result.new_posts} new posts ingested`);
    res.json({ message: 'Manual sync completed', result });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

app.post('/api/admin/x-verify', authMiddleware, requireRoles('Super Administrator'), async (req, res) => {
  const verification = await XService.verifyConnection();
  res.json({ data: verification });
});

// -------------------------------------------------------------
// OPERATIONAL HEALTH & SLA MONITORING
// -------------------------------------------------------------

function getHealthStatus() {
  let dbStatus = 'connected';
  let totalComplaints = 0;
  let activeOverdue = 0;
  let draftReviewCount = 0;
  let unassignedCount = 0;
  let recentWorker = null;

  try {
    const cTotal = db.get('SELECT COUNT(*) as c FROM complaints;');
    totalComplaints = cTotal ? cTotal.c : 0;

    const cOverdue = db.get("SELECT COUNT(*) as c FROM complaints WHERE is_overdue = 1 AND current_status NOT IN ('Closed', 'Resolved — Verification Pending', 'Duplicate / Invalid');");
    activeOverdue = cOverdue ? cOverdue.c : 0;

    const cDraft = db.get("SELECT COUNT(*) as c FROM complaints WHERE reply_status = 'DRAFT_GENERATED';");
    draftReviewCount = cDraft ? cDraft.c : 0;

    const cUnassigned = db.get("SELECT COUNT(*) as c FROM complaints WHERE district_name = 'Unassigned';");
    unassignedCount = cUnassigned ? cUnassigned.c : 0;

    recentWorker = db.get('SELECT * FROM worker_heartbeats ORDER BY id DESC LIMIT 1;');
  } catch (e) {
    dbStatus = 'error: ' + e.message;
  }

  const xStatus = XService.getStatus();
  let workerStatus = 'idle / not started';
  let workerLagSeconds = null;

  if (recentWorker && recentWorker.last_heartbeat) {
    const hbTime = new Date(recentWorker.last_heartbeat).getTime();
    workerLagSeconds = Math.round((Date.now() - hbTime) / 1000);
    workerStatus = workerLagSeconds < 180 ? 'running' : 'delayed';
  }

  const overall = (dbStatus === 'connected' && !xStatus.emergency_stop) ? 'healthy' : 'warning';

  return {
    status: overall,
    system_name: 'UPPCL Grievance Command Centre',
    timestamp: getIstTimestamp(),
    uptime_seconds: Math.round(process.uptime()),
    database: {
      status: dbStatus,
      total_complaints: totalComplaints,
      active_overdue: activeOverdue,
      draft_review_queue: draftReviewCount,
      unassigned_queue: unassignedCount
    },
    worker: {
      status: workerStatus,
      last_heartbeat: recentWorker ? recentWorker.last_heartbeat : null,
      lag_seconds: workerLagSeconds,
      service: recentWorker ? recentWorker.worker_name : 'worker-daemon'
    },
    x_integration: {
      connection_status: xStatus.connection_status,
      has_bearer_token: xStatus.has_bearer_token,
      has_user_oauth: xStatus.has_user_oauth,
      monitored_account: xStatus.monitored_account,
      automation_mode: xStatus.automation_mode,
      emergency_stop: xStatus.emergency_stop,
      last_poll_at: xStatus.last_poll_at,
      incoming_posts_count: xStatus.incoming_posts_count,
      outgoing_replies_count: xStatus.outgoing_replies_count
    }
  };
}

app.get('/health', (req, res) => {
  const health = getHealthStatus();
  res.json(health);
});

app.get('/api/health', (req, res) => {
  const health = getHealthStatus();
  res.json(health);
});

// Single Page Application Fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
db.initDb().then(async () => {
  // Check if database needs seeding (e.g. fresh cloud deployment)
  try {
    const userCheck = db.get('SELECT COUNT(*) as count FROM users;');
    if (!userCheck || userCheck.count === 0) {
      console.log('No users found in database. Running initial seed...');
      const { runSeed } = require('./seed');
      await runSeed();
    }
  } catch (seedErr) {
    console.warn('Auto-seed check error:', seedErr.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================================`);
    console.log(` UPPCL Social Media Cell Complaint Management System`);
    console.log(` Server running on port: ${PORT} (0.0.0.0)`);
    console.log(` Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(` System Time (IST): ${getIstTimestamp()}`);
    console.log(`===========================================================`);

    // Start background worker daemon if enabled (default enabled for single-service deployments)
    if (process.env.ENABLE_INTERNAL_WORKER !== 'false') {
      try {
        const worker = require('./worker');
        worker.startWorker().catch(wErr => {
          console.warn('[Server] Internal worker start warning:', wErr.message);
        });
      } catch (wErr) {
        console.warn('[Server] Worker import error:', wErr.message);
      }
    }
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
