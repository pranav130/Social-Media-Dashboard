# UPPCL Social Media Cell Complaint Management System

A centralized, secure, web-based enterprise complaint management platform designed for the **Uttar Pradesh Power Corporation Limited (UPPCL) Social Media Cell (SMC)** to track, route, follow up, and verify consumer grievances received through Twitter/X, Facebook, and manual monitoring.

---

## Key Highlights

- **Authoritative X (Twitter) Hierarchy**: Pre-loaded with the complete, official 90-handle hierarchy covering Apex/Government handles (`@UPPCLLKO`, `@CMOfficeUP`, `@EMofficeUP`, `@AKSharmaOffice`, `@aksharmaBharat`, `@ChairmanUppcl`, `@mduppcl`), DISCOM Corporate Headquarters (`@PuVVNLHQ`, `@MVVNLHQ`, `@dvvnlhq`, `@PVVNLHQ`, `@KESCoHQ`), and all 75+ district field handles.
- **Role-Based Access Control (RBAC)**: Enforced server-side on every REST endpoint across 5 distinct roles:
  1. **Super Administrator**: Full system governance, user management, audit trail, and configurable X hierarchy.
  2. **Social Media Cell Operator**: Register complaints, search, classify, assign, forward to DISCOMs, record follow-ups, and update status.
  3. **Supervisor / Management**: Consolidated executive dashboards, performance metrics, overdue monitoring, and closure verification audits.
  4. **DISCOM Nodal Officer**: Strictly scoped to assigned DISCOM grievances, submits action-taken reports, and proposes resolution (cannot unilaterally close).
  5. **Read-Only Reviewer**: High-level dashboards and reports without edit capabilities.
- **9-Stage Workflow State Machine**:
  - `New` → `Forwarded` → `DISCOM Follow Up` → `Pending` → `Escalated` → `Resolved — Verification Pending` → `Closed` → `Reopened` / `Duplicate / Invalid`.
  - Mandatory reasons on escalation, reopening, and invalidation.
  - Two-step resolution verification: DISCOM reports resolution; Social Media Cell verifies with consumer before closure.
- **Centralized Operations Dashboard**:
  - 11 real-time KPI cards matching actual database counts.
  - Interactive visual charts (daily trend line, DISCOM matrix, X handle breakdown, category breakdown, district top 10, status pie).
  - Direct drill-down: clicking any KPI or chart segment immediately opens the filtered register.
- **Comprehensive Reporting & Export**:
  - Downloadable CSV, Excel (`.xlsx`), and formatted print-to-PDF reports.
  - 10 operational reports: Daily ops, X hierarchy report, DISCOM & district performance, category-wise grievance breakdown, pending & overdue, follow-up logs, escalation trail, resolved vs verified-closed, aging analysis, and security audit trail.
- **Duplicate Grievance Detection**: Automatic real-time check against duplicate post URLs, recent consumer handles, and text snippets.
- **Append-Only Chronological Timeline**: Every complaint maintains an immutable audit history with Indian Standard Time (IST) timestamps.

---

## Technology Stack

- **Runtime**: Node.js (v20+ LTS)
- **Backend**: Express.js REST API
- **Database**: SQLite (via `sql.js` WebAssembly engine with synchronous ACID disk persistence to `data/uppcl_smc.db`)
- **Security**: JWT authentication, bcrypt password hashing, login rate-limiting, and input sanitization
- **Reporting**: SheetJS (`xlsx`) for Excel reports and formatted streaming CSV
- **Frontend**: Clean, responsive Government enterprise Single Page Application (HTML5, CSS3, Font Awesome 6, Chart.js 4)

---

## Directory Structure

```
X TOOL/
├── data/
│   ├── uppcl_smc.db           # Persistent SQLite database file
│   └── seeds/                 # Master data parsed from authoritative attachments
│       ├── tw_parsed.json     # 90 authoritative X handles
│       ├── smh_parsed.json    # Facebook handles & district nodal officers
│       ├── zones_parsed.json  # 38 UPPCL zones
│       ├── circles_parsed.json# 120 UPPCL circles
│       └── divisions_parsed.json # 459 UPPCL divisions
├── public/                    # Frontend SPA
│   ├── index.html             # Main portal shell
│   ├── css/style.css          # Professional responsive theme
│   └── js/app.js              # Complete client-side application logic
├── uploads/                   # Secure evidence & document storage
├── db.js                      # Database connection and schema manager
├── seed.js                    # Comprehensive database seeder
├── server.js                  # Express REST API and authentication server
├── test.js                    # Automated verification test suite
├── .env.example               # Environment configuration template
└── package.json               # Project manifest and scripts
```

---

## Quick Start & Setup

### 1. Start the Server

```powershell
npm start
```
The application will start at **http://localhost:3000**.

### 2. Run Database Seeding (If resetting data)

```powershell
npm run seed
```

### 3. Run Automated Tests

```powershell
npm test
```

---

## Default User Credentials (For UAT & Demonstration)

