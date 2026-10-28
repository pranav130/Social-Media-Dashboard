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
const googleSheetsService = require('./google_sheets_service');
const workingSheetService = require('./working_sheet_service');
const sheetRotationService = require('./sheet_rotation_service');
const { TARGET_HANDLES, TARGET_HANDLES_CANONICAL, isPostEligible, getMatchedTargetHandles, resolvePrimaryMonitoredAccount } = require('./eligibility');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'uppcl_smc_secret_key_2026_secure_grievance_platform';

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Dedicated raw Code.gs route (plain text so browsers view directly)
app.get(['/Code.gs', '/code.gs', '/code.txt'], (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(path.join(__dirname, 'google_apps_script', 'Code.gs'));
});

// Interactive Code.gs web viewer with 1-click copy button
app.get(['/code', '/view-code'], (req, res) => {
  const codePath = path.join(__dirname, 'google_apps_script', 'Code.gs');
  const code = fs.readFileSync(codePath, 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UPPCL Apps Script &mdash; Code.gs Viewer</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1f36; color: #f8fafc; margin: 0; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; background: #132d4b; padding: 16px 24px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #1e4570; flex-wrap: wrap; gap: 12px; }
    h1 { margin: 0; font-size: 18px; color: #00e5e5; display: flex; align-items: center; gap: 10px; }
    .btn { background: #008080; color: white; border: none; padding: 10px 22px; font-size: 14px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
    .btn:hover { background: #00a8a8; }
    .btn:active { transform: scale(0.98); }
    .raw-link { color: #38bdf8; text-decoration: none; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid #1e4570; border-radius: 6px; background: rgba(56, 189, 248, 0.08); font-weight: 600; }
    .raw-link:hover { background: rgba(56, 189, 248, 0.16); }
    pre { background: #06111f; padding: 20px; border-radius: 8px; border: 1px solid #1e4570; overflow-x: auto; font-size: 12px; font-family: Consolas, Monaco, monospace; line-height: 1.5; color: #e2e8f0; max-height: calc(100vh - 160px); }
    .toast { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; display: none; box-shadow: 0 6px 20px rgba(0,0,0,0.4); z-index: 9999; }
  </style>
</head>
<body>
  <div id="toast" class="toast"><i class="fa-solid fa-circle-check"></i> Entire Code.gs Copied to Clipboard!</div>
  <div class="header">
    <div>
      <h1><i class="fa-brands fa-google"></i> UPPCL Automation &mdash; Code.gs</h1>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Authoritative Google Apps Script for Google Sheet Automation (1,413 lines)</div>
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <a href="/Code.gs" class="raw-link" target="_blank"><i class="fa-solid fa-file-code"></i> Raw Text</a>
      <button class="btn" onclick="copyCode()"><i class="fa-solid fa-copy"></i> Copy Entire Code.gs</button>
    </div>
  </div>
  <pre id="codeBlock"><code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
  <script>
    function copyCode() {
      const code = document.getElementById('codeBlock').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const t = document.getElementById('toast');
        t.style.display = 'block';
        setTimeout(() => { t.style.display = 'none'; }, 2800);
      });
    }
  </script>
</body>
</html>`);
});

// Anti-caching middleware for modern browser SPA freshness
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (p === '/' || p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.css')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

// Static frontend
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));
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
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.get('SELECT id, username, full_name, email, role, discom_name, designation, mobile, is_active, assigned_districts FROM users WHERE id = ?;', [decoded.id]);
    if (!user || user.is_active !== 1) {
      return res.status(401).json({ error: 'Account inactive or not found' });
    }
    if (user.username === 'operator' || user.id === 2 || (user.full_name && user.full_name.includes('Rajesh Verma'))) {
      user.full_name = 'SMC-Operator';
    }
    req.user = user;

    // Strict Role-Based Server-Side Authorization for Restricted Operator Role
    const userRoleLower = (user.role || '').toLowerCase();
    const userUsernameLower = (user.username || '').toLowerCase();
    const isRestrictedOp = userRoleLower === 'operator' || 
                           userRoleLower === 'social media cell operator' || 
                           userUsernameLower === 'smc_operator' ||
                           userUsernameLower === 'operator';

    if (isRestrictedOp) {
      const allowedPaths = [
        '/api/auth/me',
        '/api/auth/logout',
        '/api/auth/change-password',
        '/api/dashboard/kpis',
        '/api/working-sheet/data',
        '/api/working-sheet/districts',
        '/api/working-sheet/update-cell'
      ];
      const cleanPath = (req.baseUrl ? `${req.baseUrl}${req.path}` : req.path).split('?')[0];
      const isAllowed = allowedPaths.some(p => cleanPath === p || cleanPath.startsWith('/api/working-sheet/'));
      if (!isAllowed) {
        logAudit(req, user, 'UNAUTHORIZED_ACCESS_BLOCKED', 'SECURITY', user.id, `Operator blocked from accessing ${req.method} ${cleanPath}`);
        return res.status(403).json({
          error: 'Forbidden: Operator account is restricted exclusively to Operations → WORKING SHEET'
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

// Role Authorization Middleware
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (['Administrator', 'Super Administrator', 'Admin'].includes(req.user.role)) return next(); // Admin bypass
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
  try {
    const { username, password } = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const rawUser = String(username || '').trim().toLowerCase();
    const throttleKey = `${clientIp}_${rawUser}`;

    const attempts = loginAttempts.get(throttleKey) || { count: 0, lastTime: Date.now() };
    if (Date.now() - attempts.lastTime >= 60000) {
      attempts.count = 0;
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.get('SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?);', [rawUser]);
    if (!user || user.is_active !== 1) {
      attempts.count++;
      attempts.lastTime = Date.now();
      loginAttempts.set(throttleKey, attempts);
      logAudit(req, null, 'LOGIN_FAILED', 'USER', username, 'User not found or inactive');
      if (attempts.count >= 10 && Date.now() - attempts.lastTime < 60000) {
        return res.status(429).json({ error: 'Too many failed login attempts. Please wait 1 minute before trying again.' });
      }
      return res.status(401).json({ error: 'Invalid credentials or account deactivated' });
    }

    let match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      // Support simplified/smaller passwords for standard roles, as well as legacy passwords
      const standardShortPasswords = {
        admin: ['admin123', 'admin', 'uppcl123', 'Admin@UPPCL2026', 'Admin@123', 'Admin123'],
        smc_operator: ['Operator@123', 'operator123', 'operator', 'uppcl123', 'Operator@UPPCL2026', 'Operator123', 'k7_Ht=8VexB&4Zr3Eb'],
        operator: ['Operator@123', 'operator123', 'operator', 'uppcl123', 'Operator@UPPCL2026', 'Operator123', 'k7_Ht=8VexB&4Zr3Eb'],
        operator2: ['operator123', 'operator', 'uppcl123', 'Operator@UPPCL2026', 'Operator@123', 'Operator123'],
        supervisor: ['supervisor123', 'supervisor', 'uppcl123', 'Supervisor@UPPCL2026', 'Supervisor@123', 'Supervisor123'],
        reviewer: ['reviewer123', 'reviewer', 'uppcl123', 'Reviewer@UPPCL2026', 'Reviewer@123', 'Reviewer123']
      };
      const validFallbacks = standardShortPasswords[user.username.toLowerCase()] || 
        (user.username.toLowerCase().startsWith('nodal_') ? ['nodal123', 'nodal', 'uppcl123', `Nodal@${(user.discom_name || '').toUpperCase()}2026`] : []);
        
      if (validFallbacks.includes(password)) {
        match = true;
      }
    }

    if (!match) {
      attempts.count++;
      attempts.lastTime = Date.now();
      loginAttempts.set(throttleKey, attempts);
      logAudit(req, user, 'LOGIN_FAILED', 'USER', user.id, 'Incorrect password');
      if (attempts.count >= 10 && Date.now() - attempts.lastTime < 60000) {
        return res.status(429).json({ error: 'Too many failed login attempts. Please wait 1 minute before trying again.' });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Clear throttle on success
    loginAttempts.delete(throttleKey);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, discom_name: user.discom_name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    logAudit(req, user, 'LOGIN_SUCCESS', 'USER', user.id, `User logged in from ${clientIp}`);

    const userFullName = (user.username === 'operator' || user.id === 2 || (user.full_name && user.full_name.includes('Rajesh Verma')))
      ? 'SMC-Operator'
      : user.full_name;

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: userFullName,
        email: user.email,
        role: user.role,
        discom_name: user.discom_name,
        designation: user.designation,
        mobile: user.mobile,
        assigned_districts: user.assigned_districts || ''
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'An unexpected internal error occurred during login. Please try again.' });
  }
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

// Helper to safely construct SQL ORDER BY clause for complaint queries
function buildComplaintOrderClause(sort_by, sort_order) {
  const safeOrder = (sort_order && String(sort_order).toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
  switch (sort_by) {
    case 'complaint_no':
      return `complaint_no ${safeOrder}, id ${safeOrder}`;
    case 'received_at':
      return `received_at ${safeOrder}, id ${safeOrder}`;
    case 'platform':
      return `platform ${safeOrder}, monitored_account ${safeOrder}, received_at DESC`;
    case 'consumer_name':
      return `COALESCE(NULLIF(consumer_name, ''), consumer_handle, 'ZZZZ') ${safeOrder}, received_at DESC`;
    case 'category_name':
      return `category_name ${safeOrder}, received_at DESC`;
    case 'discom_name':
      return `discom_name ${safeOrder}, COALESCE(district_name, '') ${safeOrder}, received_at DESC`;
    case 'district_name':
      return `COALESCE(district_name, 'ZZZZ') ${safeOrder}, discom_name ${safeOrder}, received_at DESC`;
    case 'priority':
      if (safeOrder === 'ASC') {
        return `CASE priority WHEN 'Low' THEN 1 WHEN 'Normal' THEN 2 WHEN 'High' THEN 3 WHEN 'Critical' THEN 4 ELSE 5 END ASC, received_at DESC`;
      } else {
        return `CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Normal' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END ASC, received_at DESC`;
      }
    case 'current_status':
      return `current_status ${safeOrder}, received_at DESC`;
    case 'expected_response_date':
      return `CASE WHEN expected_response_date IS NULL OR expected_response_date = '' THEN 1 ELSE 0 END ASC, expected_response_date ${safeOrder}, received_at DESC`;
    case 'assigned_nodal_officer_name':
      return `CASE WHEN assigned_nodal_officer_name IS NULL OR assigned_nodal_officer_name = '' THEN 1 ELSE 0 END ASC, assigned_nodal_officer_name ${safeOrder}, received_at DESC`;
    case 'forwarding_ref_no':
      return `CASE WHEN forwarding_ref_no IS NULL OR forwarding_ref_no = '' THEN 1 ELSE 0 END ASC, forwarding_ref_no ${safeOrder}, received_at DESC`;
    default:
      return `received_at ${safeOrder}, id ${safeOrder}`;
  }
}

/**
 * Builds a comprehensive search filter across complaint fields, including:
 * - Complaint ID & sheet row number
 * - Consumer name, handle, mobile, account number
 * - Complaint text & target mentions
 * - Received At timestamp & date (supports YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, MM-YYYY)
 * - DISCOM, Zone, Circle, Division, District
 * - Category, Subcategory, Complaint Type
 * - Workflow Status & Picked Status
 * - Head code & Monitored account
 * - Tweet post URL & original post ID
 * - Forwarding reference number
 */
function buildComplaintSearchFilter(search) {
  if (!search || !String(search).trim()) return null;

  const raw = String(search).trim();
  const term = `%${raw}%`;

  const clauses = [
    'complaint_no LIKE ?',
    'consumer_name LIKE ?',
    'consumer_handle LIKE ?',
    'complaint_text LIKE ?',
    'district_name LIKE ?',
    'division_name LIKE ?',
    'subdivision_name LIKE ?',
    'circle_name LIKE ?',
    'zone_name LIKE ?',
    'discom_name LIKE ?',
    'category_name LIKE ?',
    'subcategory_name LIKE ?',
    'complaint_type LIKE ?',
    'consumer_account_no LIKE ?',
    'consumer_mobile LIKE ?',
    'assigned_nodal_officer_name LIKE ?',
    'monitored_account LIKE ?',
    'hierarchy_handle_name LIKE ?',
    'target_mentions LIKE ?',
    'forwarding_ref_no LIKE ?',
    'post_url LIKE ?',
    'original_post_id LIKE ?',
    'head LIKE ?',
    'current_status LIKE ?',
    'picked_status LIKE ?',
    'link_shift LIKE ?',
    'reply_shift LIKE ?',
    'received_at LIKE ?'
  ];
  const params = Array(clauses.length).fill(term);

  // 1. Date conversion: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (e.g. 22-10-2026 -> 2026-10-22)
  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    const yyyy = dmy[3];
    clauses.push('received_at LIKE ?');
    params.push(`%${yyyy}-${mm}-${dd}%`);
  }

  // 2. Date conversion: MM-YYYY or MM/YYYY (e.g. 10-2026 -> 2026-10)
  const my = raw.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (my) {
    const mm = my[1].padStart(2, '0');
    const yyyy = my[2];
    clauses.push('received_at LIKE ?');
    params.push(`%${yyyy}-${mm}%`);
  }

  // 3. Sheet row index: "Row #3", "Row 3", "#3"
  const rowMatch = raw.match(/^(?:row\s*#?|#)(\d+)$/i);
  if (rowMatch) {
    clauses.push('sheet_row_index = ?');
    params.push(parseInt(rowMatch[1], 10));
  }

  return {
    sql: `(${clauses.join(' OR ')})`,
    params
  };
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

  // Strictly exclude posts authored by official hierarchy handles (only outside consumer complaints)
  whereClauses.push(`(
    consumer_handle IS NULL OR 
    REPLACE(LOWER(consumer_handle), '@', '') NOT IN (
      SELECT REPLACE(LOWER(handle_name), '@', '') FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != ''
    )
  )`);

  // Assigned X-Handle filter
  const assigned_handle = req.query.assigned_handle;
  if (assigned_handle && assigned_handle !== 'All') {
    if (assigned_handle === 'Unassigned') {
      whereClauses.push('(assigned_nodal_officer_name IS NULL OR assigned_nodal_officer_name = "")');
    } else {
      whereClauses.push('(assigned_nodal_officer_name = ? OR assigned_nodal_officer_name LIKE ?)');
      params.push(assigned_handle, `%${assigned_handle}%`);
    }
  }

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
    whereClauses.push('(discom_name = ? OR UPPER(discom_name) = UPPER(?))');
    params.push(discom, discom);
  }

  if (district && district !== 'All') {
    whereClauses.push('district_name = ?');
    params.push(district);
  }

  if (platform && platform !== 'All') {
    whereClauses.push('platform = ?');
    params.push(platform);
  }

  const handleFilter = req.query.monitored_account || x_handle;
  if (handleFilter && handleFilter !== 'All') {
    whereClauses.push('(monitored_account = ? OR hierarchy_handle_name = ? OR target_mentions LIKE ? OR complaint_text LIKE ?)');
    params.push(handleFilter, handleFilter, `%${handleFilter}%`, `%${handleFilter}%`);
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

  // Google Sheets Specific Filters (Reply & Picked Status)
  const picked_status = req.query.picked_status;
  if (picked_status && picked_status !== 'All') {
    const ps = picked_status.toUpperCase();
    if (ps === 'YES' || ps === 'UPPCLLKO REPLIED') {
      whereClauses.push('(uppcl_replied = 1 OR uppcllko_replied = "YES")');
    } else if (ps === 'NO' || ps === 'UPPCLLKO NOT REPLIED') {
      whereClauses.push('((uppcl_replied = 0 OR uppcl_replied IS NULL) AND (uppcllko_replied = "NO" OR uppcllko_replied IS NULL OR uppcllko_replied = "") AND (category_name != "APPRECIATION" OR category_name IS NULL))');
    } else if (ps === 'APPRECIATION') {
      whereClauses.push('(category_name = "APPRECIATION" OR complaint_type = "APPRECIATION")');
    } else if (ps === 'DISCOM REPLIED') {
      whereClauses.push('discom_replied = 1');
    } else {
      whereClauses.push('picked_status = ?');
      params.push(ps);
    }
  }

  const uppcl_replied = req.query.uppcl_replied !== undefined ? req.query.uppcl_replied : req.query.uppcllko_replied;
  if (uppcl_replied !== undefined && uppcl_replied !== 'All' && uppcl_replied !== '') {
    const upStr = uppcl_replied.toString().toUpperCase();
    if (upStr === '1' || upStr === 'TRUE' || upStr === 'YES') {
      whereClauses.push('(uppcl_replied = 1 OR uppcllko_replied = "YES")');
    } else if (upStr === '0' || upStr === 'FALSE' || upStr === 'NO') {
      whereClauses.push('((uppcl_replied = 0 OR uppcl_replied IS NULL) AND (uppcllko_replied = "NO" OR uppcllko_replied IS NULL OR uppcllko_replied = ""))');
    } else if (upStr === 'UNVERIFIED') {
      whereClauses.push('(uppcllko_replied IS NULL AND (uppcl_replied IS NULL OR uppcl_replied = 0))');
    }
  }

  const reply_within_30_min = req.query.reply_within_30_min;
  if (reply_within_30_min && reply_within_30_min !== 'All') {
    whereClauses.push('reply_within_30_min = ?');
    params.push(reply_within_30_min.toUpperCase());
  }

  const shift = req.query.shift;
  if (shift && shift !== 'All') {
    whereClauses.push('(link_shift = ? OR reply_shift = ?)');
    params.push(shift, shift);
  }

  const data_quality = req.query.data_quality;
  if (data_quality === 'issues_only') {
    whereClauses.push("data_quality_flags IS NOT NULL AND data_quality_flags != '[]'");
  }

  // Search across multiple fields (including received_at, dates, discom, category, etc.)
  const searchFilter = buildComplaintSearchFilter(search);
  if (searchFilter) {
    whereClauses.push(searchFilter.sql);
    params.push(...searchFilter.params);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count total
  const countRow = db.get(`SELECT COUNT(*) AS total FROM complaints ${whereSql};`, params);
  const total = countRow ? countRow.total : 0;

  // Sorting validation
  const orderClause = buildComplaintOrderClause(sort_by, sort_order);

  const querySql = `
    SELECT * FROM complaints
    ${whereSql}
    ORDER BY ${orderClause}
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
  if (!b.complaint_text || !b.discom_name || !b.category_name) {
    return res.status(400).json({ error: 'Complaint text, DISCOM, and Category are required.' });
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
    b.district_name || null,
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

// 3b. UPPCLLKO Replied Aggregate Stats (Must precede :id route)
app.get('/api/complaints/uppcllko-replied-stats', authMiddleware, (req, res) => {
  try {
    let whereClauses = [];
    let params = [];

    // Strictly exclude posts authored by official hierarchy handles
    whereClauses.push(`(
      consumer_handle IS NULL OR 
      REPLACE(LOWER(consumer_handle), '@', '') NOT IN (
        SELECT REPLACE(LOWER(handle_name), '@', '') FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != ''
      )
    )`);

    if (req.user.role === 'DISCOM Nodal Officer') {
      whereClauses.push('(discom_name = ? OR UPPER(discom_name) = UPPER(?))');
      params.push(req.user.discom_name, req.user.discom_name);
    } else if (req.query.discom && req.query.discom !== 'All') {
      whereClauses.push('discom_name = ?');
      params.push(req.query.discom);
    }

    if (req.query.district && req.query.district !== 'All') {
      whereClauses.push('district_name = ?');
      params.push(req.query.district);
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

    const repliedRow = db.get(`SELECT COUNT(*) as c FROM complaints ${whereSql ? whereSql + ' AND' : 'WHERE'} (uppcl_replied = 1 OR uppcllko_replied = 'YES');`, params);
    const notRepliedRow = db.get(`SELECT COUNT(*) as c FROM complaints ${whereSql ? whereSql + ' AND' : 'WHERE'} (uppcl_replied = 0 OR uppcllko_replied = 'NO') AND (category_name != 'APPRECIATION' OR category_name IS NULL);`, params);
    const unverifiedRow = db.get(`SELECT COUNT(*) as c FROM complaints ${whereSql ? whereSql + ' AND' : 'WHERE'} uppcllko_replied IS NULL AND (uppcl_replied IS NULL OR uppcl_replied = 0);`, params);

    res.json({
      replied: repliedRow ? repliedRow.c : 0,
      not_replied: notRepliedRow ? notRepliedRow.c : 0,
      unverified: unverifiedRow ? unverifiedRow.c : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3c. Bulk Set UPPCLLKO Replied (Super Admin only)
app.post('/api/complaints/bulk-set-uppcllko-replied', authMiddleware, requireRoles('Super Administrator'), (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Updates must be a non-empty array of { id, replied }' });
    }

    const nowIst = getIstTimestamp();
    let updatedCount = 0;
    const errors = [];

    for (const item of updates) {
      const id = parseInt(item.id, 10);
      const replied = String(item.replied || '').toUpperCase().trim();
      if (!id || (replied !== 'YES' && replied !== 'NO')) {
        errors.push({ id: item.id, error: 'Invalid id or replied value (must be YES or NO)' });
        continue;
      }

      db.run(`
        UPDATE complaints SET
          uppcllko_replied = ?,
          uppcllko_replied_verified_at = ?,
          uppcl_replied = ?,
          updated_at = ?
        WHERE id = ?;
      `, [replied, nowIst, replied === 'YES' ? 1 : 0, nowIst, id]);
      updatedCount++;
    }

    db.saveToDiskSync();
    logAudit(req, req.user, 'BULK_SET_UPPCLLKO_REPLIED', 'COMPLAINT', null, `Bulk updated ${updatedCount} complaints UPPCLLKO reply status`);
    res.json({ updated: updatedCount, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// 4b. Set UPPCLLKO Replied (Authorized Operators & Admins)
app.post('/api/complaints/:id/set-uppcllko-replied', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const { replied } = req.body;
  const upperReplied = String(replied || '').toUpperCase().trim();
  if (upperReplied !== 'YES' && upperReplied !== 'NO') {
    return res.status(400).json({ error: 'Replied status must be either YES or NO' });
  }

  const nowIst = getIstTimestamp();
  const uppclReplied = upperReplied === 'YES' ? 1 : 0;
  const evidence = upperReplied === 'YES' ? `Manually verified as replied by ${req.user.full_name}` : null;

  db.run(`
    UPDATE complaints SET
      uppcllko_replied = ?,
      uppcllko_replied_verified_at = ?,
      uppcl_replied = ?,
      reply_evidence = COALESCE(?, reply_evidence),
      updated_at = ?
    WHERE id = ?;
  `, [upperReplied, nowIst, uppclReplied, evidence, nowIst, id]);

  db.saveToDiskSync();
  logAudit(req, req.user, 'SET_UPPCLLKO_REPLIED', 'COMPLAINT', id, `Set UPPCLLKO Replied status to ${upperReplied} for complaint ${complaint.complaint_no}`);
  res.json({ message: 'Updated successfully', id, uppcllko_replied: upperReplied });
});

// 5. Forward Complaint to DISCOM / Nodal Officer
app.post('/api/complaints/:id/forward', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const b = req.body;
  if (!b.discom_name || !b.assigned_nodal_officer_name) {
    return res.status(400).json({ error: 'DISCOM and Assigned X-Handle are required for forwarding.' });
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

  const currentYear = new Date().getFullYear();
  const compTail = (complaint.complaint_no || '').replace('UPPCL-SMC-', '') || String(id).padStart(4, '0');
  const finalRefNo = (b.forwarding_ref_no && b.forwarding_ref_no.trim())
    ? b.forwarding_ref_no.trim()
    : `UPPCL/SMC/${currentYear}/FWD-${compTail}`;

  const finalDistrict = b.district_name && b.district_name.trim() ? b.district_name.trim() : (complaint.district_name === 'Unassigned' ? null : complaint.district_name);

  db.run(`
    UPDATE complaints SET
      discom_name = ?,
      district_name = ?,
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
    finalDistrict,
    b.assigned_nodal_officer_id || null,
    b.assigned_nodal_officer_name,
    b.assigned_nodal_officer_mobile || '',
    fDate,
    b.forwarding_channel || 'Twitter / X Escalation',
    finalRefNo,
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
    id, req.user.full_name, b.assigned_nodal_officer_name, b.discom_name, finalDistrict,
    b.forwarding_channel || 'Twitter / X Escalation', finalRefNo, b.forwarding_remarks || '', expectedDate, istTime
  ]);

  db.run(`
    INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
    VALUES (?, 'Forwarded', ?, ?, ?, ?, ?, ?, ?);
  `, [
    id, oldStatus, newStatus, req.user.id, req.user.full_name, req.user.role,
    `Forwarded to ${b.discom_name} (${b.assigned_nodal_officer_name}) via ${b.forwarding_channel || 'Twitter / X Escalation'}. Ref: ${finalRefNo}. Remarks: ${b.forwarding_remarks || 'None'}`,
    istTime
  ]);

  // If forwarded via Twitter / X Escalation, record in outgoing replies for audit & visibility
  if (b.forwarding_channel === 'Twitter / X Escalation' && b.assigned_nodal_officer_name) {
    const fwdEscalationText = `${b.assigned_nodal_officer_name} Attention: Grievance Ref ${finalRefNo} (${complaint.complaint_no}) escalated for prompt field action: ${b.forwarding_remarks || 'Kindly inspect and resolve within SLA.'}`.substring(0, 280);
    try {
      db.run(`
        INSERT INTO x_outgoing_replies (
          complaint_id, in_reply_to_post_id, reply_text, automation_mode,
          status, sent_by_user_id, sent_by_username, created_at, published_at
        ) VALUES (?, ?, ?, 'Escalation', 'SENT', ?, ?, ?, ?);
      `, [id, complaint.original_post_id || complaint.complaint_no || String(id), fwdEscalationText, req.user.id, req.user.full_name, istTime, istTime]);
    } catch (e) {
      console.warn('Could not record outgoing escalation reply:', e.message);
    }
  }

  logAudit(req, req.user, 'COMPLAINT_FORWARDED', 'COMPLAINT', id, `Forwarded complaint ${complaint.complaint_no} to ${b.discom_name} (${b.assigned_nodal_officer_name}) under Ref: ${finalRefNo}`);

  res.json({
    message: 'Complaint forwarded successfully',
    complaint_no: complaint.complaint_no,
    ref_no: finalRefNo,
    assigned_handle: b.assigned_nodal_officer_name,
    expected_response_date: expectedDate
  });
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

// 11b. Delete Frivolous Complaint (Dashboard + Google Sheet)
const handleDeleteFrivolous = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid complaint ID provided' });
    }

    const complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [id]);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found or already deleted' });
    }

    const postUrl = complaint.post_url || '';
    const m = postUrl.match(/status\/(\d+)/i);
    const tweetId = m ? m[1] : '';
    const istTime = getIstTimestamp();
    const reason = (req.body && req.body.reason) ? req.body.reason.trim() : 'Marked as Frivolous';
    const sheetRowIndex = complaint.sheet_row_index;
    const complaintNo = complaint.complaint_no || `ID-${id}`;

    // 1. Record into frivolous_complaints ledger so Google Sheets background sync never resurrects it
    try {
      db.run(`
        CREATE TABLE IF NOT EXISTS frivolous_complaints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_url TEXT UNIQUE,
          tweet_id TEXT,
          complaint_no TEXT,
          deleted_at TEXT NOT NULL,
          deleted_by_name TEXT,
          reason TEXT DEFAULT 'Marked as Frivolous'
        );
      `);
      db.run(`
        INSERT OR REPLACE INTO frivolous_complaints (post_url, tweet_id, complaint_no, deleted_at, deleted_by_name, reason)
        VALUES (?, ?, ?, ?, ?, ?);
      `, [
        postUrl,
        tweetId,
        complaintNo,
        istTime,
        req.user ? (req.user.full_name || req.user.username) : 'Staff',
        reason
      ]);

      // Persist to data/frivolous_ledger.json so it survives container restarts
      try {
        const ledgerPath = path.join(__dirname, 'data', 'frivolous_ledger.json');
        let ledger = [];
        if (fs.existsSync(ledgerPath)) {
          try { ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); } catch (e) {}
        }
        if (!Array.isArray(ledger)) ledger = [];
        const exists = ledger.some(x => (tweetId && x.tweet_id === tweetId) || (postUrl && x.post_url === postUrl) || (complaintNo && x.complaint_no === complaintNo));
        if (!exists) {
          ledger.push({
            tweet_id: tweetId,
            post_url: postUrl,
            complaint_no: complaintNo,
            deleted_at: istTime,
            deleted_by: req.user ? (req.user.full_name || req.user.username) : 'Staff',
            reason: reason
          });
          fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
        }
      } catch (fileErr) {
        console.warn('[Frivolous] File ledger write warning:', fileErr.message);
      }
    } catch (err) {
      console.warn('[Frivolous] Warning saving frivolous record:', err.message);
    }

    // 2. Cascade delete complaint and all related records from dashboard
    // Use individual safe deletes so missing optional columns or tables do not fail the request
    const safeDeleteFrom = (table, col = 'complaint_id') => {
      try {
        db.run(`DELETE FROM ${table} WHERE ${col} = ?;`, [id]);
      } catch (err) {
        console.warn(`[Frivolous] Clean-up warning for ${table}:`, err.message);
      }
    };

    safeDeleteFrom('complaint_timeline');
    safeDeleteFrom('complaint_forwarding_logs');
    safeDeleteFrom('complaint_followup_logs');
    safeDeleteFrom('complaint_escalation_logs');
    safeDeleteFrom('complaint_evidence');
    safeDeleteFrom('x_outgoing_replies');
    safeDeleteFrom('notifications');
    // Main complaint delete
    safeDeleteFrom('complaints', 'id');

    // Immediately flush SQLite changes to disk
    try {
      if (typeof db.flush === 'function') {
        db.flush();
      } else if (typeof db.saveToDiskSync === 'function') {
        db.saveToDiskSync();
      }
    } catch (e) {
      console.warn('[Frivolous] Disk flush warning:', e.message);
    }

    try {
      logAudit(req, req.user, 'COMPLAINT_DELETED_FRIVOLOUS', 'COMPLAINT', id, `Deleted frivolous complaint ${complaintNo} (${complaint.consumer_handle || ''})`);
    } catch (e) {
      console.warn('[Frivolous] Audit log error:', e.message);
    }

    // 3. Dispatch delete request to Google Sheet webhook
    let sheetDeleteStatus = null;
    const webhookUrl = process.env.GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbx3uJpVaB33ss8jGnmfArBpDXBc4o-pQ6fsD0x-FggDWRT1_pWEHNPDUWKpf5uG0B6HCQ/exec';
    if (webhookUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_frivolous',
            sheetRowIndex: sheetRowIndex,
            postUrl: postUrl,
            tweetId: tweetId,
            complaintNo: complaintNo
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (resp.ok) {
          sheetDeleteStatus = await resp.json().catch(() => ({}));
        }
      } catch (e) {
        console.warn('[Frivolous] Google Sheet webhook delete error:', e.message);
      }
    }

    const sheetMsg = (sheetDeleteStatus && sheetDeleteStatus.deleted)
      ? ` and Row ${sheetDeleteStatus.deletedRow} deleted from Google Sheet.`
      : ` and permanently removed from Google Sheet sync.`;

    return res.json({
      success: true,
      message: `Complaint ${complaintNo} deleted successfully from dashboard${sheetMsg}`,
      sheetDeleteStatus
    });
  } catch (err) {
    console.error('[Frivolous] Fatal error deleting complaint:', err);
    return res.status(500).json({
      error: `Failed to delete complaint: ${err.message}`
    });
  }
};

