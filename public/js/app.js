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
    overdue: '0',
    from_date: '',
    to_date: '',
    sort_by: 'received_at',
    sort_order: 'DESC'
  },
  charts: {},
  notifications: [],
  unreadNotifs: 0,
  cachedMaster: {
    categories: [],
    discoms: [],
    xHierarchy: [],
    nodalOfficers: [],
    replyTemplates: []
  },

  init() {
    this.initTheme();
    this.token = localStorage.getItem('uppcl_smc_token');
    const savedUser = localStorage.getItem('uppcl_smc_user');
    if (savedUser) {
      try { this.user = JSON.parse(savedUser); } catch(e) {}
    }

    this.startClock();
    this.startNotificationPoller();

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
    this.pollNotifications();
    setInterval(() => {
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

  initTheme() {
    try {
      const savedTheme = localStorage.getItem('uppcl_smc_theme') || 
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      this.setTheme(savedTheme, false);
    } catch(e) {
      this.setTheme('light', false);
    }
  },

  setTheme(theme, updateCharts = true) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('uppcl_smc_theme', theme);
    } catch(e) {}

    // Update Chart.js defaults if library loaded
    if (window.Chart) {
      const isDark = theme === 'dark';
      Chart.defaults.color = isDark ? '#94a3b8' : '#6b7280';
      Chart.defaults.borderColor = isDark ? '#24354f' : '#edf2f7';
    }

    // Update all theme buttons in the UI
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      const isDark = theme === 'dark';
      btn.innerHTML = isDark
        ? '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i> <span class="theme-label">Light Mode</span>'
        : '<i class="fa-solid fa-moon" style="color: #6366f1;"></i> <span class="theme-label">Dark Mode</span>';
      btn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      btn.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
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
    const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
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
      this.logout();
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
      const [cats, discs, xh, nodals, tpls] = await Promise.all([
        this.api('/api/master/categories'),
        this.api('/api/master/discoms'),
        this.api('/api/master/x-hierarchy'),
        this.api('/api/master/nodal-officers'),
        this.api('/api/templates').catch(() => ({ data: [] }))
      ]);
      this.cachedMaster.categories = cats.data || [];
      this.cachedMaster.discoms = discs.data || [];
      this.cachedMaster.xHierarchy = xh.data || [];
      this.cachedMaster.nodalOfficers = nodals.data || [];
      this.cachedMaster.replyTemplates = (tpls && tpls.data) || [];
    } catch (e) {
      console.warn('Error loading master data:', e.message);
    }
  },

  login(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('uppcl_smc_token', token);
    localStorage.setItem('uppcl_smc_user', JSON.stringify(user));
    this.loadMasterData().then(() => {
      this.renderApp();
    });
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('uppcl_smc_token');
    localStorage.removeItem('uppcl_smc_user');
    this.renderLogin();
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
      if (params.status) this.currentFilters.status = params.status;
      if (params.overdue) this.currentFilters.overdue = params.overdue;
      this.renderComplaintRegister(container);
    } else if (page === 'add-complaint') {
      this.renderAddComplaint(container);
    } else if (page === 'forwarding') {
      this.currentFilters.status = 'awaiting_discom';
      this.renderComplaintRegister(container, 'Forwarding & Follow-Up Register');
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
    const isSuperAdmin = this.user.role === 'Super Administrator';
    const isOperator = ['Super Administrator', 'Social Media Cell Operator', 'Complaint Handler'].includes(this.user.role);
    const isSupervisor = ['Super Administrator', 'Supervisor / Management'].includes(this.user.role);
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
            ${isOperator || isSupervisor ? `
            <a class="nav-item" data-page="add-complaint" onclick="App.navigate('add-complaint')">
              <i class="fa-solid fa-circle-plus"></i> Add Complaint
            </a>` : ''}

            <div class="nav-section-title">Workflow Tracking</div>
            <a class="nav-item" data-page="draft-review" onclick="App.navigate('draft-review')">
              <i class="fa-solid fa-pen-to-square"></i> Draft & Review Queue
            </a>
            <a class="nav-item" data-page="unassigned-queue" onclick="App.navigate('unassigned-queue')">
              <i class="fa-solid fa-question-circle"></i> Needs Review (Unassigned)
            </a>
            <a class="nav-item" data-page="forwarding" onclick="App.navigate('forwarding')">
              <i class="fa-solid fa-share-nodes"></i> Forwarding & Follow-Up
            </a>
            <a class="nav-item" data-page="pending-overdue" onclick="App.navigate('pending-overdue')">
              <i class="fa-solid fa-triangle-exclamation"></i> Pending & Overdue
            </a>
            <a class="nav-item" data-page="discom-responses" onclick="App.navigate('discom-responses')">
              <i class="fa-solid fa-reply-all"></i> DISCOM Responses
            </a>
            ${!isDiscomNodal ? `
            <a class="nav-item" data-page="closure-verification" onclick="App.navigate('closure-verification')">
              <i class="fa-solid fa-clipboard-check"></i> Closure Verification
            </a>` : ''}

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
            <a class="nav-item" data-page="internal-tickets" onclick="App.navigate('internal-tickets')">
              <i class="fa-solid fa-headset"></i> Support Tickets
            </a>

            ${isSuperAdmin ? `
            <a class="nav-item" data-page="users" onclick="App.navigate('users')">
              <i class="fa-solid fa-users-gear"></i> Users & Roles
            </a>
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
              <div class="header-title-badge">
                <span class="gov-badge"><i class="fa-solid fa-landmark"></i> Gov. of Uttar Pradesh</span>
                <span style="font-weight: 700; font-size: 13px; color: var(--primary);">UPPCL Social Media Cell</span>
              </div>
              <div id="ist-clock" class="clock-display">
                <i class="fa-regular fa-clock"></i> IST: Loading...
              </div>
            </div>

            <div class="header-right">
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
              <button class="theme-toggle-btn" onclick="App.toggleTheme()" title="${this.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}" aria-label="Toggle Theme">
                <i class="fa-solid ${this.theme === 'dark' ? 'fa-sun' : 'fa-moon'}" style="${this.theme === 'dark' ? 'color: #f59e0b;' : 'color: #6366f1;'}"></i>
                <span class="theme-label">${this.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
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

      <!-- Visual Charts Grid -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-chart-line"></i> Grievance Inflow Trend (Daily)</div>
          </div>
          <div class="chart-body"><canvas id="chart-trend"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-building-columns"></i> DISCOM Volume & Resolution Matrix</div>
          </div>
          <div class="chart-body"><canvas id="chart-discom"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-brands fa-x-twitter"></i> Official Monitored Handles Breakdown</div>
          </div>
          <div class="chart-body"><canvas id="chart-handles"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-layer-group"></i> Grievance Distribution by Category</div>
          </div>
          <div class="chart-body"><canvas id="chart-categories"></canvas></div>
        </div>
      </div>

      <!-- Bottom District & Platform Distribution -->
      <div class="charts-grid" style="margin-bottom: 0;">
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-map-location-dot"></i> Top 10 High Grievance Districts</div>
          </div>
          <div class="chart-body"><canvas id="chart-districts"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title"><i class="fa-solid fa-pie-chart"></i> Operational Status Distribution</div>
          </div>
          <div class="chart-body"><canvas id="chart-status"></canvas></div>
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
    } catch (e) {
      console.error('Error reloading dashboard:', e);
    }
  },

  renderKPIs(k) {
    const container = document.getElementById('dash-kpi-grid');
    if (!container) return;

    container.innerHTML = `
      <div class="kpi-card kpi-total" onclick="App.navigate('register', { status: 'All' })">
        <div class="kpi-label">Total Received</div>
        <div class="kpi-value">${k.total}</div>
        <div class="kpi-sub">Overall consumer grievances</div>
      </div>

      <div class="kpi-card kpi-today" onclick="App.navigate('register', { from_date: new Date().toISOString().substring(0, 10) })">
        <div class="kpi-label">Received Today</div>
        <div class="kpi-value">${k.receivedToday}</div>
        <div class="kpi-sub">Today's social media inflow</div>
      </div>

      <div class="kpi-card kpi-new" onclick="App.navigate('register', { status: 'New' })">
        <div class="kpi-label">New / Unprocessed</div>
        <div class="kpi-value">${k.new}</div>
        <div class="kpi-sub">Awaiting operator action</div>
      </div>

      <div class="kpi-card kpi-forwarded" onclick="App.navigate('register', { status: 'Forwarded' })">
        <div class="kpi-label">Forwarded</div>
        <div class="kpi-value">${k.forwarded}</div>
        <div class="kpi-sub">Sent to DISCOM Nodal Officer</div>
      </div>

      <div class="kpi-card kpi-followup" onclick="App.navigate('register', { status: 'DISCOM Follow Up' })">
        <div class="kpi-label">DISCOM Follow Up</div>
        <div class="kpi-value">${k.followup}</div>
        <div class="kpi-sub">Follow-up in progress</div>
      </div>

      <div class="kpi-card kpi-pending" onclick="App.navigate('register', { status: 'awaiting_discom' })">
        <div class="kpi-label">Total Pending</div>
        <div class="kpi-value">${k.pending}</div>
        <div class="kpi-sub">Action awaited at field</div>
      </div>

      <div class="kpi-card kpi-overdue" onclick="App.navigate('register', { overdue: '1' })">
        <div class="kpi-label" style="color: #ef4444;">Overdue (Breached)</div>
        <div class="kpi-value" style="color: #ef4444;">${k.overdue}</div>
        <div class="kpi-sub">Exceeded SLA response time</div>
      </div>

      <div class="kpi-card kpi-escalated" onclick="App.navigate('register', { status: 'Escalated' })">
        <div class="kpi-label">Escalated</div>
        <div class="kpi-value" style="color: #dc2626;">${k.escalated}</div>
        <div class="kpi-sub">Escalated to SE / CE / MD</div>
      </div>

      <div class="kpi-card kpi-verification" onclick="App.navigate('register', { status: 'Resolved — Verification Pending' })">
        <div class="kpi-label">Verification Due</div>
        <div class="kpi-value">${k.resolvedPendingVerification}</div>
        <div class="kpi-sub">Reported resolved by DISCOM</div>
      </div>

      <div class="kpi-card kpi-closed" onclick="App.navigate('register', { status: 'Closed' })">
        <div class="kpi-label">Verified Closed</div>
        <div class="kpi-value">${k.closed}</div>
        <div class="kpi-sub">Satisfied & closed by SMC</div>
      </div>

      <div class="kpi-card kpi-reopened" onclick="App.navigate('register', { status: 'Reopened' })">
        <div class="kpi-label">Reopened</div>
        <div class="kpi-value">${k.reopened}</div>
        <div class="kpi-sub">Customer not satisfied</div>
      </div>
    `;
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
          }
        }
      });
    }

    // Chart 2: DISCOM Matrix
    const ctxDiscom = document.getElementById('chart-discom');
    if (ctxDiscom) {
      if (this.charts.discom) this.charts.discom.destroy();
      const labels = c.discoms.map(d => d.discom_name);
      const closed = c.discoms.map(d => d.closed);
      const pending = c.discoms.map(d => d.pending);
      const overdue = c.discoms.map(d => d.overdue);

      this.charts.discom = new Chart(ctxDiscom, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['No DISCOM'],
          datasets: [
            { label: 'Verified Closed', data: closed, backgroundColor: '#059669' },
            { label: 'Pending Action', data: pending, backgroundColor: '#f59e0b' },
            { label: 'Overdue (SLA Breached)', data: overdue, backgroundColor: '#ef4444' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }

    // Chart 3: Handles Breakdown
    const ctxHandles = document.getElementById('chart-handles');
    if (ctxHandles) {
      if (this.charts.handles) this.charts.handles.destroy();
      const labels = c.handles.map(h => h.handle);
      const counts = c.handles.map(h => h.count);

      this.charts.handles = new Chart(ctxHandles, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['None'],
          datasets: [{
            label: 'Complaints',
            data: counts,
            backgroundColor: '#123456'
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }

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
          plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } }
        }
      });
    }

    // Chart 5: Districts Top 10
    const ctxDist = document.getElementById('chart-districts');
    if (ctxDist) {
      if (this.charts.districts) this.charts.districts.destroy();
      const labels = c.districts.map(d => `${d.district_name} (${d.discom_name})`);
      const counts = c.districts.map(d => d.count);

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
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }

    // Chart 6: Status Distribution
    const ctxStatus = document.getElementById('chart-status');
    if (ctxStatus) {
      if (this.charts.status) this.charts.status.destroy();
      const labels = c.statuses.map(s => s.current_status);
      const counts = c.statuses.map(s => s.count);
      const colorMap = {
        'New': '#3b82f6',
        'Forwarded': '#6366f1',
        'DISCOM Follow Up': '#f59e0b',
        'Pending': '#ea580c',
        'Escalated': '#dc2626',
        'Resolved — Verification Pending': '#10b981',
        'Closed': '#059669',
        'Reopened': '#8b5cf6',
        'Duplicate / Invalid': '#64748b'
      };

      this.charts.status = new Chart(ctxStatus, {
        type: 'pie',
        data: {
          labels: labels.length ? labels : ['None'],
          datasets: [{
            data: counts.length ? counts : [1],
            backgroundColor: labels.map(l => colorMap[l] || '#94a3b8')
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } }
        }
      });
    }
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
        <!-- Quick Status Tabs -->
        <div class="status-tabs">
          <div class="status-tab ${this.currentFilters.status === 'All' && this.currentFilters.overdue !== '1' ? 'active' : ''}" onclick="App.filterTab('All')">All Complaints</div>
          <div class="status-tab ${this.currentFilters.status === 'my_assigned' ? 'active' : ''}" onclick="App.filterTab('my_assigned')"><i class="fa-solid fa-user"></i> My Assigned</div>
          <div class="status-tab ${this.currentFilters.status === 'New' ? 'active' : ''}" onclick="App.filterTab('New')">New</div>
          <div class="status-tab ${this.currentFilters.status === 'Forwarded' ? 'active' : ''}" onclick="App.filterTab('Forwarded')">Forwarded</div>
          <div class="status-tab ${this.currentFilters.status === 'DISCOM Follow Up' ? 'active' : ''}" onclick="App.filterTab('DISCOM Follow Up')">Follow-Up Due</div>
          <div class="status-tab ${this.currentFilters.overdue === '1' ? 'active' : ''}" onclick="App.filterTab('overdue')"><span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-clock"></i> Overdue</span></div>
          <div class="status-tab ${this.currentFilters.status === 'Escalated' ? 'active' : ''}" onclick="App.filterTab('Escalated')">Escalated</div>
          <div class="status-tab ${this.currentFilters.status === 'Resolved — Verification Pending' ? 'active' : ''}" onclick="App.filterTab('Resolved — Verification Pending')">Verification Due</div>
          <div class="status-tab ${this.currentFilters.status === 'Closed' ? 'active' : ''}" onclick="App.filterTab('Closed')">Closed</div>
        </div>

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
          <table class="data-table">
            <thead>
              <tr>
                <th>Complaint ID</th>
                <th>Received (IST)</th>
                <th>Platform & Handle</th>
                <th>Consumer</th>
                <th>Grievance Summary</th>
                <th>DISCOM & District</th>
                <th>Priority</th>
                <th>Status</th>
                <th>SLA / Overdue</th>
                <th>Assigned Officer</th>
                <th>Actions</th>
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
    this.currentFilters.search = document.getElementById('reg-search').value.trim();
    this.currentFilters.discom = document.getElementById('reg-discom').value;
    this.currentFilters.category = document.getElementById('reg-cat').value;
    this.currentFilters.priority = document.getElementById('reg-priority').value;
    this.currentFilters.platform = document.getElementById('reg-platform').value;
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
      overdue: '0',
      from_date: '',
      to_date: '',
      sort_by: 'received_at',
      sort_order: 'DESC'
    };
    this.navigate('register');
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

        return `
          <tr>
            <td>
              <a href="javascript:void(0)" onclick="App.viewComplaint(${c.id})" style="font-weight: 700; color: var(--primary); text-decoration: none;">
                ${c.complaint_no}
              </a>
            </td>
            <td>
              <div style="font-weight: 600;">${c.received_at.substring(0, 10)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${c.received_at.substring(11, 16)} IST</div>
            </td>
            <td>
              <div><i class="${platformIcon}"></i> ${c.platform}</div>
              <div style="font-size: 11px; color: var(--accent); font-weight: 600;">${c.monitored_account || '@UPPCLLKO'}</div>
            </td>
            <td>
              <div style="font-weight: 600;">${c.consumer_name || 'Consumer'}</div>
              ${c.consumer_handle ? `<div style="font-size: 11px; color: var(--text-muted);">${c.consumer_handle}</div>` : ''}
              ${c.post_url ? `<a href="${c.post_url}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: var(--status-new);"><i class="fa-solid fa-arrow-up-right-from-square"></i> Post</a>` : ''}
            </td>
            <td style="max-width: 240px;">
              <div style="font-weight: 600; color: var(--primary);">${c.category_name}</div>
              <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; color: var(--text-main);" title="${c.complaint_text.replace(/"/g, '&quot;')}">
                ${c.complaint_text}
              </div>
            </td>
            <td>
              <div style="font-weight: 700;">${c.discom_name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${c.district_name || 'HQ'}</div>
            </td>
            <td>
              <span class="badge-prio ${prioBadgeClass}">${c.priority}</span>
            </td>
            <td>
              <span class="badge-status ${statusBadgeClass}">${c.current_status}</span>
            </td>
            <td>
              ${isOverdue ? `
                <span class="badge-overdue"><i class="fa-solid fa-clock-rotate-left"></i> OVERDUE</span>
              ` : (c.expected_response_date ? `
                <span style="font-size: 11px; color: var(--text-muted);">SLA: ${c.expected_response_date.substring(5, 16)}</span>
              ` : '<span style="font-size: 11px; color: var(--text-light);">-</span>')}
            </td>
            <td>
              <div style="font-size: 11px; font-weight: 600;">${c.assigned_nodal_officer_name || c.assigned_operator_name || 'Unassigned'}</div>
            </td>
            <td>
              <div style="display: flex; gap: 4px;">
                <button class="btn btn-secondary btn-sm" title="View 360° Details" onclick="App.viewComplaint(${c.id})">
                  <i class="fa-solid fa-eye"></i>
                </button>
                ${this.renderRowQuickAction(c)}
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
    const isOperator = ['Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'].includes(this.user.role);

    if (c.current_status === 'New' && isOperator) {
      return `<button class="btn btn-accent btn-sm" title="Forward to DISCOM" onclick="App.openForwardModal(${c.id})"><i class="fa-solid fa-share-nodes"></i></button>`;
    }
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

  exportCurrentRegister(format) {
    const q = new URLSearchParams();
    Object.entries(this.currentFilters).forEach(([k, v]) => {
      if (v && v !== 'All') q.append(k, v);
    });
    q.set('format', format);
    q.set('type', 'register');
    window.open(`/api/reports/export?${q.toString()}`, '_blank');
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
              <label>District *</label>
              <select id="add-district" class="form-control" required onchange="App.handleAddDistrictChange(this.value)">
                <option value="">-- Select District --</option>
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

          <!-- Immediate Forwarding Section -->
          <div style="background-color: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 6px; padding: 14px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
              <input type="checkbox" id="add-forward-now" onchange="App.toggleForwardSection(this.checked)">
              <label for="add-forward-now" style="font-weight: 700; color: var(--primary); font-size: 13px; cursor: pointer;">
                Forward immediately to DISCOM Nodal Officer upon registration
              </label>
            </div>

            <div id="forward-fields" style="display: none; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px;">
              <div class="filter-group">
                <label>Assigned Nodal Officer</label>
                <input type="text" id="add-nodal-name" class="form-control" readonly placeholder="Auto-populated by District">
                <input type="hidden" id="add-nodal-id">
                <input type="hidden" id="add-nodal-mobile">
              </div>

              <div class="filter-group">
                <label>Communication Channel</label>
                <select id="add-forward-channel" class="form-control">
                  <option value="e-Office">e-Office</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Official Email</option>
                  <option value="Portal">DISCOM Grievance Portal</option>
                  <option value="Phone Call">Direct Phone Call</option>
                </select>
              </div>

              <div class="filter-group">
                <label>Forwarding Ref / Dispatch No</label>
                <input type="text" id="add-forward-ref" class="form-control" placeholder="e.g. SMC/FWD/2026/...">
              </div>

              <div class="filter-group" style="grid-column: span 3;">
                <label>Forwarding Instructions / Action Summary</label>
                <input type="text" id="add-forward-remarks" class="form-control" placeholder="Action instructions for field staff...">
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
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
    distSel.innerHTML = '<option value="">-- Select District --</option>';

    const dObj = this.cachedMaster.discoms.find(d => d.code.toUpperCase() === discom.toUpperCase());
    if (dObj && dObj.districts) {
      dObj.districts.forEach(dist => {
        distSel.innerHTML += `<option value="${dist.name}">${dist.name}</option>`;
      });
    }
  },

  handleAddDistrictChange(district) {
    const discom = document.getElementById('add-discom').value;
    const nodalInp = document.getElementById('add-nodal-name');
    const nodalIdInp = document.getElementById('add-nodal-id');
    const nodalMobileInp = document.getElementById('add-nodal-mobile');

    if (!nodalInp) return;

    const officer = this.cachedMaster.nodalOfficers.find(o =>
      o.discom_name.toUpperCase() === discom.toUpperCase() &&
      o.district_name.toUpperCase() === district.toUpperCase()
    );

    if (officer) {
      nodalInp.value = `${officer.officer_name} (${officer.mobile})`;
      nodalIdInp.value = officer.id;
      nodalMobileInp.value = officer.mobile;
    } else {
      nodalInp.value = `Nodal Officer ${discom} - ${district}`;
      nodalIdInp.value = '';
      nodalMobileInp.value = '';
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
    const forwardNow = document.getElementById('add-forward-now').checked;

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

    if (forwardNow) {
      payload.forwarding_date = new Date().toISOString().replace('T', ' ').substring(0, 19);
      payload.assigned_nodal_officer_id = document.getElementById('add-nodal-id').value;
      payload.assigned_nodal_officer_name = document.getElementById('add-nodal-name').value;
      payload.assigned_nodal_officer_mobile = document.getElementById('add-nodal-mobile').value;
      payload.forwarding_channel = document.getElementById('add-forward-channel').value;
      payload.forwarding_ref_no = document.getElementById('add-forward-ref').value;
      payload.forwarding_remarks = document.getElementById('add-forward-remarks').value;
    }

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
                    ${c.post_url ? `
                    <div class="info-row"><span class="info-label">Original Source URL:</span><span class="info-value"><a href="${c.post_url}" target="_blank" rel="noopener noreferrer" style="color: var(--status-new); font-weight: 600;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open Social Media Post</a></span></div>
                    ` : ''}
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

                  <!-- Assignment & Nodal Officer -->
                  <div class="details-card">
                    <div class="details-card-header">
                      <span><i class="fa-solid fa-user-tie"></i> Routing & Nodal Officer</span>
                    </div>
                    <div class="info-row"><span class="info-label">Nodal Officer:</span><span class="info-value"><b>${c.assigned_nodal_officer_name || 'Unassigned'}</b></span></div>
                    <div class="info-row"><span class="info-label">Official Mobile:</span><span class="info-value"><b>${c.assigned_nodal_officer_mobile || 'Contact HQ'}</b></span></div>
                    <div class="info-row"><span class="info-label">Forwarded At:</span><span class="info-value">${c.forwarding_date || 'Not forwarded yet'}</span></div>
                    <div class="info-row"><span class="info-label">Channel:</span><span class="info-value">${c.forwarding_channel || 'e-Office'}</span></div>
                    <div class="info-row"><span class="info-label">Expected SLA:</span><span class="info-value" style="color: ${isOverdue ? '#ef4444' : 'inherit'}; font-weight: 700;">${c.expected_response_date || 'Pending'}</span></div>
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
    const isOperator = ['Super Administrator', 'Social Media Cell Operator', 'Supervisor / Management'].includes(this.user.role);
    let btns = [];

    if (isOperator) {
      btns.push(`<button class="btn btn-primary btn-sm" onclick="App.openForwardModal(${c.id})"><i class="fa-solid fa-share-nodes"></i> Forward / Re-Route</button>`);
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

    return btns.join('');
  },

  closeModal() {
    const m = document.getElementById('modal-root');
    if (m) m.innerHTML = '';
  },

  // -----------------------------------------------------------
  // ACTION MODALS
  // -----------------------------------------------------------
  openForwardModal(id) {
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
                <label>District *</label>
                <select id="fwd-district" class="form-control" required onchange="App.handleFwdDistrictChange(this.value)">
                  <option value="">-- Select District --</option>
                </select>
              </div>

              <div class="filter-group" style="margin-bottom: 12px;">
                <label>Assigned Nodal Officer *</label>
                <input type="text" id="fwd-nodal-name" class="form-control" required placeholder="Select district above">
                <input type="hidden" id="fwd-nodal-mobile">
                <input type="hidden" id="fwd-nodal-id">
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div class="filter-group">
                  <label>Communication Channel *</label>
                  <select id="fwd-channel" class="form-control" required>
                    <option value="e-Office">e-Office</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Official Email">Official Email</option>
                    <option value="Portal">Grievance Portal</option>
                    <option value="Phone Call">Phone Call</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label>Dispatch / Reference Number</label>
                  <input type="text" id="fwd-ref-no" class="form-control" placeholder="e.g. SMC/2026/FWD/123">
                </div>
              </div>

              <div class="filter-group">
                <label>Action Instructions / Remarks *</label>
                <textarea id="fwd-remarks" class="form-control" rows="3" required placeholder="Detailed instructions for field inspection and resolution..."></textarea>
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
  },

  handleFwdDiscomChange(discom) {
    const distSel = document.getElementById('fwd-district');
    distSel.innerHTML = '<option value="">-- Select District --</option>';
    const dObj = this.cachedMaster.discoms.find(d => d.code.toUpperCase() === discom.toUpperCase());
    if (dObj && dObj.districts) {
      dObj.districts.forEach(dist => {
        distSel.innerHTML += `<option value="${dist.name}">${dist.name}</option>`;
      });
    }
  },

  handleFwdDistrictChange(dist) {
    const discom = document.getElementById('fwd-discom').value;
    const officer = this.cachedMaster.nodalOfficers.find(o =>
      o.discom_name.toUpperCase() === discom.toUpperCase() &&
      o.district_name.toUpperCase() === dist.toUpperCase()
    );

    const nameInp = document.getElementById('fwd-nodal-name');
    const mobInp = document.getElementById('fwd-nodal-mobile');
    const idInp = document.getElementById('fwd-nodal-id');

    if (officer) {
      nameInp.value = `${officer.officer_name} (${officer.mobile})`;
      mobInp.value = officer.mobile;
      idInp.value = officer.id;
    } else {
      nameInp.value = `Nodal Officer (${discom} - ${dist})`;
      mobInp.value = '';
      idInp.value = '';
    }
  },

  async submitForward(e, id) {
    e.preventDefault();
    const payload = {
      discom_name: document.getElementById('fwd-discom').value,
      district_name: document.getElementById('fwd-district').value,
      assigned_nodal_officer_name: document.getElementById('fwd-nodal-name').value,
      assigned_nodal_officer_mobile: document.getElementById('fwd-nodal-mobile').value,
      assigned_nodal_officer_id: document.getElementById('fwd-nodal-id').value,
      forwarding_channel: document.getElementById('fwd-channel').value,
      forwarding_ref_no: document.getElementById('fwd-ref-no').value.trim(),
      forwarding_remarks: document.getElementById('fwd-remarks').value.trim()
    };

    try {
      await this.api(`/api/complaints/${id}/forward`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('Complaint forwarded successfully.');
      App.closeModal();
      App.viewComplaint(id);
      App.loadRegisterData();
    } catch (err) {
      alert(`Error: ${err.message}`);
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
                  <label>Officer Contacted *</label>
                  <input type="text" id="fol-officer" class="form-control" required placeholder="Name & designation...">
                </div>
                <div class="filter-group">
                  <label>Channel *</label>
                  <select id="fol-channel" class="form-control" required>
                    <option value="Phone Call">Telephone / Mobile Call</option>
                    <option value="WhatsApp">WhatsApp Message</option>
                    <option value="Portal Reminder">Official Portal Reminder</option>
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
                  <label>Escalated To Officer / Authority *</label>
                  <input type="text" id="esc-to" class="form-control" required placeholder="Designation / Name">
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
  // REPORTS VIEW
  // -----------------------------------------------------------
  renderReports(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Management Reports & Official Exports</h2>
          <p>Generate, Preview, and Download Comprehensive Operational Redressal Reports</p>
        </div>
      </div>

      <div class="details-card">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px;">
          <div class="filter-group">
            <label>Report Type *</label>
            <select id="rep-type" class="form-control" onchange="App.handleReportTypeChange()">
              <option value="daily_ops">1. Daily Operational Report</option>
              <option value="x_hierarchy">2. X Hierarchy-wise Report</option>
              <option value="discom_district">3. DISCOM & District Performance</option>
              <option value="category_wise">4. Category-wise Grievance Breakdown</option>
              <option value="pending_overdue">5. Pending & Overdue Analysis</option>
              <option value="discom_followup">6. DISCOM Follow-Up & Reminder Report</option>
              <option value="escalation_report">7. Escalation Hierarchy Trail</option>
              <option value="resolved_vs_closed">8. Resolved vs Verified-Closed Audit</option>
              <option value="aging_report">9. Complaint Aging Analysis</option>
              <option value="audit_trail">10. Security & User Audit Trail</option>
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

        <div id="report-preview-container">
          <div style="text-align: center; padding: 30px; color: var(--text-muted); background: var(--bg-subtle); border-radius: 6px; border: 1px dashed var(--border-color);">
            Select parameters and click Download or Print. Exported datasets match real-time system records.
          </div>
        </div>
      </div>
    `;
  },

  handleReportTypeChange() {
    // Optional report-specific field updates
  },

  downloadReport(format) {
    const type = document.getElementById('rep-type').value;
    const fromDate = document.getElementById('rep-from').value;
    const toDate = document.getElementById('rep-to').value;
    const discom = document.getElementById('rep-discom').value;

    const q = new URLSearchParams({
      type,
      format,
      from_date: fromDate,
      to_date: toDate,
      discom
    });

    window.open(`/api/reports/export?${q.toString()}`, '_blank');
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
          ${this.user.role === 'Super Administrator' ? `
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
          <table class="data-table">
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Hierarchy Level</th>
                <th>DISCOM</th>
                <th>District / Entity</th>
                <th>Handle Name</th>
                <th>Official Account URL</th>
                <th>Monitored</th>
                <th>Status</th>
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
          <table class="data-table">
            <thead>
              <tr>
                <th>DISCOM</th>
                <th>District</th>
                <th>Nodal Officer Name</th>
                <th>Designation</th>
                <th>Official Contact Number</th>
                <th>Twitter Handle</th>
                <th>Facebook Page</th>
                <th>Status</th>
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
        <div style="display: flex; gap: 12px; align-items: center;">
          <button type="button" class="btn ${this.theme === 'light' ? 'btn-primary' : 'btn-secondary'}" onclick="App.setTheme('light', true); App.renderSettings(document.getElementById('page-content'))">
            <i class="fa-solid fa-sun" style="color: #f59e0b;"></i> Light Mode
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
    const root = document.getElementById('app');
    root.innerHTML = `
      <div class="login-wrapper">
        <div class="login-theme-bar">
          <button class="theme-toggle-btn" onclick="App.toggleTheme()" title="${this.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}" aria-label="Toggle Theme">
            <i class="fa-solid ${this.theme === 'dark' ? 'fa-sun' : 'fa-moon'}" style="${this.theme === 'dark' ? 'color: #f59e0b;' : 'color: #6366f1;'}"></i>
            <span class="theme-label">${this.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
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
              <input type="text" id="login-username" class="form-control" placeholder="Enter username..." required value="admin">
            </div>

            <div class="filter-group" style="margin-bottom: 20px;">
              <label>Password</label>
              <input type="password" id="login-password" class="form-control" placeholder="Enter password..." required value="Admin@UPPCL2026">
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 10px;">
              <i class="fa-solid fa-lock"></i> Secure Sign In
            </button>
          </form>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color); font-size: 11px;">
            <div style="font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">Quick Role Switch (Demo Credentials):</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              <span class="role-pill-btn" onclick="App.quickFill('admin', 'Admin@UPPCL2026')">Super Admin</span>
              <span class="role-pill-btn" onclick="App.quickFill('operator', 'Operator@UPPCL2026')">SMC Operator</span>
              <span class="role-pill-btn" onclick="App.quickFill('supervisor', 'Supervisor@UPPCL2026')">Supervisor</span>
              <span class="role-pill-btn" onclick="App.quickFill('nodal_puvvnl', 'Nodal@PUVVNL2026')">PuVVNL Nodal</span>
              <span class="role-pill-btn" onclick="App.quickFill('nodal_mvvnl', 'Nodal@MVVNL2026')">MVVNL Nodal</span>
              <span class="role-pill-btn" onclick="App.quickFill('nodal_dvvnl', 'Nodal@DVVNL2026')">DVVNL Nodal</span>
              <span class="role-pill-btn" onclick="App.quickFill('nodal_pvvnl', 'Nodal@PVVNL2026')">PVVNL Nodal</span>
              <span class="role-pill-btn" onclick="App.quickFill('reviewer', 'Reviewer@UPPCL2026')">Reviewer</span>
            </div>
          </div>
        </div>
      </div>
    `;
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

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
