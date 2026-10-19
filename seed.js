const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('./db');

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return JSON.parse(text);
}

function extractHandleFromUrl(urlOrText) {
  if (!urlOrText) return '';
  const clean = urlOrText.trim();
  const match = clean.match(/(?:x\.com\/|twitter\.com\/|@)([a-zA-Z0-9_]+)/i);
  if (match) return '@' + match[1];
  return clean;
}

async function runSeed() {
  console.log('--- Initializing UPPCL SMC Database Seed ---');
  await db.initDb();

  // 1. DISCOMs
  console.log('Seeding DISCOMs...');
  const discoms = [
    { code: 'PUVVNL', name: 'Purvanchal Vidyut Vitran Nigam Ltd.', short_name: 'PuVVNL', hq: 'Varanasi' },
    { code: 'MVVNL', name: 'Madhyanchal Vidyut Vitran Nigam Ltd.', short_name: 'MVVNL', hq: 'Lucknow' },
    { code: 'DVVNL', name: 'Dakshinanchal Vidyut Vitran Nigam Ltd.', short_name: 'DVVNL', hq: 'Agra' },
    { code: 'PVVNL', name: 'Pashchimanchal Vidyut Vitran Nigam Ltd.', short_name: 'PVVNL', hq: 'Meerut' },
    { code: 'KESCo', name: 'Kanpur Electricity Supply Company Ltd.', short_name: 'KESCo', hq: 'Kanpur' }
  ];

  for (const d of discoms) {
    const existing = db.get('SELECT id FROM discoms WHERE code = ?;', [d.code]);
    if (!existing) {
      db.run('INSERT INTO discoms (code, name, short_name, headquarters, is_active) VALUES (?, ?, ?, ?, 1);', [
        d.code, d.name, d.short_name, d.hq
      ]);
    }
  }

  // 2. Social Platforms
  console.log('Seeding Social Platforms...');
  const platforms = [
    { code: 'TWITTER', name: 'Twitter/X', icon: 'fa-x-twitter' },
    { code: 'FACEBOOK', name: 'Facebook', icon: 'fa-facebook' },
    { code: 'OTHER', name: 'Other / Manual Entry', icon: 'fa-pen-to-square' }
  ];
  for (const p of platforms) {
    const existing = db.get('SELECT id FROM social_platforms WHERE code = ?;', [p.code]);
    if (!existing) {
      db.run('INSERT INTO social_platforms (code, name, icon, is_active) VALUES (?, ?, ?, 1);', [
        p.code, p.name, p.icon
      ]);
    }
  }

  // 3. Authoritative X Hierarchy from tw_parsed.json
  console.log('Seeding Authoritative X Hierarchy...');
  const twData = readJsonFile(path.join(__dirname, 'data', 'seeds', 'tw_parsed.json'));
  for (const item of twData) {
    const srNo = String(item.SrNo || '').trim();
    const rawDiscom = (item.Discom || '').trim();
    const rawDistrict = (item.District || '').trim();
    const rawUrl = (item.TwitterHandle || '').trim();

    let level = 'District / Field Office';
    let discomName = rawDiscom;
    let districtName = rawDistrict;
    let isMonitored = 0;
    const num = parseInt(srNo, 10);

    if (num >= 1 && num <= 7) {
      level = 'Apex / Government / Corporate HQ';
      isMonitored = 1;
      districtName = '';
      if (num === 4 || num === 5) {
        districtName = 'Energy Minister Sir';
      }
    } else if (num >= 86 && num <= 90) {
      level = 'DISCOM Corporate HQ';
      isMonitored = 1;
      discomName = rawDistrict.replace(/HQ$/i, '');
      districtName = 'Corporate Headquarters';
    } else {
      // Clean district string if it starts with 't' (e.g. 'tBAREILY Zone 2')
      if (districtName.startsWith('t') && districtName.length > 2 && districtName[1] === districtName[1].toUpperCase()) {
        districtName = districtName.substring(1);
      }
    }

    const handle = extractHandleFromUrl(rawUrl);
    const existing = db.get('SELECT id FROM x_hierarchy WHERE sr_no = ? OR account_url = ?;', [srNo, rawUrl]);
    if (!existing && rawUrl) {
      db.run(`
        INSERT INTO x_hierarchy (
          sr_no, hierarchy_level, discom_name, district_name, handle_name,
          account_url, parent_handle, is_monitored, is_active, remarks, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'));
      `, [
        srNo, level, discomName, districtName, handle, rawUrl,
        level === 'District / Field Office' ? (discomName + 'HQ') : null,
        isMonitored, `Authoritative record ${srNo}`
      ]);
    }
  }

  // 4. Facebook Handles & Nodal Officers from smh_parsed.json
  console.log('Seeding Facebook Handles and Nodal Officers...');
  const smhData = readJsonFile(path.join(__dirname, 'data', 'seeds', 'smh_parsed.json'));
  for (const item of smhData) {
    const srNo = String(item.SrNo || '').trim();
    const discom = String(item.Discom || '').trim();
    let district = String(item.District || '').trim();
    const fbUrl = String(item.FbHandle || '').trim();
    const twUrl = String(item.TwitterHandle || '').trim();
    const designation = String(item.NodalDesignation || 'SE').trim() || 'SE';
    const rawMobile = String(item.NodalMobile || '').trim();

    if (district.startsWith('t') && district.length > 2 && district[1] === district[1].toUpperCase()) {
      district = district.substring(1);
    }

    // Clean mobile number (remove CE tags, extra characters)
    let cleanMobile = rawMobile.replace(/[^\d,\s\/\-()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanMobile) cleanMobile = 'Contact HQ';

    // Insert Facebook handle
    if (fbUrl) {
      const existingFb = db.get('SELECT id FROM facebook_handles WHERE fb_url = ?;', [fbUrl]);
      if (!existingFb) {
        db.run(`
          INSERT INTO facebook_handles (sr_no, discom_name, district_name, fb_handle_name, fb_url, is_monitored, is_active)
          VALUES (?, ?, ?, ?, ?, 0, 1);
        `, [srNo, discom, district, `${discom} ${district}`, fbUrl]);
      }
    }

    // Insert Nodal Officer
    if (discom && district) {
      const existingOfficer = db.get('SELECT id FROM nodal_officers WHERE discom_name = ? AND district_name = ?;', [discom, district]);
      if (!existingOfficer) {
        db.run(`
          INSERT INTO nodal_officers (
            discom_name, district_name, officer_name, designation, mobile,
            email, twitter_handle, facebook_url, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'));
        `, [
          discom, district, `Nodal Officer (${designation}) - ${district}`,
          designation, cleanMobile, `nodal.${district.toLowerCase().replace(/[^a-z0-9]/g, '')}@${discom.toLowerCase()}.org`,
          extractHandleFromUrl(twUrl), fbUrl
        ]);
      }
    }

    // Insert District
    if (discom && district) {
      const existingDistrict = db.get('SELECT id FROM districts WHERE name = ? AND discom_name = ?;', [district, discom]);
      if (!existingDistrict) {
        db.run('INSERT INTO districts (name, discom_name, is_active) VALUES (?, ?, 1);', [district, discom]);
      }
    }
  }

  // 5. Organizational Hierarchy (Zones, Circles, Divisions)
  console.log('Seeding Zones, Circles, and Divisions...');
  const zones = readJsonFile(path.join(__dirname, 'data', 'seeds', 'zones_parsed.json'));
  for (const z of zones) {
    if (z.Discom && z.Zone) {
      const existing = db.get('SELECT id FROM jurisdiction_org WHERE discom_name = ? AND zone_name = ? AND circle_name IS NULL;', [
        z.Discom, z.Zone
      ]);
      if (!existing) {
        db.run(`
          INSERT INTO jurisdiction_org (discom_name, zone_name, circle_name, division_name, officer_name, mobile)
          VALUES (?, ?, NULL, NULL, ?, ?);
        `, [z.Discom, z.Zone, z.OfficerName || '', z.Mobile || '']);
      }
    }
  }

  const circles = readJsonFile(path.join(__dirname, 'data', 'seeds', 'circles_parsed.json'));
  for (const c of circles) {
    if (c.Discom && c.Zone && c.Circle) {
      const existing = db.get('SELECT id FROM jurisdiction_org WHERE discom_name = ? AND zone_name = ? AND circle_name = ? AND division_name IS NULL;', [
        c.Discom, c.Zone, c.Circle
      ]);
      if (!existing) {
        db.run(`
          INSERT INTO jurisdiction_org (discom_name, zone_name, circle_name, division_name, officer_name, mobile)
          VALUES (?, ?, ?, NULL, ?, ?);
        `, [c.Discom, c.Zone, c.Circle, c.OfficerName || '', c.Mobile || '']);
      }
    }
  }

  const divisions = readJsonFile(path.join(__dirname, 'data', 'seeds', 'divisions_parsed.json'));
  for (const div of divisions) {
    if (div.Discom && div.Zone && div.Circle && div.Division) {
      const existing = db.get('SELECT id FROM jurisdiction_org WHERE discom_name = ? AND zone_name = ? AND circle_name = ? AND division_name = ?;', [
        div.Discom, div.Zone, div.Circle, div.Division
      ]);
      if (!existing) {
        db.run(`
          INSERT INTO jurisdiction_org (discom_name, zone_name, circle_name, division_name, officer_name, mobile)
          VALUES (?, ?, ?, ?, ?, ?);
        `, [div.Discom, div.Zone, div.Circle, div.Division, div.OfficerName || '', div.Mobile || '']);
      }
    }
  }

  // 6. Complaint Categories and Subcategories
  console.log('Seeding Complaint Categories and Subcategories...');
  const categoriesData = [
    {
      name: 'Power Supply & Outage',
      code: 'PWR',
      sla: 24,
      subcategories: [
        'Total Area Blackout / Grid Tripping',
        'Single Phase Supply Failure',
        'Continuous Low Voltage',
        'High Voltage / Phase Imbalance Surge',
        'Frequent Voltage Fluctuations'
      ]
    },
    {
      name: 'Distribution Transformer',
      code: 'XFR',
      sla: 24,
      subcategories: [
        'Transformer Burnt / Non-functional',
        'Transformer Sparking / Immediate Fire Risk',
        'Severe Oil Leakage from Transformer',
        'Overloaded / Inadequate Capacity Transformer',
        'Frequent HT / LT Fuse Blowing'
      ]
    },
    {
      name: 'Meter & Connection',
      code: 'MTR',
      sla: 48,
      subcategories: [
        'Defective / Stopped Meter',
        'Burnt Meter / Melted Terminal',
        'Fast Meter / Abnormal Unit Advance',
        'Smart Meter Communication Error',
        'Blank Display / Reading Inaccessible'
      ]
    },
    {
      name: 'Billing & Commercial',
      code: 'BIL',
      sla: 48,
      subcategories: [
        'Inflated / Excessive Assessment Bill',
        'Wrong Tariff Classification',
        'Bill Not Received Regularly',
        'Online Payment Not Updated in Account',
        'Bill Revision / OTS Rebate Pending'
      ]
    },
    {
      name: 'Overhead Line, Cable & Pole',
      code: 'LNE',
      sla: 24,
      subcategories: [
        'Snapped Conductor / Live Wire on Ground',
        'Broken / Severely Damaged Pole',
        'Leaning Pole / Unsafe Tilt',
        'Underground Cable Joint Puncture',
        'Tree Branches Touching HT/LT Lines'
      ]
    },
    {
      name: 'New Connection & Modification',
      code: 'NCN',
      sla: 72,
      subcategories: [
        'Delay in New Connection Release (Jhatpat Portal)',
        'Disputed Demand Note / Estimate',
        'Load Enhancement Application Delayed',
        'Ownership / Name Transfer Pending',
        'Solar Net-Metering Connection Delay'
      ]
    },
    {
      name: 'Theft, Vigilance & Integrity',
      code: 'VIG',
      sla: 24,
      subcategories: [
        'Direct Katiya Hooking / Electricity Theft',
        'Meter Bypass / Tampered Seal',
        'Commercial Supply from Domestic Connection',
        'Unauthorized Line Extension'
      ]
    },
    {
      name: 'Staff Service & Conduct',
      code: 'STF',
      sla: 48,
      subcategories: [
        'Lineman Misbehavior / Refusal of Service',
        'Substation Phone Not Answered',
        '1912 Grievance Not Attended',
        'Harassment / Bribery Demand Complaint'
      ]
    },
    {
      name: 'Public Safety & Emergency Hazard',
      code: 'SAF',
      sla: 12,
      subcategories: [
        'Dangerous Low-Sagging Live Conductor',
        'Open Substation / Unfenced Transformer Yard',
        'Open Feeder Pillar / Exposed Live Busbars',
        'Electric Current Flowing in Pole / Neutral'
      ]
    }
  ];

  for (const cat of categoriesData) {
    let catRecord = db.get('SELECT id FROM complaint_categories WHERE name = ?;', [cat.name]);
    let catId = catRecord ? catRecord.id : null;
    if (!catRecord) {
      const res = db.run('INSERT INTO complaint_categories (name, code, sla_hours, is_active) VALUES (?, ?, ?, 1);', [
        cat.name, cat.code, cat.sla
      ]);
      catId = res.lastInsertRowid;
    }

    for (const sub of cat.subcategories) {
      const existingSub = db.get('SELECT id FROM complaint_subcategories WHERE category_id = ? AND name = ?;', [catId, sub]);
      if (!existingSub) {
        db.run('INSERT INTO complaint_subcategories (category_id, name, is_active) VALUES (?, ?, 1);', [catId, sub]);
      }
    }
  }

  // 7. System Settings
  console.log('Seeding System Settings...');
  const settings = [
    { key: 'sla_critical_hours', value: '24', desc: 'SLA for Critical priority complaints (hours)' },
    { key: 'sla_high_hours', value: '48', desc: 'SLA for High priority complaints (hours)' },
    { key: 'sla_normal_hours', value: '72', desc: 'SLA for Normal priority complaints (hours)' },
    { key: 'sla_low_hours', value: '96', desc: 'SLA for Low priority complaints (hours)' },
    { key: 'default_platform', value: 'Twitter/X', desc: 'Default social platform for new complaints' },
    { key: 'auto_duplicate_window_days', value: '3', desc: 'Duplicate detection time window in days' },
    { key: 'followup_reminder_hours', value: '24', desc: 'Default follow-up reminder interval' },
    { key: 'closure_verification_mandatory', value: 'true', desc: 'Require verification by SMC before closure' },
    { key: 'system_timezone', value: 'Asia/Kolkata', desc: 'Application timezone' },
    { key: 'organization_name', value: 'Uttar Pradesh Power Corporation Ltd. (UPPCL)', desc: 'Official Organization Name' },
    { key: 'cell_name', value: 'Social Media Cell (SMC)', desc: 'Cell / Department Name' },
    { key: 'x_account_handle', value: '@UPPCLLKO', desc: 'Authorized Official X Account Handle' },
    { key: 'x_account_id', value: '108658826', desc: 'Authorized Official X Account ID' },
    { key: 'x_connection_status', value: 'Needs Configuration', desc: 'X API Connection Status' },
    { key: 'automation_mode', value: 'Mode A - Monitor Only', desc: 'Active Automation Mode (Mode A, Mode B, or Mode C)' },
    { key: 'emergency_stop', value: 'false', desc: 'Global Emergency Stop for all Outbound Automation' },
    { key: 'ingestion_interval_seconds', value: '60', desc: 'Polling interval for continuous X ingestion (seconds)' },
    { key: 'sla_unacknowledged_alert_mins', value: '45', desc: 'Alert threshold for unacknowledged grievances (minutes)' },
    { key: 'sla_warning_hours', value: '4', desc: 'Early warning window before SLA breach (hours)' }
  ];

  for (const s of settings) {
    const existing = db.get('SELECT id FROM system_settings WHERE key = ?;', [s.key]);
    if (!existing) {
      db.run('INSERT INTO system_settings (key, value, description, updated_at) VALUES (?, ?, ?, datetime("now"));', [
        s.key, s.value, s.desc
      ]);
    }
  }

  // 8. Users & Access Control
  console.log('Seeding Users & Roles...');
  const salt = bcrypt.genSaltSync(10);
  const defaultUsers = [
    {
      username: 'admin',
      password: 'Admin@UPPCL2026',
      full_name: 'Super Administrator',
      email: 'admin.smc@uppcl.org',
      role: 'Super Administrator',
      discom_name: 'All DISCOMs',
      designation: 'Chief Systems Administrator',
      mobile: '9415000001'
    },
    {
      username: 'operator',
      password: 'Operator@UPPCL2026',
      full_name: 'Rajesh Verma (SMC Operator)',
      email: 'rajesh.operator@uppcl.org',
      role: 'Social Media Cell Operator',
      discom_name: 'All DISCOMs',
      designation: 'Senior Social Media Specialist',
      mobile: '9415000002'
    },
    {
      username: 'operator2',
      password: 'Operator@UPPCL2026',
      full_name: 'Pooja Tiwari (SMC Operator)',
      email: 'pooja.operator@uppcl.org',
      role: 'Social Media Cell Operator',
      discom_name: 'All DISCOMs',
      designation: 'Social Media Cell Executive',
      mobile: '9415000003'
    },
    {
      username: 'supervisor',
      password: 'Supervisor@UPPCL2026',
      full_name: 'Er. Sadanand (Superintending Engineer)',
      email: 'socialmediacellhq@uppcl.org',
      role: 'Supervisor / Management',
      discom_name: 'All DISCOMs',
      designation: 'Superintending Engineer (SMC HQ)',
      mobile: '9415000004'
    },
    {
      username: 'nodal_puvvnl',
      password: 'Nodal@PUVVNL2026',
      full_name: 'Er. Ashutosh Srivastava (Nodal Officer)',
      email: 'nodal.puvvnl@uppcl.org',
      role: 'DISCOM Nodal Officer',
      discom_name: 'PUVVNL',
      designation: 'Chief Engineer / Nodal Officer PuVVNL',
      mobile: '9415801234'
    },
    {
      username: 'nodal_mvvnl',
      password: 'Nodal@MVVNL2026',
      full_name: 'Er. Suneel Kapoor (Nodal Officer)',
      email: 'nodal.mvvnl@uppcl.org',
      role: 'DISCOM Nodal Officer',
      discom_name: 'MVVNL',
      designation: 'Chief Engineer / Nodal Officer MVVNL',
      mobile: '9415901646'
    },
    {
      username: 'nodal_dvvnl',
      password: 'Nodal@DVVNL2026',
      full_name: 'Er. Praduman Tripathi (Nodal Officer)',
      email: 'nodal.dvvnl@uppcl.org',
      role: 'DISCOM Nodal Officer',
      discom_name: 'DVVNL',
      designation: 'Superintending Engineer / Nodal Officer DVVNL',
      mobile: '9415304000'
    },
    {
      username: 'nodal_pvvnl',
      password: 'Nodal@PVVNL2026',
      full_name: 'Er. Pawan Kumar Agarwal (Nodal Officer)',
      email: 'nodal.pvvnl@uppcl.org',
      role: 'DISCOM Nodal Officer',
      discom_name: 'PVVNL',
      designation: 'Superintending Engineer / Nodal Officer PVVNL',
      mobile: '9415007788'
    },
    {
      username: 'nodal_kesco',
      password: 'Nodal@KESCo2026',
      full_name: 'Er. Sanjay Agarwal (Nodal Officer)',
      email: 'nodal.kesco@uppcl.org',
      role: 'DISCOM Nodal Officer',
      discom_name: 'KESCo',
      designation: 'Superintending Engineer / Nodal Officer KESCo',
      mobile: '9415009988'
    },
    {
      username: 'reviewer',
      password: 'Reviewer@UPPCL2026',
      full_name: 'Director (Commercial & Operations)',
      email: 'director.operations@uppcl.org',
      role: 'Read-Only Reviewer',
      discom_name: 'All DISCOMs',
      designation: 'Director Commercial UPPCL',
      mobile: '9415000005'
    }
  ];

  for (const u of defaultUsers) {
    const existing = db.get('SELECT id FROM users WHERE username = ?;', [u.username]);
    if (!existing) {
      const hash = bcrypt.hashSync(u.password, salt);
      db.run(`
        INSERT INTO users (
          username, password_hash, full_name, email, role,
          discom_name, designation, mobile, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'));
      `, [u.username, hash, u.full_name, u.email, u.role, u.discom_name, u.designation, u.mobile]);
    }
  }

  // 9. Realistic Sample Complaints across all operational statuses
  console.log('Checking and seeding sample complaints...');
  const sampleComplaints = [
    {
      complaint_no: 'UPPCL-SMC-202610-0001',
        received_at: '2026-10-17 08:30:00',
        platform: 'Twitter/X',
        monitored_account: '@UPPCLLKO',
        hierarchy_handle_name: '@puvvnlvaranasi',
        is_tagged: 1,
        consumer_name: 'Amitabh Sen',
        consumer_handle: '@amitabh_sen_vns',
        consumer_profile_url: 'https://x.com/amitabh_sen_vns',
        post_url: 'https://x.com/amitabh_sen_vns/status/1846839001123456789',
        complaint_text: 'Dear @UPPCLLKO @puvvnlvaranasi Distribution transformer at Sigra Chauraha, Varanasi caught fire this morning. Entire market and residential colony in complete darkness for 4 hours. No official response yet.',
        category_name: 'Distribution Transformer',
        subcategory_name: 'Transformer Sparking / Immediate Fire Risk',
        discom_name: 'PUVVNL',
        district_name: 'VARANASI',
        zone_name: 'VARANASI 1',
        circle_name: 'EDC VARANASI',
        division_name: 'EDD-1 SIGRA',
        subdivision_name: 'EDSD SIGRA',
        consumer_account_no: '721890341200',
        consumer_mobile: '9839012345',
        priority: 'Critical',
        current_status: 'Forwarded',
        assigned_operator_id: 2,
        assigned_operator_name: 'Rajesh Verma (SMC Operator)',
        assigned_nodal_officer_id: 1,
        assigned_nodal_officer_name: 'Er. Ashutosh Srivastava (Nodal Officer)',
        assigned_nodal_officer_mobile: '9415801234',
        forwarding_date: '2026-10-17 08:45:00',
        forwarding_channel: 'WhatsApp & e-Office',
        forwarding_ref_no: 'SMC/FWD/2026/101',
        forwarding_remarks: 'Critical fire incident. Transformer replacement needed urgently. Forwarded to CE/SE Varanasi.',
        expected_response_date: '2026-10-18 08:45:00',
        is_overdue: 0,
        escalation_level: 0,
        last_action_date: '2026-10-17 08:45:00'
      },
      {
        complaint_no: 'UPPCL-SMC-202610-0002',
        received_at: '2026-10-16 11:20:00',
        platform: 'Twitter/X',
        monitored_account: '@CMOfficeUP',
        hierarchy_handle_name: '@mvvnlbareilly',
        is_tagged: 1,
        consumer_name: 'Dr. Ramesh Chander',
        consumer_handle: '@dr_ramesh_bly',
        consumer_profile_url: 'https://x.com/dr_ramesh_bly',
        post_url: 'https://x.com/dr_ramesh_bly/status/1846519002234567890',
        complaint_text: '@CMOfficeUP @UPPCLLKO In Bareilly Subhash Nagar, high voltage surge occurred blowing up refrigerators and LED TVs of 20+ houses. Electricity supply still disconnected since yesterday night. Kindly intervene.',
        category_name: 'Power Supply & Outage',
        subcategory_name: 'High Voltage / Phase Imbalance Surge',
        discom_name: 'MVVNL',
        district_name: 'BAREILLY',
        zone_name: 'BAREILLY Zone 1',
        circle_name: 'EDC BAREILLY',
        division_name: 'EDD-2 SUBHASH NAGAR',
        subdivision_name: 'EDSD SUBHASH NAGAR',
        consumer_account_no: '184902184910',
        consumer_mobile: '9412345678',
        priority: 'High',
        current_status: 'DISCOM Follow Up',
        assigned_operator_id: 2,
        assigned_operator_name: 'Rajesh Verma (SMC Operator)',
        assigned_nodal_officer_id: 2,
        assigned_nodal_officer_name: 'Er. Suneel Kapoor (Nodal Officer)',
        assigned_nodal_officer_mobile: '9415901646',
        forwarding_date: '2026-10-16 11:35:00',
        forwarding_channel: 'Official Portal & Email',
        forwarding_ref_no: 'SMC/FWD/2026/098',
        forwarding_remarks: 'Severe surge damaged household equipment. Restore neutral and safely resume supply.',
        expected_response_date: '2026-10-18 11:35:00',
        is_overdue: 0,
        escalation_level: 0,
        last_action_date: '2026-10-17 10:15:00'
      },
      {
        complaint_no: 'UPPCL-SMC-202610-0003',
        received_at: '2026-10-14 14:10:00',
        platform: 'Twitter/X',
        monitored_account: '@AKSharmaOffice',
        hierarchy_handle_name: '@dvvnlagra',
        is_tagged: 1,
        consumer_name: 'Sunita Chauhan',
        consumer_handle: '@sunita_agra',
        consumer_profile_url: 'https://x.com/sunita_agra',
        post_url: 'https://x.com/sunita_agra/status/1845819003345678901',
        complaint_text: '@AKSharmaOffice Respected Minister Sir, our village in Fatehabad Agra has a burnt 25KVA transformer for 5 days. Local JE says no transformer in stock. Farmers unable to run tube-wells. Please help.',
        category_name: 'Distribution Transformer',
        subcategory_name: 'Transformer Burnt / Non-functional',
        discom_name: 'DVVNL',
        district_name: 'AGRA',
        zone_name: 'AGRA ZONE',
        circle_name: 'EDC FATEHABAD',
        division_name: 'EDD FATEHABAD',
        subdivision_name: 'EDSD FATEHABAD RURAL',
        consumer_account_no: '331098452100',
        consumer_mobile: '9456789012',
        priority: 'Critical',
        current_status: 'Escalated',
        assigned_operator_id: 3,
        assigned_operator_name: 'Pooja Tiwari (SMC Operator)',
        assigned_nodal_officer_id: 3,
        assigned_nodal_officer_name: 'Er. Praduman Tripathi (Nodal Officer)',
        assigned_nodal_officer_mobile: '9415304000',
        forwarding_date: '2026-10-14 14:30:00',
        forwarding_channel: 'e-Office & WhatsApp',
        forwarding_ref_no: 'SMC/FWD/2026/075',
        forwarding_remarks: 'Transformer burnt >72 hours. Urgent replacement requested.',
        expected_response_date: '2026-10-15 14:30:00',
        is_overdue: 1,
        escalation_level: 2,
        escalation_reason: 'Breach of 24-hour rural transformer replacement timeline. No action reported by field staff.',
        last_action_date: '2026-10-16 16:00:00'
      },
      {
        complaint_no: 'UPPCL-SMC-202610-0004',
        received_at: '2026-10-15 09:15:00',
        platform: 'Twitter/X',
        monitored_account: '@UPPCLLKO',
        hierarchy_handle_name: '@pvvnlmeerut',
        is_tagged: 1,
        consumer_name: 'Vikas Tyagi',
        consumer_handle: '@vikas_tyagi_mrt',
        consumer_profile_url: 'https://x.com/vikas_tyagi_mrt',
        post_url: 'https://x.com/vikas_tyagi_mrt/status/1846119004456789012',
        complaint_text: '@UPPCLLKO @pvvnlmeerut Received electricity bill of Rs 48,250 for 2KW domestic connection in Shastri Nagar Meerut. Normal bill is Rs 1,500. Sub-division SDO not entertaining revision request.',
        category_name: 'Billing & Commercial',
        subcategory_name: 'Inflated / Excessive Assessment Bill',
        discom_name: 'PVVNL',
        district_name: 'MEERUT',
        zone_name: 'MEERUT ZONE',
        circle_name: 'EDC-1 MEERUT',
        division_name: 'EDD SHASTRI NAGAR',
        subdivision_name: 'EDSD SHASTRI NAGAR',
        consumer_account_no: '482019485123',
        consumer_mobile: '9897123456',
        priority: 'Normal',
        current_status: 'Resolved — Verification Pending',
        assigned_operator_id: 2,
        assigned_operator_name: 'Rajesh Verma (SMC Operator)',
        assigned_nodal_officer_id: 4,
        assigned_nodal_officer_name: 'Er. Pawan Kumar Agarwal (Nodal Officer)',
        assigned_nodal_officer_mobile: '9415007788',
        forwarding_date: '2026-10-15 09:40:00',
        forwarding_channel: 'Billing Portal & Email',
        forwarding_ref_no: 'SMC/FWD/2026/082',
        forwarding_remarks: 'Bill abnormally high. Meter reading audit and bill rectification instructed.',
        expected_response_date: '2026-10-18 09:40:00',
        is_overdue: 0,
        escalation_level: 0,
        discom_response_date: '2026-10-17 11:00:00',
        discom_action_taken: 'Reading verified on meter test bench. Punching error of 4000 extra units identified. Revised bill issued for Rs 1,620. Consumer given adjusted payment receipt.',
        discom_evidence_url: 'https://uppclonline.com/revised_bills/482019485123_oct26.pdf',
        discom_reported_by: 'EE Commercial PVVNL Meerut',
        last_action_date: '2026-10-17 11:00:00'
      },
      {
        complaint_no: 'UPPCL-SMC-202610-0005',
        received_at: '2026-10-13 16:45:00',
        platform: 'Twitter/X',
        monitored_account: '@UPPCLLKO',
        hierarchy_handle_name: '@dvvnlkanpurnagr',
        is_tagged: 1,
        consumer_name: 'Mohd. Tariq',
        consumer_handle: '@tariq_kanpur',
        consumer_profile_url: 'https://x.com/tariq_kanpur',
        post_url: 'https://x.com/tariq_kanpur/status/1845419005567890123',
        complaint_text: '@UPPCLLKO Live wire broke and fell across main road near Govind Nagar market Kanpur. High risk to pedestrians and vehicles. Immediate repair needed!',
        category_name: 'Public Safety & Emergency Hazard',
        subcategory_name: 'Dangerous Low-Sagging Live Conductor',
        discom_name: 'KESCo',
        district_name: 'KANPUR NAGAR',
        zone_name: 'KANPUR CITY',
        circle_name: 'KESCO SOUTH',
        division_name: 'EDD GOVIND NAGAR',
        subdivision_name: 'EDSD GOVIND NAGAR',
        consumer_account_no: '912048591024',
        consumer_mobile: '9335123456',
        priority: 'Critical',
        current_status: 'Closed',
        assigned_operator_id: 2,
        assigned_operator_name: 'Rajesh Verma (SMC Operator)',
        assigned_nodal_officer_id: 5,
        assigned_nodal_officer_name: 'Er. Sanjay Agarwal (Nodal Officer)',
        assigned_nodal_officer_mobile: '9415009988',
        forwarding_date: '2026-10-13 16:50:00',
        forwarding_channel: 'Direct Phone & Emergency Alert',
        forwarding_ref_no: 'SMC/EMG/2026/012',
        forwarding_remarks: 'Emergency public hazard. Line power turned off, repair team dispatched.',
        expected_response_date: '2026-10-14 04:50:00',
        is_overdue: 0,
        escalation_level: 0,
        discom_response_date: '2026-10-13 18:20:00',
        discom_action_taken: 'Emergency breakdown gang reached site within 25 minutes. Snapped 11kV conductor spliced, re-tensioned, insulators checked, and power restored safely at 18:15 hrs.',
        discom_evidence_url: 'https://kesco.co.in/emergency/repairs/govindnagar_1310.jpg',
        discom_reported_by: 'AE Emergency KESCo South',
        closure_date: '2026-10-13 19:00:00',
        closure_verified_by: 'Er. Sadanand (Superintending Engineer)',
        closure_verification_notes: 'Spoke directly with consumer Mohd. Tariq. Confirmed road hazard eliminated and supply fully normal. Reply posted on Twitter.',
        closure_satisfaction_status: 'Satisfied',
        last_action_date: '2026-10-13 19:00:00'
      },
      {
        complaint_no: 'UPPCL-SMC-202610-0006',
        received_at: '2026-10-17 12:00:00',
        platform: 'Facebook',
        monitored_account: 'UPPCL Official Facebook',
        hierarchy_handle_name: 'PUVVNL Gorakhpur FB',
        is_tagged: 0,
        consumer_name: 'Alok Nath Pandey',
        consumer_handle: 'alok.pandey.gkp',
        consumer_profile_url: 'https://facebook.com/alok.pandey.gkp',
        post_url: 'https://facebook.com/uppcl/posts/948201849102384',
        complaint_text: 'Applied for new electricity connection for my shop under Jhatpat Portal on 20th September at Gorakhpur Mohaddipur. All dues and estimate paid. 27 days passed but meter not installed.',
        category_name: 'New Connection & Modification',
        subcategory_name: 'Delay in New Connection Release (Jhatpat Portal)',
        discom_name: 'PUVVNL',
        district_name: 'GORAKHPUR',
        zone_name: 'GORAKHPUR 1',
        circle_name: 'EDC GORAKHPUR',
        division_name: 'EDD-1 MOHADDIPUR',
        subdivision_name: 'EDSD MOHADDIPUR',
        consumer_account_no: 'JHATPAT-GKP-2026-9812',
        consumer_mobile: '9450688777',
        priority: 'Normal',
        current_status: 'New',
        assigned_operator_id: null,
        assigned_operator_name: null,
        assigned_nodal_officer_id: null,
        assigned_nodal_officer_name: null,
        assigned_nodal_officer_mobile: null,
        is_overdue: 0,
        escalation_level: 0,
        last_action_date: '2026-10-17 12:00:00'
      },
      {
        complaint_no: 'UPPCL-SMC-202610-0007',
        received_at: '2026-10-12 10:00:00',
        platform: 'Twitter/X',
        monitored_account: '@UPPCLLKO',
        hierarchy_handle_name: '@mvvnlsitapur',
        is_tagged: 1,
        consumer_name: 'Santosh Kumar',
        consumer_handle: '@santosh_sitapur',
        consumer_profile_url: 'https://x.com/santosh_sitapur',
        post_url: 'https://x.com/santosh_sitapur/status/1845119006678901234',
        complaint_text: '@UPPCLLKO @mvvnlsitapur Meter display blank since last 2 months. Meter reader giving average bill of 500 units every month instead of our actual 120 units. Please replace defective meter.',
        category_name: 'Meter & Connection',
        subcategory_name: 'Blank Display / Reading Inaccessible',
        discom_name: 'MVVNL',
        district_name: 'SITAPUR',
        zone_name: 'SITAPUR',
        circle_name: 'EDC SITAPUR',
        division_name: 'EDD-1 SITAPUR',
        subdivision_name: 'EDSD SITAPUR',
        consumer_account_no: '881029384712',
        consumer_mobile: '9415443322',
        priority: 'Normal',
        current_status: 'Reopened',
        assigned_operator_id: 2,
        assigned_operator_name: 'Rajesh Verma (SMC Operator)',
        assigned_nodal_officer_id: 2,
        assigned_nodal_officer_name: 'Er. Suneel Kapoor (Nodal Officer)',
        assigned_nodal_officer_mobile: '9415901646',
        forwarding_date: '2026-10-12 10:30:00',
        forwarding_channel: 'Portal',
        forwarding_ref_no: 'SMC/FWD/2026/061',
        forwarding_remarks: 'Meter replacement ordered.',
        expected_response_date: '2026-10-15 10:30:00',
        is_overdue: 1,
        escalation_level: 1,
        reopen_reason: 'Consumer replied on Twitter that DISCOM closed complaint falsely without actually visiting or replacing the meter. Reopened for field inspection.',
        last_action_date: '2026-10-16 14:00:00'
      },
      {
        complaint_no: 'UPPCL-SMC-202610-0008',
        received_at: '2026-10-16 17:00:00',
        platform: 'Twitter/X',
        monitored_account: '@UPPCLLKO',
        hierarchy_handle_name: '@dvvnljhansi',
        is_tagged: 1,
        consumer_name: 'Rajeev Srivastava',
        consumer_handle: '@rajeev_jhansi',
        consumer_profile_url: 'https://x.com/rajeev_jhansi',
        post_url: 'https://x.com/rajeev_jhansi/status/1846619007789012345',
        complaint_text: '@UPPCLLKO Transformer burnt at Sipri Bazar Jhansi. Same issue posted twice yesterday by another shopkeeper.',
        category_name: 'Distribution Transformer',
        subcategory_name: 'Transformer Burnt / Non-functional',
        discom_name: 'DVVNL',
        district_name: 'JHANSI',
        zone_name: 'JHANSI ZONE',
        circle_name: 'EDC JHANSI',
        division_name: 'EDD SIPRI BAZAR',
        subdivision_name: 'EDSD SIPRI BAZAR',
        consumer_account_no: '291048592019',
        consumer_mobile: '9451122334',
        priority: 'High',
        current_status: 'Duplicate / Invalid',
        assigned_operator_id: 3,
        assigned_operator_name: 'Pooja Tiwari (SMC Operator)',
        invalid_reason: 'Duplicate of complaint UPPCL-SMC-202610-0003 for same transformer breakdown and location.',
        duplicate_of_complaint_id: 3,
        last_action_date: '2026-10-16 17:30:00'
      }
    ];

    for (const c of sampleComplaints) {
      const existing = db.get('SELECT id FROM complaints WHERE complaint_no = ?;', [c.complaint_no]);
      if (existing) continue;
      const res = db.run(`
        INSERT INTO complaints (
          complaint_no, received_at, platform, monitored_account, hierarchy_handle_name,
          is_tagged, consumer_name, consumer_handle, consumer_profile_url, post_url,
          complaint_text, category_name, subcategory_name, discom_name, district_name,
          zone_name, circle_name, division_name, subdivision_name, consumer_account_no,
          consumer_mobile, priority, current_status, assigned_operator_id, assigned_operator_name,
          assigned_nodal_officer_id, assigned_nodal_officer_name, assigned_nodal_officer_mobile,
          forwarding_date, forwarding_channel, forwarding_ref_no, forwarding_remarks,
          expected_response_date, is_overdue, escalation_level, escalation_reason,
          discom_response_date, discom_action_taken, discom_evidence_url, discom_reported_by,
          closure_date, closure_verified_by, closure_verification_notes, closure_satisfaction_status,
          duplicate_of_complaint_id, invalid_reason, reopen_reason, last_action_date,
          created_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          'SMC System Seed', ?, ?
        );
      `, [
        c.complaint_no, c.received_at, c.platform, c.monitored_account, c.hierarchy_handle_name,
        c.is_tagged, c.consumer_name, c.consumer_handle, c.consumer_profile_url, c.post_url,
        c.complaint_text, c.category_name, c.subcategory_name, c.discom_name, c.district_name,
        c.zone_name, c.circle_name, c.division_name, c.subdivision_name, c.consumer_account_no,
        c.consumer_mobile, c.priority, c.current_status, c.assigned_operator_id, c.assigned_operator_name,
        c.assigned_nodal_officer_id, c.assigned_nodal_officer_name, c.assigned_nodal_officer_mobile,
        c.forwarding_date, c.forwarding_channel, c.forwarding_ref_no, c.forwarding_remarks,
        c.expected_response_date, c.is_overdue, c.escalation_level, c.escalation_reason,
        c.discom_response_date, c.discom_action_taken, c.discom_evidence_url, c.discom_reported_by,
        c.closure_date, c.closure_verified_by, c.closure_verification_notes, c.closure_satisfaction_status,
        c.duplicate_of_complaint_id, c.invalid_reason, c.reopen_reason, c.last_action_date,
        c.received_at, c.last_action_date || c.received_at
      ]);

      const compId = res.lastInsertRowid;

      // Initial registration timeline
      db.run(`
        INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
        VALUES (?, 'Registration', NULL, 'New', 1, 'System / Auto-Ingest', 'System', 'Complaint captured and registered into SMC queue', ?);
      `, [compId, c.received_at]);

      // If forwarded
      if (c.forwarding_date) {
        db.run(`
          INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
          VALUES (?, 'Forwarded', 'New', 'Forwarded', ?, ?, 'Social Media Cell Operator', ?, ?);
        `, [compId, c.assigned_operator_id || 2, c.assigned_operator_name || 'Rajesh Verma (SMC Operator)', c.forwarding_remarks || 'Forwarded to concerned DISCOM', c.forwarding_date]);

        db.run(`
          INSERT INTO complaint_forwarding_logs (complaint_id, forwarded_by, forwarded_to_officer, discom_name, district_name, channel, ref_no, remarks, expected_response_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          compId, c.assigned_operator_name || 'Rajesh Verma', c.assigned_nodal_officer_name || 'Nodal Officer',
          c.discom_name, c.district_name, c.forwarding_channel || 'e-Office', c.forwarding_ref_no || 'REF-1',
          c.forwarding_remarks || '', c.expected_response_date || '', c.forwarding_date
        ]);
      }

      // If follow up
      if (c.current_status === 'DISCOM Follow Up') {
        db.run(`
          INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
          VALUES (?, 'Follow-Up', 'Forwarded', 'DISCOM Follow Up', 2, 'Rajesh Verma (SMC Operator)', 'Social Media Cell Operator', 'Followed up via telephone with SE Bareilly. Action promised today.', ?);
        `, [compId, c.last_action_date]);

        db.run(`
          INSERT INTO complaint_followup_logs (complaint_id, followed_up_by, officer_contacted, channel, remarks, next_followup_date, created_at)
          VALUES (?, 'Rajesh Verma', 'SE Bareilly', 'Phone Call', 'Informed about voltage surge; technical team reached substation.', '2026-10-18 10:00:00', ?);
        `, [compId, c.last_action_date]);
      }

      // If escalated
      if (c.escalation_level > 0) {
        db.run(`
          INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
          VALUES (?, 'Escalated', 'Forwarded', 'Escalated', 3, 'Pooja Tiwari (SMC Operator)', 'Social Media Cell Operator', ?, ?);
        `, [compId, c.escalation_reason || 'Escalated due to response breach', c.last_action_date]);

        db.run(`
          INSERT INTO complaint_escalation_logs (complaint_id, escalated_by, escalation_level, escalated_to, reason, remarks, created_at)
          VALUES (?, 'Pooja Tiwari', ?, 'Chief Engineer / MD DVVNL', ?, 'Action requested within 12 hours.', ?);
        `, [compId, c.escalation_level, c.escalation_reason || 'Delayed response beyond permissible SLA threshold', c.last_action_date]);
      }

      // If DISCOM response reported
      if (c.discom_response_date) {
        db.run(`
          INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
          VALUES (?, 'DISCOM Resolution Reported', 'Forwarded', 'Resolved — Verification Pending', 5, ?, 'DISCOM Nodal Officer', ?, ?);
        `, [compId, c.discom_reported_by || 'DISCOM Nodal Officer', c.discom_action_taken, c.discom_response_date]);
      }

      // If closed
      if (c.closure_date) {
        db.run(`
          INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
          VALUES (?, 'Verified & Closed', 'Resolved — Verification Pending', 'Closed', 4, ?, 'Supervisor / Management', ?, ?);
        `, [compId, c.closure_verified_by || 'Er. Sadanand (SE)', c.closure_verification_notes, c.closure_date]);
      }

      // If reopened
      if (c.current_status === 'Reopened') {
        db.run(`
          INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
          VALUES (?, 'Reopened', 'Closed', 'Reopened', 2, 'Rajesh Verma (SMC Operator)', 'Social Media Cell Operator', ?, ?);
        `, [compId, c.reopen_reason, c.last_action_date]);
      }

      // If duplicate/invalid
      if (c.current_status === 'Duplicate / Invalid') {
        db.run(`
          INSERT INTO complaint_timeline (complaint_id, action_type, old_status, new_status, user_id, user_name, user_role, remarks, created_at)
          VALUES (?, 'Invalidated', 'New', 'Duplicate / Invalid', 3, 'Pooja Tiwari (SMC Operator)', 'Social Media Cell Operator', ?, ?);
        `, [compId, c.invalid_reason, c.last_action_date]);
      }
    }

  // 10. Reply Templates (Bilingual Approved Templates)
  console.log('Seeding Approved Reply Templates...');
  const defaultTemplates = [
    {
      title: 'Power Outage Acknowledgement (English)',
      category_name: 'Power Supply / Outage',
      stage: 'acknowledgement',
      language: 'English',
      body: 'Dear {consumer_name}, your grievance regarding power supply interruption in {district} has been registered as {complaint_no}. It is forwarded to {discom} field engineers for immediate restoration under {sla_hours}-hr SLA.',
      variables_json: JSON.stringify(['consumer_name', 'district', 'complaint_no', 'discom', 'sla_hours'])
    },
    {
      title: 'Power Outage Acknowledgement (Hindi)',
      category_name: 'Power Supply / Outage',
      stage: 'acknowledgement',
      language: 'Hindi',
      body: 'प्रिय {consumer_name}, {district} में विद्युत आपूर्ति संबंधी आपकी शिकायत संख्या {complaint_no} दर्ज कर ली गई है। त्वरित निस्तारण हेतु इसे {discom} के क्षेत्रीय अधिकारियों को {sla_hours} घंटे की समयसीमा में प्रेषित किया जा रहा है।',
      variables_json: JSON.stringify(['consumer_name', 'district', 'complaint_no', 'discom', 'sla_hours'])
    },
    {
      title: 'Distribution Transformer Failure (English)',
      category_name: 'Distribution Transformer',
      stage: 'acknowledgement',
      language: 'English',
      body: 'Dear {consumer_name}, transformer issue complaint {complaint_no} for {district} ({discom}) is recorded as Critical Priority. Executive Engineer / SDO alerted for urgent safety and replacement.',
      variables_json: JSON.stringify(['consumer_name', 'district', 'discom', 'complaint_no'])
    },
    {
      title: 'Distribution Transformer Failure (Hindi)',
      category_name: 'Distribution Transformer',
      stage: 'acknowledgement',
      language: 'Hindi',
      body: 'प्रिय {consumer_name}, {district} ({discom}) में ट्रांसफार्मर समस्या संबंधी शिकायत {complaint_no} को त्वरित प्राथमिकता पर दर्ज किया गया है। संबंधित अधिशासी अभियंता/एसडीओ को तत्काल निरीक्षण हेतु निर्देशित किया गया है।',
      variables_json: JSON.stringify(['consumer_name', 'district', 'discom', 'complaint_no'])
    },
    {
      title: 'Billing & Smart Meter Verification (English)',
      category_name: 'Billing & Payment',
      stage: 'acknowledgement',
      language: 'English',
      body: 'Dear {consumer_name}, your billing/meter grievance {complaint_no} has been forwarded to Commercial Division, {discom} for account ledger audit and verification.',
      variables_json: JSON.stringify(['consumer_name', 'complaint_no', 'discom'])
    },
    {
      title: 'Billing & Smart Meter Verification (Hindi)',
      category_name: 'Billing & Payment',
      stage: 'acknowledgement',
      language: 'Hindi',
      body: 'प्रिय {consumer_name}, आपकी बिलिंग/मीटर संबंधी शिकायत {complaint_no} {discom} वाणिज्यिक अनुभाग को मीटर व लेजर सत्यापन हेतु प्रेषित कर दी गई है।',
      variables_json: JSON.stringify(['consumer_name', 'complaint_no', 'discom'])
    },
    {
      title: 'Voltage Fluctuation (English)',
      category_name: 'Voltage Issues',
      stage: 'acknowledgement',
      language: 'English',
      body: 'Dear {consumer_name}, low/high voltage complaint {complaint_no} in {district} ({discom}) is forwarded to Substation in-charge for feeder voltage balancing.',
      variables_json: JSON.stringify(['consumer_name', 'complaint_no', 'district', 'discom'])
    },
    {
      title: 'Voltage Fluctuation (Hindi)',
      category_name: 'Voltage Issues',
      stage: 'acknowledgement',
      language: 'Hindi',
      body: 'प्रिय {consumer_name}, {district} ({discom}) में वोल्टेज संबंधी शिकायत {complaint_no} उपकेंद्र प्रभारी को फीडर लोड संतुलन हेतु अग्रेषित की गई है।',
      variables_json: JSON.stringify(['consumer_name', 'district', 'discom', 'complaint_no'])
    },
    {
      title: 'Electrical Safety & Hazard Alert (English)',
      category_name: 'Safety & Theft',
      stage: 'acknowledgement',
      language: 'English',
      body: 'URGENT: Electrical safety complaint {complaint_no} registered for {district}. 1912 Control Room & Junior Engineer directed for immediate power isolation and field rectification.',
      variables_json: JSON.stringify(['complaint_no', 'district'])
    },
    {
      title: 'Electrical Safety & Hazard Alert (Hindi)',
      category_name: 'Safety & Theft',
      stage: 'acknowledgement',
      language: 'Hindi',
      body: 'अति-आवश्यक: {district} में विद्युत सुरक्षा संबंधी शिकायत {complaint_no} दर्ज की गई। दुर्घटना रोकथाम हेतु विद्युत विच्छेदन व लाइन मरम्मत हेतु टीम रवाना की जा रही है।',
      variables_json: JSON.stringify(['district', 'complaint_no'])
    },
    {
      title: 'New Connection & Modification (English)',
      category_name: 'New Connection & Modification',
      stage: 'acknowledgement',
      language: 'English',
      body: 'Dear {consumer_name}, your new connection / modification grievance {complaint_no} for {district} ({discom}) has been registered and forwarded to Executive Engineer (Distribution).',
      variables_json: JSON.stringify(['consumer_name', 'complaint_no', 'district', 'discom'])
    },
    {
      title: 'New Connection & Modification (Hindi)',
      category_name: 'New Connection & Modification',
      stage: 'acknowledgement',
      language: 'Hindi',
      body: 'प्रिय {consumer_name}, {district} ({discom}) में नए संयोजन / भार वृद्धि संबंधी आपकी शिकायत संख्या {complaint_no} दर्ज कर अधिशासी अभियंता (वितरण) को त्वरित निस्तारण हेतु प्रेषित की गई है।',
      variables_json: JSON.stringify(['consumer_name', 'complaint_no', 'district', 'discom'])
    },
    {
      title: 'Staff Service & Conduct (English)',
      category_name: 'Staff Service & Conduct',
      stage: 'acknowledgement',
      language: 'English',
      body: 'Dear {consumer_name}, staff conduct complaint {complaint_no} has been recorded with DISCOM Vigilance / Superintending Engineer ({discom}) for inquiry and strict action.',
      variables_json: JSON.stringify(['consumer_name', 'complaint_no', 'discom'])
    },
    {
      title: 'Staff Service & Conduct (Hindi)',
      category_name: 'Staff Service & Conduct',
      stage: 'acknowledgement',
      language: 'Hindi',
      body: 'प्रिय {consumer_name}, कार्मिक आचरण संबंधी शिकायत {complaint_no} को {discom} सतर्कता अनुभाग / अधीक्षण अभियंता को जांच व आवश्यक कार्रवाई हेतु प्रेषित किया गया है।',
      variables_json: JSON.stringify(['consumer_name', 'complaint_no', 'discom'])
    },
    {
      title: 'General Service Resolution (English)',
      category_name: 'Service Quality',
      stage: 'resolution',
      language: 'English',
      body: 'Dear {consumer_name}, your grievance {complaint_no} has been resolved by {discom} field team. If supply is restored satisfactorily, kindly confirm. UPPCL 1912 24x7 helpline is at your service.',
      variables_json: JSON.stringify(['consumer_name', 'complaint_no', 'discom'])
    },
    {
      title: 'General Service Resolution (Hindi)',
      category_name: 'Service Quality',
      stage: 'resolution',
      language: 'Hindi',
      body: 'प्रिय {consumer_name}, आपकी शिकायत {complaint_no} का {discom} टीम द्वारा समाधान कर दिया गया है। कृपया संतुष्टि की पुष्टि करें। यूपीपीसीएल 24x7 हेल्पलाइन 1912 आपकी सेवा में सदैव तत्पर है।',
      variables_json: JSON.stringify(['consumer_name', 'complaint_no', 'discom'])
    }
  ];

  for (const t of defaultTemplates) {
    const existing = db.get('SELECT id FROM reply_templates WHERE title = ?;', [t.title]);
    if (!existing) {
      db.run(`
        INSERT INTO reply_templates (title, category_name, stage, language, body, variables_json, version, is_active, usage_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, datetime('now'), datetime('now'));
      `, [t.title, t.category_name, t.stage, t.language, t.body, t.variables_json]);
    } else {
      db.run(`UPDATE reply_templates SET language = ?, body = ? WHERE id = ?;`, [t.language, t.body, existing.id]);
    }
  }

  // 11. Initial Notifications
  console.log('Seeding Initial Notifications...');
  const notifCount = db.get('SELECT COUNT(*) AS cnt FROM notifications;');
  if (!notifCount || notifCount.cnt === 0) {
    const initNotifs = [
      {
        user_id: 1, // Super Admin
        title: 'System Ingestion Checkpoint',
        message: 'Continuous background complaint worker initialized in Mode A (Monitor Only).',
        type: 'system',
        link_url: 'settings'
      },
      {
        user_id: 1,
        title: 'SLA Escalation Warning',
        message: 'Grievance UPPCL-SMC-202610-0004 has breached SLA threshold. Action required.',
        type: 'sla_warning',
        link_url: 'pending-overdue'
      },
      {
        user_id: 2, // Operator
        title: 'New Complaint Inflow',
        message: 'Grievance UPPCL-SMC-202610-0001 requires forwarding confirmation.',
        type: 'assignment',
        link_url: 'register'
      }
    ];
    for (const n of initNotifs) {
      db.run(`
        INSERT INTO notifications (user_id, title, message, type, link_url, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, 0, datetime('now'));
      `, [n.user_id, n.title, n.message, n.type, n.link_url]);
    }
  }

  // 12. Internal Support Tickets
  console.log('Seeding Internal Support Tickets...');
  const ticketCount = db.get('SELECT COUNT(*) AS cnt FROM internal_tickets;');
  if (!ticketCount || ticketCount.cnt === 0) {
    db.run(`
      INSERT INTO internal_tickets (ticket_no, user_id, username, user_role, category, priority, subject, description, status, resolver_name, created_at, updated_at)
      VALUES ('TKT-UPPCL-202610-001', 2, 'operator', 'Social Media Cell Operator', 'X Ingestion', 'Normal', 'Handle @MVVNLHQ rate-limit check', 'Verifying recent mentions quota on corporate HQ handle.', 'Open', 'Super Administrator', datetime('now'), datetime('now'));
    `);
  }

  // 13. Worker Heartbeat
  db.run(`
    INSERT OR REPLACE INTO worker_heartbeats (id, worker_name, last_heartbeat, status, metadata_json)
    VALUES (1, 'uppcl-command-centre-worker', datetime('now'), 'Healthy', '{"mode":"Mode A - Monitor Only","uptime_secs":0,"interval":60}');
  `);

  // 14. Initial Audit Logs
  db.run(`
    INSERT INTO audit_logs (user_id, username, user_role, action, entity_type, entity_id, details, ip_address, created_at)
    VALUES (1, 'system', 'Super Administrator', 'SYSTEM_INITIALIZATION', 'SYSTEM', '0', 'UPPCL Grievance Command Centre production seed verified', '127.0.0.1', datetime('now'));
  `);

  db.flush();
  console.log('--- Database Seeding Complete! ---');
}

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = { runSeed };