app.delete('/api/complaints/:id', authMiddleware, handleDeleteFrivolous);
app.post('/api/complaints/:id/delete', authMiddleware, handleDeleteFrivolous);
app.post('/api/complaints/:id/frivolous', authMiddleware, handleDeleteFrivolous);

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

  // Strictly exclude posts authored by official hierarchy handles (only outside consumer complaints)
  whereClauses.push(`(
    consumer_handle IS NULL OR 
    REPLACE(LOWER(consumer_handle), '@', '') NOT IN (
      SELECT REPLACE(LOWER(handle_name), '@', '') FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != ''
    )
  )`);

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

  const handleFilter = req.query.monitored_account || req.query.x_handle;
  if (handleFilter && handleFilter !== 'All') {
    whereClauses.push('(monitored_account = ? OR hierarchy_handle_name = ? OR target_mentions LIKE ? OR complaint_text LIKE ?)');
    params.push(handleFilter, handleFilter, `%${handleFilter}%`, `%${handleFilter}%`);
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

  // Reply-Status KPI aggregations
  const pickedRows = db.query(`
    SELECT 
      CASE 
        WHEN category_name = 'APPRECIATION' OR complaint_type = 'APPRECIATION' THEN 'APPRECIATION'
        WHEN uppcl_replied = 1 OR uppcllko_replied = 'YES' THEN 'YES'
        ELSE 'NO'
      END as effective_picked,
      COUNT(*) as c 
    FROM complaints ${whereSql} 
    GROUP BY effective_picked;
  `, params);
  let pickedYes = 0, pickedNo = 0, pickedAppreciation = 0;
  for (const r of pickedRows) {
    if (r.effective_picked === 'YES') pickedYes = r.c;
    else if (r.effective_picked === 'NO') pickedNo = r.c;
    else if (r.effective_picked === 'APPRECIATION') pickedAppreciation = r.c;
  }

  const uppclRepliedCount = pickedYes;
  const uppclNotRepliedCount = pickedNo;
  const appreciationCount = pickedAppreciation;

  const reply30Row = db.get(`SELECT COUNT(*) as c FROM complaints ${whereSql ? (whereSql + " AND reply_within_30_min = 'YES'") : "WHERE reply_within_30_min = 'YES'"}`, params);
  const replyWithin30MinCount = reply30Row ? reply30Row.c : 0;
  const replyWithin30MinRate = total > 0 ? Number(((replyWithin30MinCount / total) * 100).toFixed(1)) : 0;

  const qualityRow = db.get(`SELECT COUNT(*) as c FROM complaints ${whereSql ? (whereSql + " AND data_quality_flags IS NOT NULL AND data_quality_flags != '[]'") : "WHERE data_quality_flags IS NOT NULL AND data_quality_flags != '[]'"}`, params);
  const dataQualityIssues = qualityRow ? qualityRow.c : 0;

  const syncStatus = googleSheetsService.getSyncStatus();

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
    resolvedRate: Number(resolvedRate),
    pickedYes,
    pickedNo,
    pickedAppreciation,
    uppclRepliedCount,
    uppclNotRepliedCount,
    uppclReplied: uppclRepliedCount,
    uppclNotReplied: uppclNotRepliedCount,
    uppcllkoReplied: uppclRepliedCount,
    uppcllkoNotReplied: uppclNotRepliedCount,
    appreciationCount,
    replyWithin30MinCount,
    replyWithin30MinRate,
    dataQualityIssues,
    syncStatus
  });
});

