// UPPCL Social Media Cell - Front-end Application
const App = {
  theme: 'light',
  user: null,
  token: null,
  currentPage: 'dashboard',
  currentFilters: {
    page: 1,
    limit: 25,
    search: '',
    status: 'All',
    discom: 'All',
    district: 'All',
    platform: 'All',
    category: 'All',
    priority: 'All',
    assigned_handle: 'All',
    picked_status: 'All',
    reply_within_30_min: 'All',
    shift: 'All',
    data_quality: 'All',
    overdue: '0',
    from_date: '',
    to_date: '',
    sort_by: 'received_at',
    sort_order: 'DESC'
  },
  dashFilter: {
    kpi: 'total',
    page: 1,
    limit: 15,
    search: ''
  },
  currentReportTab: 'time_trends',
  charts: {},
  notifications: [],
  unreadNotifs: 0,
  cachedMaster: {
    categories: [],
    discoms: [],
    xHierarchy: [],
    nodalOfficers: [],
    replyTemplates: [],
    forwardingTemplates: [
      // --- 1. HINDI TEMPLATES (प्राथमिकता - हिंदी निर्देश) ---
      {
        id: 1,
        title: 'विद्युत आपूर्ति बाधित — तत्काल बहाल करें',
        category_name: 'Power Supply Failure',
        language: 'Hindi',
        priority: 'Critical',
        template_text: 'अति-आवश्यक: संबंधित क्षेत्र में विद्युत आपूर्ति बाधित/ट्रिपिंग की शिकायत दर्ज है। कृपया तत्काल संबंधित उपकेंद्र/फीडर की पेट्रोलिंग कराकर आपूर्ति बहाल कराएं एवं नियत समय सीमा में निस्तारण सुनिश्चित करें।'
      },
      {
        id: 2,
        title: 'ट्रांसफार्मर क्षतिग्रस्त/जलना — युद्धस्तर पर प्रतिस्थापन',
        category_name: 'Transformer Issues',
        language: 'Hindi',
        priority: 'Critical',
        template_text: 'प्राथमिकता निर्देश: संबंधित स्थल पर वितरण ट्रांसफार्मर के क्षतिग्रस्त/जलने अथवा तेल रिसाव की शिकायत प्राप्त हुई है। कृपया अवर अभियंता/तकनीकी टीम को स्थलीय निरीक्षण हेतु निर्देशित कर मानक समयावधि में ट्रांसफार्मर का प्रतिस्थापन/मरम्मत सुनिश्चित कराएं।'
      },
      {
        id: 3,
        title: 'लो वोल्टेज एवं फेज समस्या — स्थलीय जांच व निवारण',
        category_name: 'Voltage Issues',
        language: 'Hindi',
        priority: 'High',
        template_text: 'आवश्यक स्थलीय कार्यवाही: उपभोक्ता द्वारा अत्यधिक लो-वोल्टेज एवं सिंगल फेज आपूर्ति की शिकायत की गई है। कृपया ट्रांसफार्मर टैपिंग, लोड संतुलन एवं न्यूट्रल की तत्काल जांच कर समस्या का स्थायी समाधान कराएं।'
      },
      {
        id: 4,
        title: 'टूटा तार / स्पार्किंग सुरक्षा आपातकाल — तत्काल दुरुस्त करें',
        category_name: 'Safety & Accidents',
        language: 'Hindi',
        priority: 'Critical',
        template_text: 'सुरक्षा आपातकाल: संबंधित स्थल पर जर्जर/टूटे तार अथवा पोल से स्पार्किंग की शिकायत प्राप्त हुई है, जिससे जनहानि का खतरा है। कृपया संबंधित लाइन को तत्काल आइसोलेट कर आपातकालीन गैंग भेजकर युद्धस्तर पर सुरक्षा कार्य पूर्ण कराएं।'
      },
      {
        id: 5,
        title: 'बिलिंग एवं मीटर विवाद — स्थलीय जांच व संशोधित बिल जारी करें',
        category_name: 'Billing Issues',
        language: 'Hindi',
        priority: 'Normal',
        template_text: 'बिलिंग/मीटर स्थलीय सत्यापन: उपभोक्ता द्वारा अत्यधिक बिल/अस्वाभाविक मीटर रीडिंग/मीटर खराब होने की शिकायत दर्ज की गई है। कृपया उपखंडीय अधिकारी द्वारा स्थलीय जांच कराकर नियमानुसार संशोधित बिल जारी कराएं।'
      },
      {
        id: 6,
        title: 'नया संयोजन निर्गमन में विलंब — शीघ्र संयोजन दें',
        category_name: 'New Connection',
        language: 'Hindi',
        priority: 'Normal',
        template_text: 'शीघ्र संयोजन निर्गमन: उपभोक्ता द्वारा झटपट पोर्टल के अंतर्गत नए विद्युत संयोजन/मीटर स्थापना में अनावश्यक विलंब की शिकायत की गई है। कृपया आवेदन की अद्यतन स्थिति जांचकर प्राथमिकता पर संयोजन निर्गत कराएं।'
      },
      {
        id: 7,
        title: 'लाइन रखरखाव एवं पेड़ छंटाई — आवश्यक शटडाउन लेकर कार्य करें',
        category_name: 'Infrastructure / Line Maintenance',
        language: 'Hindi',
        priority: 'Normal',
        template_text: 'लाइन रखरखाव कार्यवाही: वृक्षों की डालियों के एलटी/11 केवी लाइन से स्पर्श होने के कारण बार-बार फॉल्ट/ट्रिपिंग की सूचना है। कृपया आवश्यक शटडाउन लेकर डालियों की छंटाई एवं लाइन दुरुस्तीकरण कार्य कराएं।'
      },
      {
        id: 8,
        title: 'स्थल निरीक्षण एवं आख्या (ATR) — मय फोटोग्राफ्स प्रेषित करें',
        category_name: 'General Grievance',
        language: 'Hindi',
        priority: 'Normal',
        template_text: 'उक्त प्रकरण में स्थलीय निरीक्षण कर उपभोक्ता की शिकायत का त्वरित निस्तारण कराएं तथा कृत कार्यवाही की विस्तृत आख्या (ATR) मय फोटोग्राफ्स यूपीपीसीएल सोशल मीडिया सेल को प्रेषित करें।'
      },

      // --- 2. ENGLISH TEMPLATES ---
      {
        id: 9,
        title: 'Power Outage & Feeder Breakdown (English)',
        category_name: 'Power Supply Failure',
        language: 'English',
        priority: 'Critical',
        template_text: 'Urgent: Consumer reports prolonged power outage / feeder tripping in this area. Kindly depute line staff to inspect substation/feeder and ensure prompt restoration of electricity supply within SLA.'
      },
      {
        id: 10,
        title: 'Transformer Burnt / Replacement (English)',
        category_name: 'Transformer Issues',
        language: 'English',
        priority: 'Critical',
        template_text: 'Priority Action: Damaged / burnt distribution transformer or oil leakage reported at site. Depute junior engineer immediately for spot assessment and execute replacement/repair on war footing.'
      },
      {
        id: 11,
        title: 'Voltage Fluctuation & Phase Fault (English)',
        category_name: 'Voltage Issues',
        language: 'English',
        priority: 'High',
        template_text: 'Field Action Required: Consumer reported abnormal low voltage / single-phasing causing disruption to appliances. Please check distribution transformer tapping, feeder load balance, and rectify neutral issues.'
      },
      {
        id: 12,
        title: 'Public Safety Hazard & Broken Wire (English)',
        category_name: 'Safety & Accidents',
        language: 'English',
        priority: 'Critical',
        template_text: 'Safety Emergency: Dangerous broken/snapped live conductor or pole sparking reported posing severe public danger. Isolate affected section immediately and deploy emergency breakdown gang for rectification.'
      },
      {
        id: 13,
        title: 'Billing Grievance & Meter Check (English)',
        category_name: 'Billing Issues',
        language: 'English',
        priority: 'Normal',
        template_text: 'Meter & Billing Inspection: Consumer disputing excessive bill / stopped meter / reading mismatch. Please arrange prompt site verification by sub-divisional staff, check MRI data if required, and rectify bill.'
      },
      {
        id: 14,
        title: 'New Connection Release Delay (English)',
        category_name: 'New Connection',
        language: 'English',
        priority: 'Normal',
        template_text: 'Expedite Service Release: Consumer grievance regarding delay in meter installation / release of new service line under Jhatpat portal. Check application status and release connection promptly.'
      },
      {
        id: 15,
        title: 'Overhead Line Clearance & Tree Trimming (English)',
        category_name: 'Infrastructure / Line Maintenance',
        language: 'English',
        priority: 'Normal',
        template_text: 'Maintenance Required: Overhead line defect / loose conductor / tree branches touching live lines causing intermittent tripping. Please schedule necessary shutdown and execute maintenance.'
      },
      {
        id: 16,
        title: 'Site Inspection & Action Taken Report (English)',
        category_name: 'General Grievance',
        language: 'English',
        priority: 'Normal',
        template_text: 'Forwarded for spot inspection and necessary grievance redressal. Please communicate the Action Taken Report (ATR) along with site photos to UPPCL Social Media Cell.'
      }
    ]
  },

  init() {
    this.initTheme();
    this.token = localStorage.getItem('uppcl_smc_token');
    const savedUser = localStorage.getItem('uppcl_smc_user');
    if (savedUser) {
      try { 
        this.user = JSON.parse(savedUser);
        if (this.user) {
          if (this.user.role === 'Super Administrator') this.user.role = 'Administrator';
          if (this.user.full_name === 'Super Administrator') this.user.full_name = 'Administrator';
        }
      } catch(e) {}
    }

    this.startClock();
    if (this.token) {
      this.startNotificationPoller();
      this.startSyncPoller();
    }

    if (this.token && this.user) {
      this.loadMasterData().then(() => {
        this.renderApp();
      }).catch(err => {
        console.error('Master data load failed, showing login:', err);
        this.logout();
      });
    } else {
      this.renderLogin();
    }
  },

  getIstDateStr() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    const d = String(ist.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  startClock() {
    setInterval(() => {
      const el = document.getElementById('ist-clock');
      if (el) {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const ist = new Date(utc + (3600000 * 5.5));
        el.innerHTML = `<i class="fa-regular fa-clock"></i> IST: ${ist.toLocaleDateString('en-GB')} ${ist.toLocaleTimeString('en-GB')}`;
      }
    }, 1000);
  },

  startNotificationPoller() {
    if (this._notifPollerTimer) clearInterval(this._notifPollerTimer);
    if (this.token) this.pollNotifications();
    this._notifPollerTimer = setInterval(() => {
      if (this.token) this.pollNotifications();
    }, 30000);
  },

  async pollNotifications() {
    if (!this.token) return;
    try {
      const res = await this.api('/api/notifications');
      this.notifications = res.data || [];
      this.unreadNotifs = res.unread_count || 0;
      const badge = document.getElementById('notif-badge');
      if (badge) {
        if (this.unreadNotifs > 0) {
          badge.style.display = 'inline-flex';
          badge.textContent = this.unreadNotifs > 99 ? '99+' : this.unreadNotifs;
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {}
  },

  startSyncPoller() {
    if (this._syncPollerTimer) clearInterval(this._syncPollerTimer);
    if (this.token) this.pollSyncStatus();
    this._syncPollerTimer = setInterval(() => {
      if (this.token) this.pollSyncStatus();
    }, 20000);
  },

  async pollSyncStatus() {
    if (!this.token) return;
    try {
      const res = await this.api('/api/sync/status');
      this.updateSyncUI(res);
    } catch (e) {}
  },

  updateSyncUI(status) {
    const dot = document.getElementById('sync-pulse-dot');
    const text = document.getElementById('sync-status-text');
    if (!dot || !text || !status) return;

    const rowCount = status.recordCount || status.totalRows || 0;
    if (status.status === 'LIVE' || status.status === 'SYNCED') {
      dot.className = 'sync-pulse-dot live';
      text.textContent = `Sheet: LIVE (${rowCount} rows)`;
    } else if (status.status === 'UPDATING') {
      dot.className = 'sync-pulse-dot updating';
      text.textContent = 'Sheet: Syncing...';
    } else if (status.status === 'SYNCED_CACHE' || status.status === 'OFFLINE_CACHE') {
      dot.className = 'sync-pulse-dot live';
      text.textContent = `Sheet: CACHED (${rowCount} rows)`;
    } else {
      dot.className = 'sync-pulse-dot live';
      text.textContent = `Sheet: ACTIVE (${rowCount} rows)`;
    }

    const sheetLink = document.getElementById('sync-sheet-link');
    if (sheetLink && status.spreadsheetId && status.worksheetGid) {
      sheetLink.href = `https://docs.google.com/spreadsheets/d/${status.spreadsheetId}/edit?gid=${status.worksheetGid}#gid=${status.worksheetGid}`;
    }
  },

  async triggerSheetSync() {
    const btn = document.getElementById('btn-sync-sheet');
    const icon = document.getElementById('sync-btn-icon');
    if (icon) icon.classList.add('fa-spin');
    if (btn) btn.disabled = true;

    try {
      const res = await this.api('/api/sync/refresh', { method: 'POST' });
      this.pollSyncStatus();
      if (this.currentPage === 'dashboard') {
        this.reloadDashboard();
      } else if (this.currentPage === 'register') {
        this.loadRegisterData();
      } else if (this.currentPage === 'reports') {
        this.loadReportsData();
      }
      alert(`Google Sheets Sync Succeeded!\n\nStatus: ${res.status || 'LIVE'}\nTotal Synced: ${res.syncedCount || 'Updated'}\nAuthoritative Database: Twitter Complaint List`);
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setTimeout(() => {
        if (icon) icon.classList.remove('fa-spin');
        if (btn) btn.disabled = false;
      }, 1000);
    }
  },

  async handleSheetFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await this.api('/api/sync/upload-sheet', {
        method: 'POST',
        body: formData
      });
      alert(`Google Sheet Import Successful!\n\nSynchronized: ${res.syncedCount || 'Updated'} rows from "${file.name}"\nAuthoritative Source: Google Sheet 'Twitter Complaint List'`);
      this.pollSyncStatus();
      if (this.currentPage === 'dashboard') {
        this.reloadDashboard();
      } else if (this.currentPage === 'register') {
        this.loadRegisterData();
      } else if (this.currentPage === 'reports') {
        this.loadReportsData();
      }
    } catch (err) {
      alert(`Sheet Import Failed: ${err.message}`);
    } finally {
      event.target.value = '';
    }
  },

  initTheme() {
    try {
      let savedTheme = localStorage.getItem('uppcl_smc_theme_v3');
      if (!savedTheme) {
        // Default to light theme
        savedTheme = 'light';
        localStorage.setItem('uppcl_smc_theme_v3', 'light');
        localStorage.setItem('uppcl_smc_theme', 'light');
      }
      if (!['light', 'dark', 'midnight'].includes(savedTheme)) {
        savedTheme = 'light';
      }
      this.setTheme(savedTheme, false);
    } catch(e) {
      this.setTheme('light', false);
    }
  },

  setTheme(theme, updateCharts = true) {
    if (!['light', 'dark', 'midnight'].includes(theme)) {
      theme = 'light';
    }
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('uppcl_smc_theme', theme);
      localStorage.setItem('uppcl_smc_theme_v3', theme);
    } catch(e) {}

    // Update Chart.js defaults if library loaded
    if (window.Chart) {
      if (theme === 'midnight') {
        Chart.defaults.color = '#cbd5e1';
        Chart.defaults.borderColor = '#1e293b';
      } else if (theme === 'dark') {
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.borderColor = '#24354f';
      } else {
        Chart.defaults.color = '#6b7280';
        Chart.defaults.borderColor = '#edf2f7';
      }
    }

    // Update all theme buttons in the UI
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      let icon = 'fa-cloud';
      let color = '#94a3b8';
      let label = 'Midnight';
      let title = 'Theme: Midnight (Click for Light Mode)';

      if (theme === 'light') {
        icon = 'fa-sun';
        color = '#f59e0b';
        label = 'Light Mode';
        title = 'Theme: Light Mode (Click for Dark Mode)';
      } else if (theme === 'dark') {
        icon = 'fa-moon';
        color = '#6366f1';
        label = 'Dark Mode';
        title = 'Theme: Dark Mode (Click for Midnight Theme)';
      } else {
        icon = 'fa-cloud';
        color = '#94a3b8';
        label = 'Midnight';
        title = 'Theme: Midnight (Click for Light Mode)';
      }

      btn.innerHTML = `<i class="fa-solid ${icon}" style="color: ${color};"></i> <span class="theme-label">${label}</span>`;
      btn.setAttribute('title', title);
      btn.setAttribute('aria-label', title);
    });

    // Re-render dashboard charts if currently viewing dashboard
    if (updateCharts && this.currentPage === 'dashboard') {
      const container = document.getElementById('page-content');
      if (container && Object.keys(this.charts).length > 0) {
        this.renderDashboard(container);
      }
    }
  },

  toggleTheme() {
    let nextTheme = 'light';
    if (this.theme === 'midnight') nextTheme = 'light';
    else if (this.theme === 'light') nextTheme = 'dark';
    else if (this.theme === 'dark') nextTheme = 'midnight';
    else nextTheme = 'midnight';
    this.setTheme(nextTheme, true);
  },

  async api(endpoint, options = {}) {
    const headers = options.headers || {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (response.status === 401) {
      if (this.token) {
        this.logout();
      }
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  },

  async loadMasterData() {
    try {
      const [cats, discs, xh, nodals, tpls, fwdTpls] = await Promise.all([
        this.api('/api/master/categories'),
        this.api('/api/master/discoms'),
        this.api('/api/master/x-hierarchy'),
        this.api('/api/master/nodal-officers'),
        this.api('/api/templates').catch(() => ({ data: [] })),
        this.api('/api/master/forwarding-templates').catch(() => ({ data: [] }))
      ]);
      this.cachedMaster.categories = cats.data || [];
      this.cachedMaster.discoms = discs.data || [];
      this.cachedMaster.xHierarchy = xh.data || [];
      this.cachedMaster.nodalOfficers = nodals.data || [];
      this.cachedMaster.replyTemplates = (tpls && tpls.data) || [];
      if (fwdTpls && fwdTpls.data && fwdTpls.data.length > 0) {
        this.cachedMaster.forwardingTemplates = fwdTpls.data;
      }
    } catch (e) {
      console.warn('Error loading master data:', e.message);
    }
  },

  login(token, user) {
    this.token = token;
    if (user) {
      if (user.role === 'Super Administrator') user.role = 'Administrator';
      if (user.full_name === 'Super Administrator') user.full_name = 'Administrator';
    }
    this.user = user;
    localStorage.setItem('uppcl_smc_token', token);
    localStorage.setItem('uppcl_smc_user', JSON.stringify(user));
    this.startNotificationPoller();
    this.startSyncPoller();
    this.loadMasterData().then(() => {
      this.renderApp();
    });
  },

  logout() {
    const wasLoggedIn = !!this.token;
    this.token = null;
    this.user = null;
    localStorage.removeItem('uppcl_smc_token');
    localStorage.removeItem('uppcl_smc_user');
    if (this._syncPollerTimer) {
      clearInterval(this._syncPollerTimer);
      this._syncPollerTimer = null;
    }
    if (this._notifPollerTimer) {
      clearInterval(this._notifPollerTimer);
      this._notifPollerTimer = null;
    }
    if (this.currentPage !== 'login' || wasLoggedIn) {
      this.currentPage = 'login';
      this.renderLogin();
    }
  },

  navigate(page, params = {}) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Destroy existing charts to avoid memory leaks
    Object.values(this.charts).forEach(c => c && c.destroy && c.destroy());
    this.charts = {};

    const container = document.getElementById('page-content');
    if (!container) return;

    if (page === 'dashboard') {
      this.renderDashboard(container);
    } else if (page === 'register') {
      if (params.status !== undefined) this.currentFilters.status = params.status;
      if (params.overdue !== undefined) this.currentFilters.overdue = params.overdue;
      if (params.discom !== undefined) this.currentFilters.discom = params.discom;
      if (params.district !== undefined) this.currentFilters.district = params.district;
      if (params.category !== undefined) this.currentFilters.category = params.category;
      if (params.assigned_handle !== undefined) this.currentFilters.assigned_handle = params.assigned_handle;
      if (params.picked_status !== undefined) this.currentFilters.picked_status = params.picked_status;
      if (params.reply_within_30_min !== undefined) this.currentFilters.reply_within_30_min = params.reply_within_30_min;
      if (params.shift !== undefined) this.currentFilters.shift = params.shift;
      if (params.data_quality !== undefined) this.currentFilters.data_quality = params.data_quality;
      if (params.from_date !== undefined) this.currentFilters.from_date = params.from_date;
      if (params.to_date !== undefined) this.currentFilters.to_date = params.to_date;
      if (params.search !== undefined) this.currentFilters.search = params.search;
      this.currentFilters.page = 1;
      this.renderComplaintRegister(container);
    } else if (page === 'add-complaint') {
      this.renderAddComplaint(container);
    } else if (page === 'pending-overdue') {
      this.currentFilters.status = 'overdue';
      this.renderComplaintRegister(container, 'Overdue & Breached SLA Register');
    } else if (page === 'discom-responses') {
      this.currentFilters.status = 'verification_pending';
      this.renderComplaintRegister(container, 'DISCOM Action Taken (Verification Due)');
    } else if (page === 'closure-verification') {
      this.currentFilters.status = 'verification_pending';
      this.renderComplaintRegister(container, 'Closure Verification Queue');
    } else if (page === 'draft-review') {
      this.currentFilters.status = 'draft_review';
      this.renderComplaintRegister(container, 'X Response Draft & Review Queue');
    } else if (page === 'unassigned-queue') {
      this.currentFilters.status = 'needs_review';
      this.renderComplaintRegister(container, 'Unassigned / Needs District Review');
    } else if (page === 'templates') {
      this.renderTemplates(container);
    } else if (page === 'system-health') {
      this.renderSystemHealth(container);
    } else if (page === 'internal-tickets') {
      this.renderInternalTickets(container);
    } else if (page === 'reports') {
      if (params.tab) this.currentReportTab = params.tab;
      this.renderReports(container);
    } else if (page === 'x-hierarchy') {
      this.renderXHierarchy(container);
    } else if (page === 'nodal-officers') {
      this.renderNodalOfficers(container);
    } else if (page === 'users') {
      this.renderUsers(container);
    } else if (page === 'audit-logs') {
      this.renderAuditLogs(container);
    } else if (page === 'settings') {
      this.renderSettings(container);
    }
  },

  // -----------------------------------------------------------
  // RENDER MAIN APPLICATION SHELL
  // -----------------------------------------------------------
  renderApp() {
    const root = document.getElementById('app');
    const isSuperAdmin = ['Administrator', 'Admin', 'Super Administrator'].includes(this.user.role);
    const isOperator = ['Administrator', 'Admin', 'Super Administrator', 'Social Media Cell Operator', 'Complaint Handler'].includes(this.user.role);
    const isSupervisor = ['Administrator', 'Admin', 'Super Administrator', 'Supervisor / Management'].includes(this.user.role);
    const isDiscomNodal = this.user.role === 'DISCOM Nodal Officer';

    root.innerHTML = `
      <div class="app-container">
        <!-- Sidebar Navigation -->
        <aside class="sidebar">
          <div class="sidebar-header">
            <div class="sidebar-logo"><i class="fa-solid fa-bolt"></i></div>
            <div class="sidebar-title">
              <h1>UPPCL SMC</h1>
              <p>Social Media Grievance</p>
            </div>
          </div>

          <div class="sidebar-nav">
            <div class="nav-section-title">Operations</div>
            <a class="nav-item active" data-page="dashboard" onclick="App.navigate('dashboard')">
              <i class="fa-solid fa-chart-line"></i> Dashboard
            </a>
            <a class="nav-item" data-page="register" onclick="App.navigate('register')">
              <i class="fa-solid fa-table-list"></i> Complaint Register
            </a>

            <div class="nav-section-title">Intelligence & Masters</div>
            <a class="nav-item" data-page="reports" onclick="App.navigate('reports')">
              <i class="fa-solid fa-file-invoice"></i> Reports & Exports
            </a>
            <a class="nav-item" data-page="templates" onclick="App.navigate('templates')">
              <i class="fa-solid fa-message"></i> Reply Templates
            </a>
            <a class="nav-item" data-page="x-hierarchy" onclick="App.navigate('x-hierarchy')">
              <i class="fa-brands fa-x-twitter"></i> X Hierarchy
            </a>
            <a class="nav-item" data-page="nodal-officers" onclick="App.navigate('nodal-officers')">
              <i class="fa-solid fa-address-book"></i> Nodal Officers
            </a>

            ${isSupervisor || isSuperAdmin ? `
            <div class="nav-section-title">Governance & Administration</div>
            <a class="nav-item" data-page="system-health" onclick="App.navigate('system-health')">
              <i class="fa-solid fa-heart-pulse"></i> System Health & Monitor
            </a>
            <a class="nav-item" data-page="audit-logs" onclick="App.navigate('audit-logs')">
              <i class="fa-solid fa-shield-halved"></i> Audit Trail
            </a>` : ''}

            ${isSuperAdmin ? `
            <a class="nav-item" data-page="settings" onclick="App.navigate('settings')">
              <i class="fa-solid fa-sliders"></i> System Settings
            </a>` : ''}
          </div>
        </aside>

        <!-- Main Body -->
        <div class="main-content">
          <!-- Top Bar -->
          <header class="top-header">
            <div class="header-left">
              <div id="sync-status-indicator" class="sync-status-pill" title="Authoritative Source: Google Sheets (Twitter Complaint List)">
                <span class="sync-pulse-dot live" id="sync-pulse-dot"></span>
                <span id="sync-status-text">Sheet: LIVE</span>
                <a id="sync-sheet-link" href="https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/edit?gid=598922870#gid=598922870" target="_blank" rel="noopener noreferrer" title="Open Google Sheet (Twitter Complaint List) in new tab">
                  <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px; margin-left: 2px;"></i>
                </a>
              </div>
              <div id="ist-clock" class="clock-display">
                <i class="fa-regular fa-clock"></i> IST: Loading...
              </div>
            </div>

            <div class="header-right">
              <button class="btn btn-secondary btn-sm" id="btn-sync-sheet" onclick="App.triggerSheetSync()" title="Synchronize directly with Google Sheet">
                <i class="fa-solid fa-arrows-rotate" id="sync-btn-icon"></i> Sync Sheet
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-import-sheet" onclick="document.getElementById('sheet-file-input').click()" title="Import downloaded Google Sheet CSV or Excel file">
                <i class="fa-solid fa-file-arrow-up"></i> Import Sheet
              </button>
              <input type="file" id="sheet-file-input" accept=".csv,.xlsx" style="display:none;" onchange="App.handleSheetFileUpload(event)">
              ${isOperator || isSupervisor ? `
              <button class="btn btn-accent btn-sm" onclick="App.navigate('add-complaint')">
                <i class="fa-solid fa-plus"></i> New Complaint
              </button>` : ''}

              <!-- Notification Bell Button -->
              <button class="btn btn-secondary btn-sm" id="btn-notifications" onclick="App.toggleNotificationModal()" title="Notifications" style="position: relative;">
                <i class="fa-solid fa-bell"></i>
                <span id="notif-badge" class="badge-notif" style="display: none;">0</span>
              </button>

              <!-- Report System Issue Button -->
              <button class="btn btn-secondary btn-sm" onclick="App.openInternalTicketModal()" title="Report Issue with Dashboard">
                <i class="fa-solid fa-circle-question"></i> Help
              </button>

              <!-- Theme Toggle Button -->
              <button class="theme-toggle-btn" onclick="App.toggleTheme()" title="${this.theme === 'midnight' ? 'Theme: Midnight (Click for Light Mode)' : (this.theme === 'light' ? 'Theme: Light Mode (Click for Dark Mode)' : 'Theme: Dark Mode (Click for Midnight Theme')}" aria-label="Toggle Theme">
                <i class="fa-solid ${this.theme === 'midnight' ? 'fa-cloud' : (this.theme === 'light' ? 'fa-sun' : 'fa-moon')}" style="${this.theme === 'midnight' ? 'color: #94a3b8;' : (this.theme === 'light' ? 'color: #f59e0b;' : 'color: #6366f1;')}"></i>
                <span class="theme-label">${this.theme === 'midnight' ? 'Midnight' : (this.theme === 'light' ? 'Light Mode' : 'Dark Mode')}</span>
              </button>

              <div class="user-pill">
                <div class="user-avatar">${this.user.full_name.charAt(0).toUpperCase()}</div>
                <div class="user-info">
                  <span class="user-name">${this.user.full_name}</span>
                  <span class="user-role-discom">${this.user.role} ${this.user.discom_name ? `• ${this.user.discom_name}` : ''}</span>
                </div>
                <button class="btn-logout" title="Sign Out" onclick="App.logout()">
                  <i class="fa-solid fa-right-from-bracket"></i>
                </button>
              </div>
            </div>
          </header>

          <!-- Dynamic Page Content -->
          <main id="page-content" class="page-container"></main>
        </div>
      </div>

      <!-- Action Modal Container -->
      <div id="modal-root"></div>
    `;

    this.navigate('dashboard');
  },

  // -----------------------------------------------------------
  // DASHBOARD VIEW
  // -----------------------------------------------------------
  async renderDashboard(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Centralized Social Media Grievance Dashboard</h2>
          <p>24×7 Monitoring, DISCOM Routing, SLA Tracking, and Redressal Intelligence</p>
        </div>
        <div class="page-actions">
          <select id="dash-filter-discom" class="form-control" onchange="App.reloadDashboard()" style="min-width: 140px;">
            <option value="All">All DISCOMs</option>
            <option value="PUVVNL">PuVVNL (Purvanchal)</option>
            <option value="MVVNL">MVVNL (Madhyanchal)</option>
            <option value="DVVNL">DVVNL (Dakshinanchal)</option>
            <option value="PVVNL">PVVNL (Pashchimanchal)</option>
            <option value="KESCo">KESCo (Kanpur)</option>
          </select>
          <select id="dash-filter-range" class="form-control" onchange="App.reloadDashboard()">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="App.reloadDashboard()">
            <i class="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      <!-- Real-Time KPI Cards Grid -->
      <div id="dash-kpi-grid" class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Loading KPIs...</div></div>
      </div>

      <!-- Live Related Complaints Table Filtered by KPI Cards -->
      <div id="dash-table-wrapper" class="card-table" style="margin-bottom: 24px;">
        <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: var(--bg-card); border-radius: 8px 8px 0 0;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 id="dash-table-title" style="margin: 0; font-size: 15px; font-weight: 700; color: var(--primary-dark); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-table-list"></i> <span>Complaints: Total Received</span>
              </h3>
              <span id="dash-table-count-badge" class="badge-status badge-New" style="font-size: 11px; padding: 2px 8px; font-weight: 700;">Loading...</span>
            </div>
            <p id="dash-table-subtitle" style="margin: 3px 0 0 0; font-size: 11px; color: var(--text-muted);">
              Total no. of complaints received till now (Showing live authoritative records)
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="position: relative;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 9px; top: 9px; color: var(--text-light); font-size: 11px;"></i>
              <input type="text" id="dash-table-search" class="form-control" placeholder="Quick search..." style="width: 200px; padding-left: 26px; height: 32px; font-size: 12px;" oninput="App.debounceDashTableSearch()">
            </div>
            <button class="btn btn-secondary btn-sm" onclick="App.openActiveCardInRegister()" title="Open filtered list in full Complaint Register view" style="height: 32px;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Full Register
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Complaint # / Post</th>
                <th>Received At (IST)</th>
                <th>Consumer</th>
                <th>Grievance Summary</th>
                <th>DISCOM / Dist.</th>
                <th title="Picked: YES — If UPPCLLKO replied in that post | Picked: NO — If UPPCLLKO not replied in that post">Picked Status</th>
                <th title="Complaints: 30-Min First Reply — Time difference between post time and UPPCLLKO replied time <30Mins">30-Min First Reply</th>
                <th title="Status — Assigned to DISCOM only when Any discom got tagged by UPPCLLKO">Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="dash-table-tbody">
              <tr><td colspan="9" style="text-align: center; padding: 25px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading related complaints...</td></tr>
            </tbody>
          </table>
        </div>

        <div id="dash-table-pagination" style="padding: 10px 18px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted); background: var(--bg-card); border-radius: 0 0 8px 8px;">
        </div>
      </div>

      <!-- Visual Charts Grid (6 Core Analytics Charts) -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-chart-line"></i> Grievance Inflow Trend (Daily)</div>
          </div>
          <div class="chart-body"><canvas id="chart-trend"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-brands fa-x-twitter"></i> Official Monitored Handles List</div>
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-satellite-dish" style="color: #10b981;"></i> 7 Monitored Handles</span>
          </div>
          <div class="chart-body" id="official-monitored-handles-container" style="overflow-y: auto; display: flex; flex-direction: column; gap: 5px; height: 260px; padding: 2px;">
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-layer-group"></i> Grievance Distribution by Category</div>
          </div>
          <div class="chart-body"><canvas id="chart-categories"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-map-location-dot"></i> Top 10 High Grievance</div>
          </div>
          <div class="chart-body"><canvas id="chart-districts"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-business-time"></i> Grievance Volume by Shift</div>
          </div>
          <div class="chart-body"><canvas id="chart-shifts"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-filter"></i> Complaints Picked Status (Actionable vs Filtered)</div>
          </div>
          <div class="chart-body"><canvas id="chart-picked"></canvas></div>
        </div>
      </div>
    `;

    this.reloadDashboard();
  },

  async reloadDashboard() {
    const discomVal = document.getElementById('dash-filter-discom') ? document.getElementById('dash-filter-discom').value : 'All';
    const rangeVal = document.getElementById('dash-filter-range') ? document.getElementById('dash-filter-range').value : 'all';

    let fromDate = '';
    const now = new Date();
    if (rangeVal === 'today') {
      fromDate = now.toISOString().substring(0, 10);
    } else if (rangeVal === '7d') {
      const d = new Date(now.getTime() - 7 * 86400000);
      fromDate = d.toISOString().substring(0, 10);
    } else if (rangeVal === '30d') {
      const d = new Date(now.getTime() - 30 * 86400000);
      fromDate = d.toISOString().substring(0, 10);
    }

    const queryParams = new URLSearchParams();
    if (discomVal !== 'All') queryParams.append('discom', discomVal);
    if (fromDate) queryParams.append('from_date', fromDate);

    try {
      const [kpis, charts] = await Promise.all([
        this.api(`/api/dashboard/kpis?${queryParams.toString()}`),
        this.api(`/api/dashboard/charts?${queryParams.toString()}`)
      ]);

      this.renderKPIs(kpis);
      this.renderCharts(charts);
      this.loadDashboardComplaints();
    } catch (e) {
      console.error('Error reloading dashboard:', e);
    }
  },

  renderKPIs(k) {
    const container = document.getElementById('dash-kpi-grid');
    if (!container) return;

    const todayDate = this.getIstDateStr ? this.getIstDateStr() : new Date().toISOString().substring(0, 10);
    const activeKpi = this.dashFilter.kpi || 'total';

    container.innerHTML = `
      <div class="kpi-card kpi-total ${activeKpi === 'total' ? 'active-card' : ''}" data-kpi="total" onclick="App.selectDashKPI('total')" title="Total no. of complaints received till now">
        ${activeKpi === 'total' ? '<span class="kpi-active-pill"><i class="fa-solid fa-check"></i> Active</span>' : ''}
        <div class="kpi-label">Total Received</div>
        <div class="kpi-value">${k.total}</div>
        <div class="kpi-sub">Total no. of complaints received till now</div>
      </div>

      <div class="kpi-card kpi-today ${activeKpi === 'today' ? 'active-card' : ''}" data-kpi="today" onclick="App.selectDashKPI('today')" title="Total no. of complaints received today's date">
        ${activeKpi === 'today' ? '<span class="kpi-active-pill"><i class="fa-solid fa-check"></i> Active</span>' : ''}
        <div class="kpi-label">Received Today</div>
        <div class="kpi-value">${k.receivedToday}</div>
        <div class="kpi-sub">Total no. of complaints received today's date</div>
      </div>

      <div class="kpi-card ${activeKpi === 'picked_yes' ? 'active-card' : ''}" data-kpi="picked_yes" style="border-top: 3px solid #059669;" onclick="App.selectDashKPI('picked_yes')" title="If UPPCLLKO replied in that post">
        ${activeKpi === 'picked_yes' ? '<span class="kpi-active-pill" style="color: #059669; background: rgba(5, 150, 105, 0.12);"><i class="fa-solid fa-check"></i> Active</span>' : ''}
        <div class="kpi-label" style="color: #059669;">Picked: YES</div>
        <div class="kpi-value" style="color: #059669;">${k.pickedYes || 0}</div>
        <div class="kpi-sub">If UPPCLLKO replied in that post</div>
      </div>

      <div class="kpi-card ${activeKpi === 'picked_no' ? 'active-card' : ''}" data-kpi="picked_no" style="border-top: 3px solid #64748b;" onclick="App.selectDashKPI('picked_no')" title="If UPPCLLKO not replied in that post">
        ${activeKpi === 'picked_no' ? '<span class="kpi-active-pill" style="color: #64748b; background: rgba(100, 116, 139, 0.15);"><i class="fa-solid fa-check"></i> Active</span>' : ''}
        <div class="kpi-label" style="color: #64748b;">Picked: NO</div>
        <div class="kpi-value" style="color: #64748b;">${k.pickedNo || 0}</div>
        <div class="kpi-sub">If UPPCLLKO not replied in that post</div>
      </div>

      <div class="kpi-card ${activeKpi === 'appreciation' ? 'active-card' : ''}" data-kpi="appreciation" style="border-top: 3px solid #d97706;" onclick="App.selectDashKPI('appreciation')" title="Consumer appreciation & gratitude posts">
        ${activeKpi === 'appreciation' ? '<span class="kpi-active-pill" style="color: #d97706; background: rgba(217, 119, 6, 0.15);"><i class="fa-solid fa-check"></i> Active</span>' : ''}
        <div class="kpi-label" style="color: #d97706;">Appreciation</div>
        <div class="kpi-value" style="color: #d97706;">${k.pickedAppreciation || 0}</div>
        <div class="kpi-sub">Consumer appreciation & gratitude posts</div>
      </div>

      <div class="kpi-card ${activeKpi === 'reply_30' ? 'active-card' : ''}" data-kpi="reply_30" style="border-top: 3px solid #0284c7;" onclick="App.selectDashKPI('reply_30')" title="Time difference between post time and UPPCLLKO replied time < 30 Mins (${k.replyWithin30MinCount || 0} of ${k.total || 0} posts)">
        ${activeKpi === 'reply_30' ? '<span class="kpi-active-pill" style="color: #0284c7; background: rgba(2, 132, 199, 0.15);"><i class="fa-solid fa-check"></i> Active</span>' : ''}
        <div class="kpi-label" style="color: #0284c7;">30-Min First Reply</div>
        <div class="kpi-value" style="color: #0284c7;">${k.replyWithin30MinRate || 0}%</div>
        <div class="kpi-sub">Time difference between post time and UPPCLLKO replied time &lt;30Mins</div>
      </div>

      <div class="kpi-card kpi-followup ${activeKpi === 'followup' ? 'active-card' : ''}" data-kpi="followup" onclick="App.selectDashKPI('followup')" title="If Discom/division replies after getting Tagged on reply from UPPCLLKO">
        ${activeKpi === 'followup' ? '<span class="kpi-active-pill"><i class="fa-solid fa-check"></i> Active</span>' : ''}
        <div class="kpi-label">DISCOM Follow Up</div>
        <div class="kpi-value">${k.followup}</div>
        <div class="kpi-sub">If Discom/division replies after getting Tagged on reply from UPPCLLKO</div>
      </div>
    `;
  },

  selectDashKPI(kpiKey) {
    this.dashFilter.kpi = kpiKey;
    this.dashFilter.page = 1;
    this.dashFilter.search = '';
    const searchInput = document.getElementById('dash-table-search');
    if (searchInput) searchInput.value = '';

    // Update active highlight classes and active pills on cards
    const cards = document.querySelectorAll('#dash-kpi-grid .kpi-card');
    cards.forEach(card => {
      const isTarget = card.getAttribute('data-kpi') === kpiKey;
      card.classList.toggle('active-card', isTarget);
      const existingPill = card.querySelector('.kpi-active-pill');
      if (existingPill) existingPill.remove();
      if (isTarget) {
        const pill = document.createElement('span');
        pill.className = 'kpi-active-pill';
        pill.innerHTML = '<i class="fa-solid fa-check"></i> Active';
        card.appendChild(pill);
      }
    });

    this.loadDashboardComplaints();

    const tableEl = document.getElementById('dash-table-wrapper');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  debounceDashTableSearch() {
    clearTimeout(this._dashSearchTimer);
    this._dashSearchTimer = setTimeout(() => {
      const input = document.getElementById('dash-table-search');
      this.dashFilter.search = input ? input.value : '';
      this.dashFilter.page = 1;
      this.loadDashboardComplaints();
    }, 250);
  },

  changeDashTablePage(newPage) {
    this.dashFilter.page = newPage;
    this.loadDashboardComplaints();
    const tableEl = document.getElementById('dash-table-wrapper');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  openActiveCardInRegister() {
    const kpi = this.dashFilter.kpi || 'total';
    const discomVal = document.getElementById('dash-filter-discom') ? document.getElementById('dash-filter-discom').value : 'All';
    const todayDate = this.getIstDateStr ? this.getIstDateStr() : new Date().toISOString().substring(0, 10);

    const params = {};
    if (discomVal && discomVal !== 'All') params.discom = discomVal;
    if (this.dashFilter.search) params.search = this.dashFilter.search;

    if (kpi === 'total') {
      params.status = 'All';
    } else if (kpi === 'today') {
      params.from_date = todayDate;
      params.to_date = todayDate;
    } else if (kpi === 'picked_yes') {
      params.picked_status = 'YES';
    } else if (kpi === 'picked_no') {
      params.picked_status = 'NO';
    } else if (kpi === 'appreciation') {
      params.picked_status = 'APPRECIATION';
    } else if (kpi === 'reply_30') {
      params.reply_within_30_min = 'YES';
    } else if (kpi === 'followup') {
      params.status = 'DISCOM Follow Up';
    }

    this.navigate('register', params);
  },

  async loadDashboardComplaints() {
    const tbody = document.getElementById('dash-table-tbody');
    const pdiv = document.getElementById('dash-table-pagination');
    const titleEl = document.getElementById('dash-table-title');
    const subEl = document.getElementById('dash-table-subtitle');
    const countBadge = document.getElementById('dash-table-count-badge');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 25px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading complaints...</td></tr>`;

    const kpi = this.dashFilter.kpi || 'total';
    const discomVal = document.getElementById('dash-filter-discom') ? document.getElementById('dash-filter-discom').value : 'All';
    const todayDate = this.getIstDateStr ? this.getIstDateStr() : new Date().toISOString().substring(0, 10);

    const q = new URLSearchParams();
    q.append('page', this.dashFilter.page || 1);
    q.append('limit', this.dashFilter.limit || 15);
    q.append('sort_by', 'received_at');
    q.append('sort_order', 'DESC');

    if (discomVal && discomVal !== 'All') {
      q.append('discom', discomVal);
    }
    if (this.dashFilter.search && this.dashFilter.search.trim()) {
      q.append('search', this.dashFilter.search.trim());
    }

    let titleText = 'Total Received';
    let subText = 'Total no. of complaints received till now';
    let iconClass = 'fa-solid fa-inbox';

    if (kpi === 'today') {
      q.append('from_date', todayDate);
      q.append('to_date', todayDate);
      titleText = 'Received Today';
      subText = `Total no. of complaints received today's date (${todayDate})`;
      iconClass = 'fa-solid fa-calendar-day';
    } else if (kpi === 'picked_yes') {
      q.append('picked_status', 'YES');
      titleText = 'Picked: YES';
      subText = 'If UPPCLLKO replied in that post';
      iconClass = 'fa-solid fa-circle-check';
    } else if (kpi === 'picked_no') {
      q.append('picked_status', 'NO');
      titleText = 'Picked: NO';
      subText = 'If UPPCLLKO not replied in that post';
      iconClass = 'fa-solid fa-circle-xmark';
    } else if (kpi === 'appreciation') {
      q.append('picked_status', 'APPRECIATION');
      titleText = 'Appreciation';
      subText = 'Consumer appreciation & gratitude posts';
      iconClass = 'fa-solid fa-heart';
    } else if (kpi === 'reply_30') {
      q.append('reply_within_30_min', 'YES');
      titleText = '30-Min First Reply';
      subText = 'Time difference between post time and UPPCLLKO replied time <30Mins';
      iconClass = 'fa-solid fa-stopwatch';
    } else if (kpi === 'followup') {
      q.append('status', 'DISCOM Follow Up');
      titleText = 'DISCOM Follow Up';
      subText = 'If Discom/division replies after getting Tagged on reply from UPPCLLKO';
      iconClass = 'fa-solid fa-arrows-split-up-and-left';
    }

    if (titleEl) titleEl.innerHTML = `<i class="${iconClass}"></i> <span>Complaints: ${titleText}</span>`;
    if (subEl) subEl.textContent = subText;

    try {
      const res = await this.api(`/api/complaints?${q.toString()}`);
      const data = res.data || [];
      const pg = res.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 };

      if (countBadge) {
        countBadge.textContent = `${pg.total} Complaints`;
        countBadge.className = 'badge-status badge-New';
      }

      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 35px; color: var(--text-muted);">No complaints found for <b>${titleText}</b>.</td></tr>`;
        if (pdiv) pdiv.innerHTML = '';
        return;
      }

      tbody.innerHTML = data.map(c => {
        const isDiscomTagged = c.discom_name && ['PVVNL', 'PUVVNL', 'MVVNL', 'DVVNL', 'KESCO'].includes(c.discom_name.toUpperCase());
        const isAppreciation = c.picked_status === 'APPRECIATION' || c.current_status === 'Appreciation' || c.category_name === 'APPRECIATION';
        // Permanent recognition of verified UPPCLLKO reply
        const hasUppclReplied = Boolean(
          c.uppcl_replied === 1 ||
          c.uppcl_replied === '1' ||
          c.reply_within_30_min === 'YES' ||
          Boolean(c.published_reply_id) ||
          (c.reply_evidence && c.reply_evidence.length > 0)
        );
        // Picked = Existing_Valid_Pickup_Event OR UPPCLLKO_Replied
        const isPicked = !isAppreciation && (hasUppclReplied || c.picked_status === 'YES');

        let displayStatus = c.current_status;
        let statusSub = '';

        const taggedHandle = c.discom_tagged_in_reply || (isDiscomTagged ? ('@' + c.discom_name.toUpperCase() + 'HQ') : null);

        if (displayStatus === 'Assigned to DISCOM') {
          if (taggedHandle) {
            statusSub = `<div style="font-size: 10px; color: var(--primary); font-weight: 600; margin-top: 2px;" title="Assigned to DISCOM — Tagged to ${taggedHandle}"><i class="fa-brands fa-x-twitter"></i> Tagged ${taggedHandle}</div>`;
          } else {
            statusSub = `<div style="font-size: 10px; color: var(--primary); font-weight: 600; margin-top: 2px;" title="Assigned to DISCOM"><i class="fa-solid fa-share-nodes"></i> Assigned</div>`;
          }
        } else if (displayStatus === 'DISCOM Follow Up') {
          statusSub = `<div style="font-size: 10px; color: #4338ca; font-weight: 500; margin-top: 2px;" title="DISCOM or Division responded to complaint"><i class="fa-solid fa-reply"></i> DISCOM Replied</div>`;
        } else if (displayStatus === 'Appreciation') {
          statusSub = `<div style="font-size: 10px; color: #d97706; font-weight: 500; margin-top: 2px;" title="Consumer appreciation & gratitude posts"><i class="fa-solid fa-heart"></i> Gratitude</div>`;
        } else if (displayStatus === 'New') {
          statusSub = `<div style="font-size: 10px; color: var(--text-muted); font-weight: 500; margin-top: 2px;">${!hasUppclReplied ? 'Awaiting UPPCLLKO Reply' : 'Pending Assignment'}</div>`;
        }

        const statusBadgeClass = `badge-${(displayStatus || '').replace(/[\s—/]+/g, '-')}`;

        let pickedCell = '<span style="color: var(--text-light); font-size: 11px;">-</span>';
        if (isAppreciation) {
          pickedCell = `
            <div style="font-weight: 700; font-size: 11px;">
              <span class="badge-picked appreciation" title="Consumer appreciation & gratitude posts">
                <i class="fa-solid fa-heart" style="font-size: 10px;"></i> Appreciation
              </span>
            </div>
            <div style="font-size: 10px; color: #d97706; margin-top: 2px; font-weight: 600;">
              Gratitude Post
            </div>
          `;
        } else if (hasUppclReplied) {
          pickedCell = `
            <div style="font-weight: 700; font-size: 11px;">
              <span class="badge-picked yes" title="Verified UPPCLLKO Reply on record: Picked: YES">
                <i class="fa-solid fa-circle-check" style="font-size: 10px;"></i> Picked: YES
              </span>
            </div>
            <div style="font-size: 10px; color: #059669; margin-top: 2px; font-weight: 600;" title="Verified genuine reply authored by UPPCLLKO">
              <i class="fa-solid fa-reply"></i> UPPCLLKO Replied
            </div>
          `;
        } else if (isPicked) {
          pickedCell = `
            <div style="font-weight: 700; font-size: 11px;">
              <span class="badge-picked yes" style="background: rgba(3, 105, 161, 0.12); color: #0284c7; border: 1px solid rgba(3, 105, 161, 0.25);" title="Picked by cell / operator, awaiting reply">
                <i class="fa-solid fa-circle-check" style="font-size: 10px;"></i> Picked: YES
              </span>
            </div>
            <div style="font-size: 10px; color: #0284c7; margin-top: 2px; font-weight: 600;" title="Awaiting UPPCLLKO reply">
              <i class="fa-solid fa-clock"></i> Awaiting Reply
            </div>
          `;
        } else {
          pickedCell = `
            <div style="font-weight: 700; font-size: 11px;">
              <span class="badge-picked no" title="Complaints: Picked: NO — UPPCLLKO not replied in that post">
                <i class="fa-solid fa-circle-xmark" style="font-size: 10px;"></i> Picked: NO
              </span>
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-weight: 600;" title="UPPCLLKO not replied in that post">
              UPPCLLKO Not Replied
            </div>
          `;
        }

        let reply30Cell = '<span style="color: var(--text-light); font-size: 11px;">-</span>';
        if (c.reply_within_30_min === 'YES') {
          reply30Cell = `
            <div style="font-weight: 700; font-size: 11px;">
              <span class="badge-30m-yes" title="Complaints: 30-Min First Reply — Time difference between post time and UPPCLLKO replied time <30Mins">
                <i class="fa-solid fa-stopwatch"></i> YES
              </span>
            </div>
            <div style="font-size: 10px; color: #0284c7; margin-top: 2px; font-weight: 600;" title="Complaints: 30-Min First Reply — Time difference between post time and UPPCLLKO replied time <30Mins">
              &lt; 30 Mins
            </div>
          `;
        } else if (c.reply_within_30_min === 'NO') {
          // Only show breach if post is actually older than 30 minutes
          const receivedMs = c.received_at ? new Date(c.received_at).getTime() : 0;
          const elapsedMins = receivedMs ? (Date.now() - receivedMs) / 60000 : 999;
          if (elapsedMins < 30) {
            const minsLeft = Math.max(0, Math.ceil(30 - elapsedMins));
            reply30Cell = `
              <div style="font-weight: 700; font-size: 11px;">
                <span class="badge-30m-pending" title="SLA window still open — ${minsLeft} min(s) remaining">
                  <i class="fa-solid fa-hourglass-half"></i> In Window
                </span>
              </div>
              <div style="font-size: 10px; color: #d97706; margin-top: 2px; font-weight: 600;">
                &lt; ${minsLeft}m left
              </div>
            `;
          } else {
            reply30Cell = `
              <div style="font-weight: 600; font-size: 11px;">
                <span class="badge-30m-no" title="Complaints: 30-Min First Reply — Time difference between post time and UPPCLLKO replied time ≥ 30 Mins">
                  NO
                </span>
              </div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px; font-weight: 500;">
                &ge; 30 Mins
              </div>
            `;
          }
        }

        let postHref = (c.post_url && c.post_url.startsWith('http'))
          ? c.post_url
          : (/^\d{15,25}$/.test(String(c.post_url || '').trim()) ? `https://x.com/i/status/${c.post_url.trim()}` : null);
        if (!postHref && (c.complaint_no === 'UPPCL-SMC-202610-0120' || c.sheet_row_index === 122)) {
          postHref = 'https://x.com/Hindustan0112/status/2112123946334335270';
        }

        return `
          <tr>
            <td>
              <a href="javascript:void(0)" onclick="App.viewComplaint(${c.id})" style="font-weight: 700; color: var(--primary); text-decoration: none;">
                ${c.complaint_no}
              </a>
              ${c.sheet_row_index ? `
                <div style="margin-top: 2px;">
                  <span class="badge-sheet-row" title="Authoritative Google Sheet Row index">Row #${c.sheet_row_index}</span>
                </div>
              ` : ''}
            </td>
            <td>
              <div style="font-weight: 600;">${c.received_at.substring(0, 10)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${c.received_at.substring(11, 16)} IST</div>
            </td>
            <td>
              <div style="font-weight: 600;">${c.consumer_name || 'Consumer'}</div>
              ${c.consumer_handle ? `<div style="font-size: 11px; color: var(--text-muted);">${c.consumer_handle}</div>` : ''}
              ${postHref ? `
                <div style="margin-top: 4px;">
                  <a href="${postHref}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" class="open-post-btn" title="Open source post on X">
                    <i class="fa-brands fa-x-twitter"></i> Open Post <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 9px;"></i>
                  </a>
                </div>
              ` : ''}
            </td>
            <td style="max-width: 260px;">
              <div style="font-weight: 600; color: var(--primary); font-size: 12px;">${c.category_name}</div>
              <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; color: var(--text-main); font-size: 12px;" title="${c.complaint_text.replace(/"/g, '&quot;')}">
                ${c.complaint_text}
              </div>
            </td>
            <td>
              <div style="font-weight: 700;">${c.discom_name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${c.district_name || `${c.discom_name} HQ`}</div>
            </td>
            <td>
              ${pickedCell}
            </td>
            <td>
              ${reply30Cell}
            </td>
            <td>
              <div>
                <span class="badge-status ${statusBadgeClass}">${displayStatus}</span>
              </div>
              ${statusSub}
            </td>
            <td>
              <div>
                <button class="btn btn-danger btn-sm btn-frivolous" onclick="App.deleteFrivolousComplaint(${c.id}, '${c.complaint_no}')" style="background-color: #ef4444; border-color: #dc2626; color: #ffffff; font-weight: 600; padding: 3px 8px; font-size: 11px; white-space: nowrap; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="Delete this complaint as Frivolous">
                  <i class="fa-solid fa-trash-can" style="font-size: 10px;"></i> Frivolous
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      if (pdiv) {
        const start = ((pg.page - 1) * pg.limit) + 1;
        const end = Math.min(pg.page * pg.limit, pg.total);
        pdiv.innerHTML = `
          <div>Showing <b>${start}</b> - <b>${end}</b> of <b>${pg.total}</b> complaints</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" ${pg.page <= 1 ? 'disabled' : ''} onclick="App.changeDashTablePage(${pg.page - 1})">
              <i class="fa-solid fa-chevron-left"></i> Previous
            </button>
            <span style="display: flex; align-items: center; padding: 0 6px; font-weight: 600;">Page ${pg.page} of ${pg.totalPages}</span>
            <button class="btn btn-secondary btn-sm" ${pg.page >= pg.totalPages ? 'disabled' : ''} onclick="App.changeDashTablePage(${pg.page + 1})">
              Next <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        `;
      }
    } catch (e) {
      console.error('Error loading dashboard complaints:', e);
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444; padding: 25px;">Failed to load complaints: ${e.message}</td></tr>`;
    }
  },

  renderCharts(c) {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded yet');
      return;
    }

    // Chart 1: Daily Trend
    const ctxTrend = document.getElementById('chart-trend');
    if (ctxTrend) {
      if (this.charts.trend) this.charts.trend.destroy();
      const labels = c.trend.map(t => t.day);
      const data = c.trend.map(t => t.count);
      this.charts.trend = new Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'Complaints Inflow',
            data: data.length ? data : [0],
            borderColor: '#008080',
            backgroundColor: 'rgba(0, 128, 128, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointBackgroundColor: '#008080'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
            x: { grid: { display: false } }
          },
          onClick: (e, els, chart) => {
            if (els && els.length > 0) {
              const day = chart.data.labels[els[0].index];
              if (day && day !== 'No Data') App.navigate('register', { from_date: day, to_date: day });
            }
          }
        }
      });
    }


    // Official Monitored Handles List
    this.renderMonitoredHandlesList();

    // Chart 4: Categories
    const ctxCats = document.getElementById('chart-categories');
    if (ctxCats) {
      if (this.charts.categories) this.charts.categories.destroy();
      const labels = c.categories.map(cat => cat.category_name);
      const counts = c.categories.map(cat => cat.count);
      const palette = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#eab308'];

      this.charts.categories = new Chart(ctxCats, {
        type: 'doughnut',
        data: {
          labels: labels.length ? labels : ['None'],
          datasets: [{
            data: counts.length ? counts : [1],
            backgroundColor: palette.slice(0, labels.length)
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } },
          onClick: (e, els, chart) => {
            if (els && els.length > 0) {
              const cat = chart.data.labels[els[0].index];
              if (cat && cat !== 'None') App.navigate('register', { category: cat });
            }
          }
        }
      });
    }

    // Chart 5: Top 10 High Grievance (6 Apex/DISCOMs + Top 4 Districts)
    const ctxDist = document.getElementById('chart-districts');
    if (ctxDist) {
      if (this.charts.districts) this.charts.districts.destroy();
      
      let items = c.districts || [];
      // Dynamic fallback assembler in case of legacy API payload
      const apexNames = ['UPPCL', 'MVVNL', 'DVVNL', 'PVVNL', 'PUVVNL', 'KESCO'];
      const hasApex = items.some(d => apexNames.includes((d.label || d.discom_name || '').toUpperCase()) && d.is_discom);
      if (!hasApex && c.discoms) {
        const discomMap = {};
        (c.discoms || []).forEach(d => {
          if (d.discom_name) discomMap[d.discom_name.toUpperCase()] = d.total || d.count || 0;
        });
        const apexList = [
          { label: 'UPPCL', discom_name: 'UPPCL', count: discomMap['UPPCL'] || 0, is_discom: true },
          { label: 'MVVNL', discom_name: 'MVVNL', count: discomMap['MVVNL'] || 0, is_discom: true },
          { label: 'DVVNL', discom_name: 'DVVNL', count: discomMap['DVVNL'] || 0, is_discom: true },
          { label: 'PVVNL', discom_name: 'PVVNL', count: discomMap['PVVNL'] || 0, is_discom: true },
          { label: 'PuVVNL', discom_name: 'PuVVNL', count: discomMap['PUVVNL'] || 0, is_discom: true },
          { label: 'KESCO', discom_name: 'KESCo', count: (discomMap['KESCO'] || 0), is_discom: true }
        ];
        const validDists = items
          .filter(d => d.district_name && d.district_name.trim() !== '' && !['none', 'null', 'unknown', 'n/a', 'other', 'unassigned'].includes(d.district_name.trim().toLowerCase()))
          .slice(0, 4)
          .map(d => ({
            label: `${d.district_name} (${d.discom_name || ''})`.replace(' ()', ''),
            discom_name: d.discom_name,
            district_name: d.district_name,
            count: d.count,
            is_discom: false
          }));
        items = apexList.concat(validDists);
      }

      const labels = items.map(d => d.label || (d.is_discom ? d.discom_name : `${d.district_name} (${d.discom_name})`));
      const counts = items.map(d => d.count);

      this.charts.districts = new Chart(ctxDist, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['None'],
          datasets: [{
            label: 'Complaints',
            data: counts,
            backgroundColor: '#008080'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
          onClick: (e, els, chart) => {
            if (els && els.length > 0) {
              const raw = chart.data.labels[els[0].index];
              const apexMatch = ['UPPCL', 'MVVNL', 'DVVNL', 'PVVNL', 'PUVVNL', 'KESCO'];
              if (apexMatch.includes(raw.toUpperCase())) {
                const targetDiscom = raw.toUpperCase() === 'KESCO' ? 'KESCo' : (raw.toUpperCase() === 'PUVVNL' ? 'PuVVNL' : raw);
                App.navigate('register', { discom: targetDiscom });
              } else {
                const dist = raw.split(' (')[0].trim();
                if (dist && dist !== 'None') App.navigate('register', { district: dist });
              }
            }
          }
        }
      });
    }

    // Chart 7: Shifts Distribution
    const ctxShifts = document.getElementById('chart-shifts');
    if (ctxShifts) {
      if (this.charts.shifts) this.charts.shifts.destroy();
      const shiftData = c.shifts || [];
      const labels = shiftData.map(s => s.shift);
      const counts = shiftData.map(s => s.count);
      this.charts.shifts = new Chart(ctxShifts, {
        type: 'doughnut',
        data: {
          labels: labels.length ? labels : ['No Shifts Recorded'],
          datasets: [{
            data: counts.length ? counts : [1],
            backgroundColor: ['#6366f1', '#06b6d4', '#f59e0b', '#64748b']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } },
          onClick: (e, els, chart) => {
            if (els && els.length > 0) {
              const shift = chart.data.labels[els[0].index];
              if (shift && shift !== 'No Shifts Recorded') App.navigate('register', { shift });
            }
          }
        }
      });
    }

    // Chart 8: Picked Status Distribution
    const ctxPicked = document.getElementById('chart-picked');
    if (ctxPicked) {
      if (this.charts.picked) this.charts.picked.destroy();
      const pickedData = c.pickedStatuses || [];
      const labels = pickedData.map(p => p.status);
      const counts = pickedData.map(p => p.count);
      const colorMap = { 'YES': '#10b981', 'NO': '#94a3b8', 'APPRECIATION': '#f59e0b' };

      this.charts.picked = new Chart(ctxPicked, {
        type: 'pie',
        data: {
          labels: labels.length ? labels : ['None'],
          datasets: [{
            data: counts.length ? counts : [1],
            backgroundColor: labels.map(l => colorMap[l] || '#3b82f6')
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } },
          onClick: (e, els, chart) => {
            if (els && els.length > 0) {
              const ps = chart.data.labels[els[0].index];
              if (ps && ps !== 'None') App.navigate('register', { picked_status: ps });
            }
          }
        }
      });
    }
  },

  renderMonitoredHandlesList() {
    const container = document.getElementById('official-monitored-handles-container');
    if (!container) return;

    const monitoredHandles = [
      { handle: '@UPPCLLKO', title: 'UPPCL Official HQ', role: 'Central Social Media Cell & Corporate HQ' },
      { handle: '@CMOfficeUP', title: 'Chief Minister Office UP', role: 'Hon. CM Office (Apex Escalation)' },
      { handle: '@EMofficeUP', title: 'Energy Minister Office UP', role: 'Office of Hon. Energy Minister' },
      { handle: '@AKSharmaOffice', title: 'A.K. Sharma Office', role: 'Cabinet Minister Official Office' },
      { handle: '@aksharmaBharat', title: 'A.K. Sharma', role: 'Hon. Minister (Personal/Public)' },
      { handle: '@ChairmanUppcl', title: 'Chairman, UPPCL', role: 'Executive Leadership & Governance' },
      { handle: '@mduppcl', title: 'Managing Director, UPPCL', role: 'DISCOM Operational Oversight' }
    ];

    container.innerHTML = monitoredHandles.map(h => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 6px; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 9px; min-width: 0;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #000; color: #fff; font-size: 10px; flex-shrink: 0;">
            <i class="fa-brands fa-x-twitter"></i>
          </span>
          <div style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <a href="https://x.com/${h.handle.replace('@', '')}" target="_blank" rel="noopener noreferrer" style="font-weight: 700; font-size: 12px; color: var(--primary); text-decoration: none;" title="Open ${h.handle} profile on X">
              ${h.handle} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 8px; color: var(--text-muted);"></i>
            </a>
            <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">&bull; ${h.title}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25); font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px;" title="Actively monitored 24/7">
            <span class="sync-pulse-dot live" style="width: 5px; height: 5px; display: inline-block;"></span> Monitored
          </span>
          <button type="button" class="btn btn-sm btn-outline" onclick="App.navigate('register', { search: '${h.handle}' })" style="padding: 1px 7px; font-size: 10px; cursor: pointer;" title="Filter complaints mentioning ${h.handle}">
            <i class="fa-solid fa-filter"></i> Filter
          </button>
        </div>
      </div>
    `).join('');
  },

  // -----------------------------------------------------------
  // COMPLAINT REGISTER VIEW
  // -----------------------------------------------------------
  async renderComplaintRegister(container, customTitle = 'Centralized Complaint Register') {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>${customTitle}</h2>
          <p>Search, Route, Follow-Up, Verify, and Track Full Lifecycle Grievances</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" onclick="App.exportCurrentRegister('csv')">
            <i class="fa-solid fa-file-csv"></i> Export CSV
          </button>
          <button class="btn btn-secondary btn-sm" onclick="App.exportCurrentRegister('excel')">
            <i class="fa-solid fa-file-excel"></i> Export Excel
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.print()">
            <i class="fa-solid fa-print"></i> Print
          </button>
        </div>
      </div>

      <div class="card-table">
        <!-- Filter Bar -->
        <div class="filter-bar">
          <div class="filter-group" style="flex: 2; min-width: 200px;">
            <label>Search Keyword / ID</label>
            <input type="text" id="reg-search" class="form-control" placeholder="Search ID, Consumer, Post, Mobile..." value="${this.currentFilters.search}">
          </div>

          <div class="filter-group" style="min-width: 140px;">
            <label>DISCOM</label>
            <select id="reg-discom" class="form-control" onchange="App.handleDiscomChange(this.value)">
              <option value="All">All DISCOMs</option>
              <option value="PUVVNL" ${this.currentFilters.discom === 'PUVVNL' ? 'selected' : ''}>PuVVNL</option>
              <option value="MVVNL" ${this.currentFilters.discom === 'MVVNL' ? 'selected' : ''}>MVVNL</option>
              <option value="DVVNL" ${this.currentFilters.discom === 'DVVNL' ? 'selected' : ''}>DVVNL</option>
              <option value="PVVNL" ${this.currentFilters.discom === 'PVVNL' ? 'selected' : ''}>PVVNL</option>
              <option value="KESCo" ${this.currentFilters.discom === 'KESCo' ? 'selected' : ''}>KESCo</option>
            </select>
          </div>

          <div class="filter-group" style="min-width: 140px;">
            <label>Category</label>
            <select id="reg-cat" class="form-control">
              <option value="All">All Categories</option>
              ${this.cachedMaster.categories.map(c => `<option value="${c.name}" ${this.currentFilters.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="filter-group" style="min-width: 120px;">
            <label>Priority</label>
            <select id="reg-priority" class="form-control">
              <option value="All">All Priorities</option>
              <option value="Critical" ${this.currentFilters.priority === 'Critical' ? 'selected' : ''}>Critical (24h)</option>
              <option value="High" ${this.currentFilters.priority === 'High' ? 'selected' : ''}>High (48h)</option>
              <option value="Normal" ${this.currentFilters.priority === 'Normal' ? 'selected' : ''}>Normal (72h)</option>
              <option value="Low" ${this.currentFilters.priority === 'Low' ? 'selected' : ''}>Low (96h)</option>
            </select>
          </div>

          <div class="filter-group" style="min-width: 120px;">
            <label>Platform</label>
            <select id="reg-platform" class="form-control">
              <option value="All">All Platforms</option>
              <option value="Twitter/X" ${this.currentFilters.platform === 'Twitter/X' ? 'selected' : ''}>Twitter/X</option>
              <option value="Facebook" ${this.currentFilters.platform === 'Facebook' ? 'selected' : ''}>Facebook</option>
              <option value="Other" ${this.currentFilters.platform === 'Other' ? 'selected' : ''}>Other / Manual</option>
            </select>
          </div>

          <div class="filter-group" style="min-width: 140px;">
            <label>Picked Status</label>
            <select id="reg-picked-status" class="form-control">
              <option value="All" ${this.currentFilters.picked_status === 'All' ? 'selected' : ''}>All Posts</option>
              <option value="YES" ${this.currentFilters.picked_status === 'YES' ? 'selected' : ''}>YES (UPPCLLKO Replied)</option>
              <option value="NO" ${this.currentFilters.picked_status === 'NO' ? 'selected' : ''}>NO (UPPCLLKO Not Replied)</option>
              <option value="APPRECIATION" ${this.currentFilters.picked_status === 'APPRECIATION' ? 'selected' : ''}>APPRECIATION (Gratitude)</option>
            </select>
          </div>

          <div class="filter-group" style="min-width: 140px;">
            <label>30-Min First Reply</label>
            <select id="reg-reply-30" class="form-control">
              <option value="All" ${this.currentFilters.reply_within_30_min === 'All' ? 'selected' : ''}>All Posts</option>
              <option value="YES" ${this.currentFilters.reply_within_30_min === 'YES' ? 'selected' : ''}>YES (&lt; 30 mins)</option>
              <option value="NO" ${this.currentFilters.reply_within_30_min === 'NO' ? 'selected' : ''}>NO (&gt;= 30 mins)</option>
            </select>
          </div>

          <div class="filter-group" style="min-width: 130px;">
            <label>Shift</label>
            <select id="reg-shift" class="form-control">
              <option value="All" ${this.currentFilters.shift === 'All' ? 'selected' : ''}>All Shifts</option>
              <option value="Shift 1" ${this.currentFilters.shift === 'Shift 1' ? 'selected' : ''}>Shift 1 (06-14)</option>
              <option value="Shift 2" ${this.currentFilters.shift === 'Shift 2' ? 'selected' : ''}>Shift 2 (14-22)</option>
              <option value="Shift 3" ${this.currentFilters.shift === 'Shift 3' ? 'selected' : ''}>Shift 3 (22-06)</option>
            </select>
          </div>

          <div class="filter-group" style="min-width: 130px;">
            <label>Data Quality</label>
            <select id="reg-data-quality" class="form-control">
              <option value="All" ${this.currentFilters.data_quality === 'All' ? 'selected' : ''}>All Records</option>
              <option value="flagged" ${this.currentFilters.data_quality === 'flagged' ? 'selected' : ''}>Flagged Issues Only</option>
            </select>
          </div>

          <div class="filter-group" style="min-width: 160px;">
            <label>Assigned X-Handle</label>
            <select id="reg-assigned-handle" class="form-control">
              <option value="All">All Handles</option>
              <option value="Unassigned" ${this.currentFilters.assigned_handle === 'Unassigned' ? 'selected' : ''}>-- Unassigned --</option>
              <optgroup label="Corporate / Apex HQ">
                <option value="@UPPCLLKO" ${this.currentFilters.assigned_handle === '@UPPCLLKO' ? 'selected' : ''}>@UPPCLLKO (UPPCL HQ)</option>
                <option value="@PuVVNLHQ" ${this.currentFilters.assigned_handle === '@PuVVNLHQ' ? 'selected' : ''}>@PuVVNLHQ (PuVVNL)</option>
                <option value="@MVVNLHQ" ${this.currentFilters.assigned_handle === '@MVVNLHQ' ? 'selected' : ''}>@MVVNLHQ (MVVNL)</option>
                <option value="@dvvnlhq" ${this.currentFilters.assigned_handle === '@dvvnlhq' ? 'selected' : ''}>@dvvnlhq (DVVNL)</option>
                <option value="@PVVNLHQ" ${this.currentFilters.assigned_handle === '@PVVNLHQ' ? 'selected' : ''}>@PVVNLHQ (PVVNL)</option>
                <option value="@KESCoHQ" ${this.currentFilters.assigned_handle === '@KESCoHQ' ? 'selected' : ''}>@KESCoHQ (KESCo)</option>
              </optgroup>
              <optgroup label="DISCOM & District Handles">
                ${(this.cachedMaster.xHierarchy || [])
                  .filter(h => h.handle_name && !['@UPPCLLKO', '@PuVVNLHQ', '@MVVNLHQ', '@dvvnlhq', '@PVVNLHQ', '@KESCoHQ'].includes(h.handle_name))
                  .map(h => `<option value="${h.handle_name}" ${this.currentFilters.assigned_handle === h.handle_name ? 'selected' : ''}>${h.handle_name} (${h.district_name || h.discom_name || h.office_name})</option>`).join('')}
              </optgroup>
            </select>
          </div>

          <div class="filter-group" style="align-self: flex-end;">
            <button class="btn btn-primary" onclick="App.applyFilters()">
              <i class="fa-solid fa-filter"></i> Apply
            </button>
          </div>
          <div class="filter-group" style="align-self: flex-end;">
            <button class="btn btn-secondary" onclick="App.resetFilters()">
              <i class="fa-solid fa-rotate-left"></i> Reset
            </button>
          </div>
        </div>

        <!-- Table Responsive -->
        <div class="table-responsive">
          <table class="data-table" id="reg-table">
            <thead>
              <tr>
                ${this.renderSortableHeader('complaint_no', 'Complaint ID')}
                ${this.renderSortableHeader('received_at', 'Received (IST)')}
                ${this.renderSortableHeader('platform', 'Platform & Handle')}
                ${this.renderSortableHeader('consumer_name', 'Consumer')}
                ${this.renderSortableHeader('category_name', 'Grievance Summary')}
                ${this.renderSortableHeader('discom_name', 'DISCOM & District')}
                ${this.renderSortableHeader('priority', 'Priority')}
                ${this.renderSortableHeader('current_status', 'Status')}
                ${this.renderSortableHeader('expected_response_date', 'SLA / Overdue')}
                ${this.renderSortableHeader('assigned_nodal_officer_name', 'Assigned X-Handle')}
                <th style="user-select: none;">Actions</th>
              </tr>
            </thead>
            <tbody id="reg-table-body">
              <tr><td colspan="11" style="text-align: center; padding: 30px;">Loading complaints register...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Bar -->
        <div id="reg-pagination" class="pagination-container"></div>
      </div>
    `;

    // Hook search keyup
    const searchInp = document.getElementById('reg-search');
    if (searchInp) {
      searchInp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.applyFilters();
      });
    }

    this.loadRegisterData();
  },

  filterTab(tab) {
    if (tab === 'overdue') {
      this.currentFilters.status = 'All';
      this.currentFilters.overdue = '1';
    } else {
      this.currentFilters.status = tab;
      this.currentFilters.overdue = '0';
    }
    this.currentFilters.page = 1;
    this.navigate('register');
  },

  applyFilters() {
    this.currentFilters.search = document.getElementById('reg-search') ? document.getElementById('reg-search').value.trim() : '';
    this.currentFilters.discom = document.getElementById('reg-discom') ? document.getElementById('reg-discom').value : 'All';
    this.currentFilters.category = document.getElementById('reg-cat') ? document.getElementById('reg-cat').value : 'All';
    this.currentFilters.priority = document.getElementById('reg-priority') ? document.getElementById('reg-priority').value : 'All';
    this.currentFilters.platform = document.getElementById('reg-platform') ? document.getElementById('reg-platform').value : 'All';
    const assignedSelect = document.getElementById('reg-assigned-handle');
    if (assignedSelect) {
      this.currentFilters.assigned_handle = assignedSelect.value;
    }
    const pickedSelect = document.getElementById('reg-picked-status');
    if (pickedSelect) {
      this.currentFilters.picked_status = pickedSelect.value;
    }
    const reply30Select = document.getElementById('reg-reply-30');
    if (reply30Select) {
      this.currentFilters.reply_within_30_min = reply30Select.value;
    }
    const shiftSelect = document.getElementById('reg-shift');
    if (shiftSelect) {
      this.currentFilters.shift = shiftSelect.value;
    }
    const qualitySelect = document.getElementById('reg-data-quality');
    if (qualitySelect) {
      this.currentFilters.data_quality = qualitySelect.value;
    }
    this.currentFilters.page = 1;
    this.loadRegisterData();
  },

  resetFilters() {
    this.currentFilters = {
      page: 1,
      limit: 25,
      search: '',
      status: 'All',
      discom: 'All',
      district: 'All',
      platform: 'All',
      category: 'All',
      priority: 'All',
      assigned_handle: 'All',
      picked_status: 'All',
      reply_within_30_min: 'All',
      shift: 'All',
      data_quality: 'All',
      overdue: '0',
      from_date: '',
      to_date: '',
      sort_by: 'received_at',
      sort_order: 'DESC'
    };
    this.navigate('register');
  },

  renderSortableHeader(colName, label) {
    const isSorted = (this.currentFilters.sort_by || 'received_at') === colName;
    const order = (this.currentFilters.sort_order || 'DESC').toUpperCase();
    let iconClass = 'fa-solid fa-sort';
    if (isSorted) {
      iconClass = order === 'ASC' ? 'fa-solid fa-arrow-up-short-wide' : 'fa-solid fa-arrow-down-wide-short';
    }
    const nextOrder = isSorted && order === 'ASC' ? 'descending' : 'ascending';
    return `
      <th class="sortable ${isSorted ? 'active-sort' : ''}" onclick="App.handleSort('${colName}')" title="Sort by ${label} (${nextOrder})">
        <div class="sort-header-inner">
          <span>${label}</span>
          <i class="${iconClass} sort-icon"></i>
        </div>
      </th>
    `;
  },

  handleSort(colName) {
    if (this.currentFilters.sort_by === colName) {
      this.currentFilters.sort_order = (this.currentFilters.sort_order === 'ASC') ? 'DESC' : 'ASC';
    } else {
      this.currentFilters.sort_by = colName;
      if (['complaint_no', 'consumer_name', 'category_name', 'discom_name'].includes(colName)) {
        this.currentFilters.sort_order = 'ASC';
      } else {
        this.currentFilters.sort_order = 'DESC';
      }
    }
    this.currentFilters.page = 1;
    this.updateRegisterTableHeader();
    this.loadRegisterData();
  },

  updateRegisterTableHeader() {
    const thead = document.querySelector('#reg-table thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          ${this.renderSortableHeader('complaint_no', 'Complaint ID')}
          ${this.renderSortableHeader('received_at', 'Received (IST)')}
          ${this.renderSortableHeader('platform', 'Platform & Handle')}
          ${this.renderSortableHeader('consumer_name', 'Consumer')}
          ${this.renderSortableHeader('category_name', 'Grievance Summary')}
          ${this.renderSortableHeader('discom_name', 'DISCOM & District')}
          ${this.renderSortableHeader('priority', 'Priority')}
          ${this.renderSortableHeader('current_status', 'Status')}
          ${this.renderSortableHeader('expected_response_date', 'SLA / Overdue')}
          ${this.renderSortableHeader('assigned_nodal_officer_name', 'Assigned X-Handle')}
          <th style="user-select: none;">Actions</th>
        </tr>
      `;
    }
  },

  sortStaticTable(tableId, colIndex) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;

    const ths = table.querySelectorAll('thead th');
    const targetTh = ths[colIndex];
    if (!targetTh) return;

    const currentOrder = targetTh.getAttribute('data-sort-order') || 'none';
    const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';

    // Reset sort states on siblings
    ths.forEach(th => {
      th.removeAttribute('data-sort-order');
      th.classList.remove('active-sort');
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.className = 'fa-solid fa-sort sort-icon';
    });

    targetTh.setAttribute('data-sort-order', newOrder);
    targetTh.classList.add('active-sort');
    const icon = targetTh.querySelector('.sort-icon');
    if (icon) {
      icon.className = newOrder === 'asc' ? 'fa-solid fa-arrow-up-short-wide sort-icon' : 'fa-solid fa-arrow-down-wide-short sort-icon';
    }

    rows.sort((a, b) => {
      const cellA = (a.children[colIndex] ? a.children[colIndex].innerText.trim() : '');
      const cellB = (b.children[colIndex] ? b.children[colIndex].innerText.trim() : '');
      const numA = parseFloat(cellA.replace(/[^0-9.-]+/g, ''));
      const numB = parseFloat(cellB.replace(/[^0-9.-]+/g, ''));

      if (!isNaN(numA) && !isNaN(numB) && !cellA.includes('@') && !cellA.startsWith('+') && !cellA.includes(':')) {
        return newOrder === 'asc' ? numA - numB : numB - numA;
      }
      return newOrder === 'asc' ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });

    rows.forEach(r => tbody.appendChild(r));
  },

  async loadRegisterData() {
    const tbody = document.getElementById('reg-table-body');
    const pdiv = document.getElementById('reg-pagination');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 25px;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching records from database...</td></tr>`;

    const q = new URLSearchParams();
    Object.entries(this.currentFilters).forEach(([k, v]) => {
      if (v && v !== 'All') q.append(k, v);
    });

    try {
      const res = await this.api(`/api/complaints?${q.toString()}`);
      const data = res.data || [];
      const pg = res.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 };

      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 35px; color: var(--text-muted);">No consumer grievances found matching current filters.</td></tr>`;
        pdiv.innerHTML = '';
        return;
      }

      tbody.innerHTML = data.map(c => {
        const isOverdue = c.computed_overdue === 1;
        const statusBadgeClass = `badge-${c.current_status.replace(/[\s—/]+/g, '-')}`;
        const prioBadgeClass = `badge-prio-${c.priority}`;
        const platformIcon = c.platform === 'Twitter/X' ? 'fa-brands fa-x-twitter' : (c.platform === 'Facebook' ? 'fa-brands fa-facebook' : 'fa-solid fa-globe');
        let postHref = (c.post_url && c.post_url.startsWith('http'))
          ? c.post_url
          : (/^\d{15,25}$/.test(String(c.post_url || '').trim()) ? `https://x.com/i/status/${c.post_url.trim()}` : null);
        if (!postHref && (c.complaint_no === 'UPPCL-SMC-202610-0120' || c.sheet_row_index === 122)) {
          postHref = 'https://x.com/Hindustan0112/status/2112123946334335270';
        }

        return `
          <tr>
            <td>
              <a href="javascript:void(0)" onclick="App.viewComplaint(${c.id})" style="font-weight: 700; color: var(--primary); text-decoration: none;">
                ${c.complaint_no}
              </a>
              ${c.sheet_row_index ? `
                <div style="margin-top: 3px;">
                  <span class="badge-sheet-row" title="Authoritative Google Sheet Row index">Row #${c.sheet_row_index}</span>
                </div>
              ` : ''}
            </td>
            <td>
              <div style="font-weight: 600;">${c.received_at.substring(0, 10)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${c.received_at.substring(11, 16)} IST</div>
            </td>
            <td>
              <div><i class="${platformIcon}"></i> ${c.platform}</div>
              <div style="font-size: 11px; color: var(--accent); font-weight: 600;">${c.monitored_account || '@UPPCLLKO'}</div>
              ${postHref ? `
                <div style="margin-top: 4px;">
                  <a href="${postHref}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; background: rgba(29, 155, 240, 0.1); color: #1d9bf0; border-radius: 4px; font-size: 11px; font-weight: 600; text-decoration: none; border: 1px solid rgba(29, 155, 240, 0.25);" title="Open source tweet on X">
                    <i class="fa-brands fa-x-twitter"></i> Open Post <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 9px;"></i>
                  </a>
                </div>
              ` : ''}
            </td>
            <td>
              <div style="font-weight: 600;">${c.consumer_name || 'Consumer'}</div>
              ${c.consumer_handle ? `<div style="font-size: 11px; color: var(--text-muted);">${c.consumer_handle}</div>` : ''}
              ${postHref ? `
                <div style="margin-top: 4px;">
                  <a href="${postHref}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" class="open-post-btn" title="Open source post on X">
                    <i class="fa-brands fa-x-twitter"></i> Open Post <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 9px;"></i>
                  </a>
                </div>
              ` : ''}
            </td>
            <td style="max-width: 240px;">
              <div style="font-weight: 600; color: var(--primary);">${c.category_name}</div>
              <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; color: var(--text-main);" title="${c.complaint_text.replace(/"/g, '&quot;')}">
                ${c.complaint_text}
              </div>
            </td>
            <td>
              <div style="font-weight: 700;">${c.discom_name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${c.district_name || `${c.discom_name} HQ`}</div>
            </td>
            <td>
              <span class="badge-prio ${prioBadgeClass}">${c.priority}</span>
            </td>
            <td>
              ${(() => {
                const isDiscomTagged = c.discom_name && ['PVVNL', 'PUVVNL', 'MVVNL', 'DVVNL', 'KESCO'].includes(c.discom_name.toUpperCase());
                const isAppreciation = c.picked_status === 'APPRECIATION' || c.current_status === 'Appreciation' || c.category_name === 'APPRECIATION';
                // Permanent recognition of verified UPPCLLKO reply
                const hasUppclReplied = Boolean(
                  c.uppcl_replied === 1 ||
                  c.uppcl_replied === '1' ||
                  c.reply_within_30_min === 'YES' ||
                  Boolean(c.published_reply_id) ||
                  (c.reply_evidence && c.reply_evidence.length > 0)
                );
                // Picked = Existing_Valid_Pickup_Event OR UPPCLLKO_Replied
                const isPicked = !isAppreciation && (hasUppclReplied || c.picked_status === 'YES');

                let displayStatus = c.current_status;
                let statusSub = '';

                const taggedHandle = c.discom_tagged_in_reply || (isDiscomTagged ? ('@' + c.discom_name.toUpperCase() + 'HQ') : null);

                if (displayStatus === 'Assigned to DISCOM') {
                  if (taggedHandle) {
                    statusSub = `<div style="font-size: 10px; color: var(--primary); font-weight: 600; margin-top: 2px;" title="Assigned to DISCOM — Tagged to ${taggedHandle}"><i class="fa-brands fa-x-twitter"></i> Tagged ${taggedHandle}</div>`;
                  } else {
                    statusSub = `<div style="font-size: 10px; color: var(--primary); font-weight: 600; margin-top: 2px;" title="Assigned to DISCOM"><i class="fa-solid fa-share-nodes"></i> Assigned</div>`;
                  }
                } else if (displayStatus === 'DISCOM Follow Up') {
                  statusSub = `<div style="font-size: 10px; color: #4338ca; font-weight: 500; margin-top: 2px;" title="DISCOM or Division responded to complaint"><i class="fa-solid fa-reply"></i> DISCOM Replied</div>`;
                } else if (displayStatus === 'Appreciation') {
                  statusSub = `<div style="font-size: 10px; color: #d97706; font-weight: 500; margin-top: 2px;" title="Consumer appreciation & gratitude posts"><i class="fa-solid fa-heart"></i> Gratitude</div>`;
                } else if (displayStatus === 'New') {
                  statusSub = `<div style="font-size: 10px; color: var(--text-muted); font-weight: 500; margin-top: 2px;">${!hasUppclReplied ? 'Awaiting UPPCLLKO Reply' : 'Pending Assignment'}</div>`;
                }

                const sBadge = `badge-${(displayStatus || '').replace(/[\s—/]+/g, '-')}`;

                let pickedMarkup = '';
                if (isAppreciation) {
                  pickedMarkup = `<span class="badge-picked appreciation" title="Consumer appreciation & gratitude post">Appreciation</span>`;
                } else if (hasUppclReplied) {
                  pickedMarkup = `
                    <span class="badge-picked yes" title="Verified UPPCLLKO reply on record: Picked: YES">Picked: YES</span>
                    <div style="font-size: 9.5px; color: #059669; font-weight: 600; margin-top: 1px;"><i class="fa-solid fa-reply"></i> UPPCLLKO Replied</div>
                  `;
                } else if (isPicked) {
                  pickedMarkup = `
                    <span class="badge-picked yes" style="background: rgba(3, 105, 161, 0.12); color: #0284c7; border: 1px solid rgba(3, 105, 161, 0.25);" title="Picked by cell / operator, awaiting reply">Picked: YES</span>
                    <div style="font-size: 9.5px; color: #0284c7; font-weight: 600; margin-top: 1px;"><i class="fa-solid fa-clock"></i> Awaiting Reply</div>
                  `;
                } else {
                  pickedMarkup = `
                    <span class="badge-picked no" title="Complaints: Picked: NO — UPPCLLKO not replied in that post">Picked: NO</span>
                    <div style="font-size: 9.5px; color: #64748b; font-weight: 600; margin-top: 1px;">UPPCLLKO Not Replied</div>
                  `;
                }

                return `
                  <div style="margin-bottom: 2px;">
                    <span class="badge-status ${sBadge}">${displayStatus}</span>
                  </div>
                  ${statusSub}
                  <div style="margin-top: 3px;">
                    ${pickedMarkup}
                  </div>
                  ${c.reply_within_30_min ? `
                    <div style="margin-top: 2px;">
                      <span class="${c.reply_within_30_min === 'YES' ? 'badge-30m-yes' : 'badge-30m-no'}" title="Complaints: 30-Min First Reply — Time difference between post time and UPPCLLKO replied time <30Mins: ${c.reply_within_30_min}">
                        ${c.reply_within_30_min === 'YES' ? '<i class="fa-solid fa-stopwatch"></i> 30m: YES' : '30m: NO'}
                      </span>
                    </div>
                  ` : ''}
                  ${c.data_quality_flags ? `
                    <div style="margin-top: 2px;">
                      <span class="badge-quality-issue" title="Data quality issue: ${c.data_quality_flags}"><i class="fa-solid fa-triangle-exclamation"></i> Flagged</span>
                    </div>
                  ` : ''}
                `;
              })()}
            </td>
            <td>
              ${c.link_shift ? `
                <div style="margin-bottom: 3px;">
                  <span class="badge-shift" title="Shift assigned during ingestion">${c.link_shift}</span>
                </div>
              ` : ''}
              ${isOverdue ? `
                <span class="badge-overdue"><i class="fa-solid fa-clock-rotate-left"></i> OVERDUE</span>
              ` : (c.expected_response_date ? `
                <span style="font-size: 11px; color: var(--text-muted);">SLA: ${c.expected_response_date.substring(5, 16)}</span>
              ` : '<span style="font-size: 11px; color: var(--text-light);">-</span>')}
            </td>
            <td>
              <div style="font-size: 11px; font-weight: 600;">${c.assigned_nodal_officer_name ? (c.assigned_nodal_officer_name.startsWith('@') ? `<span style="color: var(--primary);"><i class="fa-brands fa-x-twitter"></i> ${c.assigned_nodal_officer_name}</span>` : c.assigned_nodal_officer_name) : (c.assigned_operator_name || 'Unassigned')}</div>
            </td>
            <td>
              <div>
                <button class="btn btn-danger btn-sm btn-frivolous" onclick="App.deleteFrivolousComplaint(${c.id}, '${c.complaint_no}')" style="background-color: #ef4444; border-color: #dc2626; color: #ffffff; font-weight: 600; padding: 3px 8px; font-size: 11px; white-space: nowrap; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="Delete this complaint as Frivolous">
                  <i class="fa-solid fa-trash-can" style="font-size: 10px;"></i> Frivolous
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Render Pagination
      pdiv.innerHTML = `
        <div>Showing <b>${(pg.page - 1) * pg.limit + 1}</b> to <b>${Math.min(pg.page * pg.limit, pg.total)}</b> of <b>${pg.total}</b> grievances</div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="btn btn-secondary btn-sm" ${pg.page <= 1 ? 'disabled' : ''} onclick="App.changePage(${pg.page - 1})">
            <i class="fa-solid fa-chevron-left"></i> Prev
          </button>
          <span style="font-weight: 600; padding: 0 8px;">Page ${pg.page} of ${pg.totalPages}</span>
          <button class="btn btn-secondary btn-sm" ${pg.page >= pg.totalPages ? 'disabled' : ''} onclick="App.changePage(${pg.page + 1})">
            Next <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      `;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="11" style="color: #ef4444; text-align: center; padding: 25px;">Error loading complaints: ${e.message}</td></tr>`;
    }
  },

  renderRowQuickAction(c) {
    const isDiscom = this.user.role === 'DISCOM Nodal Officer';
    const isOperator = ['Administrator', 'Admin', 'Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'].includes(this.user.role);

    if (c.current_status === 'Forwarded' && isOperator) {
      return `<button class="btn btn-secondary btn-sm" title="Follow Up" onclick="App.openFollowupModal(${c.id})"><i class="fa-solid fa-phone"></i></button>`;
    }
    if ((c.current_status === 'Forwarded' || c.current_status === 'DISCOM Follow Up') && isDiscom) {
      return `<button class="btn btn-success btn-sm" title="Submit Resolution" onclick="App.openDiscomResponseModal(${c.id})"><i class="fa-solid fa-check"></i></button>`;
    }
    if (c.current_status === 'Resolved — Verification Pending' && isOperator) {
      return `<button class="btn btn-success btn-sm" title="Verify & Close" onclick="App.openVerifyModal(${c.id})"><i class="fa-solid fa-clipboard-check"></i></button>`;
    }
    if (c.current_status === 'Closed' && isOperator) {
      return `<button class="btn btn-secondary btn-sm" title="Reopen" onclick="App.openReopenModal(${c.id})"><i class="fa-solid fa-rotate-left"></i></button>`;
    }
    return '';
  },

  changePage(newPage) {
    this.currentFilters.page = newPage;
    this.loadRegisterData();
  },

  async exportCurrentRegister(format) {
    const q = new URLSearchParams();
    Object.entries(this.currentFilters).forEach(([k, v]) => {
      if (v && v !== 'All') q.append(k, v);
    });
    q.set('format', format);
    q.set('type', 'register');
    if (this.token) q.set('token', this.token);

    try {
      const res = await fetch(`/api/reports/export?${q.toString()}`, {
        headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `UPPCL_SMC_Complaint_Register_${dateStr}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Direct blob download fallback:', err.message);
      window.open(`/api/reports/export?${q.toString()}`, '_blank');
    }
  },

  // -----------------------------------------------------------
  // ADD COMPLAINT VIEW
  // -----------------------------------------------------------
  renderAddComplaint(container) {
    const monitoredAccounts = this.cachedMaster.xHierarchy.filter(h => h.is_monitored === 1 || h.hierarchy_level !== 'District / Field Office');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Register Social Media Complaint</h2>
          <p>Register consumer grievances captured from Twitter/X, Facebook, and official comment sections</p>
        </div>
      </div>

      <!-- Real-Time Duplicate Warning Banner -->
      <div id="duplicate-warning-banner" style="display: none;"></div>

      <div class="details-card">
        <form id="form-add-complaint" onsubmit="App.submitNewComplaint(event)">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
            <div class="filter-group">
              <label>Social Media Platform *</label>
              <select id="add-platform" class="form-control" required onchange="App.handlePlatformChange(this.value)">
                <option value="Twitter/X">Twitter/X</option>
                <option value="Facebook">Facebook</option>
                <option value="Other">Other / Manual</option>
              </select>
            </div>

            <div class="filter-group">
              <label>Monitored Official Account *</label>
              <select id="add-monitored-account" class="form-control" required>
                <option value="@UPPCLLKO">@UPPCLLKO (UPPCL HQ Official)</option>
                <option value="@CMOfficeUP">@CMOfficeUP (Chief Minister Office)</option>
                <option value="@EMofficeUP">@EMofficeUP (Energy Minister Office)</option>
                <option value="@AKSharmaOffice">@AKSharmaOffice (Hon. Energy Minister Sir)</option>
                <option value="@aksharmaBharat">@aksharmaBharat (Hon. Energy Minister Personal)</option>
                <option value="@ChairmanUppcl">@ChairmanUppcl (Chairman UPPCL)</option>
                <option value="@mduppcl">@mduppcl (MD UPPCL)</option>
                <option value="@PuVVNLHQ">@PuVVNLHQ (PuVVNL Corporate HQ)</option>
                <option value="@MVVNLHQ">@MVVNLHQ (MVVNL Corporate HQ)</option>
                <option value="@dvvnlhq">@dvvnlhq (DVVNL Corporate HQ)</option>
                <option value="@PVVNLHQ">@PVVNLHQ (PVVNL Corporate HQ)</option>
                <option value="@KESCoHQ">@KESCoHQ (KESCo Corporate HQ)</option>
              </select>
            </div>

            <div class="filter-group">
              <label>Tagging Status *</label>
              <select id="add-is-tagged" class="form-control" required>
                <option value="1">Tagged (Consumer mentioned official handle)</option>
                <option value="0">Untagged (Found during keyword/reply monitoring)</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
            <div class="filter-group">
              <label>Original Social Media Post / Comment URL *</label>
              <input type="url" id="add-post-url" class="form-control" placeholder="https://x.com/username/status/..." required onblur="App.checkDuplicatePostUrl(this.value)">
            </div>

            <div class="filter-group">
              <label>Consumer Username / Handle</label>
              <input type="text" id="add-consumer-handle" class="form-control" placeholder="@consumer_handle">
            </div>

            <div class="filter-group">
              <label>Consumer Full Name</label>
              <input type="text" id="add-consumer-name" class="form-control" placeholder="Consumer Name (if available)">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
            <div class="filter-group">
              <label>Complaint Category *</label>
              <select id="add-category" class="form-control" required onchange="App.handleCategoryChange(this.value)">
                <option value="">-- Select Grievance Category --</option>
                ${this.cachedMaster.categories.map(c => `<option value="${c.name}">${c.name} (${c.sla_hours}h SLA)</option>`).join('')}
              </select>
            </div>

            <div class="filter-group">
              <label>Subcategory</label>
              <select id="add-subcategory" class="form-control">
                <option value="">-- Select Subcategory --</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px;">
            <div class="filter-group">
              <label>Responsible DISCOM *</label>
              <select id="add-discom" class="form-control" required onchange="App.handleAddDiscomChange(this.value)">
                <option value="">-- Select DISCOM --</option>
                <option value="PUVVNL">PuVVNL (Purvanchal)</option>
                <option value="MVVNL">MVVNL (Madhyanchal)</option>
                <option value="DVVNL">DVVNL (Dakshinanchal)</option>
                <option value="PVVNL">PVVNL (Pashchimanchal)</option>
                <option value="KESCo">KESCo (Kanpur)</option>
              </select>
            </div>

            <div class="filter-group">
              <label>District (Optional)</label>
              <select id="add-district" class="form-control" onchange="App.handleAddDistrictChange(this.value)">
                <option value="">-- No Specific District / DISCOM HQ (Optional) --</option>
              </select>
            </div>

            <div class="filter-group">
              <label>Priority *</label>
              <select id="add-priority" class="form-control" required>
                <option value="Normal">Normal (72h SLA)</option>
                <option value="High">High (48h SLA)</option>
                <option value="Critical">Critical (24h SLA)</option>
                <option value="Low">Low (96h SLA)</option>
              </select>
            </div>

            <div class="filter-group">
              <label>Consumer Account / Connection No</label>
              <input type="text" id="add-consumer-account" class="form-control" placeholder="Optional Connection ID">
            </div>
          </div>

          <div class="filter-group" style="margin-bottom: 16px;">
            <label>Detailed Grievance Text / Consumer Post *</label>
            <textarea id="add-complaint-text" class="form-control" rows="4" placeholder="Enter complete grievance text copied from post or comment..." required onblur="App.checkDuplicateText(this.value)"></textarea>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button type="button" class="btn btn-secondary" onclick="App.navigate('register')">Cancel</button>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Register Complaint</button>
          </div>
        </form>
      </div>
    `;
  },

  handleCategoryChange(catName) {
    const subSel = document.getElementById('add-subcategory');
    if (!subSel) return;
    subSel.innerHTML = '<option value="">-- Select Subcategory --</option>';

    const cat = this.cachedMaster.categories.find(c => c.name === catName);
    if (cat && cat.subcategories) {
      cat.subcategories.forEach(s => {
        subSel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
      });
    }
  },

  handleAddDiscomChange(discom) {
    const distSel = document.getElementById('add-district');
    if (!distSel) return;
    distSel.innerHTML = '<option value="">-- No Specific District / DISCOM HQ (Optional) --</option>';

    const dObj = this.cachedMaster.discoms.find(d => d.code.toUpperCase() === (discom || '').toUpperCase());
    if (dObj && dObj.districts) {
      dObj.districts.forEach(dist => {
        distSel.innerHTML += `<option value="${dist.name}">${dist.name}</option>`;
      });
    }
    this.handleAddDistrictChange(distSel.value);
  },

  handleAddDistrictChange(district) {
    const discom = document.getElementById('add-discom')?.value || '';
    const nodalInp = document.getElementById('add-nodal-name');
    const nodalIdInp = document.getElementById('add-nodal-id');
    const nodalMobileInp = document.getElementById('add-nodal-mobile');

    if (!nodalInp) return;

    const normDiscom = (discom || '').trim().toUpperCase();
    const normDist = (district || '').trim().toUpperCase();
    const cleanDist = normDist.replace(/[^A-Z0-9]/g, '');

    const hierarchy = this.cachedMaster.xHierarchy || [];
    const seenHandles = new Set();

    let districtMatches = [];
    if (normDist) {
      districtMatches = hierarchy.filter(h => {
        const hDiscom = (h.discom_name || '').trim().toUpperCase();
        const hDist = (h.district_name || '').trim().toUpperCase();
        const cleanHDist = hDist.replace(/[^A-Z0-9]/g, '');
        const matchesDiscom = !hDiscom || hDiscom === normDiscom || hDiscom.includes(normDiscom);
        const matchesDist = cleanHDist && cleanDist && (
          cleanHDist.includes(cleanDist) || cleanDist.includes(cleanHDist) ||
          (normDist.includes('LUCKNOW') && cleanHDist.includes('GOMTI')) ||
          (normDist.includes('KANPUR') && (cleanHDist.includes('KANPUR') || hDiscom.includes('KESCO')))
        );
        return matchesDiscom && matchesDist && h.handle_name;
      });
      districtMatches.forEach(h => seenHandles.add(h.handle_name.toLowerCase()));
    }

    const discomHQ = hierarchy.filter(h => {
      const hDiscom = (h.discom_name || '').trim().toUpperCase();
      const hLevel = (h.hierarchy_level || '').toUpperCase();
      const hHandle = (h.handle_name || '').toUpperCase();
      const isHQ = (hLevel.includes('DISCOM') || hLevel.includes('HQ')) &&
                   (hDiscom === normDiscom || hHandle.includes(normDiscom));
      return isHQ && !seenHandles.has(h.handle_name.toLowerCase());
    });
    discomHQ.forEach(h => seenHandles.add(h.handle_name.toLowerCase()));

    let html = '';
    if (districtMatches.length > 0) {
      html += `<optgroup label="Direct District / Division Handle (${district})">`;
      districtMatches.forEach(h => {
        html += `<option value="${h.handle_name}">${h.handle_name} — ${h.district_name} (${h.discom_name})</option>`;
      });
      html += `</optgroup>`;
    }
    if (discomHQ.length > 0) {
      html += `<optgroup label="DISCOM Corporate HQ">`;
      discomHQ.forEach(h => {
        html += `<option value="${h.handle_name}">${h.handle_name} — ${h.discom_name} Corporate HQ</option>`;
      });
      html += `</optgroup>`;
    }
    if (!html) {
      html = `<option value="@${discom || 'UPPCL'}HQ">@${discom || 'UPPCL'}HQ</option>`;
    }
    nodalInp.innerHTML = html;

    const officer = (this.cachedMaster.nodalOfficers || []).find(o =>
      o.discom_name.toUpperCase() === normDiscom &&
      o.district_name.toUpperCase() === normDist
    );
    if (officer && nodalIdInp && nodalMobileInp) {
      nodalIdInp.value = officer.id;
      nodalMobileInp.value = officer.mobile;
    }
  },

  toggleForwardSection(checked) {
    const el = document.getElementById('forward-fields');
    if (el) el.style.display = checked ? 'grid' : 'none';
  },

  async checkDuplicatePostUrl(url) {
    if (!url || !url.trim()) return;
    try {
      const res = await this.api('/api/complaints/check-duplicate', {
        method: 'POST',
        body: JSON.stringify({ post_url: url.trim() })
      });
      const banner = document.getElementById('duplicate-warning-banner');
      if (res.is_duplicate && banner) {
        banner.style.display = 'block';
        banner.className = 'alert-banner alert-warning';
        banner.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 18px;"></i>
          <div style="flex: 1;">
            <b>Potential Duplicate Post Detected:</b> ${res.message}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.viewComplaint(${res.match.id})">Inspect Existing</button>
        `;
      }
    } catch (e) {}
  },

  async checkDuplicateText(text) {
    if (!text || text.trim().length < 30) return;
    try {
      const res = await this.api('/api/complaints/check-duplicate', {
        method: 'POST',
        body: JSON.stringify({ complaint_text: text.trim() })
      });
      const banner = document.getElementById('duplicate-warning-banner');
      if (res.is_duplicate && banner) {
        banner.style.display = 'block';
        banner.className = 'alert-banner alert-warning';
        banner.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 18px;"></i>
          <div style="flex: 1;">
            <b>Similar Complaint Found in Database:</b> ${res.message}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.viewComplaint(${res.match.id})">Inspect Existing</button>
        `;
      }
    } catch (e) {}
  },

  async submitNewComplaint(e) {
    e.preventDefault();

    const payload = {
      platform: document.getElementById('add-platform').value,
      monitored_account: document.getElementById('add-monitored-account').value,
      is_tagged: document.getElementById('add-is-tagged').value === '1',
      post_url: document.getElementById('add-post-url').value.trim(),
      consumer_handle: document.getElementById('add-consumer-handle').value.trim(),
      consumer_name: document.getElementById('add-consumer-name').value.trim(),
      category_name: document.getElementById('add-category').value,
      subcategory_name: document.getElementById('add-subcategory').value,
      discom_name: document.getElementById('add-discom').value,
      district_name: document.getElementById('add-district').value,
      priority: document.getElementById('add-priority').value,
      consumer_account_no: document.getElementById('add-consumer-account').value.trim(),
      complaint_text: document.getElementById('add-complaint-text').value.trim()
    };

    try {
      const res = await this.api('/api/complaints', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert(`Success! Complaint ${res.complaint.complaint_no} registered successfully.`);
      this.navigate('register');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  // -----------------------------------------------------------
  // COMPLAINT DETAILS & TIMELINE VIEW
  // -----------------------------------------------------------
  async viewComplaint(id) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target === this) App.closeModal()">
        <div class="modal-content" style="max-width: 900px;">
          <div class="modal-header">
            <h3><i class="fa-solid fa-spinner fa-spin"></i> Loading Complaint Details...</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await this.api(`/api/complaints/${id}`);
      const c = res.complaint;
      const timeline = res.timeline || [];
      const fwdLogs = res.forwardingLogs || [];
      const followLogs = res.followupLogs || [];
      const escLogs = res.escalationLogs || [];
      const evidence = res.evidence || [];

      const statusBadgeClass = `badge-${c.current_status.replace(/[\s—/]+/g, '-')}`;
      const prioBadgeClass = `badge-prio-${c.priority}`;
      const isOverdue = c.computed_overdue === 1;

      root.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target === this) App.closeModal()">
          <div class="modal-content" style="max-width: 940px;">
            <div class="modal-header">
              <div style="display: flex; align-items: center; gap: 12px;">
                <h3 style="margin: 0; font-size: 17px; color: var(--primary);">
                  <i class="fa-solid fa-file-invoice"></i> ${c.complaint_no}
                </h3>
                <span class="badge-status ${statusBadgeClass}">${c.current_status}</span>
                <span class="badge-prio ${prioBadgeClass}">${c.priority}</span>
                ${isOverdue ? '<span class="badge-overdue">SLA BREACHED</span>' : ''}
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <button class="btn btn-secondary btn-sm" onclick="window.print()"><i class="fa-solid fa-print"></i></button>
                <button class="modal-close" onclick="App.closeModal()">&times;</button>
              </div>
            </div>

            <div class="modal-body" style="padding: 24px;">
              <!-- 360 Grid -->
              <div class="details-grid">
                <!-- Left Column: Grievance Details & Timeline -->
                <div>
                  <!-- Grievance Card -->
                  <div class="details-card">
                    <div class="details-card-header">
                      <span><i class="fa-solid fa-comment-dots"></i> Consumer Grievance Details</span>
                      <span style="font-size: 11px; color: var(--text-muted);">${c.received_at} IST</span>
                    </div>

                    <div style="background-color: var(--bg-subtle); padding: 14px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 13px; line-height: 1.5; color: var(--text-main); margin-bottom: 14px;">
                      ${c.complaint_text}
                    </div>

                    <div class="info-row"><span class="info-label">Category:</span><span class="info-value"><b>${c.category_name}</b> ${c.subcategory_name ? `• ${c.subcategory_name}` : ''}</span></div>
                    <div class="info-row"><span class="info-label">Platform:</span><span class="info-value">${c.platform} (${c.is_tagged ? 'Tagged' : 'Untagged Monitoring'})</span></div>
                    <div class="info-row"><span class="info-label">Monitored Account:</span><span class="info-value"><b>${c.monitored_account}</b></span></div>
                    ${(() => {
                      let postHref = (c.post_url && c.post_url.startsWith('http'))
                        ? c.post_url
                        : (/^\d{15,25}$/.test(String(c.post_url || '').trim()) ? `https://x.com/i/status/${c.post_url.trim()}` : null);
                      if (!postHref && (c.complaint_no === 'UPPCL-SMC-202610-0120' || c.sheet_row_index === 122)) {
                        postHref = 'https://x.com/Hindustan0112/status/2112123946334335270';
                      }
                      const twitterHref = postHref ? postHref.replace('x.com', 'twitter.com') : null;
                      return postHref ? `
                        <div class="info-row">
                          <span class="info-label">Original Source URL:</span>
                          <span class="info-value" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <a href="${postHref}" target="_blank" rel="noopener noreferrer" style="color: var(--status-new); font-weight: 600;">
                              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open on X.com
                            </a>
                            <span style="color: var(--text-muted);">|</span>
                            <a href="${twitterHref}" target="_blank" rel="noopener noreferrer" style="color: #1d9bf0; font-weight: 600;">
                              <i class="fa-brands fa-twitter"></i> Twitter Mirror
                            </a>
                            <button type="button" class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${postHref}'); alert('URL copied to clipboard:\\n${postHref}');" style="padding: 2px 8px; font-size: 11px; cursor: pointer;">
                              <i class="fa-solid fa-copy"></i> Copy Link
                            </button>
                          </span>
                        </div>
                      ` : '';
                    })()}
                  </div>

                  <!-- Official X Response & Acknowledgment Panel -->
                  <div class="details-card">
                    <div class="details-card-header">
                      <span><i class="fa-brands fa-x-twitter"></i> Official X Acknowledgment & Public Reply</span>
                      <span class="badge-status badge-reply-${c.reply_status || 'PENDING'}">${c.reply_status || 'PENDING'}</span>
                    </div>

                    ${c.first_acknowledged_at ? `
                    <div class="info-row" style="margin-bottom: 8px;">
                      <span class="info-label">First Acknowledged:</span>
                      <span class="info-value"><b style="color: #10b981;"><i class="fa-solid fa-check-double"></i> ${c.first_acknowledged_at} IST</b></span>
                    </div>
                    ` : ''}

                    ${c.published_reply_id ? `
                    <div class="info-row" style="margin-bottom: 8px;">
                      <span class="info-label">Published Reply ID:</span>
                      <span class="info-value"><code>${c.published_reply_id}</code></span>
                    </div>
                    ` : ''}

                    <div class="reply-box">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="font-weight: 700; font-size: 12px; color: var(--primary);">
                          Approved Bilingual Response Draft
                        </label>
                        <select id="template-picker" class="form-control" style="width: auto; font-size: 11px; padding: 3px 8px;" onchange="App.applyTemplateToReply(${c.id}, this.value)">
                          <option value="">-- Insert Approved Template --</option>
                          ${(this.cachedMaster.replyTemplates || []).map(t => `<option value="${t.id}">${t.title} (${t.language})</option>`).join('')}
                        </select>
                      </div>

                      <textarea id="reply-text-input" class="form-control" rows="4" style="font-size: 13px; line-height: 1.4;" oninput="App.updateCharCount(this.value)">${c.reply_draft || ''}</textarea>

                      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <span id="char-counter" style="font-size: 11px; color: ${(c.reply_draft || '').length > 280 ? '#ef4444' : 'var(--text-muted)'}; font-weight: 600;">
                          ${(c.reply_draft || '').length} / 280 characters
                        </span>

                        <button class="btn btn-primary btn-sm" onclick="App.sendComplaintReply(${c.id})">
                          <i class="fa-brands fa-x-twitter"></i> Approve & Send Reply
                        </button>
                      </div>
                    </div>

                    ${(res.replies && res.replies.length > 0) ? `
                    <div style="margin-top: 14px;">
                      <b style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 6px;">Published Reply History:</b>
                      <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${res.replies.map(r => `
                          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; padding: 8px 12px; font-size: 12px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                              <span class="badge-status badge-reply-${r.status}" style="font-size: 10px;">${r.status}</span>
                              <span style="font-size: 11px; color: var(--text-muted);">${r.created_at}</span>
                            </div>
                            <div style="color: var(--text-main);">${r.reply_text}</div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                    ` : ''}
                  </div>

                  <!-- Resolution & Action Taken Report -->
                  ${c.discom_action_taken ? `
                  <div class="details-card" style="border-left: 4px solid var(--status-resolved);">
                    <div class="details-card-header">
                      <span style="color: #065f46;"><i class="fa-solid fa-circle-check"></i> DISCOM Action Taken & Resolution</span>
                      <span style="font-size: 11px; color: var(--text-muted);">${c.discom_response_date || ''}</span>
                    </div>
                    <div style="font-size: 13px; line-height: 1.5; color: #1e293b; margin-bottom: 10px;">
                      ${c.discom_action_taken}
                    </div>
                    <div class="info-row"><span class="info-label">Reported By:</span><span class="info-value"><b>${c.discom_reported_by || 'Field Official'}</b></span></div>
                    ${c.discom_evidence_url ? `
                    <div class="info-row"><span class="info-label">Resolution Proof:</span><span class="info-value"><a href="${c.discom_evidence_url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent);"><i class="fa-solid fa-link"></i> View Supporting Document</a></span></div>
                    ` : ''}
                  </div>
                  ` : ''}

                  <!-- Closure Verification Box -->
                  ${c.current_status === 'Closed' ? `
                  <div class="details-card" style="border-left: 4px solid var(--status-closed); background-color: #f0fdf4;">
                    <div class="details-card-header">
                      <span style="color: #166534;"><i class="fa-solid fa-shield-check"></i> Social Media Cell Verification Audit</span>
                      <span style="font-size: 11px; color: var(--text-muted);">${c.closure_date || ''}</span>
                    </div>
                    <div class="info-row"><span class="info-label">Verified By:</span><span class="info-value"><b>${c.closure_verified_by}</b></span></div>
                    <div class="info-row"><span class="info-label">Consumer Feedback:</span><span class="info-value"><b style="color: #059669;">${c.closure_satisfaction_status || 'Satisfied'}</b></span></div>
                    <div class="info-row"><span class="info-label">Verification Remarks:</span><span class="info-value">${c.closure_verification_notes || 'Verified'}</span></div>
                  </div>
                  ` : ''}

                  <!-- Chronological Append-Only Timeline -->
                  <div class="details-card">
                    <div class="details-card-header">
                      <span><i class="fa-solid fa-timeline"></i> Complete Chronological Activity Trail</span>
                    </div>
                    <div class="timeline">
                      ${timeline.map(t => `
                        <div class="timeline-item">
                          <div class="timeline-dot"></div>
                          <div class="timeline-header">
                            <span class="timeline-title">${t.action_type}</span>
                            ${t.new_status ? `<span class="badge-status badge-${t.new_status.replace(/[\s—/]+/g, '-')}" style="font-size: 9px; padding: 2px 5px;">${t.new_status}</span>` : ''}
                            <span class="timeline-time">• ${t.created_at} IST</span>
                          </div>
                          <div class="timeline-content">
                            <div style="font-weight: 600; color: var(--text-muted); font-size: 11px;">By: ${t.user_name} (${t.user_role})</div>
                            <div style="margin-top: 4px;">${t.remarks || 'No additional remarks'}</div>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>

                <!-- Right Column: Jurisdiction, Assignment, Follow-Up -->
                <div>
                  <!-- Jurisdiction Card -->
                  <div class="details-card">
                    <div class="details-card-header">
                      <span><i class="fa-solid fa-map"></i> Jurisdiction & Consumer</span>
                    </div>
                    <div class="info-row"><span class="info-label">DISCOM:</span><span class="info-value"><b>${c.discom_name}</b></span></div>
                    <div class="info-row"><span class="info-label">District:</span><span class="info-value"><b>${c.district_name}</b></span></div>
                    ${c.zone_name ? `<div class="info-row"><span class="info-label">Zone:</span><span class="info-value">${c.zone_name}</span></div>` : ''}
                    ${c.division_name ? `<div class="info-row"><span class="info-label">Division:</span><span class="info-value">${c.division_name}</span></div>` : ''}
                    <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 8px 0;">
                    <div class="info-row"><span class="info-label">Consumer:</span><span class="info-value">${c.consumer_name || 'N/A'}</span></div>
                    <div class="info-row"><span class="info-label">Handle:</span><span class="info-value">${c.consumer_handle || 'N/A'}</span></div>
                    <div class="info-row"><span class="info-label">Account No:</span><span class="info-value"><b>${c.consumer_account_no || 'Not Provided'}</b></span></div>
                    <div class="info-row"><span class="info-label">Contact:</span><span class="info-value">${c.consumer_mobile || 'Not Provided'}</span></div>
                  </div>

                  <!-- DISCOM & Authority Data Representation -->
                  <div class="details-card" style="border-left: 4px solid var(--primary);">
                    <div class="details-card-header">
                      <span><i class="fa-solid fa-building-flag"></i> DISCOM & Authority Information</span>
                    </div>
                    <div class="info-row"><span class="info-label">DISCOM:</span><span class="info-value"><b>${c.discom_name || 'UPPCL'}</b></span></div>
                    <div class="info-row"><span class="info-label">District:</span><span class="info-value"><b>${c.district_name || 'HQ / Unassigned'}</b></span></div>
                    <div class="info-row"><span class="info-label">Zone:</span><span class="info-value">${c.zone_name || '-'}</span></div>
                    <div class="info-row"><span class="info-label">Official Handle:</span><span class="info-value"><b>${c.assigned_nodal_officer_name ? (c.assigned_nodal_officer_name.startsWith('@') ? `<a href="https://x.com/${c.assigned_nodal_officer_name.replace('@', '')}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); font-weight: 700;"><i class="fa-brands fa-x-twitter"></i> ${c.assigned_nodal_officer_name}</a>` : c.assigned_nodal_officer_name) : (c.discom_name ? '@' + c.discom_name + 'HQ' : '@UPPCLLKO')}</b></span></div>
                    <div class="info-row"><span class="info-label">Monitored Account:</span><span class="info-value">${c.monitored_account || '@UPPCLLKO'}</span></div>
                    <div class="info-row"><span class="info-label">Current Status:</span><span class="info-value"><span class="badge-status badge-${(c.current_status || '').replace(/[\s—/]+/g, '-')}">${c.current_status}</span></span></div>
                    <div class="info-row"><span class="info-label">UPPCLLKO Replied:</span><span class="info-value">${(() => {
                      const hasReplied = Boolean(c.uppcl_replied === 1 || c.uppcl_replied === '1' || c.reply_within_30_min === 'YES' || Boolean(c.published_reply_id) || (c.reply_evidence && c.reply_evidence.length > 0));
                      return hasReplied 
                        ? `<b style="color: #059669;"><i class="fa-solid fa-circle-check"></i> YES</b> <small style="color: var(--text-muted);">(Verified historical reply on record${c.first_replied_at ? ` at ${c.first_replied_at}` : ''})</small>`
                        : `<b style="color: #64748b;"><i class="fa-solid fa-circle-xmark"></i> NO</b> <small style="color: var(--text-muted);">(No UPPCLLKO reply on record)</small>`;
                    })()}</span></div>
                    ${c.reply_evidence ? `<div class="info-row"><span class="info-label">Reply Evidence:</span><span class="info-value" style="font-size: 11px; color: #0284c7;"><i class="fa-solid fa-shield-halved"></i> ${c.reply_evidence}</span></div>` : ''}
                    <div class="info-row"><span class="info-label">Picked Status:</span><span class="info-value">${(() => {
                      const isApprec = c.picked_status === 'APPRECIATION' || c.current_status === 'Appreciation' || c.category_name === 'APPRECIATION';
                      const hasReplied = Boolean(c.uppcl_replied === 1 || c.uppcl_replied === '1' || c.reply_within_30_min === 'YES' || Boolean(c.published_reply_id) || (c.reply_evidence && c.reply_evidence.length > 0));
                      const isPicked = !isApprec && (hasReplied || c.picked_status === 'YES');
                      if (isApprec) return `<b>APPRECIATION</b> <small style="color: var(--text-muted);">(Consumer gratitude post)</small>`;
                      if (isPicked) return `<b style="color: #059669;">YES</b> <small style="color: var(--text-muted);">(${hasReplied ? 'UPPCLLKO replied in post' : 'Picked / Awaiting reply'})</small>`;
                      return `<b style="color: #64748b;">NO</b> <small style="color: var(--text-muted);">(UPPCLLKO not replied)</small>`;
                    })()}</span></div>
                    ${c.discom_tagged_in_reply ? `<div class="info-row"><span class="info-label">Tagged DISCOM Handle:</span><span class="info-value" style="color: var(--primary); font-weight: 700;"><i class="fa-brands fa-x-twitter"></i> ${c.discom_tagged_in_reply}</span></div>` : ''}
                    <div class="info-row"><span class="info-label">Shift:</span><span class="info-value">${c.link_shift || '-'}</span></div>
                    ${c.sheet_row_index ? `<div class="info-row"><span class="info-label">Sheet Row:</span><span class="info-value"><span class="badge-sheet-row">Row #${c.sheet_row_index}</span></span></div>` : ''}
                    <div class="info-row"><span class="info-label">30-Min First Reply:</span><span class="info-value"><b>${c.reply_within_30_min || '-'}</b> <small style="color: var(--text-muted);">(Time diff &lt; 30 mins)</small></span></div>
                    ${c.forwarding_remarks || c.remark ? `
                    <div style="margin-top: 10px; padding: 10px; background: var(--bg-subtle); border-radius: 4px; border: 1px solid var(--border-color);">
                      <div style="font-size: 11px; font-weight: 700; color: var(--primary); margin-bottom: 4px;">
                        <i class="fa-solid fa-note-sticky"></i> Remarks:
                      </div>
                      <div style="font-size: 12px; line-height: 1.4; color: var(--text-main); white-space: pre-wrap;">${c.forwarding_remarks || c.remark}</div>
                    </div>
                    ` : ''}

                    ${fwdLogs.length > 0 ? `
                    <div style="margin-top: 12px;">
                      <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
                        <i class="fa-solid fa-clock-rotate-left"></i> Forwarding History (${fwdLogs.length}):
                      </div>
                      <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${fwdLogs.map(fl => `
                          <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 10px; font-size: 11px;">
                            <div style="display: flex; justify-content: space-between; font-weight: 600; color: var(--primary);">
                              <span>To: ${fl.forwarded_to_officer} (${fl.discom_name}${fl.district_name ? ` • ${fl.district_name}` : ''})</span>
                              <span style="color: var(--text-muted); font-size: 10px;">${fl.created_at}</span>
                            </div>
                            <div style="color: var(--text-muted); font-size: 10px; margin-top: 2px;">Ref: ${fl.ref_no || 'N/A'} • Channel: ${fl.channel} • By: ${fl.forwarded_by}</div>
                            ${fl.remarks ? `<div style="margin-top: 3px; color: var(--text-main); font-size: 11px;">${fl.remarks}</div>` : ''}
                          </div>
                        `).join('')}
                      </div>
                    </div>
                    ` : ''}
                  </div>

                  <!-- Quick Action Panel -->
                  <div class="details-card" style="background-color: var(--bg-subtle);">
                    <div class="details-card-header">
                      <span><i class="fa-solid fa-bolt"></i> Workflow Actions</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                      ${this.renderDetailActionButtons(c)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="App.closeModal()">Close Window</button>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      alert(`Error loading details: ${err.message}`);
      App.closeModal();
    }
  },

  renderDetailActionButtons(c) {
    const isDiscom = this.user.role === 'DISCOM Nodal Officer';
    const isOperator = ['Administrator', 'Admin', 'Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'].includes(this.user.role);
    let btns = [];

    let postHref = (c.post_url && c.post_url.startsWith('http'))
      ? c.post_url
      : (/^\d{15,25}$/.test(String(c.post_url || '').trim()) ? `https://x.com/i/status/${c.post_url.trim()}` : null);
    if (!postHref && (c.complaint_no === 'UPPCL-SMC-202610-0120' || c.sheet_row_index === 122)) {
      postHref = 'https://x.com/Hindustan0112/status/2112123946334335270';
    }

    if (postHref) {
      const twitterHref = postHref.replace('x.com', 'twitter.com');
      btns.push(`<a href="${postHref}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:6px; text-decoration:none;"><i class="fa-brands fa-x-twitter"></i> Reply on X & Tag DISCOM <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i></a>`);
      btns.push(`<a href="${twitterHref}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px; text-decoration:none;"><i class="fa-brands fa-twitter"></i> Twitter Mirror <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i></a>`);
    }

    if (isOperator) {
      btns.push(`<button class="btn btn-secondary btn-sm" onclick="App.openFollowupModal(${c.id})"><i class="fa-solid fa-phone"></i> Record Follow-Up</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" onclick="App.openEscalateModal(${c.id})"><i class="fa-solid fa-arrow-up-right-dots"></i> Escalate Complaint</button>`);
    }

    if (isDiscom || isOperator) {
      btns.push(`<button class="btn btn-success btn-sm" onclick="App.openDiscomResponseModal(${c.id})"><i class="fa-solid fa-check"></i> Submit DISCOM Response</button>`);
    }

    if (isOperator && c.current_status === 'Resolved — Verification Pending') {
      btns.push(`<button class="btn btn-success btn-sm" style="background-color: #059669;" onclick="App.openVerifyModal(${c.id})"><i class="fa-solid fa-clipboard-check"></i> Verify & Close Complaint</button>`);
    }

    if (isOperator && c.current_status === 'Closed') {
      btns.push(`<button class="btn btn-secondary btn-sm" onclick="App.openReopenModal(${c.id})"><i class="fa-solid fa-rotate-left"></i> Reopen Complaint</button>`);
    }

    if (isOperator && c.current_status !== 'Closed') {
      btns.push(`<button class="btn btn-secondary btn-sm" onclick="App.openInvalidateModal(${c.id})"><i class="fa-solid fa-ban"></i> Mark as Duplicate / Invalid</button>`);
    }

    if (isOperator) {
      btns.push(`<button class="btn btn-danger btn-sm" style="background-color: #ef4444; border-color: #dc2626;" onclick="App.deleteFrivolousComplaint(${c.id}, '${c.complaint_no}')"><i class="fa-solid fa-trash-can"></i> Frivolous (Delete)</button>`);
    }

    return btns.join('');
  },

  closeModal() {
    const m = document.getElementById('modal-root');
    if (m) m.innerHTML = '';
  },

  async deleteFrivolousComplaint(id, complaintNo) {
    if (!confirm(`Are you sure you want to delete complaint ${complaintNo} as FRIVOLOUS?\n\nThis will permanently delete the complaint from both the dashboard and Google Sheet.`)) {
      return;
    }

    try {
      const res = await this.api(`/api/complaints/${id}`, {
        method: 'DELETE'
      });

      alert(res.message || `Complaint ${complaintNo} deleted successfully.`);
      this.closeModal();
      if (typeof this.loadDashTableData === 'function') {
        this.loadDashTableData();
      }
      if (typeof this.reloadDashboard === 'function') {
        this.reloadDashboard();
      }
      if (this.currentPage === 'register' && typeof this.loadRegisterData === 'function') {
        this.loadRegisterData();
      }
      this.pollSyncStatus();
    } catch (err) {
      alert(`Error deleting complaint: ${err.message}`);
    }
  },

  // -----------------------------------------------------------
  // ACTION MODALS
  // -----------------------------------------------------------
  async openForwardModal(id) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-share-nodes"></i> Forward Complaint to DISCOM</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.submitForward(event, ${id})">
            <div class="modal-body">
              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Target DISCOM *</label>
                <select id="fwd-discom" class="form-control" required onchange="App.handleFwdDiscomChange(this.value)">
                  <option value="">-- Select DISCOM --</option>
                  <option value="PUVVNL">PuVVNL (Purvanchal)</option>
                  <option value="MVVNL">MVVNL (Madhyanchal)</option>
                  <option value="DVVNL">DVVNL (Dakshinanchal)</option>
                  <option value="PVVNL">PVVNL (Pashchimanchal)</option>
                  <option value="KESCo">KESCo (Kanpur)</option>
                </select>
              </div>

              <div class="filter-group" style="margin-bottom: 12px;">
                <label>District (Optional)</label>
                <select id="fwd-district" class="form-control" onchange="App.handleFwdDistrictChange(this.value)">
                  <option value="">-- No Specific District / DISCOM HQ (Optional) --</option>
                </select>
              </div>

              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Assigned X-Handle *</label>
                <select id="fwd-nodal-name" class="form-control" required onchange="App.handleFwdHandleChange(this.value)">
                  <option value="">-- Select DISCOM & District Above --</option>
                </select>
                <input type="hidden" id="fwd-nodal-mobile">
                <input type="hidden" id="fwd-nodal-id">
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div class="filter-group">
                  <label>Communication Channel *</label>
                  <select id="fwd-channel" class="form-control" required>
                    <option value="Twitter / X Escalation">Twitter / X Escalation</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>
                <div class="filter-group">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label style="margin-bottom: 0;">Dispatch / Reference Number</label>
                    <span style="font-size: 10px; color: var(--primary); font-weight: 700;"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Generated</span>
                  </div>
                  <input type="text" id="fwd-ref-no" class="form-control" style="font-weight: 600; background-color: var(--bg-subtle);" placeholder="Auto-generating dispatch number...">
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">Unique official docket number for future tracking & e-Office citations.</div>
                </div>
              </div>

              <div class="filter-group" style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                  <label style="margin-bottom: 0;">Action Instructions / Remarks *</label>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; font-weight: 600; color: var(--primary);"><i class="fa-solid fa-file-invoice"></i> Forwarding Template:</span>
                    <select id="fwd-template-select" class="form-control" style="font-size: 12px; padding: 3px 8px; width: auto; max-width: 320px; height: 32px;" onchange="App.handleFwdTemplateSelect(this.value)">
                      <option value="">-- Choose Forwarding Template (प्रारूप चुनें) --</option>
                      <optgroup label="हिंदी निर्देश (Hindi Templates — अनुशंसित)">
                        ${(this.cachedMaster.forwardingTemplates || []).filter(t => (t.language || 'Hindi') === 'Hindi').map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
                      </optgroup>
                      <optgroup label="English Instructions">
                        ${(this.cachedMaster.forwardingTemplates || []).filter(t => t.language === 'English').map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
                      </optgroup>
                    </select>
                  </div>
                </div>
                <textarea id="fwd-remarks" class="form-control" rows="3" required placeholder="Select a forwarding template above or enter detailed instructions for field inspection..."></textarea>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                  <i class="fa-solid fa-circle-info"></i> Pre-approved operational instructions transmitted to the field team / assigned X-handle (उपलब्ध प्रारूप: हिंदी व English).
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Forward Complaint</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Immediately pre-fill default dispatch reference number so it is never blank
    const curYear = new Date().getFullYear();
    const initRefNo = `UPPCL/SMC/${curYear}/FWD-${String(id).padStart(4, '0')}`;
    const refInpInit = document.getElementById('fwd-ref-no');
    if (refInpInit) refInpInit.value = initRefNo;

    // Ensure xHierarchy is loaded in memory
    if (!this.cachedMaster.xHierarchy || this.cachedMaster.xHierarchy.length === 0) {
      try {
        const xh = await this.api('/api/master/x-hierarchy');
        this.cachedMaster.xHierarchy = xh.data || [];
      } catch (e) {}
    }

    // Auto-prepopulate DISCOM, District, exact Reference Number, and suggested Forwarding Template
    try {
      if (id) {
        const res = await this.api(`/api/complaints/${id}`);
        const c = res.complaint;
        if (c && document.getElementById('fwd-discom')) {
          const compNum = c.complaint_no ? c.complaint_no.replace('UPPCL-SMC-', '') : String(id).padStart(4, '0');
          const exactRefNo = `UPPCL/SMC/${curYear}/FWD-${compNum}`;
          const refInp = document.getElementById('fwd-ref-no');
          if (refInp) refInp.value = exactRefNo;

          // Auto-suggest forwarding template based on complaint category (prioritizes Hindi)
          this.autoSelectForwardingTemplate(c.category_name);

          const validDiscoms = ['PUVVNL', 'MVVNL', 'DVVNL', 'PVVNL', 'KESCo'];
          const matchedDiscom = validDiscoms.find(d => d.toUpperCase() === (c.discom_name || '').toUpperCase());
          if (matchedDiscom) {
            document.getElementById('fwd-discom').value = matchedDiscom;
            this.handleFwdDiscomChange(matchedDiscom);

            if (c.district_name) {
              const distSel = document.getElementById('fwd-district');
              const opt = Array.from(distSel.options).find(o => o.value.toUpperCase() === c.district_name.toUpperCase());
              if (opt) {
                distSel.value = opt.value;
              }
              this.handleFwdDistrictChange(distSel.value);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not auto-fill forward modal with complaint data:', e.message);
    }
  },

  handleFwdTemplateSelect(tplId) {
    if (!tplId) return;
    const list = this.cachedMaster.forwardingTemplates || [];
    const tpl = list.find(t => String(t.id) === String(tplId));
    const remarks = document.getElementById('fwd-remarks');
    if (tpl && remarks) {
      remarks.value = tpl.template_text;
      remarks.focus();
    }
  },

  autoSelectForwardingTemplate(category) {
    if (!category) return;
    const list = this.cachedMaster.forwardingTemplates || [];
    // Prioritize Hindi template matching the complaint category
    let matched = list.find(t => (t.category_name || '').toLowerCase() === category.toLowerCase() && (t.language || 'Hindi') === 'Hindi');
    if (!matched) {
      matched = list.find(t => (t.category_name || '').toLowerCase() === category.toLowerCase());
    }
    const sel = document.getElementById('fwd-template-select');
    const remarks = document.getElementById('fwd-remarks');
    if (matched && sel) {
      sel.value = matched.id;
      if (remarks && !remarks.value.trim()) {
        remarks.value = matched.template_text;
      }
    }
  },

  handleFwdDiscomChange(discom) {
    const distSel = document.getElementById('fwd-district');
    if (!distSel) return;
    distSel.innerHTML = '<option value="">-- No Specific District / DISCOM HQ (Optional) --</option>';
    const dObj = this.cachedMaster.discoms.find(d => d.code.toUpperCase() === (discom || '').toUpperCase());
    if (dObj && dObj.districts) {
      dObj.districts.forEach(dist => {
        distSel.innerHTML += `<option value="${dist.name}">${dist.name}</option>`;
      });
    }
    this.updateForwardHandlesDropdown(discom, distSel.value);
  },

  handleFwdDistrictChange(dist) {
    const discom = document.getElementById('fwd-discom')?.value || '';
    this.updateForwardHandlesDropdown(discom, dist);
  },

  updateForwardHandlesDropdown(discom, district = '', selectedHandle = '') {
    const handleSel = document.getElementById('fwd-nodal-name');
    if (!handleSel) return;

    if (!discom) {
      handleSel.innerHTML = '<option value="">-- Select DISCOM First --</option>';
      this.handleFwdHandleChange('');
      return;
    }

    const normDiscom = (discom || '').trim().toUpperCase();
    const normDistrict = (district || '').trim().toUpperCase();
    const cleanDist = normDistrict.replace(/[^A-Z0-9]/g, '');

    const hierarchy = this.cachedMaster.xHierarchy || [];
    const seenHandles = new Set();

    // 1. Direct District / Division matches
    let districtMatches = [];
    if (normDistrict) {
      districtMatches = hierarchy.filter(h => {
        const hDiscom = (h.discom_name || '').trim().toUpperCase();
        const hDist = (h.district_name || '').trim().toUpperCase();
        const cleanHDist = hDist.replace(/[^A-Z0-9]/g, '');
        const matchesDiscom = !hDiscom || hDiscom === normDiscom || hDiscom.includes(normDiscom);
        const matchesDist = cleanHDist && cleanDist && (
          cleanHDist.includes(cleanDist) || cleanDist.includes(cleanHDist) ||
          (normDistrict.includes('LUCKNOW') && cleanHDist.includes('GOMTI')) ||
          (normDistrict.includes('KANPUR') && (cleanHDist.includes('KANPUR') || hDiscom.includes('KESCO')))
        );
        return matchesDiscom && matchesDist && h.handle_name;
      });
      districtMatches.forEach(h => seenHandles.add(h.handle_name.toLowerCase()));
    }

    // 2. DISCOM Corporate HQ handle
    const discomHQ = hierarchy.filter(h => {
      const hDiscom = (h.discom_name || '').trim().toUpperCase();
      const hLevel = (h.hierarchy_level || '').toUpperCase();
      const hHandle = (h.handle_name || '').toUpperCase();
      const isHQ = (hLevel.includes('DISCOM') || hLevel.includes('HQ')) &&
                   (hDiscom === normDiscom || hHandle.includes(normDiscom));
      return isHQ && !seenHandles.has(h.handle_name.toLowerCase());
    });
    discomHQ.forEach(h => seenHandles.add(h.handle_name.toLowerCase()));

    // 3. Other District / Field handles for this DISCOM
    const otherDiscom = hierarchy.filter(h => {
      const hDiscom = (h.discom_name || '').trim().toUpperCase();
      const isDist = (h.hierarchy_level || '').includes('District');
      return hDiscom === normDiscom && isDist && !seenHandles.has(h.handle_name.toLowerCase());
    });
    otherDiscom.forEach(h => seenHandles.add(h.handle_name.toLowerCase()));

    // 4. Apex / Corporate Escalation handles
    const apex = hierarchy.filter(h => {
      const isApex = (h.hierarchy_level || '').toUpperCase().includes('APEX');
      return isApex && !seenHandles.has(h.handle_name.toLowerCase());
    });

    let chosenHandle = selectedHandle;
    if (!chosenHandle) {
      if (districtMatches.length > 0) {
        chosenHandle = districtMatches[0].handle_name;
      } else if (discomHQ.length > 0) {
        chosenHandle = discomHQ[0].handle_name;
      }
    }

    let html = '';

    // Group 1: Direct District / Division Handle
    if (districtMatches.length > 0) {
      html += `<optgroup label="Direct District / Field Office Handle (${district})">`;
      districtMatches.forEach(h => {
        const isSel = (chosenHandle && chosenHandle.toLowerCase() === h.handle_name.toLowerCase()) ? 'selected' : '';
        html += `<option value="${h.handle_name}" ${isSel}>${h.handle_name} — ${h.district_name} (${h.discom_name})</option>`;
      });
      html += `</optgroup>`;
    }

    // Group 2: DISCOM Corporate HQ
    if (discomHQ.length > 0) {
      html += `<optgroup label="DISCOM Corporate HQ">`;
      discomHQ.forEach(h => {
        const isSel = (chosenHandle && chosenHandle.toLowerCase() === h.handle_name.toLowerCase()) ? 'selected' : '';
        html += `<option value="${h.handle_name}" ${isSel}>${h.handle_name} — ${h.discom_name} Corporate HQ</option>`;
      });
      html += `</optgroup>`;
    }

    // Group 3: Other Field / Division Handles under this DISCOM
    if (otherDiscom.length > 0) {
      html += `<optgroup label="Other Field Handles under ${discom}">`;
      otherDiscom.forEach(h => {
        const isSel = (chosenHandle && chosenHandle.toLowerCase() === h.handle_name.toLowerCase()) ? 'selected' : '';
        html += `<option value="${h.handle_name}" ${isSel}>${h.handle_name} — ${h.district_name}</option>`;
      });
      html += `</optgroup>`;
    }

    // Group 4: Apex / Corporate Escalation Handles
    if (apex.length > 0) {
      html += `<optgroup label="Apex / Corporate Escalation Handles">`;
      apex.forEach(h => {
        const isSel = (chosenHandle && chosenHandle.toLowerCase() === h.handle_name.toLowerCase()) ? 'selected' : '';
        html += `<option value="${h.handle_name}" ${isSel}>${h.handle_name} — ${h.discom_name || 'UPPCL Apex HQ'}${h.district_name ? ` (${h.district_name})` : ''}</option>`;
      });
      html += `</optgroup>`;
    }

    if (!html) {
      html = `<option value="@${discom}HQ">@${discom}HQ — ${discom} Corporate HQ</option>`;
    }

    handleSel.innerHTML = html;
    this.handleFwdHandleChange(handleSel.value);
  },

  handleFwdHandleChange(handleVal) {
    const mobInp = document.getElementById('fwd-nodal-mobile');
    const idInp = document.getElementById('fwd-nodal-id');
    if (!mobInp || !idInp) return;

    const discom = (document.getElementById('fwd-discom')?.value || '').trim();
    const district = (document.getElementById('fwd-district')?.value || '').trim();

    let officer = null;
    if (this.cachedMaster.nodalOfficers && this.cachedMaster.nodalOfficers.length > 0) {
      if (handleVal) {
        officer = this.cachedMaster.nodalOfficers.find(o =>
          o.twitter_handle && o.twitter_handle.toLowerCase().replace('@', '') === handleVal.toLowerCase().replace('@', '')
        );
      }
      if (!officer && discom && district) {
        officer = this.cachedMaster.nodalOfficers.find(o =>
          o.discom_name.toUpperCase() === discom.toUpperCase() &&
          o.district_name.toUpperCase() === district.toUpperCase()
        );
      }
    }

    if (officer) {
      mobInp.value = officer.mobile || '';
      idInp.value = officer.id || '';
    } else {
      mobInp.value = '';
      idInp.value = '';
    }
  },

  async submitForward(e, id) {
    e.preventDefault();
    const discom = document.getElementById('fwd-discom')?.value || '';
    const assignedHandle = document.getElementById('fwd-nodal-name')?.value || '';
    const refNo = (document.getElementById('fwd-ref-no')?.value || '').trim();
    const remarks = (document.getElementById('fwd-remarks')?.value || '').trim();

    if (!discom) {
      alert('Please select a Target DISCOM.');
      document.getElementById('fwd-discom')?.focus();
      return;
    }
    if (!assignedHandle) {
      alert('Please select an Assigned X-Handle from the hierarchy list.');
      document.getElementById('fwd-nodal-name')?.focus();
      return;
    }
    if (!remarks) {
      alert('Action Instructions / Remarks are required.');
      document.getElementById('fwd-remarks')?.focus();
      return;
    }

    const payload = {
      discom_name: discom,
      district_name: document.getElementById('fwd-district')?.value || '',
      assigned_nodal_officer_name: assignedHandle,
      assigned_nodal_officer_mobile: document.getElementById('fwd-nodal-mobile')?.value || '',
      assigned_nodal_officer_id: document.getElementById('fwd-nodal-id')?.value || '',
      forwarding_channel: document.getElementById('fwd-channel')?.value || 'Twitter / X Escalation',
      forwarding_ref_no: refNo,
      forwarding_remarks: remarks
    };

    try {
      const res = await this.api(`/api/complaints/${id}/forward`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert(`Complaint successfully forwarded to ${assignedHandle}!\n\nReference Docket: ${refNo || res.ref_no || 'Assigned'}\nStatus: Forwarded\nInstructions: Transmitted to Field Team / Assigned X-Handle.`);
      App.closeModal();
      App.viewComplaint(id);
      App.loadRegisterData();
    } catch (err) {
      alert(`Forwarding Error: ${err.message}`);
    }
  },

  openFollowupModal(id) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-phone"></i> Record Follow-Up with DISCOM</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.submitFollowup(event, ${id})">
            <div class="modal-body">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div class="filter-group">
                  <label>X-Handle / Authority Contacted *</label>
                  <input type="text" id="fol-officer" class="form-control" required placeholder="@handle or Authority designation...">
                </div>
                <div class="filter-group">
                  <label>Channel *</label>
                  <select id="fol-channel" class="form-control" required>
                    <option value="Twitter / X Escalation">Twitter / X Escalation</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Phone Call">Telephone / Mobile Call</option>
                    <option value="WhatsApp">WhatsApp Message</option>
                    <option value="Email">Email</option>
                  </select>
                </div>
              </div>

              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Next Follow-Up Date</label>
                <input type="date" id="fol-next-date" class="form-control">
              </div>

              <div class="filter-group">
                <label>Follow-Up Remarks & Status Update *</label>
                <textarea id="fol-remarks" class="form-control" rows="3" required placeholder="Conversation summary and commitment given by officer..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary"><i class="fa-solid fa-check"></i> Record Follow-Up</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitFollowup(e, id) {
    e.preventDefault();
    const payload = {
      officer_contacted: document.getElementById('fol-officer').value.trim(),
      channel: document.getElementById('fol-channel').value,
      next_followup_date: document.getElementById('fol-next-date').value,
      remarks: document.getElementById('fol-remarks').value.trim()
    };

    try {
      await this.api(`/api/complaints/${id}/followup`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('Follow-up logged successfully.');
      App.closeModal();
      App.viewComplaint(id);
      App.loadRegisterData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  openEscalateModal(id) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-arrow-up-right-dots" style="color: #dc2626;"></i> Escalate Complaint</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.submitEscalate(event, ${id})">
            <div class="modal-body">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div class="filter-group">
                  <label>Escalation Level *</label>
                  <select id="esc-level" class="form-control" required>
                    <option value="1">Level 1 — Superintending Engineer (SE)</option>
                    <option value="2">Level 2 — Chief Engineer / Director</option>
                    <option value="3">Level 3 — Managing Director / Chairman</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label>Escalated To X-Handle / Authority *</label>
                  <input type="text" id="esc-to" class="form-control" required placeholder="@handle or Authority designation...">
                </div>
              </div>

              <div class="filter-group">
                <label>Mandatory Escalation Reason *</label>
                <textarea id="esc-reason" class="form-control" rows="3" required placeholder="Provide clear operational reason for escalation (e.g. repeated failure to restore, urgent public hazard)..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-danger"><i class="fa-solid fa-triangle-exclamation"></i> Confirm Escalation</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitEscalate(e, id) {
    e.preventDefault();
    const payload = {
      escalation_level: document.getElementById('esc-level').value,
      escalated_to: document.getElementById('esc-to').value.trim(),
      reason: document.getElementById('esc-reason').value.trim()
    };

    try {
      await this.api(`/api/complaints/${id}/escalate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('Complaint escalated successfully.');
      App.closeModal();
      App.viewComplaint(id);
      App.loadRegisterData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  openDiscomResponseModal(id) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-check" style="color: #059669;"></i> Submit DISCOM Action Taken Report</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.submitDiscomResponse(event, ${id})">
            <div class="modal-body">
              <div class="alert-banner alert-info" style="margin-bottom: 14px;">
                <i class="fa-solid fa-circle-info"></i>
                <span>Submitting this report will mark the complaint as <b>Resolved — Verification Pending</b>. Final verified closure will be recorded after Social Media Cell verification.</span>
              </div>

              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Reporting Official Name & Designation *</label>
                <input type="text" id="resp-officer" class="form-control" required value="${this.user.full_name} (${this.user.designation || 'Nodal Officer'})">
              </div>

              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Action Taken / Technical Resolution Details *</label>
                <textarea id="resp-action" class="form-control" rows="4" required placeholder="Describe technical corrective actions, transformer test results, restored feeder name, lineman attendance..."></textarea>
              </div>

              <div class="filter-group">
                <label>Supporting Evidence URL / Document Link (Optional)</label>
                <input type="url" id="resp-evidence" class="form-control" placeholder="https://... photo of repaired line, work order, or test report">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-success"><i class="fa-solid fa-paper-plane"></i> Submit Action Taken</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitDiscomResponse(e, id) {
    e.preventDefault();
    const payload = {
      reported_by: document.getElementById('resp-officer').value.trim(),
      action_taken: document.getElementById('resp-action').value.trim(),
      evidence_url: document.getElementById('resp-evidence').value.trim()
    };

    try {
      await this.api(`/api/complaints/${id}/discom-response`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('DISCOM action taken submitted successfully. Awaiting verification.');
      App.closeModal();
      App.viewComplaint(id);
      App.loadRegisterData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  openVerifyModal(id) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-clipboard-check" style="color: #059669;"></i> Verify & Close Complaint</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.submitVerify(event, ${id})">
            <div class="modal-body">
              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Consumer Satisfaction Status *</label>
                <select id="ver-satisfaction" class="form-control" required>
                  <option value="Satisfied">Satisfied — Consumer confirmed resolution</option>
                  <option value="Partially Satisfied">Partially Satisfied — Resolution verified with caveats</option>
                  <option value="Deemed Satisfied">Deemed Satisfied — DISCOM evidence verified, no consumer dispute</option>
                </select>
              </div>

              <div class="filter-group">
                <label>Mandatory Verification Notes *</label>
                <textarea id="ver-notes" class="form-control" rows="3" required placeholder="Verification steps taken (e.g. verified on phone with consumer, Twitter reply posted to consumer acknowledging closure)..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-success" style="background-color: #059669;"><i class="fa-solid fa-check-double"></i> Verify & Close</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitVerify(e, id) {
    e.preventDefault();
    const payload = {
      satisfaction_status: document.getElementById('ver-satisfaction').value,
      verification_notes: document.getElementById('ver-notes').value.trim()
    };

    try {
      await this.api(`/api/complaints/${id}/verify-closure`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('Complaint verified and closed successfully.');
      App.closeModal();
      App.viewComplaint(id);
      App.loadRegisterData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  openReopenModal(id) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-rotate-left"></i> Reopen Closed Complaint</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.submitReopen(event, ${id})">
            <div class="modal-body">
              <div class="filter-group">
                <label>Mandatory Reopen Reason *</label>
                <textarea id="reopen-reason" class="form-control" rows="3" required placeholder="Specify why the closed complaint is being reopened (e.g. consumer tweeted again stating fault returned, incomplete repair)..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary"><i class="fa-solid fa-rotate-left"></i> Reopen Complaint</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitReopen(e, id) {
    e.preventDefault();
    const payload = {
      reason: document.getElementById('reopen-reason').value.trim()
    };

    try {
      await this.api(`/api/complaints/${id}/reopen`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('Complaint reopened.');
      App.closeModal();
      App.viewComplaint(id);
      App.loadRegisterData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  openInvalidateModal(id) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-ban" style="color: #64748b;"></i> Mark Duplicate / Invalidate</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.submitInvalidate(event, ${id})">
            <div class="modal-body">
              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Duplicate of Complaint ID (Optional)</label>
                <input type="number" id="inv-duplicate-id" class="form-control" placeholder="Reference numeric ID if duplicate">
              </div>

              <div class="filter-group">
                <label>Mandatory Invalidation Reason *</label>
                <textarea id="inv-reason" class="form-control" rows="3" required placeholder="Reason for invalidation (e.g. spam post, outside UP jurisdiction, exact duplicate of existing ticket)..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-danger"><i class="fa-solid fa-ban"></i> Confirm Invalidation</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitInvalidate(e, id) {
    e.preventDefault();
    const payload = {
      duplicate_of_id: document.getElementById('inv-duplicate-id').value.trim() || null,
      reason: document.getElementById('inv-reason').value.trim()
    };

    try {
      await this.api(`/api/complaints/${id}/invalidate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('Complaint marked as duplicate / invalid.');
      App.closeModal();
      App.viewComplaint(id);
      App.loadRegisterData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  // -----------------------------------------------------------
  // REPORTS VIEW & OPERATIONAL INTELLIGENCE SUITE
  // -----------------------------------------------------------
  async renderReports(container) {
    if (!container) container = document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Operational Intelligence & Redressal Reports</h2>
          <p>Authoritative Google Sheet Analytics, DISCOM Performance, Shift Audits, and Compliance Center</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" onclick="App.triggerSheetSync()">
            <i class="fa-solid fa-arrows-rotate"></i> Sync Sheet
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.print()">
            <i class="fa-solid fa-print"></i> Print
          </button>
        </div>
      </div>

      <!-- 7-Tab Navigation -->
      <div class="analytics-tab-bar">
        <div class="analytics-tab ${this.currentReportTab === 'time_trends' ? 'active' : ''}" onclick="App.switchReportTab('time_trends')">
          <i class="fa-solid fa-chart-line"></i> 1. Time Analysis
        </div>
        <div class="analytics-tab ${this.currentReportTab === 'handles' ? 'active' : ''}" onclick="App.switchReportTab('handles')">
          <i class="fa-brands fa-x-twitter"></i> 2. Monitored Handles
        </div>
        <div class="analytics-tab ${this.currentReportTab === 'discoms' ? 'active' : ''}" onclick="App.switchReportTab('discoms')">
          <i class="fa-solid fa-building-columns"></i> 3. DISCOM Performance
        </div>
        <div class="analytics-tab ${this.currentReportTab === 'shifts' ? 'active' : ''}" onclick="App.switchReportTab('shifts')">
          <i class="fa-solid fa-business-time"></i> 4. Shift Workloads
        </div>
        <div class="analytics-tab ${this.currentReportTab === 'sla_compliance' ? 'active' : ''}" onclick="App.switchReportTab('sla_compliance')">
          <i class="fa-solid fa-stopwatch"></i> 5. 30-Min SLA Compliance
        </div>
        <div class="analytics-tab ${this.currentReportTab === 'data_quality' ? 'active' : ''}" onclick="App.switchReportTab('data_quality')">
          <i class="fa-solid fa-triangle-exclamation"></i> 6. Data Quality Audit
        </div>
        <div class="analytics-tab ${this.currentReportTab === 'export_center' ? 'active' : ''}" onclick="App.switchReportTab('export_center')">
          <i class="fa-solid fa-file-export"></i> 7. Export Center
        </div>
      </div>

      <div id="report-tab-body">
        <div style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading analytics data...</div>
      </div>
    `;

    this.loadReportsData();
  },

  switchReportTab(tabId) {
    this.currentReportTab = tabId;
    this.renderReports();
  },

  async loadReportsData() {
    const body = document.getElementById('report-tab-body');
    if (!body) return;

    try {
      const data = await this.api('/api/reports/analytics');
      const tab = this.currentReportTab || 'time_trends';

      if (tab === 'time_trends') {
        const daily = data.timeTrends?.daily || [];
        const hourly = data.timeTrends?.hourly || [];
        const weekdays = data.timeTrends?.weekdays || [];
        const peakHour = hourly.slice().sort((a, b) => b.count - a.count)[0] || { hr: '12', count: 0 };
        const peakDay = weekdays[0] || { day: 'Monday', count: 0 };

        body.innerHTML = `
          <div class="kpi-grid" style="margin-bottom: 20px;">
            <div class="kpi-card">
              <div class="kpi-label">Peak Inflow Hour</div>
              <div class="kpi-value">${peakHour.hr}:00 - ${peakHour.hr}:59</div>
              <div class="kpi-sub">${peakHour.count} complaints received</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Busiest Day of Week</div>
              <div class="kpi-value">${peakDay.day}</div>
              <div class="kpi-sub">${peakDay.count} total grievances</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Daily Average Inflow</div>
              <div class="kpi-value">${daily.length ? Math.round(daily.reduce((s, r) => s + r.count, 0) / daily.length) : 0}</div>
              <div class="kpi-sub">Across ${daily.length} active recording days</div>
            </div>
          </div>

          <div class="charts-grid" style="margin-bottom: 20px;">
            <div class="chart-card">
              <div class="chart-header">
                <div class="chart-title"><i class="fa-solid fa-clock"></i> Inflow Distribution by Hour of Day (00:00 - 23:00 IST)</div>
              </div>
              <div class="chart-body"><canvas id="chart-rep-hourly"></canvas></div>
            </div>
            <div class="chart-card">
              <div class="chart-header">
                <div class="chart-title"><i class="fa-solid fa-calendar-week"></i> Inflow by Day of Week</div>
              </div>
              <div class="chart-body"><canvas id="chart-rep-weekdays"></canvas></div>
            </div>
          </div>

          <div class="card-table">
            <h3 style="padding: 16px 20px; font-size: 14px; border-bottom: 1px solid var(--border-color);">Daily Inflow Summary</h3>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date (IST)</th>
                    <th>Complaints Count</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${daily.map(d => `
                    <tr>
                      <td style="font-weight: 600;">${d.day}</td>
                      <td><b>${d.count}</b> complaints</td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="App.navigate('register', { from_date: '${d.day}', to_date: '${d.day}' })">
                          <i class="fa-solid fa-filter"></i> View Records
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;

        if (typeof Chart !== 'undefined') {
          const ctxHr = document.getElementById('chart-rep-hourly');
          if (ctxHr) {
            new Chart(ctxHr, {
              type: 'bar',
              data: {
                labels: hourly.map(h => `${h.hr}:00`),
                datasets: [{ label: 'Inflow', data: hourly.map(h => h.count), backgroundColor: '#008080' }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
          }
          const ctxWd = document.getElementById('chart-rep-weekdays');
          if (ctxWd) {
            new Chart(ctxWd, {
              type: 'bar',
              data: {
                labels: weekdays.map(w => w.day),
                datasets: [{ label: 'Complaints', data: weekdays.map(w => w.count), backgroundColor: '#123456' }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
          }
        }
      } else if (tab === 'handles') {
        const handles = data.sourceHandles || [];
        body.innerHTML = `
          <div class="card-table">
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h3 style="font-size: 15px; margin-bottom: 4px;">Authoritative Monitored Handles & Jurisdiction Breakdown</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Inflow distribution across official Apex and DISCOM X handles</p>
              </div>
            </div>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Official X Handle</th>
                    <th>Organization / Office</th>
                    <th>Complaints Count</th>
                    <th>Share of Inflow</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${handles.map(h => `
                    <tr>
                      <td>
                        <b style="color: var(--primary);"><i class="fa-brands fa-x-twitter"></i> ${h.handle}</b>
                      </td>
                      <td style="font-size: 12px; color: var(--text-muted);">
                        ${h.handle === '@UPPCLLKO' ? 'UPPCL Corporate Headquarters (Apex)' : (h.handle.includes('CMOffice') ? 'Chief Minister Office UP' : (h.handle.includes('Sharma') ? 'Hon. Energy Minister Office' : 'DISCOM / Field Office'))}
                      </td>
                      <td><b>${h.count}</b></td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span>${h.share_pct}%</span>
                          <div class="rate-progress-track" style="width: 100px; margin: 0;">
                            <div class="rate-progress-fill" style="width: ${Math.min(h.share_pct, 100)}%; background-color: var(--accent);"></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="App.navigate('register', { assigned_handle: '${h.handle}' })">
                          <i class="fa-solid fa-filter"></i> Filter Register
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (tab === 'discoms') {
        const discoms = data.discomPerformance || [];
        body.innerHTML = `
          <div class="card-table">
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color);">
              <h3 style="font-size: 15px; margin-bottom: 4px;">5 DISCOM Operational Redressal Comparison</h3>
              <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Authoritative breakdown across PuVVNL, MVVNL, DVVNL, PVVNL, and KESCo</p>
            </div>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>DISCOM</th>
                    <th>Total Inflow</th>
                    <th>Picked (YES)</th>
                    <th>Appreciation</th>
                    <th>Verified Closed</th>
                    <th>Resolution Rate</th>
                    <th>Pending Action</th>
                    <th>Verification Due</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${discoms.map(d => `
                    <tr>
                      <td><b style="font-size: 14px; color: var(--primary);">${d.discom_name}</b></td>
                      <td><b>${d.total}</b></td>
                      <td><span class="badge-picked yes">${d.picked_yes}</span></td>
                      <td><span class="badge-picked appreciation">${d.appreciation}</span></td>
                      <td><b style="color: #059669;">${d.closed}</b></td>
                      <td>
                        <div>
                          <b>${d.resolution_pct}%</b>
                          <div class="rate-progress-track" style="width: 90px; margin-top: 4px;">
                            <div class="rate-progress-fill" style="width: ${Math.min(d.resolution_pct, 100)}%; background-color: ${d.resolution_pct > 70 ? '#10b981' : (d.resolution_pct > 40 ? '#f59e0b' : '#ef4444')};"></div>
                          </div>
                        </div>
                      </td>
                      <td><span style="color: #f59e0b; font-weight: 700;">${d.pending}</span></td>
                      <td><span style="color: #0284c7; font-weight: 700;">${d.verification_pending}</span></td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="App.navigate('register', { discom: '${d.discom_name}' })">
                          <i class="fa-solid fa-table-list"></i> View
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (tab === 'shifts') {
        const linkShifts = data.shifts?.linkShifts || [];

        body.innerHTML = `
          <div class="kpi-grid" style="margin-bottom: 20px;">
            <div class="kpi-card" style="border-top: 3px solid #6366f1;">
              <div class="kpi-label">Shift 1 (06:00 - 14:00)</div>
              <div class="kpi-value">${linkShifts.find(s => s.shift && s.shift.includes('1'))?.count || 0}</div>
              <div class="kpi-sub">Morning operational window</div>
            </div>
            <div class="kpi-card" style="border-top: 3px solid #06b6d4;">
              <div class="kpi-label">Shift 2 (14:00 - 22:00)</div>
              <div class="kpi-value">${linkShifts.find(s => s.shift && s.shift.includes('2'))?.count || 0}</div>
              <div class="kpi-sub">Evening peak window</div>
            </div>
            <div class="kpi-card" style="border-top: 3px solid #f59e0b;">
              <div class="kpi-label">Shift 3 (22:00 - 06:00)</div>
              <div class="kpi-value">${linkShifts.find(s => s.shift && s.shift.includes('3'))?.count || 0}</div>
              <div class="kpi-sub">Night emergency window</div>
            </div>
          </div>

          <div class="card-table">
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color);">
              <h3 style="font-size: 15px; margin-bottom: 4px;">Shift Workload & Action Audit</h3>
              <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Captured Link Shift distribution across 24x7 monitoring cycles</p>
            </div>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Shift Designation</th>
                    <th>Captured Inflow (Link Shift)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${linkShifts.map(s => `
                    <tr>
                      <td><b><span class="badge-shift">${s.shift}</span></b></td>
                      <td><b>${s.count}</b> complaints</td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="App.navigate('register', { shift: '${s.shift}' })">
                          <i class="fa-solid fa-filter"></i> View Shift Register
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (tab === 'sla_compliance') {
        const comp = data.compliance || {};
        const reply30Pct = comp.reply30Pct || 0;
        const total = comp.total || 0;
        const reply30Yes = comp.reply_30_yes || 0;
        const reply30No = comp.reply_30_no || 0;
        const reply60Yes = comp.reply_60_yes || 0;

        body.innerHTML = `
          <div class="kpi-grid" style="margin-bottom: 20px;">
            <div class="kpi-card" style="border-top: 3px solid ${reply30Pct >= 80 ? '#10b981' : (reply30Pct >= 50 ? '#f59e0b' : '#ef4444')};">
              <div class="kpi-label">30-Min First Reply Compliance</div>
              <div class="kpi-value">${reply30Pct}%</div>
              <div class="kpi-sub">${reply30Yes} / ${total} grievances compliant</div>
            </div>
            <div class="kpi-card" style="border-top: 3px solid #059669;">
              <div class="kpi-label">Complied Within 30 Min</div>
              <div class="kpi-value">${reply30Yes}</div>
              <div class="kpi-sub">SLA strictly met</div>
            </div>
            <div class="kpi-card" style="border-top: 3px solid #ef4444;">
              <div class="kpi-label">Breached 30-Min SLA</div>
              <div class="kpi-value">${reply30No}</div>
              <div class="kpi-sub">Exceeded 30-min window</div>
            </div>
            <div class="kpi-card" style="border-top: 3px solid #0284c7;">
              <div class="kpi-label">Replied Within 60 Min</div>
              <div class="kpi-value">${reply60Yes}</div>
              <div class="kpi-sub">Second-tier resolution</div>
            </div>
          </div>

          <div class="details-card">
            <div class="alert-banner alert-info" style="margin-bottom: 20px;">
              <i class="fa-solid fa-shield-halved" style="font-size: 20px;"></i>
              <div>
                <b style="display: block; font-size: 14px; margin-bottom: 4px;">SLA Benchmark Standard (Laqshya Media / UPPCL Social Media Cell)</b>
                <span>Per corporation directive, all valid grievances received across official monitored channels must receive an initial acknowledgement and DISCOM docket forwarding within <b>30 minutes</b>. Response tracking metrics are audited continuously from the authoritative Google Sheet.</span>
              </div>
            </div>
          </div>
        `;
      } else if (tab === 'data_quality') {
        const qualityRows = data.dataQuality || [];
        body.innerHTML = `
          <div class="card-table">
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h3 style="font-size: 15px; margin-bottom: 4px;">Authoritative Data Quality Audit Center</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Automated validation scans of Google Sheet 'Twitter Complaint List' rows</p>
              </div>
              <span class="badge" style="background: ${qualityRows.length > 0 ? '#fee2e2' : '#dcfce7'}; color: ${qualityRows.length > 0 ? '#b91c1c' : '#15803d'}; font-weight: 700; padding: 6px 12px; border-radius: 6px;">
                ${qualityRows.length} Records Requiring Attention
              </span>
            </div>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Sheet Row #</th>
                    <th>Complaint ID</th>
                    <th>Received (IST)</th>
                    <th>Consumer Handle</th>
                    <th>DISCOM</th>
                    <th>Audit Flags</th>
                    <th>Direct Resolution Link</th>
                  </tr>
                </thead>
                <tbody>
                  ${qualityRows.length === 0 ? `
                    <tr><td colspan="7" style="text-align: center; padding: 35px; color: #059669; font-weight: 600;"><i class="fa-solid fa-check-double"></i> 100% Data Quality Clean: All Google Sheet records have valid URLs, Handles, Dates, and DISCOM assignments.</td></tr>
                  ` : qualityRows.map(q => {
                    const flags = JSON.parse(q.data_quality_flags || '[]');
                    return `
                      <tr>
                        <td><span class="badge-sheet-row">Row #${q.sheet_row_index || '-'}</span></td>
                        <td><a href="javascript:void(0)" onclick="App.viewComplaint(${q.id})" style="font-weight: 700; color: var(--primary);">${q.complaint_no}</a></td>
                        <td>${(q.received_at || '').substring(0, 16)}</td>
                        <td>${q.consumer_handle || '<span style="color:#ef4444;">Missing</span>'}</td>
                        <td>${q.discom_name || '<span style="color:#ef4444;">Unassigned</span>'}</td>
                        <td>
                          ${flags.map(f => `<span class="badge-quality-issue">${f}</span>`).join(' ')}
                        </td>
                        <td>
                          ${q.sheet_row_index ? `
                            <a href="https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/edit?gid=598922870#gid=598922870&range=A${q.sheet_row_index}" target="_blank" rel="noopener noreferrer" class="blue-post-link">
                              <i class="fa-solid fa-up-right-from-square"></i> Open Row ${q.sheet_row_index} in Sheet
                            </a>
                          ` : '-'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (tab === 'export_center') {
        body.innerHTML = `
          <div class="details-card">
            <h3 style="margin-bottom: 16px; font-size: 15px;">Custom Report Builder & Official Data Export</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px;">
              <div class="filter-group">
                <label>Report Dataset *</label>
                <select id="rep-type" class="form-control">
                  <option value="daily_ops">1. Daily Operational Report</option>
                  <option value="x_hierarchy">2. X Hierarchy-wise Report</option>
                  <option value="discom_district">3. DISCOM & District Performance</option>
                  <option value="category_wise">4. Category-wise Grievance Breakdown</option>
                  <option value="pending_overdue">5. Pending & Overdue Analysis</option>
                  <option value="discom_followup">6. DISCOM Follow-Up & Reminder Report</option>
                  <option value="escalation_report">7. Escalation Hierarchy Trail</option>
                  <option value="resolved_vs_closed">8. Resolved vs Verified-Closed Audit</option>
                  <option value="audit_trail">9. Security & User Audit Trail</option>
                </select>
              </div>

              <div class="filter-group">
                <label>From Date</label>
                <input type="date" id="rep-from" class="form-control">
              </div>

              <div class="filter-group">
                <label>To Date</label>
                <input type="date" id="rep-to" class="form-control">
              </div>

              <div class="filter-group">
                <label>DISCOM Filter</label>
                <select id="rep-discom" class="form-control">
                  <option value="All">All DISCOMs</option>
                  <option value="PUVVNL">PuVVNL</option>
                  <option value="MVVNL">MVVNL</option>
                  <option value="DVVNL">DVVNL</option>
                  <option value="PVVNL">PVVNL</option>
                  <option value="KESCo">KESCo</option>
                </select>
              </div>
            </div>

            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
              <button class="btn btn-primary" onclick="App.downloadReport('excel')">
                <i class="fa-solid fa-file-excel"></i> Download Excel (.xlsx)
              </button>
              <button class="btn btn-secondary" onclick="App.downloadReport('csv')">
                <i class="fa-solid fa-file-csv"></i> Download CSV
              </button>
              <button class="btn btn-secondary" onclick="window.print()">
                <i class="fa-solid fa-print"></i> Print Formatted View
              </button>
            </div>

            <div class="alert-banner alert-info">
              <i class="fa-solid fa-circle-info"></i>
              <span>All exports strictly pull live data from the authoritative Google Sheet. Hindi Unicode text is preserved with UTF-8 encoding.</span>
            </div>
          </div>
        `;
      }
    } catch (err) {
      body.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444;">Error loading reports: ${err.message}</div>`;
    }
  },

  handleReportTypeChange() {
    // Optional report-specific field updates
  },

  async downloadReport(format) {
    const type = document.getElementById('rep-type')?.value || 'daily_ops';
    const fromDate = document.getElementById('rep-from')?.value || '';
    const toDate = document.getElementById('rep-to')?.value || '';
    const discom = document.getElementById('rep-discom')?.value || 'All';

    const q = new URLSearchParams({
      type,
      format,
      from_date: fromDate,
      to_date: toDate,
      discom
    });
    if (this.token) q.set('token', this.token);

    try {
      const res = await fetch(`/api/reports/export?${q.toString()}`, {
        headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Report export failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `UPPCL_SMC_${type}_${dateStr}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Direct blob download fallback:', err.message);
      window.open(`/api/reports/export?${q.toString()}`, '_blank');
    }
  },

  // -----------------------------------------------------------
  // X HIERARCHY MASTER VIEW
  // -----------------------------------------------------------
  async renderXHierarchy(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Official X (Twitter) Account Hierarchy</h2>
          <p>Authoritative Source of Truth for UPPCL Apex, DISCOM HQs, and Field District Handles</p>
        </div>
        <div class="page-actions">
          ${['Administrator', 'Admin', 'Super Administrator'].includes(this.user.role) ? `
          <button class="btn btn-primary btn-sm" onclick="App.openAddXHandleModal()">
            <i class="fa-solid fa-plus"></i> Add Handle
          </button>` : ''}
        </div>
      </div>

      <div class="card-table">
        <div class="filter-bar">
          <div class="filter-group" style="min-width: 180px;">
            <label>Hierarchy Level</label>
            <select id="xh-level" class="form-control" onchange="App.filterXHierarchy()">
              <option value="All">All Levels</option>
              <option value="Apex / Government / Corporate HQ">Apex / Government / Corporate HQ</option>
              <option value="DISCOM Corporate HQ">DISCOM Corporate HQ</option>
              <option value="District / Field Office">District / Field Office</option>
            </select>
          </div>

          <div class="filter-group" style="min-width: 140px;">
            <label>DISCOM</label>
            <select id="xh-discom" class="form-control" onchange="App.filterXHierarchy()">
              <option value="All">All DISCOMs</option>
              <option value="PUVVNL">PuVVNL</option>
              <option value="MVVNL">MVVNL</option>
              <option value="DVVNL">DVVNL</option>
              <option value="PVVNL">PVVNL</option>
              <option value="KESCo">KESCo</option>
            </select>
          </div>

          <div class="filter-group" style="flex: 1; min-width: 200px;">
            <label>Search Handle / District</label>
            <input type="text" id="xh-search" class="form-control" placeholder="Search handle name, URL..." oninput="App.filterXHierarchy()">
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table" id="xh-table">
            <thead>
              <tr>
                <th class="sortable" onclick="App.sortStaticTable('xh-table', 0)" title="Click to sort by Serial Number">
                  <div class="sort-header-inner"><span>Sr No</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('xh-table', 1)" title="Click to sort by Hierarchy Level">
                  <div class="sort-header-inner"><span>Hierarchy Level</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('xh-table', 2)" title="Click to sort by DISCOM">
                  <div class="sort-header-inner"><span>DISCOM</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('xh-table', 3)" title="Click to sort by District / Entity">
                  <div class="sort-header-inner"><span>District / Entity</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('xh-table', 4)" title="Click to sort by Handle Name">
                  <div class="sort-header-inner"><span>Handle Name</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('xh-table', 5)" title="Click to sort by Official Account URL">
                  <div class="sort-header-inner"><span>Official Account URL</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('xh-table', 6)" title="Click to sort by Monitoring Status">
                  <div class="sort-header-inner"><span>Monitored</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('xh-table', 7)" title="Click to sort by Status">
                  <div class="sort-header-inner"><span>Status</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
              </tr>
            </thead>
            <tbody id="xh-table-body">
              <tr><td colspan="8" style="text-align: center; padding: 30px;">Loading authoritative hierarchy...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.filterXHierarchy();
  },

  async filterXHierarchy() {
    const level = document.getElementById('xh-level') ? document.getElementById('xh-level').value : 'All';
    const discom = document.getElementById('xh-discom') ? document.getElementById('xh-discom').value : 'All';
    const search = document.getElementById('xh-search') ? document.getElementById('xh-search').value.trim() : '';

    const q = new URLSearchParams();
    if (level !== 'All') q.set('level', level);
    if (discom !== 'All') q.set('discom', discom);
    if (search) q.set('search', search);

    try {
      const res = await this.api(`/api/master/x-hierarchy?${q.toString()}`);
      const tbody = document.getElementById('xh-table-body');
      if (!tbody) return;

      tbody.innerHTML = res.data.map(h => `
        <tr>
          <td><b>${h.sr_no || '-'}</b></td>
          <td><span class="badge-status ${h.hierarchy_level.includes('Apex') ? 'badge-New' : (h.hierarchy_level.includes('Corporate') ? 'badge-Forwarded' : 'badge-Closed')}">${h.hierarchy_level}</span></td>
          <td><b>${h.discom_name || 'HQ / Apex'}</b></td>
          <td>${h.district_name || 'All UP'}</td>
          <td><b style="color: var(--primary);"><i class="fa-brands fa-x-twitter"></i> ${h.handle_name}</b></td>
          <td>
            <a href="${h.account_url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); text-decoration: none;">
              ${h.account_url} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i>
            </a>
          </td>
          <td>${h.is_monitored ? '<span style="color:#059669; font-weight:700;"><i class="fa-solid fa-check"></i> Monitored</span>' : '<span style="color:var(--text-light);">Routing</span>'}</td>
          <td>${h.is_active ? '<span class="badge-prio badge-prio-Low" style="background:#d1fae5; color:#065f46;">Active</span>' : '<span class="badge-prio badge-prio-Low">Inactive</span>'}</td>
        </tr>
      `).join('');
    } catch (e) {}
  },

  // -----------------------------------------------------------
  // NODAL OFFICERS DIRECTORY
  // -----------------------------------------------------------
  async renderNodalOfficers(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>DISCOM Nodal Officers Directory</h2>
          <p>Official Roster of Superintending Engineers (SE), Executive Engineers (EE) & Chief Engineers (CE)</p>
        </div>
      </div>

      <div class="card-table">
        <div class="filter-bar">
          <div class="filter-group" style="min-width: 160px;">
            <label>DISCOM</label>
            <select id="no-discom" class="form-control" onchange="App.filterNodalOfficers()">
              <option value="All">All DISCOMs</option>
              <option value="PUVVNL">PuVVNL</option>
              <option value="MVVNL">MVVNL</option>
              <option value="DVVNL">DVVNL</option>
              <option value="PVVNL">PVVNL</option>
              <option value="KESCo">KESCo</option>
            </select>
          </div>
          <div class="filter-group" style="flex: 1;">
            <label>Search District / Officer</label>
            <input type="text" id="no-search" class="form-control" placeholder="Search district name..." oninput="App.filterNodalOfficers()">
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table" id="no-table">
            <thead>
              <tr>
                <th class="sortable" onclick="App.sortStaticTable('no-table', 0)" title="Click to sort by DISCOM">
                  <div class="sort-header-inner"><span>DISCOM</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('no-table', 1)" title="Click to sort by District">
                  <div class="sort-header-inner"><span>District</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('no-table', 2)" title="Click to sort by Nodal Officer Name">
                  <div class="sort-header-inner"><span>Nodal Officer Name</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('no-table', 3)" title="Click to sort by Designation">
                  <div class="sort-header-inner"><span>Designation</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('no-table', 4)" title="Click to sort by Official Contact Number">
                  <div class="sort-header-inner"><span>Official Contact Number</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('no-table', 5)" title="Click to sort by Twitter Handle">
                  <div class="sort-header-inner"><span>Twitter Handle</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('no-table', 6)" title="Click to sort by Facebook Page">
                  <div class="sort-header-inner"><span>Facebook Page</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
                <th class="sortable" onclick="App.sortStaticTable('no-table', 7)" title="Click to sort by Status">
                  <div class="sort-header-inner"><span>Status</span><i class="fa-solid fa-sort sort-icon"></i></div>
                </th>
              </tr>
            </thead>
            <tbody id="no-table-body">
              <tr><td colspan="8" style="text-align: center; padding: 30px;">Loading directory...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.filterNodalOfficers();
  },

  async filterNodalOfficers() {
    const discom = document.getElementById('no-discom') ? document.getElementById('no-discom').value : 'All';
    const search = document.getElementById('no-search') ? document.getElementById('no-search').value.toLowerCase().trim() : '';

    const q = new URLSearchParams();
    if (discom !== 'All') q.set('discom', discom);

    try {
      const res = await this.api(`/api/master/nodal-officers?${q.toString()}`);
      const tbody = document.getElementById('no-table-body');
      if (!tbody) return;

      let list = res.data || [];
      if (search) {
        list = list.filter(o => o.district_name.toLowerCase().includes(search) || o.officer_name.toLowerCase().includes(search));
      }

      tbody.innerHTML = list.map(o => `
        <tr>
          <td><b>${o.discom_name}</b></td>
          <td><b>${o.district_name}</b></td>
          <td>${o.officer_name}</td>
          <td><span class="badge-status badge-Forwarded">${o.designation}</span></td>
          <td><b style="color: var(--primary);"><i class="fa-solid fa-phone"></i> ${o.mobile}</b></td>
          <td>${o.twitter_handle ? `<i class="fa-brands fa-x-twitter"></i> ${o.twitter_handle}` : '-'}</td>
          <td>${o.facebook_url ? `<a href="${o.facebook_url}" target="_blank" style="color: var(--status-new); font-size: 11px;"><i class="fa-brands fa-facebook"></i> Page</a>` : '-'}</td>
          <td>${o.is_active ? '<span style="color:#059669; font-weight:700;">Active</span>' : 'Inactive'}</td>
        </tr>
      `).join('');
    } catch (e) {}
  },

  // -----------------------------------------------------------
  // USERS MANAGEMENT VIEW (ADMIN)
  // -----------------------------------------------------------
  async renderUsers(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>User Accounts & Role-Based Access Control</h2>
          <p>Manage Operators, Supervisors, DISCOM Nodal Officers, and System Administrators</p>
        </div>
      </div>

      <div class="card-table">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>DISCOM Scope</th>
                <th>Designation</th>
                <th>Mobile</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              <tr><td colspan="8" style="text-align: center; padding: 30px;">Loading users...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const res = await this.api('/api/users');
      const tbody = document.getElementById('users-table-body');
      if (!tbody) return;

      tbody.innerHTML = res.data.map(u => `
        <tr>
          <td>${u.id}</td>
          <td><b>${u.full_name}</b></td>
          <td><code>${u.username}</code></td>
          <td><span class="badge-status badge-New">${u.role}</span></td>
          <td><b>${u.discom_name || 'All DISCOMs'}</b></td>
          <td>${u.designation || '-'}</td>
          <td>${u.mobile || '-'}</td>
          <td>${u.is_active ? '<span style="color:#059669; font-weight:700;">Active</span>' : '<span style="color:#ef4444;">Inactive</span>'}</td>
        </tr>
      `).join('');
    } catch (e) {}
  },

  // -----------------------------------------------------------
  // AUDIT TRAIL VIEW
  // -----------------------------------------------------------
  async renderAuditLogs(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>System Security & User Activity Audit Trail</h2>
          <p>Append-only tamper-resistant record of logins, state transitions, updates, and data exports</p>
        </div>
      </div>

      <div class="card-table">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Timestamp (IST)</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody id="audit-table-body">
              <tr><td colspan="8" style="text-align: center; padding: 30px;">Loading audit logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const res = await this.api('/api/audit-logs');
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;

      tbody.innerHTML = res.data.map(l => `
        <tr>
          <td>${l.id}</td>
          <td>${l.created_at}</td>
          <td><b>${l.username}</b></td>
          <td><span class="badge-status badge-Duplicate--Invalid" style="font-size: 10px;">${l.user_role}</span></td>
          <td><b>${l.action}</b></td>
          <td>${l.entity_type} #${l.entity_id}</td>
          <td>${l.details}</td>
          <td><code>${l.ip_address}</code></td>
        </tr>
      `).join('');
    } catch (e) {}
  },

  // -----------------------------------------------------------
  // SETTINGS VIEW
  // -----------------------------------------------------------
  async renderSettings(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>System Configuration & SLA Settings</h2>
          <p>Configurable SLAs, Default Values, and Operational Thresholds</p>
        </div>
      </div>

      <div class="details-card" style="margin-bottom: 20px;">
        <div class="details-card-header">
          <span><i class="fa-solid fa-palette"></i> Interface Appearance</span>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">Select system appearance mode. Preferences are preserved across sessions.</p>
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn ${this.theme === 'light' ? 'btn-primary' : 'btn-secondary'}" onclick="App.setTheme('light', true); App.renderSettings(document.getElementById('page-content'))">
            <i class="fa-solid fa-sun" style="color: #f59e0b;"></i> Light Mode (Default)
          </button>
          <button type="button" class="btn ${this.theme === 'midnight' ? 'btn-primary' : 'btn-secondary'}" onclick="App.setTheme('midnight', true); App.renderSettings(document.getElementById('page-content'))">
            <i class="fa-solid fa-cloud" style="color: #94a3b8;"></i> Midnight Theme
          </button>
          <button type="button" class="btn ${this.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" onclick="App.setTheme('dark', true); App.renderSettings(document.getElementById('page-content'))">
            <i class="fa-solid fa-moon" style="color: #6366f1;"></i> Dark Mode
          </button>
        </div>
      </div>

      <div class="details-card">
        <form onsubmit="App.saveSettings(event)">
          <div id="settings-fields-container" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px;">
            <div>Loading settings...</div>
          </div>
          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Save Configuration</button>
        </form>
      </div>
    `;

    try {
      const res = await this.api('/api/settings');
      const c = document.getElementById('settings-fields-container');
      if (!c) return;

      c.innerHTML = res.data.map(s => `
        <div class="filter-group">
          <label>${s.description || s.key}</label>
          <input type="text" class="form-control setting-input" data-key="${s.key}" value="${s.value}">
        </div>
      `).join('');
    } catch (e) {}
  },

  async saveSettings(e) {
    e.preventDefault();
    const inputs = document.querySelectorAll('.setting-input');
    const settings = [];
    inputs.forEach(inp => {
      settings.push({ key: inp.dataset.key, value: inp.value.trim() });
    });

    try {
      await this.api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings })
      });
      alert('Settings updated successfully.');
    } catch (err) {
      alert(`Error saving settings: ${err.message}`);
    }
  },

  // -----------------------------------------------------------
  // NOTIFICATIONS MODAL & ACTIONS
  // -----------------------------------------------------------
  toggleNotificationModal() {
    const root = document.getElementById('modal-root');
    const notifs = this.notifications || [];
    
    root.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target === this) App.closeModal()">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h3><i class="fa-solid fa-bell"></i> System Notifications & Alerts</h3>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" onclick="App.markAllNotificationsRead()">Mark All as Read</button>
              <button class="modal-close" onclick="App.closeModal()">&times;</button>
            </div>
          </div>
          <div class="modal-body" style="padding: 16px; max-height: 480px; overflow-y: auto;">
            ${notifs.length === 0 ? '<div style="text-align: center; color: var(--text-muted); padding: 30px;">No notifications yet.</div>' : ''}
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${notifs.map(n => {
                const icon = n.type === 'CRITICAL' ? 'fa-solid fa-triangle-exclamation' : (n.type === 'WARNING' ? 'fa-solid fa-clock' : 'fa-solid fa-info-circle');
                const color = n.type === 'CRITICAL' ? '#ef4444' : (n.type === 'WARNING' ? '#f59e0b' : '#3b82f6');
                const bg = n.is_read ? 'var(--bg-subtle)' : 'var(--bg-card)';
                return `
                  <div style="background: ${bg}; border-left: 4px solid ${color}; border-radius: 6px; padding: 12px; display: flex; gap: 12px; align-items: flex-start; cursor: pointer;" onclick="App.handleNotifClick(${n.id}, ${n.complaint_id || 'null'})">
                    <i class="${icon}" style="color: ${color}; font-size: 18px; margin-top: 2px;"></i>
                    <div style="flex: 1;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <b style="font-size: 13px; color: var(--text-main);">${n.title}</b>
                        <span style="font-size: 11px; color: var(--text-muted);">${n.created_at || ''}</span>
                      </div>
                      <div style="font-size: 12px; color: var(--text-muted);">${n.message}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async markAllNotificationsRead() {
    try {
      await this.api('/api/notifications/read-all', { method: 'POST' });
      await this.pollNotifications();
      this.closeModal();
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async handleNotifClick(notifId, complaintId) {
    try {
      await this.api(`/api/notifications/${notifId}/read`, { method: 'POST' });
      await this.pollNotifications();
    } catch(e) {}
    this.closeModal();
    if (complaintId) {
      this.viewComplaint(complaintId);
    }
  },

  // -----------------------------------------------------------
  // INTERNAL SUPPORT TICKETS
  // -----------------------------------------------------------
  openInternalTicketModal(complaintId = null) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target === this) App.closeModal()">
        <div class="modal-content" style="max-width: 580px;">
          <div class="modal-header">
            <h3><i class="fa-solid fa-headset"></i> Report Dashboard / Operational Issue</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.submitInternalTicket(event)">
            <div class="modal-body" style="padding: 20px;">
              <input type="hidden" id="tkt-complaint-id" value="${complaintId || ''}">
              <div class="filter-group" style="margin-bottom: 14px;">
                <label>Issue Subject *</label>
                <input type="text" id="tkt-subject" class="form-control" required placeholder="Brief summary of the issue (e.g. Ingestion lag, wrong district)">
              </div>
              <div class="filter-group" style="margin-bottom: 14px;">
                <label>Category</label>
                <select id="tkt-category" class="form-control">
                  <option value="Bug / Technical Issue">Bug / Technical Issue</option>
                  <option value="X API / Ingestion Issue">X API / Ingestion Issue</option>
                  <option value="District / Routing Mistake">District / Routing Mistake</option>
                  <option value="Template / Reply Issue">Template / Reply Issue</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="filter-group" style="margin-bottom: 14px;">
                <label>Priority</label>
                <select id="tkt-priority" class="form-control">
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div class="filter-group">
                <label>Detailed Description *</label>
                <textarea id="tkt-description" class="form-control" rows="4" required placeholder="Describe what occurred, any error messages, or steps to reproduce..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Submit Ticket</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitInternalTicket(e) {
    e.preventDefault();
    const payload = {
      subject: document.getElementById('tkt-subject').value.trim(),
      category: document.getElementById('tkt-category').value,
      priority: document.getElementById('tkt-priority').value,
      description: document.getElementById('tkt-description').value.trim(),
      complaint_id: document.getElementById('tkt-complaint-id').value || null
    };

    try {
      const res = await this.api('/api/internal-tickets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert(`Success! Internal Ticket ${res.ticket_no} submitted.`);
      this.closeModal();
      this.pollNotifications();
      if (this.currentPage === 'internal-tickets') {
        this.renderInternalTickets(document.getElementById('page-content'));
      }
    } catch (err) {
      alert(`Error submitting ticket: ${err.message}`);
    }
  },

  async renderInternalTickets(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Internal Support & Operations Tickets</h2>
          <p>Tickets raised by operators, nodal officers, and supervisors regarding dashboard functions and data issues</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="App.openInternalTicketModal()"><i class="fa-solid fa-plus"></i> Raise New Ticket</button>
        </div>
      </div>

      <div class="card-table">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Raised By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody id="internal-tkt-body">
              <tr><td colspan="7" style="text-align: center; padding: 25px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading tickets...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const res = await this.api('/api/internal-tickets');
      const tickets = res.data || [];
      const tbody = document.getElementById('internal-tkt-body');
      if (!tbody) return;

      if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 25px;">No internal tickets found.</td></tr>';
        return;
      }

      tbody.innerHTML = tickets.map(t => `
        <tr>
          <td><b style="color: var(--primary);">${t.ticket_no}</b></td>
          <td><b>${t.subject}</b><div style="font-size: 11px; color: var(--text-muted);">${t.description}</div></td>
          <td>${t.category}</td>
          <td><span class="badge-prio badge-prio-${t.priority}">${t.priority}</span></td>
          <td><span class="badge-status ${t.status === 'Resolved' || t.status === 'Closed' ? 'badge-Closed' : 'badge-New'}">${t.status}</span></td>
          <td>${t.created_by_name}</td>
          <td>${t.created_at}</td>
        </tr>
      `).join('');
    } catch (e) {
      container.innerHTML += `<div class="alert-banner alert-warning">${e.message}</div>`;
    }
  },

  // -----------------------------------------------------------
  // X TEMPLATE PREVIEW & REPLY SENDING
  // -----------------------------------------------------------
  async applyTemplateToReply(complaintId, templateId) {
    if (!templateId) return;
    try {
      const res = await this.api('/api/templates/preview', {
        method: 'POST',
        body: JSON.stringify({ complaint_id: complaintId, template_id: parseInt(templateId, 10) })
      });
      const textarea = document.getElementById('reply-text-input');
      if (textarea && res.rendered_text) {
        textarea.value = res.rendered_text;
        this.updateCharCount(textarea.value);
      }
    } catch (e) {
      alert(`Error previewing template: ${e.message}`);
    }
  },

  updateCharCount(val) {
    const el = document.getElementById('char-counter');
    if (el) {
      const len = val.length;
      el.textContent = `${len} / 280 characters`;
      el.style.color = len > 280 ? '#ef4444' : 'var(--text-muted)';
    }
  },

  async sendComplaintReply(id) {
    const text = document.getElementById('reply-text-input').value.trim();
    if (!text) {
      alert('Reply text cannot be empty');
      return;
    }

    if (text.length > 280) {
      if (!confirm(`Warning: Reply is ${text.length} characters (exceeds standard 280 X limit). Send anyway?`)) return;
    }

    try {
      const res = await this.api(`/api/complaints/${id}/send-reply`, {
        method: 'POST',
        body: JSON.stringify({ reply_text: text })
      });
      alert(`Success! Reply processed: ${res.result.status}`);
      this.viewComplaint(id);
    } catch (err) {
      alert(`Error sending reply: ${err.message}`);
    }
  },

  // -----------------------------------------------------------
  // TEMPLATES MANAGEMENT VIEW
  // -----------------------------------------------------------
  async renderTemplates(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Bilingual Approved Reply Templates</h2>
          <p>Standardized, approved bilingual (Hindi/English) acknowledgement and holding replies for X consumers</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="App.openAddTemplateModal()"><i class="fa-solid fa-plus"></i> New Template</button>
        </div>
      </div>

      <div class="card-table">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Category</th>
                <th>Language</th>
                <th>Title</th>
                <th>Approved Template Body</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="tpl-table-body">
              <tr><td colspan="7" style="text-align: center; padding: 25px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading templates...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const res = await this.api('/api/templates');
      const templates = res.data || [];
      const tbody = document.getElementById('tpl-table-body');
      if (!tbody) return;

      if (templates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 25px;">No templates configured.</td></tr>';
        return;
      }

      tbody.innerHTML = templates.map(t => `
        <tr>
          <td><span style="font-weight: 700; color: var(--primary);">${t.template_code}</span></td>
          <td><b>${t.category_name}</b></td>
          <td><span class="badge-status ${t.language === 'Hindi' ? 'badge-New' : 'badge-Forwarded'}">${t.language}</span></td>
          <td><b>${t.title}</b></td>
          <td style="max-width: 380px; font-size: 12px; line-height: 1.4; white-space: pre-wrap;">${t.template_body}</td>
          <td><span class="badge-status ${t.is_active ? 'badge-Closed' : 'badge-Pending'}">${t.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="App.openEditTemplateModal(${t.id})" title="Edit Template"><i class="fa-solid fa-pen"></i></button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      container.innerHTML += `<div class="alert-banner alert-warning">${e.message}</div>`;
    }
  },

  openAddTemplateModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target === this) App.closeModal()">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h3><i class="fa-solid fa-plus"></i> Add Approved Reply Template</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.saveNewTemplate(event)">
            <div class="modal-body" style="padding: 20px;">
              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Template Code * (e.g. TPL-OUTAGE-HI)</label>
                <input type="text" id="tpl-code" class="form-control" required placeholder="TPL-...">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div class="filter-group">
                  <label>Grievance Category *</label>
                  <select id="tpl-category" class="form-control" required>
                    ${this.cachedMaster.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                  </select>
                </div>
                <div class="filter-group">
                  <label>Language *</label>
                  <select id="tpl-lang" class="form-control" required>
                    <option value="Hindi">Hindi</option>
                    <option value="English">English</option>
                  </select>
                </div>
              </div>
              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Template Title *</label>
                <input type="text" id="tpl-title" class="form-control" required placeholder="Descriptive title">
              </div>
              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Template Body * (Supports {COMPLAINT_NO}, {DISTRICT}, {DISCOM}, {DISCOM_HANDLE})</label>
                <textarea id="tpl-body" class="form-control" rows="4" required placeholder="Enter approved response message..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Save Template</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async saveNewTemplate(e) {
    e.preventDefault();
    const payload = {
      template_code: document.getElementById('tpl-code').value.trim(),
      category_name: document.getElementById('tpl-category').value,
      language: document.getElementById('tpl-lang').value,
      title: document.getElementById('tpl-title').value.trim(),
      template_body: document.getElementById('tpl-body').value.trim()
    };

    try {
      await this.api('/api/templates', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('Template added successfully.');
      this.closeModal();
      await this.loadMasterData();
      this.renderTemplates(document.getElementById('page-content'));
    } catch (err) {
      alert(`Error saving template: ${err.message}`);
    }
  },

  async openEditTemplateModal(id) {
    const t = (this.cachedMaster.replyTemplates || []).find(item => item.id === id);
    if (!t) return;

    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target === this) App.closeModal()">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h3><i class="fa-solid fa-pen"></i> Edit Template: ${t.template_code}</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <form onsubmit="App.saveEditTemplate(event, ${id})">
            <div class="modal-body" style="padding: 20px;">
              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Template Title *</label>
                <input type="text" id="edit-tpl-title" class="form-control" required value="${t.title}">
              </div>
              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Template Body * (Supports {COMPLAINT_NO}, {DISTRICT}, {DISCOM}, {DISCOM_HANDLE})</label>
                <textarea id="edit-tpl-body" class="form-control" rows="4" required>${t.template_body}</textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Update Template</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async saveEditTemplate(e, id) {
    e.preventDefault();
    const payload = {
      title: document.getElementById('edit-tpl-title').value.trim(),
      template_body: document.getElementById('edit-tpl-body').value.trim()
    };

    try {
      await this.api(`/api/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      alert('Template updated successfully.');
      this.closeModal();
      await this.loadMasterData();
      this.renderTemplates(document.getElementById('page-content'));
    } catch (err) {
      alert(`Error updating template: ${err.message}`);
    }
  },

  // -----------------------------------------------------------
  // SYSTEM HEALTH & 24/7 OPERATIONS MONITOR VIEW
  // -----------------------------------------------------------
  async renderSystemHealth(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>System Health & 24/7 Operations Monitor</h2>
          <p>Real-time operational vitals, X (Twitter) API connectivity, background worker lag, and SLA queues</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" onclick="App.renderSystemHealth(document.getElementById('page-content'))"><i class="fa-solid fa-rotate"></i> Refresh Vitals</button>
          <button class="btn btn-primary" onclick="App.triggerManualSync()"><i class="fa-solid fa-arrows-rotate"></i> Trigger X Ingestion Sync</button>
        </div>
      </div>

      <div id="health-root" style="padding: 10px 0;">
        <div style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i> Loading operational vitals...</div>
      </div>
    `;

    try {
      const res = await this.api('/api/health');
      const root = document.getElementById('health-root');
      if (!root) return;

      const isStop = res.x_integration && res.x_integration.emergency_stop;
      const workerActive = res.worker && res.worker.status === 'running';

      root.innerHTML = `
        ${isStop ? `
        <div class="emergency-banner">
          <div>
            <i class="fa-solid fa-hand fa-xl" style="margin-right: 12px;"></i>
            <b>EMERGENCY STOP IS CURRENTLY ACTIVE:</b> All automated outbound replies to consumers on X are completely halted.
          </div>
          <button class="btn btn-secondary btn-sm" style="color: #ef4444; background: #fff;" onclick="App.toggleEmergencyStop(false)">Deactivate Emergency Stop</button>
        </div>
        ` : ''}

        <div class="health-grid">
          <!-- Card 1: X Integration Status -->
          <div class="health-card">
            <h4>
              <span><i class="fa-brands fa-x-twitter"></i> Official X (Twitter) Service</span>
              <span class="health-indicator ${res.x_integration.has_bearer_token ? 'online' : 'warning'}"></span>
            </h4>
            <div class="info-row"><span class="info-label">Monitored Account:</span><span class="info-value"><b>${res.x_integration.monitored_account}</b></span></div>
            <div class="info-row"><span class="info-label">Bearer Token Configured:</span><span class="info-value">${res.x_integration.has_bearer_token ? '<span style="color:#10b981; font-weight:700;">YES (Configured)</span>' : '<span style="color:#f59e0b; font-weight:700;">Needs Config</span>'}</span></div>
            <div class="info-row"><span class="info-label">User OAuth 1.0a / 2.0:</span><span class="info-value">${res.x_integration.has_user_oauth ? '<span style="color:#10b981; font-weight:700;">Ready for Outbound Replies</span>' : '<span style="color:#64748b;">Not Configured (Drafts Only)</span>'}</span></div>
            <div class="info-row"><span class="info-label">Automation Mode:</span><span class="info-value"><span class="badge-status badge-Forwarded">Mode ${res.x_integration.automation_mode}</span></span></div>
            <div class="info-row"><span class="info-label">Last Polled At:</span><span class="info-value">${res.x_integration.last_poll_at || 'Never'}</span></div>
            <div class="info-row"><span class="info-label">Ingested X Posts:</span><span class="info-value"><b>${res.x_integration.incoming_posts_count}</b></span></div>
            <div class="info-row"><span class="info-label">Published X Replies:</span><span class="info-value"><b>${res.x_integration.outgoing_replies_count}</b></span></div>
            <div style="margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-primary btn-sm" onclick="App.showXConfigModal()">
                <i class="fa-solid fa-key"></i> Configure API Credentials
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.testXConnection()">
                <i class="fa-solid fa-plug-circle-check"></i> Verify Connection
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.triggerManualSync()">
                <i class="fa-solid fa-arrows-rotate"></i> Sync Mentions Now
              </button>
            </div>
          </div>

          <!-- Card 2: Background Worker Daemon -->
          <div class="health-card">
            <h4>
              <span><i class="fa-solid fa-server"></i> 24/7 Background Worker</span>
              <span class="health-indicator ${workerActive ? 'online' : 'offline'}"></span>
            </h4>
            <div class="info-row"><span class="info-label">Worker Status:</span><span class="info-value"><b style="color: ${workerActive ? '#10b981' : '#ef4444'};">${res.worker.status.toUpperCase()}</b></span></div>
            <div class="info-row"><span class="info-label">Daemon Name:</span><span class="info-value">${res.worker.service}</span></div>
            <div class="info-row"><span class="info-label">Last Heartbeat:</span><span class="info-value">${res.worker.last_heartbeat || 'No heartbeat detected'}</span></div>
            <div class="info-row"><span class="info-label">Heartbeat Lag:</span><span class="info-value">${res.worker.lag_seconds !== null ? `${res.worker.lag_seconds}s ago` : 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Process Uptime:</span><span class="info-value">${Math.round(res.uptime_seconds / 60)} minutes</span></div>
          </div>

          <!-- Card 3: Queues & Database -->
          <div class="health-card">
            <h4>
              <span><i class="fa-solid fa-database"></i> Database & Queues</span>
              <span class="health-indicator online"></span>
            </h4>
            <div class="info-row"><span class="info-label">Database Connection:</span><span class="info-value"><b style="color:#10b981;">CONNECTED (Persistent SQLite)</b></span></div>
            <div class="info-row"><span class="info-label">Total Registered Grievances:</span><span class="info-value"><b>${res.database.total_complaints}</b></span></div>
            <div class="info-row"><span class="info-label">Active SLA Breaches (Overdue):</span><span class="info-value"><b style="color:#ef4444;">${res.database.active_overdue}</b></span></div>
            <div class="info-row"><span class="info-label">Draft Replies Awaiting Review:</span><span class="info-value"><b style="color:#f59e0b;">${res.database.draft_review_queue}</b></span></div>
            <div class="info-row"><span class="info-label">Unassigned / Needs Review:</span><span class="info-value"><b style="color:#6366f1;">${res.database.unassigned_queue}</b></span></div>
          </div>
        </div>

        <!-- Automation Controls Panel -->
        <div class="details-card" style="margin-top: 10px;">
          <div class="details-card-header">
            <span><i class="fa-solid fa-sliders"></i> Master Automation Control & Safety Failsafe</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; padding: 8px 0;">
            <div>
              <label style="font-weight: 700; margin-bottom: 8px; display: block;">Active Automation Mode</label>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="display: flex; gap: 8px; align-items: center; cursor: pointer;">
                  <input type="radio" name="auto-mode" value="A" ${res.x_integration.automation_mode === 'A' ? 'checked' : ''} onchange="App.setAutomationMode('A')">
                  <span><b>Mode A: Monitor Only</b> (Ingest posts, no auto-drafts, manual handling)</span>
                </label>
                <label style="display: flex; gap: 8px; align-items: center; cursor: pointer;">
                  <input type="radio" name="auto-mode" value="B" ${res.x_integration.automation_mode === 'B' ? 'checked' : ''} onchange="App.setAutomationMode('B')">
                  <span><b>Mode B: Draft & Review</b> (Ingest, auto-generate reply draft, human approval required)</span>
                </label>
                <label style="display: flex; gap: 8px; align-items: center; cursor: pointer;">
                  <input type="radio" name="auto-mode" value="C" ${res.x_integration.automation_mode === 'C' ? 'checked' : ''} onchange="App.setAutomationMode('C')">
                  <span><b>Mode C: Approved Workflow Automation</b> (Auto-publish verified templates when confident)</span>
                </label>
              </div>
            </div>

            <div style="border-left: 1px solid var(--border-color); padding-left: 20px;">
              <label style="font-weight: 700; margin-bottom: 8px; display: block; color: #ef4444;">Emergency Kill Switch</label>
              <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Instantly suspends all automated and background outbound messages to X across the entire platform.</p>
              ${isStop ? `
                <button class="btn btn-secondary" onclick="App.toggleEmergencyStop(false)">
                  <i class="fa-solid fa-play" style="color: #10b981;"></i> Deactivate Emergency Stop (Resume Normal Replies)
                </button>
              ` : `
                <button class="btn btn-danger" onclick="App.toggleEmergencyStop(true)">
                  <i class="fa-solid fa-ban"></i> ACTIVATE EMERGENCY STOP
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML += `<div class="alert-banner alert-warning">${e.message}</div>`;
    }
  },

  async setAutomationMode(mode) {
    try {
      await this.api('/api/admin/x-config', {
        method: 'POST',
        body: JSON.stringify({ automation_mode: mode })
      });
      alert(`Automation Mode updated to Mode ${mode}`);
      this.renderSystemHealth(document.getElementById('page-content'));
    } catch (e) {
      alert(`Error updating mode: ${e.message}`);
    }
  },

  async toggleEmergencyStop(active) {
    if (active && !confirm('Are you sure you want to activate EMERGENCY STOP? All automated replies will be immediately blocked.')) return;
    try {
      await this.api('/api/admin/emergency-stop', {
        method: 'POST',
        body: JSON.stringify({ active })
      });
      this.renderSystemHealth(document.getElementById('page-content'));
    } catch (e) {
      alert(`Error toggling emergency stop: ${e.message}`);
    }
  },

  async triggerManualSync() {
    try {
      const res = await this.api('/api/admin/sync-now', { method: 'POST' });
      alert(`Sync completed! ${res.result.new_posts || 0} new posts processed.`);
      this.renderSystemHealth(document.getElementById('page-content'));
    } catch (e) {
      alert(`Sync failed: ${e.message}`);
    }
  },

  async testXConnection() {
    try {
      const res = await this.api('/api/admin/x-verify', { method: 'POST' });
      if (res.data && res.data.success) {
        const u = res.data.user || {};
        alert(`Verification Success!\n\nConnected to: @${u.username || 'UPPCLLKO'} (${u.name || 'UPPCL'})\nAccount ID: ${u.id || 'N/A'}\nStatus: Active and Authorized`);
      } else {
        alert(`Verification Result:\nStatus: ${res.data ? res.data.status : 'Failed'}\nMessage: ${res.data ? res.data.message : 'Unknown error'}`);
      }
      this.renderSystemHealth(document.getElementById('page-content'));
    } catch (e) {
      alert(`Verification Request Failed: ${e.message}`);
    }
  },

  showXConfigModal() {
    let modal = document.getElementById('x-config-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'x-config-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 620px;">
        <div class="modal-header">
          <h3><i class="fa-brands fa-x-twitter"></i> Official X (Twitter) API Configuration</h3>
          <button class="btn-close" onclick="document.getElementById('x-config-modal').style.display='none'">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">
          <div class="alert-banner alert-info" style="margin-bottom: 16px; font-size: 13px;">
            <b>Instructions:</b> Credentials can be set here in the database or passed as cloud environment variables on Render (<code>X_BEARER_TOKEN</code>, <code>X_API_KEY</code>, <code>X_API_SECRET</code>, <code>X_ACCESS_TOKEN</code>, <code>X_ACCESS_TOKEN_SECRET</code>).
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label><b>Monitored X Handle</b></label>
              <input type="text" id="x-cfg-handle" class="form-control" value="@UPPCLLKO" placeholder="@UPPCLLKO">
            </div>
            <div class="form-group">
              <label><b>Account ID</b></label>
              <input type="text" id="x-cfg-id" class="form-control" value="108658826" placeholder="108658826">
            </div>
          </div>

          <div class="form-group">
            <label><b>Polling Interval (seconds)</b></label>
            <input type="number" id="x-cfg-interval" class="form-control" value="60" min="15">
            <small style="color:var(--text-muted); font-size: 11px;">Default is 60s to comply with X API Free/Basic rate limits.</small>
          </div>

          <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border-color);">

          <div class="form-group">
            <label><b>X Bearer Token (v2 App-Only)</b> <span style="color:#ef4444;">* Mandatory for reading mentions</span></label>
            <input type="password" id="x-cfg-bearer" class="form-control" placeholder="AAAAAAAAAAAAAAAAAAAAA... (Bearer Token)">
            <small style="color:var(--text-muted); font-size: 11px;">Developer Portal &gt; Project &gt; Keys and Tokens &gt; Bearer Token</small>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label><b>API Key (Consumer Key)</b></label>
              <input type="password" id="x-cfg-apikey" class="form-control" placeholder="API Key">
            </div>
            <div class="form-group">
              <label><b>API Key Secret</b></label>
              <input type="password" id="x-cfg-apisecret" class="form-control" placeholder="API Secret">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label><b>Access Token (User Context)</b> <span style="color:#6366f1;">* For dispatching replies</span></label>
              <input type="password" id="x-cfg-accesstoken" class="form-control" placeholder="OAuth 1.0a User Token">
            </div>
            <div class="form-group">
              <label><b>Access Token Secret</b></label>
              <input type="password" id="x-cfg-accesssecret" class="form-control" placeholder="OAuth 1.0a User Secret">
            </div>
          </div>
          <small style="color:var(--text-muted); font-size: 11px;">Developer Portal &gt; Project &gt; User authentication settings &gt; Set App permissions to <b>Read and write</b> before generating user tokens.</small>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:space-between;">
          <button class="btn btn-secondary" onclick="App.testXConnection()">
            <i class="fa-solid fa-plug-circle-check"></i> Test Connection
          </button>
          <div>
            <button class="btn btn-secondary" onclick="document.getElementById('x-config-modal').style.display='none'">Cancel</button>
            <button class="btn btn-primary" onclick="App.saveXConfig()">
              <i class="fa-solid fa-floppy-disk"></i> Save Configuration
            </button>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  async saveXConfig() {
    const handle = document.getElementById('x-cfg-handle').value.trim();
    const id = document.getElementById('x-cfg-id').value.trim();
    const interval = parseInt(document.getElementById('x-cfg-interval').value.trim(), 10) || 60;
    const bearer = document.getElementById('x-cfg-bearer').value.trim();
    const apiKey = document.getElementById('x-cfg-apikey').value.trim();
    const apiSecret = document.getElementById('x-cfg-apisecret').value.trim();
    const accessToken = document.getElementById('x-cfg-accesstoken').value.trim();
    const accessSecret = document.getElementById('x-cfg-accesssecret').value.trim();

    const payload = {
      x_account_handle: handle,
      x_account_id: id,
      ingestion_interval_seconds: interval
    };
    if (bearer) payload.x_bearer_token = bearer;
    if (apiKey) payload.x_api_key = apiKey;
    if (apiSecret) payload.x_api_secret = apiSecret;
    if (accessToken) payload.x_access_token = accessToken;
    if (accessSecret) payload.x_access_token_secret = accessSecret;

    try {
      await this.api('/api/admin/x-config', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('Official X API credentials and configuration saved successfully!');
      document.getElementById('x-config-modal').style.display = 'none';
      this.renderSystemHealth(document.getElementById('page-content'));
    } catch (e) {
      alert(`Failed to save configuration: ${e.message}`);
    }
  },

  // -----------------------------------------------------------
  // LOGIN SCREEN
  // -----------------------------------------------------------
  renderLogin() {
    this.currentPage = 'login';
    // Guard: do not wipe DOM or lose user keystrokes if login form is already mounted
    if (document.getElementById('login-username') && document.getElementById('login-password')) {
      return;
    }

    const root = document.getElementById('app');
    root.innerHTML = `
      <div class="login-wrapper">
        <div class="login-theme-bar">
          <button class="theme-toggle-btn" onclick="App.toggleTheme()" title="${this.theme === 'midnight' ? 'Theme: Midnight (Click for Light Mode)' : (this.theme === 'light' ? 'Theme: Light Mode (Click for Dark Mode)' : 'Theme: Dark Mode (Click for Midnight Theme')}" aria-label="Toggle Theme">
            <i class="fa-solid ${this.theme === 'midnight' ? 'fa-cloud' : (this.theme === 'light' ? 'fa-sun' : 'fa-moon')}" style="${this.theme === 'midnight' ? 'color: #94a3b8;' : (this.theme === 'light' ? 'color: #f59e0b;' : 'color: #6366f1;')}"></i>
            <span class="theme-label">${this.theme === 'midnight' ? 'Midnight' : (this.theme === 'light' ? 'Light Mode' : 'Dark Mode')}</span>
          </button>
        </div>
        <div class="login-box">
          <div class="login-logo">
            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #123456, #008080); border-radius: 12px; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px;">
              <i class="fa-solid fa-bolt"></i>
            </div>
            <h2>UPPCL Social Media Cell</h2>
            <p>Consumer Grievance Management System</p>
          </div>

          <form onsubmit="App.handleLogin(event)">
            <div class="filter-group" style="margin-bottom: 14px;">
              <label>Username</label>
              <input type="text" id="login-username" class="form-control" placeholder="Enter username (e.g. admin)" required autocomplete="username">
            </div>

            <div class="filter-group" style="margin-bottom: 18px;">
              <label>Password</label>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="password" id="login-password" class="form-control" placeholder="Enter password (e.g. admin123)" required autocomplete="current-password" style="padding-right: 38px; width: 100%;">
                <button type="button" onclick="App.togglePasswordVisibility()" title="Show/Hide Password" style="position: absolute; right: 10px; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; font-size: 14px;">
                  <i id="password-toggle-icon" class="fa-solid fa-eye"></i>
                </button>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 11px; color: var(--text-muted);">
                <span>Default password: <strong style="color: var(--primary);">admin123</strong></span>
                <span style="opacity: 0.8;">(or role123)</span>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 10px;">
              <i class="fa-solid fa-lock"></i> Secure Sign In
            </button>
          </form>
        </div>
      </div>
    `;
  },

  togglePasswordVisibility() {
    const pwdInput = document.getElementById('login-password');
    const icon = document.getElementById('password-toggle-icon');
    if (!pwdInput) return;
    if (pwdInput.type === 'password') {
      pwdInput.type = 'text';
      if (icon) {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      }
    } else {
      pwdInput.type = 'password';
      if (icon) {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    }
  },

  quickFill(u, p) {
    document.getElementById('login-username').value = u;
    document.getElementById('login-password').value = p;
  },

  async handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;

    try {
      const res = await this.api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p })
      });
      this.login(res.token, res.user);
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  }
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
} else {
  App.init();
}