| Role | Username | Password | Assigned DISCOM Scope |
| :--- | :--- | :--- | :--- |
| **Super Administrator** | `admin` | `admin123` | All DISCOMs (Full Access) |
| **SMC Operator** | `operator` | `operator123` | All DISCOMs (Grievance Processing) |
| **SMC Operator 2** | `operator2` | `operator123` | All DISCOMs (Grievance Processing) |
| **Supervisor / Management** | `supervisor` | `supervisor123` | All DISCOMs (Monitoring & Verification) |
| **PuVVNL Nodal Officer** | `nodal_puvvnl` | `nodal123` | PuVVNL Only |
| **MVVNL Nodal Officer** | `nodal_mvvnl` | `nodal123` | MVVNL Only |
| **DVVNL Nodal Officer** | `nodal_dvvnl` | `nodal123` | DVVNL Only |
| **PVVNL Nodal Officer** | `nodal_pvvnl` | `nodal123` | PVVNL Only |
| **KESCo Nodal Officer** | `nodal_kesco` | `nodal123` | KESCo Only |
| **Read-Only Reviewer** | `reviewer` | `reviewer123` | All DISCOMs (Read-Only) |

*Note: For backward compatibility, legacy passwords (e.g. `Admin@UPPCL2026`) and simple passwords (`admin`) are also accepted.*

---

## Authoritative X Hierarchy

The system incorporates all 90 entries from the official UPPCL Social Media Cell master sheet:

1. **Level 1 — Apex / Government / Corporate HQ**:
   - `UPPCL HQ` — `https://x.com/UPPCLLKO` (`@UPPCLLKO`)
   - `CM OFFICE` — `https://x.com/CMOfficeUP` (`@CMOfficeUP`)
   - `E M OFFICE` — `https://x.com/EMofficeUP` (`@EMofficeUP`)
   - `EM SIR (SHRI A K SHARMA)` — `https://x.com/AKSharmaOffice` (`@AKSharmaOffice`)
   - `EM SIR (SHRI A K SHARMA)` — `https://x.com/aksharmaBharat` (`@aksharmaBharat`)
   - `Chairman UPPCL` — `https://x.com/ChairmanUppcl` (`@ChairmanUppcl`)
   - `MD UPPCL` — `https://x.com/mduppcl` (`@mduppcl`)
2. **Level 2 — DISCOM Corporate HQ**:
   - `PVVNL HQ` — `https://x.com/PVVNLHQ` (`@PVVNLHQ`)
   - `DVVNL HQ` — `https://x.com/dvvnlhq` (`@dvvnlhq`)
   - `PUVVNL HQ` — `https://x.com/PuVVNLHQ` (`@PuVVNLHQ`)
   - `MVVNL HQ` — `https://x.com/MVVNLHQ` (`@MVVNLHQ`)
   - `KESCo HQ` — `https://x.com/KESCoHQ` (`@KESCoHQ`)
3. **Level 3 — District & Field Office Accounts**:
   - 21 PUVVNL districts (Varanasi, Prayagraj, Gorakhpur, Azamgarh, Ghazipur, Basti, Jaunpur, Mirzapur, etc.)
   - 22 MVVNL districts & zones (Lucknow Cis/Trans Gomti, Bareilly, Ayodhya, Sitapur, Hardoi, Gonda, etc.)
   - 21 DVVNL districts (Agra, Aligarh, Mathura, Jhansi, Kanpur Dehat, Firozabad, Banda, etc.)
   - 14 PVVNL districts (Meerut, Noida/GB Nagar, Ghaziabad, Muzaffarnagar, Saharanpur, Moradabad, etc.)

---

## Complaint Workflow Lifecycle

```
[Consumer Post on X/FB]
         │
         ▼
     ┌───────┐
     │  New  │ (Captured by SMC Operator)
     └───────┘
         │
         ▼ (Forwarded to DISCOM Nodal Officer with SLA)
   ┌───────────┐
   │ Forwarded │
   └───────────┘
         │
         ├──────────────────────────────┐
         ▼                              ▼
┌──────────────────┐            ┌───────────────┐
│ DISCOM Follow Up │ (Reminder) │   Escalated   │ (SLA Breach / Urgency)
└──────────────────┘            └───────────────┘
         │                              │
         └──────────────┬───────────────┘
                        │
                        ▼ (DISCOM submits action taken)
         ┌─────────────────────────────────┐
         │ Resolved — Verification Pending │
         └─────────────────────────────────┘
                        │
                        ▼ (SMC Operator verifies resolution with consumer)
                   ┌────────┐
                   │ Closed │
                   └────────┘
                        │
                        ▼ (If consumer reports unresolved)
                  ┌──────────┐
                  │ Reopened │
                  └──────────┘
```

---

## Security & Reliability Standards

- **Server-Side Enforcement**: DISCOM Nodal Officers cannot query, edit, or view grievances from another DISCOM even if parameters are forged.
- **Tamper-Evident Activity Trail**: Timeline and audit entries are append-only.
- **Login Throttling**: Accounts are protected against brute-force attacks by rate-limiting failed attempts.
- **Input Validation**: URLs and file uploads are strictly validated before storage.