app.get('/api/dashboard/charts', authMiddleware, (req, res) => {
  let whereClauses = [];
  let params = [];

  // Strictly exclude posts authored by official hierarchy handles (only outside consumer complaints)
  whereClauses.push(`(
    consumer_handle IS NULL OR 
    REPLACE(LOWER(consumer_handle), '@', '') NOT IN (
      SELECT REPLACE(LOWER(handle_name), '@', '') FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != ''
    )
  )`);

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

  const handleFilter = req.query.monitored_account || req.query.x_handle;
  if (handleFilter && handleFilter !== 'All') {
    whereClauses.push('(monitored_account = ? OR hierarchy_handle_name = ? OR target_mentions LIKE ? OR complaint_text LIKE ?)');
    params.push(handleFilter, handleFilter, `%${handleFilter}%`, `%${handleFilter}%`);
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

  // 6. Top 10 High Grievance: 6 Apex entities/DISCOMs (UPPCL, MVVNL, DVVNL, PVVNL, PuVVNL, KESCO) + Top 4 Districts
  const discomCountMap = {};
  discomRows.forEach(r => {
    if (r.discom_name) {
      discomCountMap[r.discom_name.toUpperCase()] = r.total;
    }
  });

  const apexEntities = [
    { label: 'UPPCL', discom_name: 'UPPCL', district_name: '', count: discomCountMap['UPPCL'] || 0, is_discom: true },
    { label: 'MVVNL', discom_name: 'MVVNL', district_name: '', count: discomCountMap['MVVNL'] || 0, is_discom: true },
    { label: 'DVVNL', discom_name: 'DVVNL', district_name: '', count: discomCountMap['DVVNL'] || 0, is_discom: true },
    { label: 'PVVNL', discom_name: 'PVVNL', district_name: '', count: discomCountMap['PVVNL'] || 0, is_discom: true },
    { label: 'PuVVNL', discom_name: 'PuVVNL', district_name: '', count: discomCountMap['PUVVNL'] || 0, is_discom: true },
    { label: 'KESCO', discom_name: 'KESCo', district_name: '', count: (discomCountMap['KESCO'] || 0), is_discom: true }
  ];

  const districtWhere = whereClauses.concat([
    "district_name IS NOT NULL",
    "TRIM(district_name) != ''",
    "LOWER(TRIM(district_name)) NOT IN ('none', 'null', 'unknown', 'n/a', 'other', 'unassigned')"
  ]);
  const districtWhereSql = `WHERE ${districtWhere.join(' AND ')}`;

  const topDistrictRows = db.query(`
    SELECT district_name, discom_name, COUNT(*) as count
    FROM complaints
    ${districtWhereSql}
    GROUP BY district_name, discom_name
    ORDER BY count DESC
    LIMIT 4;
  `, params);

  const topDistrictsFormatted = topDistrictRows.map(d => ({
    label: `${d.district_name} (${d.discom_name || ''})`.replace(' ()', ''),
    discom_name: d.discom_name || '',
    district_name: d.district_name,
    count: d.count,
    is_discom: false
  }));

  const districtRows = apexEntities.concat(topDistrictsFormatted);

  // 7. Operational Status Distribution
  const statusRows = db.query(`
    SELECT current_status as status, COUNT(*) as count
    FROM complaints
    ${whereSql}
    GROUP BY current_status
    ORDER BY count DESC;
  `, params);

  // 8. Shift Distribution (Link Shift & Reply Shift)
  const linkShiftRows = db.query(`
    SELECT COALESCE(NULLIF(link_shift, ''), 'Unassigned') as shift, COUNT(*) as count
    FROM complaints
    ${whereSql}
    GROUP BY shift
    ORDER BY count DESC;
  `, params);

  // 9. UPPCLLKO Reply Status Distribution (UPPCLLKO Replied, UPPCLLKO Not Replied, DISCOM Replied, Appreciation)
  const replyRows = db.query(`
    SELECT 
      CASE 
        WHEN category_name = 'APPRECIATION' OR complaint_type = 'APPRECIATION' THEN 'Appreciation'
        WHEN uppcl_replied = 1 THEN 'UPPCLLKO Replied'
        WHEN discom_replied = 1 THEN 'DISCOM Replied'
        ELSE 'UPPCLLKO Not Replied'
      END as status,
      COUNT(*) as count
    FROM complaints
    ${whereSql}
    GROUP BY status
    ORDER BY count DESC;
  `, params);

  res.json({
    trend: trendRows,
    platforms: platformRows,
    handles: handleRows,
    discoms: discomRows,
    categories: categoryRows,
    districts: districtRows,
    statuses: statusRows,
    shifts: linkShiftRows,
    replyStatuses: replyRows,
    pickedStatuses: replyRows
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
  if (req.query.type === 'dashboard_table') {
    return handleDashboardTableExcelExport(req, res);
  }

  const {
    type = 'daily_ops',
    format = 'csv',
    from_date,
    to_date,
    discom,
    district,
    status,
    search,
    category,
    priority,
    platform,
    assigned_handle,
    overdue,
    sort_by,
    sort_order
  } = req.query;

  let whereClauses = [];
  let params = [];

  // Strictly exclude posts authored by official hierarchy handles (only outside consumer complaints)
  whereClauses.push(`(
    consumer_handle IS NULL OR 
    REPLACE(LOWER(consumer_handle), '@', '') NOT IN (
      SELECT REPLACE(LOWER(handle_name), '@', '') FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != ''
    )
  )`);

  const searchFilter = buildComplaintSearchFilter(search);
  if (searchFilter) {
    whereClauses.push(searchFilter.sql);
    params.push(...searchFilter.params);
  }

  if (req.user.role === 'DISCOM Nodal Officer') {
    whereClauses.push('(discom_name = ? OR discom_name = ?)');
    params.push(req.user.discom_name, req.user.discom_name.toUpperCase());
  } else if (discom && discom !== 'All') {
    whereClauses.push('(discom_name = ? OR UPPER(discom_name) = UPPER(?))');
    params.push(discom, discom);
  }

  if (district && district !== 'All') {
    whereClauses.push('district_name = ?');
    params.push(district);
  }

  if (category && category !== 'All') {
    whereClauses.push('category_name = ?');
    params.push(category);
  }

  if (priority && priority !== 'All') {
    whereClauses.push('priority = ?');
    params.push(priority);
  }

  if (platform && platform !== 'All') {
    whereClauses.push('platform = ?');
    params.push(platform);
  }

  if (assigned_handle && assigned_handle !== 'All') {
    if (assigned_handle === 'Unassigned') {
      whereClauses.push('(assigned_nodal_officer_name IS NULL OR assigned_nodal_officer_name = "")');
    } else {
      whereClauses.push('(assigned_nodal_officer_name = ? OR assigned_nodal_officer_name LIKE ?)');
      params.push(assigned_handle, `%${assigned_handle}%`);
    }
  }

  if (overdue === '1') {
    whereClauses.push('is_overdue = 1');
  }

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
    } else if (status === 'verification_pending') {
      whereClauses.push("current_status = 'Resolved — Verification Pending'");
    } else if (status === 'closed') {
      whereClauses.push("current_status = 'Closed'");
    } else {
      whereClauses.push('current_status = ?');
      params.push(status);
    }
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
        assigned_nodal_officer_name as 'Assigned X-Handle',
        forwarding_ref_no as 'Dispatch Reference No',
        forwarding_date as 'Forwarded Date',
        forwarding_channel as 'Forwarding Channel',
        forwarding_remarks as 'Forwarding Instructions',
        expected_response_date as 'Expected SLA Date',
        discom_action_taken as 'Action Taken',
        closure_date as 'Closure Date',
        closure_satisfaction_status as 'Satisfaction',
        complaint_text as 'Grievance Text',
        post_url as 'Original Post URL'
      FROM complaints
      ${whereSql}
      ORDER BY ${buildComplaintOrderClause(sort_by, sort_order)};
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
// DASHBOARD TABLE EXCEL EXPORT (.XLSX)
// -------------------------------------------------------------

function sanitizeForExcel(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Protect against spreadsheet formula injection (=, +, @, and leading - if not just a dash/number)
  if (/^[=\+@]/.test(str)) {
    return "'" + str;
  }
  if (str.startsWith('-') && str !== '-' && str !== '--' && !/^-\d+$/.test(str)) {
    return "'" + str;
  }
  return str;
}

function handleDashboardTableExcelExport(req, res) {
  const {
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
    picked_status,
    uppcl_replied,
    reply_within_30_min,
    shift,
    data_quality,
    assigned_handle,
    sort_by = 'received_at',
    sort_order = 'DESC'
  } = req.query;

  let whereClauses = [];
  let params = [];

  // Strictly exclude posts authored by official hierarchy handles (only outside consumer complaints)
  whereClauses.push(`(
    consumer_handle IS NULL OR 
    REPLACE(LOWER(consumer_handle), '@', '') NOT IN (
      SELECT REPLACE(LOWER(handle_name), '@', '') FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != ''
    )
  )`);

  // Assigned X-Handle filter
  if (assigned_handle && assigned_handle !== 'All') {
    if (assigned_handle === 'Unassigned') {
      whereClauses.push('(assigned_nodal_officer_name IS NULL OR assigned_nodal_officer_name = "")');
    } else {
      whereClauses.push('(assigned_nodal_officer_name = ? OR assigned_nodal_officer_name LIKE ?)');
      params.push(assigned_handle, `%${assigned_handle}%`);
    }
  }

  // Scoping: DISCOM Nodal Officer can only see complaints for their assigned DISCOM
  if (req.user && req.user.role === 'DISCOM Nodal Officer') {
    whereClauses.push('(discom_name = ? OR discom_name = ?)');
    params.push(req.user.discom_name, req.user.discom_name.toUpperCase());
  } else if (req.user && (req.user.role === 'Complaint Handler' || req.user.role === 'Social Media Cell Operator') && req.user.assigned_districts && req.user.assigned_districts.trim() && req.user.assigned_districts !== 'All') {
    const districts = req.user.assigned_districts.split(',').map(d => d.trim()).filter(Boolean);
    if (districts.length > 0) {
      const placeholders = districts.map(() => '?').join(',');
      whereClauses.push(`district_name IN (${placeholders})`);
      params.push(...districts);
    }
  } else if (discom && discom !== 'All') {
    whereClauses.push('(discom_name = ? OR UPPER(discom_name) = UPPER(?))');
    params.push(discom, discom);
  }

  if (district && district !== 'All') {
    whereClauses.push('district_name = ?');
    params.push(district);
  }

  if (platform && platform !== 'All') {
    whereClauses.push('platform = ?');
    params.push(platform);
  }

  const handleFilter = req.query.monitored_account || x_handle;
  if (handleFilter && handleFilter !== 'All') {
    whereClauses.push('(monitored_account = ? OR hierarchy_handle_name = ? OR target_mentions LIKE ? OR complaint_text LIKE ?)');
    params.push(handleFilter, handleFilter, `%${handleFilter}%`, `%${handleFilter}%`);
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
      params.push(req.user ? req.user.id : 0);
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

  // Google Sheets Specific Filters (Picked & Reply Status)
  if (picked_status && picked_status !== 'All') {
    const ps = picked_status.toUpperCase();
    if (ps === 'YES' || ps === 'UPPCLLKO REPLIED') {
      whereClauses.push('(uppcl_replied = 1 OR uppcllko_replied = "YES")');
    } else if (ps === 'NO' || ps === 'UPPCLLKO NOT REPLIED') {
      whereClauses.push('((uppcl_replied = 0 OR uppcl_replied IS NULL) AND (uppcllko_replied = "NO" OR uppcllko_replied IS NULL OR uppcllko_replied = "") AND (category_name != "APPRECIATION" OR category_name IS NULL))');
    } else if (ps === 'APPRECIATION') {
      whereClauses.push('(category_name = "APPRECIATION" OR complaint_type = "APPRECIATION")');
    } else if (ps === 'DISCOM REPLIED') {
      whereClauses.push('discom_replied = 1');
    } else {
      whereClauses.push('picked_status = ?');
      params.push(ps);
    }
  }

  if (uppcl_replied !== undefined && uppcl_replied !== 'All' && uppcl_replied !== '') {
    if (uppcl_replied === '1' || uppcl_replied === 'true' || uppcl_replied.toString().toUpperCase() === 'YES') {
      whereClauses.push('(uppcl_replied = 1 OR uppcllko_replied = "YES")');
    } else if (uppcl_replied === '0' || uppcl_replied === 'false' || uppcl_replied.toString().toUpperCase() === 'NO') {
      whereClauses.push('((uppcl_replied = 0 OR uppcl_replied IS NULL) AND (uppcllko_replied = "NO" OR uppcllko_replied IS NULL OR uppcllko_replied = ""))');
    }
  }

  if (reply_within_30_min && reply_within_30_min !== 'All') {
    whereClauses.push('reply_within_30_min = ?');
    params.push(reply_within_30_min.toUpperCase());
  }

  if (shift && shift !== 'All') {
    whereClauses.push('(link_shift = ? OR reply_shift = ?)');
    params.push(shift, shift);
  }

  if (data_quality === 'issues_only') {
    whereClauses.push("data_quality_flags IS NOT NULL AND data_quality_flags != '[]'");
  }

  // Search across multiple fields (including received_at, dates, discom, category, etc.)
  const searchFilter = buildComplaintSearchFilter(search);
  if (searchFilter) {
    whereClauses.push(searchFilter.sql);
    params.push(...searchFilter.params);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const orderClause = buildComplaintOrderClause(sort_by, sort_order);

  // Fetch all matching records across all pages (no LIMIT / OFFSET)
  const rows = db.query(`
    SELECT * FROM complaints
    ${whereSql}
    ORDER BY ${orderClause};
  `, params);

  if (!rows || rows.length === 0) {
    return res.status(404).json({ error: 'No matching complaints found to export for the current filters.' });
  }

  // Format data for Excel export matching dashboard table columns & status badges
  const exportRows = rows.map(c => {
    const isDiscomTagged = c.discom_name && ['PVVNL', 'PUVVNL', 'MVVNL', 'DVVNL', 'KESCO'].includes(c.discom_name.toUpperCase());
    const isAppreciation = c.picked_status === 'APPRECIATION' || c.current_status === 'Appreciation' || c.category_name === 'APPRECIATION';

    // Authoritative UPPCLLKO Reply Rule (Picked status completely retired)
    const isUppclReplied = !isAppreciation && Boolean(
      c.uppcl_replied === 1 ||
      c.has_historical_reply === 1 ||
      Boolean(c.published_reply_id)
    );
    const isDiscomReplied = !isAppreciation && !isUppclReplied && Boolean(
      c.discom_replied === 1 ||
      c.current_status === 'DISCOM Follow Up' ||
      Boolean(c.reply_within_60_min && c.reply_within_60_min !== 'NO')
    );

    let replyStatusText = 'UPPCLLKO Not Replied';
    if (isAppreciation) {
      replyStatusText = 'Appreciation (Gratitude Post)';
    } else if (isUppclReplied) {
      replyStatusText = 'UPPCLLKO Replied';
    } else if (isDiscomReplied) {
      replyStatusText = 'DISCOM Replied (Registered Action)';
    }

    let reply30Text = '-';
    if (c.reply_within_30_min === 'YES') {
      reply30Text = 'YES (< 30 Mins)';
    } else if (c.reply_within_30_min === 'NO') {
      const receivedMs = c.received_at ? new Date(c.received_at).getTime() : 0;
      const elapsedMins = receivedMs ? (Date.now() - receivedMs) / 60000 : 999;
      if (elapsedMins < 30) {
        const minsLeft = Math.max(0, Math.ceil(30 - elapsedMins));
        reply30Text = `In Window (< ${minsLeft}m left)`;
      } else {
        reply30Text = 'NO (>= 30 Mins)';
      }
    }

    let displayStatus = c.current_status || 'New';
    let statusText = displayStatus;
    if (displayStatus === 'Assigned to DISCOM') {
      if (isUppclReplied && isDiscomTagged) {
        statusText = `Assigned to DISCOM (Tagged @${c.discom_name}HQ)`;
      } else {
        statusText = 'New (Awaiting UPPCLLKO Reply)';
      }
    } else if (displayStatus === 'DISCOM Follow Up') {
      statusText = 'DISCOM Follow Up (DISCOM Replied)';
    } else if (displayStatus === 'Appreciation') {
      statusText = 'Appreciation (Gratitude)';
    } else if (displayStatus === 'New') {
      statusText = !isUppclReplied ? 'New (Awaiting UPPCLLKO Reply)' : 'New (Pending Assignment)';
    }

    let postHref = (c.post_url && c.post_url.startsWith('http'))
      ? c.post_url
      : (/^\d{15,25}$/.test(String(c.post_url || '').trim()) ? `https://x.com/i/status/${c.post_url.trim()}` : (c.post_url || ''));
    if (!postHref && (c.complaint_no === 'UPPCL-SMC-202610-0120' || c.sheet_row_index === 122)) {
      postHref = 'https://x.com/Hindustan0112/status/2112123946334335270';
    }

    const receivedIst = c.received_at ? (c.received_at.length >= 16 ? `${c.received_at.substring(0, 16)} IST` : c.received_at) : '';
    const districtDiv = c.district_name || (c.discom_name ? `${c.discom_name} HQ` : '');

    return {
      'Complaint #': sanitizeForExcel(c.complaint_no || ''),
      'Sheet Row #': c.sheet_row_index ? sanitizeForExcel(String(c.sheet_row_index)) : '',
      'Received At (IST)': sanitizeForExcel(receivedIst),
      'Consumer Name': sanitizeForExcel(c.consumer_name || 'Consumer'),
      'Consumer Handle': sanitizeForExcel(c.consumer_handle || ''),
      'Grievance Category': sanitizeForExcel(c.category_name || ''),
      'Grievance Summary': sanitizeForExcel(c.complaint_text || ''),
      'DISCOM': sanitizeForExcel(c.discom_name || ''),
      'District / Division': sanitizeForExcel(districtDiv),
      'UPPCLLKO Reply Status': sanitizeForExcel(replyStatusText),
      '30-Min First Reply': sanitizeForExcel(reply30Text),
      'Status': sanitizeForExcel(statusText),
      'Original Post URL': sanitizeForExcel(postHref)
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  ws['!cols'] = [
    { wch: 28 }, // Complaint #
    { wch: 14 }, // Sheet Row #
    { wch: 22 }, // Received At (IST)
    { wch: 22 }, // Consumer Name
    { wch: 20 }, // Consumer Handle
    { wch: 24 }, // Grievance Category
    { wch: 50 }, // Grievance Summary
    { wch: 12 }, // DISCOM
    { wch: 22 }, // District / Division
    { wch: 30 }, // UPPCLLKO Reply Status
    { wch: 22 }, // 30-Min First Reply
    { wch: 34 }, // Status
    { wch: 45 }  // Original Post URL
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Complaints');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const istNow = getIstTimestamp(); // 'YYYY-MM-DD HH:MM:SS'
  const timeFormatted = istNow.substring(0, 10) + '_' + istNow.substring(11, 16).replace(':', '-');
  const fileName = `complaints_export_${timeFormatted}.xlsx`;

  logAudit(req, req.user, 'REPORT_EXPORTED', 'DASHBOARD_TABLE', 'excel', `Exported ${exportRows.length} dashboard table records to Excel`);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  return res.send(buf);
}

app.get('/api/dashboard/export-excel', authMiddleware, handleDashboardTableExcelExport);

// -------------------------------------------------------------
// GOOGLE SHEETS LIVE SYNCHRONIZATION & DEEP ANALYTICS
// -------------------------------------------------------------

app.get('/api/sync/status', authMiddleware, (req, res) => {
  try {
    const status = googleSheetsService.getSyncStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync/refresh', authMiddleware, async (req, res) => {
  try {
    const result = await googleSheetsService.syncGoogleSheets(true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync/upload-sheet', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select a CSV or Excel file to upload.' });
    }
    const result = googleSheetsService.syncFromFile(req.file.path);
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.json(result);
  } catch (err) {
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to process sheet file: ' + err.message });
  }
});

app.get('/api/reports/analytics', authMiddleware, (req, res) => {
  try {
    const { from_date, to_date, discom } = req.query;
    let whereClauses = [];
    let params = [];

    // Strictly exclude posts authored by official hierarchy handles
    whereClauses.push(`(
      consumer_handle IS NULL OR 
      REPLACE(LOWER(consumer_handle), '@', '') NOT IN (
        SELECT REPLACE(LOWER(handle_name), '@', '') FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != ''
      )
    )`);

    if (req.user.role === 'DISCOM Nodal Officer') {
      whereClauses.push('(discom_name = ? OR discom_name = ?)');
      params.push(req.user.discom_name, req.user.discom_name.toUpperCase());
    } else if (discom && discom !== 'All') {
      whereClauses.push('discom_name = ?');
      params.push(discom);
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

    // A. Time-based Analysis (Daily Trend, Weekday, Peak Hours)
    const dailyRows = db.query(`
      SELECT substr(received_at, 1, 10) as day, COUNT(*) as count
      FROM complaints ${whereSql}
      GROUP BY day ORDER BY day ASC;
    `, params);

    const weekdayMap = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' };
    const weekdayRows = db.query(`
      SELECT strftime('%w', received_at) as wd, COUNT(*) as count
      FROM complaints ${whereSql}
      GROUP BY wd ORDER BY count DESC;
    `, params).map(r => ({ day: weekdayMap[r.wd] || r.wd, count: r.count }));

    const hourRows = db.query(`
      SELECT substr(received_at, 12, 2) as hr, COUNT(*) as count
      FROM complaints
      ${whereSql ? (whereSql + " AND substr(received_at, 12, 2) != ''") : "WHERE substr(received_at, 12, 2) != ''"}
      GROUP BY hr ORDER BY hr ASC;
    `, params);

    // B. Source-Handle Analysis
    const totalComplaints = db.get(`SELECT COUNT(*) as cnt FROM complaints ${whereSql};`, params)?.cnt || 1;
    const handleRows = db.query(`
      SELECT COALESCE(monitored_account, '@UPPCLLKO') as handle, COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / ${totalComplaints}), 1) as share_pct
      FROM complaints ${whereSql}
      GROUP BY handle ORDER BY count DESC;
    `, params);

    // C. DISCOM Redressal Performance Analysis
    const discomPerformance = db.query(`
      SELECT discom_name,
        COUNT(*) as total,
        SUM(CASE WHEN current_status = 'Closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN current_status IN ('Forwarded', 'Assigned to DISCOM', 'DISCOM Follow Up', 'Escalated') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN current_status = 'Resolved — Verification Pending' THEN 1 ELSE 0 END) as verification_pending,
        SUM(CASE WHEN uppcl_replied = 1 THEN 1 ELSE 0 END) as uppcl_replied,
        SUM(CASE WHEN picked_status = 'APPRECIATION' THEN 1 ELSE 0 END) as appreciation,
        SUM(CASE WHEN uppcl_replied = 1 THEN 1 ELSE 0 END) as uppcl_replied,
        ROUND((SUM(CASE WHEN current_status = 'Closed' THEN 1 ELSE 0 END) * 100.0 / MAX(COUNT(*), 1)), 1) as resolution_pct
      FROM complaints ${whereSql}
      GROUP BY discom_name ORDER BY total DESC;
    `, params);

    // D. Shift & Workload Analysis
    const linkShiftRows = db.query(`
      SELECT COALESCE(NULLIF(link_shift, ''), 'Unassigned') as shift, COUNT(*) as count
      FROM complaints ${whereSql}
      GROUP BY shift ORDER BY count DESC;
    `, params);

    const replyShiftRows = db.query(`
      SELECT COALESCE(NULLIF(reply_shift, ''), 'Unassigned') as shift, COUNT(*) as count
      FROM complaints ${whereSql}
      GROUP BY shift ORDER BY count DESC;
    `, params);

    // E. Response & SLA Compliance
    const complianceRow = db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN reply_within_30_min = 'YES' THEN 1 ELSE 0 END) as reply_30_yes,
        SUM(CASE WHEN reply_within_30_min = 'NO' THEN 1 ELSE 0 END) as reply_30_no,
        SUM(CASE WHEN reply_within_60_min = 'YES' THEN 1 ELSE 0 END) as reply_60_yes,
        SUM(CASE WHEN reply_within_60_min = 'NO' THEN 1 ELSE 0 END) as reply_60_no
      FROM complaints ${whereSql};
    `, params);

    const reply30Pct = complianceRow && complianceRow.total > 0
      ? Number(((complianceRow.reply_30_yes / complianceRow.total) * 100).toFixed(1))
      : 0;

    // F. Data Quality Issues Audit
    const qualityRows = db.query(`
      SELECT id, complaint_no, received_at, consumer_handle, post_url, discom_name, district_name, sheet_row_index, data_quality_flags
      FROM complaints
      ${whereSql ? (whereSql + " AND data_quality_flags IS NOT NULL AND data_quality_flags != '[]'") : "WHERE data_quality_flags IS NOT NULL AND data_quality_flags != '[]'"}
      ORDER BY sheet_row_index DESC
      LIMIT 100;
    `, params);

    const totalQualityIssues = db.get(`
      SELECT COUNT(*) as cnt
      FROM complaints
      ${whereSql ? (whereSql + " AND data_quality_flags IS NOT NULL AND data_quality_flags != '[]'") : "WHERE data_quality_flags IS NOT NULL AND data_quality_flags != '[]'"}
    `, params)?.cnt || 0;

    const syncStatus = googleSheetsService.getSyncStatus();

    res.json({
      timeAnalysis: {
        daily: dailyRows,
        weekdays: weekdayRows,
        hours: hourRows
      },
      sourceHandles: handleRows,
      discomPerformance: discomPerformance,
      shiftAnalysis: {
        linkShift: linkShiftRows,
        replyShift: replyShiftRows
      },
      responseCompliance: {
        total: complianceRow ? complianceRow.total : 0,
        reply30Yes: complianceRow ? complianceRow.reply_30_yes : 0,
        reply30No: complianceRow ? complianceRow.reply_30_no : 0,
        reply30Pct: reply30Pct,
        reply60Yes: complianceRow ? complianceRow.reply_60_yes : 0,
        reply60No: complianceRow ? complianceRow.reply_60_no : 0
      },
      dataQuality: {
        totalIssues: totalQualityIssues,
        records: qualityRows.map(r => {
          let flags = [];
          try { flags = JSON.parse(r.data_quality_flags || '[]'); } catch (e) {}
          return { ...r, flags };
        })
      },
      syncStatus: syncStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate analytics: ' + err.message });
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
    db.run("UPDATE x_hierarchy SET is_monitored = 1, updated_at = ? WHERE sr_no IN ('1', '3', '4', '5', '7') OR CAST(sr_no AS INTEGER) BETWEEN 86 AND 90;", [istTime]);
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
// FORWARDING INSTRUCTION TEMPLATES (DISPATCH & FIELD ACTION)
// -------------------------------------------------------------

app.get('/api/master/forwarding-templates', authMiddleware, (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM forwarding_templates WHERE is_active = 1';
  const params = [];
  if (category && category !== 'All') {
    sql += ' AND category_name = ?';
    params.push(category);
  }
  sql += ' ORDER BY CASE WHEN language = \'Hindi\' THEN 0 ELSE 1 END, id ASC;';
  const templates = db.query(sql, params);
  res.json({ data: templates });
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
  if (!['Administrator', 'Super Administrator', 'Admin', 'Supervisor / Management'].includes(req.user.role)) {
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
// GOOGLE SHEETS MONTHLY ROTATION & ARCHIVING ENDPOINTS
// -------------------------------------------------------------

// 1. Get current active sheet status, rotation ledger, and schedule
app.get('/api/admin/sheet-rotation/status', authMiddleware, requireRoles('Super Administrator', 'Supervisor / Management'), (req, res) => {
  try {
    const activeConfig = sheetRotationService.getActiveSpreadsheetConfig();
    const ledger = sheetRotationService.getRotationLedger();
    const currentIst = sheetRotationService.getCurrentIstMonthInfo();
    const prevIst = sheetRotationService.getPreviousIstMonthInfo();

    res.json({
      status: 'ok',
      activeConfig,
      currentMonth: currentIst,
      previousMonth: prevIst,
      timezone: sheetRotationService.SYSTEM_TIMEZONE,
      baselineSpreadsheetId: sheetRotationService.BASELINE_SPREADSHEET_ID,
      baselineWorksheetGid: sheetRotationService.BASELINE_WORKSHEET_GID,
      isBaselineActive: sheetRotationService.isBaselineActive(),
      scheduler: sheetRotationService.getSchedulerStatus(),
      history: ledger
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Trigger / Test monthly rollover
app.post('/api/admin/sheet-rotation/trigger', authMiddleware, requireRoles('Super Administrator'), async (req, res) => {
  try {
    const { force = false, target_month = null } = req.body;
    const result = await sheetRotationService.checkAndPerformMonthlyRollover({
      force: force === true || force === 'true',
      targetMonth: target_month,
      user: req.user
    });

    logAudit(
      req,
      req.user,
      'SHEET_ROTATION_TRIGGER',
      'GOOGLE_SPREADSHEET',
      0,
      `Triggered monthly rollover: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.activeSpreadsheetId || result.error})`
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Rollover execution failed: ' + err.message });
  }
});

// 3. Rollback to baseline stable version or previous target sheet
app.post('/api/admin/sheet-rotation/rollback', authMiddleware, requireRoles('Super Administrator'), async (req, res) => {
  try {
    const { target_spreadsheet_id, target_worksheet_gid, target_month } = req.body;
    const result = await sheetRotationService.rollbackConfiguration({
      targetSpreadsheetId: target_spreadsheet_id || sheetRotationService.BASELINE_SPREADSHEET_ID,
      targetWorksheetGid: target_worksheet_gid || sheetRotationService.BASELINE_WORKSHEET_GID,
      targetMonth: target_month || '2026_10',
      user: req.user
    });

    logAudit(
      req,
      req.user,
      'SHEET_ROTATION_ROLLBACK',
      'GOOGLE_SPREADSHEET',
      0,
      `Rolled back spreadsheet configuration to ${result.restoredSpreadsheetId}`
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Rollback execution failed: ' + err.message });
  }
});

// 4. Verify two-way synchronization on active sheet
app.post('/api/admin/sheet-rotation/verify', authMiddleware, requireRoles('Super Administrator'), async (req, res) => {
  try {
    const activeConfig = sheetRotationService.getActiveSpreadsheetConfig();
    const districtInfo = await workingSheetService.getDistrictList(true);
    const syncStatus = googleSheetsService.getSyncStatus();

    res.json({
      status: 'ok',
      activeConfig,
      verifiedAt: new Date().toISOString(),
      districtsCount: districtInfo.count,
      syncStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});

// -------------------------------------------------------------
// WORKING SHEET MANAGEMENT ENDPOINTS (11 TARGET COLUMNS)
// -------------------------------------------------------------

// 1. Fetch Working Sheet Data (Strictly 11 Columns, Search, Filter, Sort, Paginate)
app.get('/api/working-sheet/data', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      sort_by = 'DATE',
      sort_order = 'DESC',
      picked_status = 'All',
      head = 'All',
      district = 'All',
      complaint_type = 'All',
      refresh = 'false'
    } = req.query;

    const forceRefresh = refresh === 'true' || refresh === true || refresh === '1';
    const result = await workingSheetService.getWorkingSheetData({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
      search,
      sortBy: sort_by,
      sortOrder: sort_order,
      pickedStatus: picked_status,
      head,
      district,
      complaintType: complaint_type,
      forceRefresh
    });

    res.json(result);
  } catch (err) {
    console.error('[Server] Working Sheet fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch Working Sheet data' });
  }
});

// 2. Dynamic District List (Sourced from Discom_District_List worksheet)
app.get('/api/working-sheet/districts', authMiddleware, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const districts = await workingSheetService.getDistrictList(forceRefresh);
    res.json(districts);
  } catch (err) {
    console.error('[Server] Working Sheet district fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch dynamic district list from Google Sheets' });
  }
});

// 3. Single-Cell Update Directly to Google Sheets with Verification
app.post('/api/working-sheet/update-cell', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management', 'operator', 'Operator'), async (req, res) => {
  try {
    const { tweet_id, post_url, sheet_row_index, column_name, new_value } = req.body;

    if (!column_name) {
      return res.status(400).json({ error: 'Column name is required' });
    }

    const result = await workingSheetService.updateWorkingSheetCell({
      tweetId: tweet_id,
      postUrl: post_url,
      sheetRowIndex: sheet_row_index,
      columnName: column_name,
      newValue: new_value,
      user: req.user
    });

    logAudit(
      req,
      req.user,
      'WORKING_SHEET_UPDATE',
      'GOOGLE_SHEETS',
      sheet_row_index || 0,
      `Updated ${column_name} to "${new_value}" on Google Sheet Row ${result.row}`
    );

    res.json(result);
  } catch (err) {
    console.error('[Server] Working Sheet cell update error:', err);
    res.status(400).json({ error: err.message || 'Failed to update cell in Google Sheet' });
  }
});

// 4. Permanent Row Deletion Directly from Google Sheet
app.post('/api/working-sheet/delete-row', authMiddleware, requireRoles('Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management', 'operator', 'Operator'), async (req, res) => {
  try {
    const { tweet_id, post_url, sheet_row_index } = req.body;

    if (!tweet_id && !post_url && (!sheet_row_index || sheet_row_index < 3)) {
      return res.status(400).json({ error: 'Tweet ID or Post URL is required to safely identify the complaint for deletion.' });
    }

    const result = await workingSheetService.deleteWorkingSheetRow({
      tweetId: tweet_id,
      postUrl: post_url,
      sheetRowIndex: sheet_row_index,
      user: req.user
    });

    logAudit(
      req,
      req.user,
      'WORKING_SHEET_ROW_DELETE',
      'GOOGLE_SHEETS',
      result.deletedRow || sheet_row_index || 0,
      `Permanently deleted complaint ${tweet_id || post_url} from Google Sheet Row ${result.deletedRow || sheet_row_index}`
    );

    res.json(result);
  } catch (err) {
    console.error('[Server] Working Sheet row delete error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete complaint from Google Sheet' });
  }
});

// 5. Download WORKING SHEET as Excel (.xlsx)
app.get('/api/working-sheet/export-excel', authMiddleware, async (req, res) => {
  try {
    const {
      search = '',
      sort_by = 'DATE',
      sort_order = 'DESC',
      picked_status = 'All',
      head = 'All',
      district = 'All',
      complaint_type = 'All'
    } = req.query;

    const result = await workingSheetService.getWorkingSheetData({
      page: 1,
      limit: 100000, // Export all matching rows across all pages
      search,
      sortBy: sort_by,
      sortOrder: sort_order,
      pickedStatus: picked_status,
      head,
      district,
      complaintType: complaint_type,
      forceRefresh: false
    });

    const rows = result.rows || [];
    const exportRows = rows.map(r => ({
      'DATE': sanitizeForExcel(r['DATE'] || ''),
      'C F': sanitizeForExcel(r['C F'] || ''),
      'LINK URL': sanitizeForExcel(r['LINK URL'] || r.link_url || ''),
      'Twitter Id': sanitizeForExcel(r['Twitter Id'] || ''),
      'Picked Status': sanitizeForExcel(r['Picked Status'] || ''),
      'Head': sanitizeForExcel(r['Head'] || ''),
      'Untagged Complaint': sanitizeForExcel(r['Untagged Complaint'] || ''),
      'UPPCLLKO Replied (YES/NO)': sanitizeForExcel(r['UPPCLLKO Replied (YES/NO)'] || ''),
      'Complaint Type': sanitizeForExcel(r['Complaint Type'] || ''),
      'District': sanitizeForExcel(r['District'] || ''),
      'Status': sanitizeForExcel(r['Status'] || '')
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows, { header: workingSheetService.WORKING_SHEET_COLUMNS });
    ws['!cols'] = [
      { wch: 14 }, // DATE
      { wch: 8 },  // C F
      { wch: 48 }, // LINK URL
      { wch: 20 }, // Twitter Id
      { wch: 16 }, // Picked Status
      { wch: 12 }, // Head
      { wch: 20 }, // Untagged Complaint
      { wch: 28 }, // UPPCLLKO Replied (YES/NO)
      { wch: 28 }, // Complaint Type
      { wch: 20 }, // District
      { wch: 24 }  // Status
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WORKING SHEET');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const todayDate = new Date().toISOString().substring(0, 10);
    const fileName = `UPPCL_Working_Sheet_${todayDate}.xlsx`;

    logAudit(
      req,
      req.user,
      'REPORT_EXPORTED',
      'WORKING_SHEET',
      'excel',
      `Exported ${exportRows.length} working sheet records to Excel (${fileName})`
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buf);
  } catch (err) {
    console.error('[Server] Working Sheet excel export error:', err);
    res.status(500).json({ error: err.message || 'Failed to export Working Sheet to Excel' });
  }
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
    },
    google_sheets: {
      active_spreadsheet_id: sheetRotationService.getActiveSpreadsheetId(),
      active_worksheet_gid: sheetRotationService.getActiveWorksheetGid(),
      active_month: sheetRotationService.getActiveMonth(),
      is_baseline: sheetRotationService.isBaselineActive(),
      sync_status: googleSheetsService.getSyncStatus()
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

// Legacy redirect for any stale client navigating to /2
app.get('/2', (req, res) => {
  res.redirect('https://x.com/Hindustan0112/status/2112123946334335270');
});

// Universal post redirect by complaint number or internal ID
app.get(['/post/:id', '/p/:id'], (req, res) => {
  const param = String(req.params.id || '').trim();
  let complaint = null;
  if (/^\d+$/.test(param)) {
    complaint = db.get('SELECT * FROM complaints WHERE id = ?;', [parseInt(param, 10)]);
  }
  if (!complaint) {
    complaint = db.get('SELECT * FROM complaints WHERE complaint_no = ? OR complaint_no LIKE ?;', [param, `%${param}`]);
  }
  if (complaint && complaint.post_url && complaint.post_url.startsWith('http')) {
    return res.redirect(complaint.post_url);
  }
  return res.redirect('/');
});

// Single Page Application Fallback
app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (process.env.NO_SERVER_AUTOSTART !== 'true') {
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

    // Ensure all standard users have smaller passwords in the database (e.g. admin123)
    try {
      const salt = bcrypt.genSaltSync(10);
      const updates = [
        { username: 'admin', pass: 'admin123' },
        { username: 'operator', pass: 'operator123' },
        { username: 'operator2', pass: 'operator123' },
        { username: 'supervisor', pass: 'supervisor123' },
        { username: 'reviewer', pass: 'reviewer123' },
        { username: 'nodal_puvvnl', pass: 'nodal123' },
        { username: 'nodal_mvvnl', pass: 'nodal123' },
        { username: 'nodal_dvvnl', pass: 'nodal123' },
        { username: 'nodal_pvvnl', pass: 'nodal123' },
        { username: 'nodal_kesco', pass: 'nodal123' }
      ];
      for (const u of updates) {
        const hash = bcrypt.hashSync(u.pass, salt);
        db.run("UPDATE users SET password_hash = ? WHERE username = ?;", [hash, u.username]);
      }
      db.run("UPDATE users SET full_name = 'SMC-Operator' WHERE username = 'operator' OR id = 2;");
      db.run("UPDATE users SET full_name = 'SMC-Operator' WHERE full_name LIKE '%Rajesh Verma%';");
      db.saveToDiskSync();
      console.log('[Auth] Default passwords synchronized to smaller passwords (admin123, etc.)');

    // Ensure smc_operator account is securely configured
    try {
      const defaultOpHash = '$2b$10$AbcukpyP6sRnNK9xlOzRouly6HOSQglJJuoKEvUEVEVCZrNNbmfcu';
      const targetHash = process.env.OPERATOR_PASSWORD
        ? bcrypt.hashSync(process.env.OPERATOR_PASSWORD, 10)
        : defaultOpHash;

      const opUser = db.get("SELECT id FROM users WHERE username = 'smc_operator';");
      if (!opUser) {
        db.run(`
          INSERT INTO users (username, password_hash, full_name, email, role, is_active, created_at, updated_at)
          VALUES ('smc_operator', ?, 'SMC Working Sheet Operator', 'operator.working@uppcl.org', 'operator', 1, datetime('now'), datetime('now'));
        `, [targetHash]);
        db.saveToDiskSync();
        console.log('[Auth] smc_operator account initialized with secure password hash.');
      } else {
        db.run("UPDATE users SET password_hash = ? WHERE username = 'smc_operator';", [targetHash]);
        db.saveToDiskSync();
      }
    } catch (opErr) {
      console.warn('[Auth] smc_operator check error:', opErr.message);
    }
    } catch (mErr) {
      console.warn('[Auth] Password sync warning:', mErr.message);
    }

    // Purge any rogue complaints ingested directly from X rather than Google Sheets
    try {
      const purged = db.run("DELETE FROM complaints WHERE created_by = 'X_INGESTION_WORKER';");
      if (purged && purged.changes > 0) {
        console.log(`[Server] Purged ${purged.changes} rogue complaints ingested directly from X.`);
        db.saveToDiskSync();
      }
    } catch (pErr) {
      console.warn('[Server] Purge warning:', pErr.message);
    }

    // Purge phantom records with no post URL and no handle
    try {
      const purgedPhantom = db.run("DELETE FROM complaints WHERE (post_url IS NULL OR post_url = '') AND (consumer_handle IS NULL OR consumer_handle = '' OR consumer_handle = '@');");
      if (purgedPhantom && purgedPhantom.changes > 0) {
        console.log(`[Server] Purged ${purgedPhantom.changes} phantom complaints with no post URL.`);
        db.saveToDiskSync();
      }
    } catch (phErr) {
      console.warn('[Server] Phantom purge warning:', phErr.message);
    }

    // Authoritative Historical UPPCLLKO Reply Rule (Picked status permanently retired)
    try {
      // 1. Re-link verified historical replies in complaint_replies with current complaint IDs
      db.run(`
        UPDATE complaint_replies
        SET complaint_id = (
          SELECT c.id FROM complaints c 
          WHERE c.post_url LIKE '%' || complaint_replies.conversation_id || '%' 
          LIMIT 1
        )
        WHERE EXISTS (
          SELECT 1 FROM complaints c 
          WHERE c.post_url LIKE '%' || complaint_replies.conversation_id || '%'
        );
      `);

      // 2. All complaints with verified UPPCLLKO reply (genuine reply record, published reply ID, or sent reply)
      db.run(`
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
      `);

      // 3. Complaints where UPPCLLKO has not replied
      db.run(`
        UPDATE complaints
        SET has_historical_reply = 0,
            uppcl_replied = 0,
            picked_status = NULL,
            reply_evidence = NULL
        WHERE (id NOT IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_uppcl_reply = 1))
          AND (published_reply_id IS NULL OR published_reply_id = '')
          AND (id NOT IN (SELECT DISTINCT complaint_id FROM x_outgoing_replies WHERE status IN ('Published', 'SENT')))
          AND (reply_evidence IS NULL OR reply_evidence NOT LIKE '%sheet%');
      `);

      // 4. Scenario A: Registered DISCOM reply tracking
      db.run(`
        UPDATE complaints
        SET discom_name = CASE
              WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%pvvnl%' THEN 'PVVNL'
              WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%puvvnl%' THEN 'PuVVNL'
              WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%mvvnl%' THEN 'MVVNL'
              WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%dvvnl%' THEN 'DVVNL'
              WHEN (SELECT author_handle FROM complaint_replies WHERE complaint_id = complaints.id AND is_discom_reply = 1 LIMIT 1) LIKE '%kesco%' THEN 'KESCo'
              ELSE discom_name
            END
        WHERE (discom_name IS NULL OR discom_name = '' OR discom_name = 'UPPCL')
          AND id IN (SELECT complaint_id FROM complaint_replies WHERE is_discom_reply = 1);
      `);

      db.run(`
        UPDATE complaints
        SET discom_replied = 1,
            assigned_nodal_officer_name = COALESCE(assigned_nodal_officer_name, 'DISCOM Nodal Officer (' || discom_name || ')'),
            discom_reply_evidence = COALESCE(
            (SELECT 'Verified registered DISCOM reply in thread (Tweet ID: ' || reply_tweet_id || ')' 
             FROM complaint_replies 
             WHERE complaint_id = complaints.id AND is_discom_reply = 1 
             ORDER BY id DESC LIMIT 1),
            'Verified registered DISCOM reply on record'
          )
        WHERE (id IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_discom_reply = 1))
           OR (reply_within_60_min IS NOT NULL AND reply_within_60_min != '' AND reply_within_60_min != 'NO' AND reply_within_60_min != '-');
      `);

      db.run(`
        UPDATE complaints
        SET discom_replied = 0,
            discom_reply_evidence = NULL
        WHERE (id NOT IN (SELECT DISTINCT complaint_id FROM complaint_replies WHERE is_discom_reply = 1))
          AND (reply_within_60_min IS NULL OR reply_within_60_min = '' OR reply_within_60_min = 'NO' OR reply_within_60_min = '-');
      `);

      db.run(`
        UPDATE complaints
        SET discom_tagged_in_reply = '@' || UPPER(discom_name) || 'HQ'
        WHERE discom_name IN ('PVVNL', 'PUVVNL', 'MVVNL', 'DVVNL', 'KESCO')
          AND (discom_tagged_in_reply IS NULL OR discom_tagged_in_reply = '');
      `);

      db.saveToDiskSync();
    } catch (hErr) {
      console.warn('[Server] Reply harmonization warning:', hErr.message);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`===========================================================`);
      console.log(` UPPCL Social Media Cell Complaint Management System`);
      console.log(` Server running on port: ${PORT} (0.0.0.0)`);
      console.log(` Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(` System Time (IST): ${getIstTimestamp()}`);
      console.log(`===========================================================`);

      // Start Google Sheets 24/7 background synchronization
      try {
        googleSheetsService.startBackgroundSync(5);
        console.log('[Server] Google Sheets synchronization service started (5-min interval).');
      } catch (sErr) {
        console.warn('[Server] Google Sheets sync init warning:', sErr.message);
      }

      // Start automatic monthly Google Sheets archiving and rotation scheduler (Asia/Kolkata)
      try {
        sheetRotationService.startMonthlyRotationScheduler();
      } catch (rErr) {
        console.warn('[Server] Sheet rotation scheduler init warning:', rErr.message);
      }

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
}

module.exports = { app, buildComplaintOrderClause, handleDashboardTableExcelExport };
