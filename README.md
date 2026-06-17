# Evidence Vault

[![Live Site](https://img.shields.io/badge/Live-evidence--vault--yuqu.onrender.com-brightgreen)](https://evidence-vault-yuqu.onrender.com) [![Demo Video](https://img.shields.io/badge/Watch-Demo%20Video-red)](https://youtu.be/_vztS2-JNHs)

A professional, secure platform for preserving digital evidence, AI-powered threat analysis, forensic reporting, and automated emergency release (Dead-Man Switch).

Quick links:
- Live site: https://evidence-vault-yuqu.onrender.com
- Demo video: https://youtu.be/_vztS2-JNHs

---

## Table of Contents
- [Project Identity](#project-identity)
- [Problem Statement](#problem-statement)
- [Core Features](#core-features)
- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Directory Structure](#directory-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Frontend Pages & Routes](#frontend-pages--routes)
- [Library Modules (src/lib/)](#library-modules-srclib)
- [UI Components](#ui-components)
- [Key Workflows](#key-workflows)
- [Authentication & Authorization](#authentication--authorization)
- [Data Storage Strategy](#data-storage-strategy)
- [Firebase Integration](#firebase-integration)
- [Cloud Functions](#cloud-functions)
- [Environment Variables](#environment-variables)
- [Setup & Running](#setup--running)
- [Demo Credentials](#demo-credentials)
- [Design Decisions & Trade-offs](#design-decisions--trade-offs)
---
## Project Identity

| Field | Value |
| --- | --- |
| Name | **Evidence Vault** |
| Monorepo Root | `Evidence_Vault/` |
| Package Name | `react-example` (inherited from AI Studio scaffold) |
| Version | `0.0.0` (prototype / hackathon) |
| Module System | ESM (`"type": "module"`) |
| License | Unlicensed (private project) |
| Origin | Built via Google AI Studio (hackathon/demo) |

---
## Problem Statement
Victims of cyber harassment, technology-facilitated abuse, stalking, and digital fraud need a secure platform to:
1. **Preserve digital evidence** with cryptographic integrity (SHA-256 hashing)
2. **Prove evidence has not been tampered with** via client/server hash comparison
3. **Receive AI-powered risk analysis** of their situation
4. **Automatically release evidence to trusted contacts** if the victim becomes unreachable (Dead-Man Switch)
5. **Monitor social media** for incoming threats and automatically create cases
6. **Generate court-admissible forensic reports** with full chain-of-custody audit trails
---
## Core Features
### 1. Evidence Upload & Preservation
- Upload any file; client-side SHA-256 hash computed in-browser via `crypto.subtle`
- Server re-hashes the file independently; both hashes stored and compared
- Integrity status: `VERIFIED` (hashes match) or `FAILED` (mismatch = tampering detected)
- Evidence linked to cases with full metadata (file name, size, type, timestamps)
### 2. AI-Powered Threat Analysis
- **Primary**: Google Gemini API (`gemini-3.1-pro-preview`) — structured JSON analysis
- **Fallback**: Local keyword + file-type heuristic analyzer (never fails; always produces output)
- Outputs: `risk_score` (1–10), `detected_threats[]`, `recommendations[]`
- Analysis is separated from case creation (2-step: analyze first, then preserve)
### 3. Case Management Dashboard
- Full case lifecycle: `Draft → Open → Under Investigation → Evidence Verified → Report Generated → Closed → Archived`
- Valid transitions enforced via `VALID_TRANSITIONS` map
- Priority levels: `Low | Medium | High | Critical`
- Cases support: locking, tamper flags, digital signatures (simulated), assigned investigators
### 4. Dead-Man Switch (DMS)
- User configures a check-in interval (default: 24 hours)
- If the user fails to check in before the deadline:
  - All open cases auto-escalate to `escalated` status
  - A ZIP archive of all evidence + audit logs is generated
  - Professional HTML/plaintext emergency email sent to trusted contacts (via SMTP or Ethereal demo)
  - One-time time-limited download tokens created (24-hour expiry)
- Reminder emails sent before deadline (configurable `reminder_minutes_before`)
- Duplicate-send prevention via `emergency_release_sent` flag
### 5. Social Media Monitoring
- Connect accounts: WhatsApp, Messenger, SMS, Telegram, Instagram DM, Twitter DM
- AI scans conversations for threat indicators
- Risk levels 1–10; auto-creates cases when threshold exceeded (default: ≥8)
- DMS timeout per conversation: if user doesn't respond within configured minutes, emergency email fires
- "Mark as Safe" button to dismiss false positives
### 6. Forensic Report Generation
- Generates court-admissible PDF reports via `jsPDF` + `jspdf-autotable`
- Includes: case metadata, evidence inventory with SHA-256 hashes, chain-of-custody audit trail, AI analysis summary, integrity statements
- Also generates plaintext `.txt` forensic reports for email attachments
### 7. Immutable Audit Trail
- Every action logged: case creation, evidence upload, status changes, investigator assignments, emergency releases, tamper detection
- Client-side: `localStorage` key `ev_audit_log` (max 500 entries)
- Server-side: SQLite `audit_logs` table with `archived` soft-delete flag
- Firebase: `evidence_audit_logs` collection (immutable, write-only by Cloud Functions)
### 8. Role-Based Access Control (RBAC)
- 4 roles: `admin`, `investigator`, `viewer`, `user`
- 20 distinct permissions (see `ROLE_PERMISSIONS` in `rbac.ts`)
- Admin sees all cases; investigators see assigned cases only; users see own cases
- Permission guards: `hasPermission()`, `canAccessCase()`, `canUpdateStatus()`
### 9. Emergency Access Links
- One-time-use tokens for trusted contacts to access case files without authentication
- Route: `/access/:token`
- Time-limited (72 hours), email-verified, logged in audit trail
### 10. Survivors Safety Monitor
- Tracks user activity per high-priority case
- If inactive beyond threshold, auto-escalates case status and notifies authority
- Browser notification support
- Configurable hours threshold and authority email
---
## Architecture Overview
```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                             │
│                                                                     │
│  React 19 + React Router v7 + TailwindCSS v4 + Framer Motion       │
│  ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ HomePage   │ │ Dashboard │ │ Upload   │ │ Social Monitor       │ │
│  │ (public)   │ │ (cases)   │ │ (evidence│ │ (chat scanning)      │ │
│  └───────────┘ └───────────┘ │  +AI)    │ └──────────────────────┘ │
│  ┌───────────┐ ┌───────────┐ └──────────┘ ┌──────────────────────┐ │
│  │ Authority  │ │ AI        │              │ Settings             │ │
│  │ Dashboard  │ │ Analysis  │              │ (DMS config)         │ │
│  │ (admin)    │ │ Page      │              └──────────────────────┘ │
│  └───────────┘ └───────────┘                                       │
│                                                                     │
│  localStorage stores:                                               │
│    ev_managed_cases, ev_audit_log, ev_users, ev_social_*,           │
│    cases, evidence, user                                            │
│                                                                     │
│  Firebase Auth (optional) ←→ Firebase Storage (optional)            │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTP REST (fetch)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPRESS SERVER (server.ts)                       │
│                     Port 3000 (dev: Vite middleware)                 │
│                                                                     │
│  ┌────────────────┐  ┌───────────────┐  ┌────────────────────────┐ │
│  │ /api/cases     │  │ /api/analyze  │  │ /api/deadman/checkin   │ │
│  │ /api/evidence  │  │ /api/preserve │  │ /api/safety            │ │
│  │ /api/auth      │  │ /api/me       │  │ /api/emergency-release │ │
│  └────────────────┘  └───────────────┘  └────────────────────────┘ │
│                                                                     │
│  Gemini AI (via @google/genai) ←→ Local Fallback Analyzer          │
│  Nodemailer (SMTP / Ethereal demo)                                  │
│  Multer (file uploads → /uploads/)                                  │
│  SQLite (better-sqlite3 → /data/vault.db)                           │
│  Dead-Man Timer Cron (setInterval, every 60s)                       │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│                     FIREBASE (Optional/Production)                  │
│                                                                     │
│  Firestore: evidence, evidence_audit_logs                           │
│  Storage: evidence/{caseId}/{evidenceId}/{filename}                 │
│  Auth: Email/Password                                               │
│  Cloud Functions: startUpload, onObjectFinalized                    │
│  Security Rules: firestore.rules (immutable evidence fields)        │
└─────────────────────────────────────────────────────────────────────┘
```
---
## Technology Stack

| Layer | Technology | Version | Purpose |
| --- | --- | ---: | --- |
| Frontend Framework | React | 19.0.0 | UI rendering and component architecture |
| Router | react-router-dom | 7.13.1 | Client-side routing with protected routes |
| Styling | TailwindCSS (+@tailwindcss/vite) | 4.1.14 | Utility-first CSS |
| Animations | Framer Motion (motion) | 12.23.24 | Page transitions and micro-animations |
| Icons | lucide-react | 0.546.0 | Icon set used across UI |
| Build Tool | Vite | 6.2.0 | Dev server (HMR) and production bundler |
| Language | TypeScript | 5.8.2 | Type safety across frontend and backend |
| Backend Runtime | Node.js + Express | — | REST API server |
| Backend Runner (dev) | tsx | 4.21.0 | Run TypeScript directly in development |
| Database | better-sqlite3 | 12.6.2 | Embedded SQLite for cases, evidence, audit logs |
| File Upload | multer | 2.0.2 | Multipart/form-data file handling |
| AI / LLM | @google/genai | 1.42.0 | Google Gemini (structured analysis) |
| Email | nodemailer | 6.10.1 | SMTP or Ethereal demo delivery |
| PDF Reports | jsPDF + jspdf-autotable | 4.x / 5.x | Forensic report generation |
| ZIP Archives | archiver + jszip | 7.x / 3.x | Evidence export packaging |
| Auth (optional) | Firebase Auth | 12.9.0 | Email/password authentication (optional) |
| Storage (optional) | Firebase Storage | 12.9.0 | Cloud file storage (optional) |
| Cloud Functions | Firebase Functions | v1 | Optional serverless triggers (startUpload, onFinalize) |
| Date Utility | date-fns | 4.1.0 | Date formatting and utilities |
| CSS Utilities | clsx + tailwind-merge | 2.1.1 / 3.5.0 | Conditional class merging and Tailwind helpers |
| Env Config | dotenv | 17.2.3 | Load .env files in local development |

## Directory Structure
```
Evidence-Vault/
├── README.md                          ← THIS FILE
└── Evidence_Vault/                    ← Main application directory
    ├── package.json                   ← Dependencies & scripts
    ├── tsconfig.json                  ← TypeScript config (ES2022, React JSX)
    ├── vite.config.ts                 ← Vite config (TailwindCSS plugin, path aliases)
    ├── tailwind.config.cjs            ← TailwindCSS config
    ├── server.ts                      ← Express backend (1361 lines, all API routes)
    ├── index.html                     ← HTML entry point (SPA shell)
    ├── metadata.json                  ← AI Studio metadata
    ├── firestore.rules                ← Firestore security rules
    ├── .env.example                   ← Environment variable template
    ├── .gitignore
    │
    ├── src/                           ← Frontend source code
    │   ├── main.tsx                   ← React entry point (ReactDOM.createRoot)
    │   ├── App.tsx                    ← Root component: routing, auth, layout, safety banners
    │   ├── index.css                  ← Global CSS (TailwindCSS import)
    │   │
    │   ├── pages/                     ← Page-level components (route targets)
    │   │   ├── HomePage.tsx           ← Public landing page (59KB, animated hero)
    │   │   ├── HomePage.css           ← Landing page custom styles
    │   │   ├── Login.tsx              ← Firebase Auth + demo mode login/register
    │   │   ├── Dashboard.tsx          ← Case management dashboard (CRUD, metrics)
    │   │   ├── CaseDetails.tsx        ← Individual case view (evidence, logs, actions)
    │   │   ├── EvidenceUpload.tsx     ← File upload + SHA-256 hashing + preserve workflow
    │   │   ├── AIAnalysisPage.tsx     ← AI threat analysis interface
    │   │   ├── AuthorityDashboard.tsx ← Admin-only: escalated cases, metrics
    │   │   ├── SocialMonitoringPage.tsx ← Social media scanning (68KB, largest page)
    │   │   ├── SettingsPage.tsx       ← DMS config, trusted contacts, emergency release
    │   │   ├── EmergencyAccessPage.tsx ← Token-based one-time access for trusted contacts
    │   │   └── UnauthorizedPage.tsx   ← 403 error page
    │   │
    │   ├── components/                ← Reusable UI components
    │   │   ├── AIOverviewSection.tsx       ← AI analysis summary card
    │   │   ├── CaseDetailsDashboard.tsx    ← Case detail with status workflow, notes, actions
    │   │   ├── EvidenceRecordDisplay.tsx   ← Evidence file record card (hash, integrity)
    │   │   ├── ForensicReportPanel.tsx     ← In-app forensic report viewer/generator
    │   │   ├── GeoSafetyAlert.tsx          ← Geolocation-based safety alerts
    │   │   └── admin/                      ← Admin-specific components
    │   │       ├── AuditLogPanel.tsx        ← Audit log viewer with filters, export
    │   │       ├── CaseOverviewMetrics.tsx  ← Dashboard metric cards
    │   │       ├── CaseStatusBadge.tsx      ← Status indicator badge
    │   │       ├── InvestigatorManagement.tsx ← Assign/remove investigators
    │   │       ├── InviteInvestigatorModal.tsx ← Email invitation modal
    │   │       └── RoleBadge.tsx            ← Role indicator badge
    │   │
    │   └── lib/                       ← Business logic & data access modules
    │       ├── firebase.ts            ← Firebase app initialization (auth, storage)
    │       ├── rbac.ts                ← Role-based access control (4 roles, 20 permissions)
    │       ├── caseStore.ts           ← Case CRUD in localStorage (ManagedCase type)
    │       ├── evidenceStore.ts       ← Evidence metadata in localStorage
    │       ├── auditLog.ts            ← Audit log system (append-only, max 500 entries)
    │       ├── aiAnalyzer.ts          ← Client-side AI analysis (calls /api/analyze)
    │       ├── safetyMonitor.ts       ← Survivors safety monitor (inactivity detection)
    │       ├── socialMonitorStore.ts  ← Social media monitor store (accounts, scans, alerts)
    │       ├── ForensicReportGenerator.ts ← PDF forensic report builder (jsPDF)
    │       ├── forensicRecords.ts     ← Forensic record data structures
    │       ├── evidenceDownload.ts    ← Evidence export/download utilities
    │       ├── emergencyAccessStore.ts ← Emergency access token management
    │       ├── investigatorRequests.ts ← Investigator invite/request handling
    │       ├── inviteStore.ts         ← Invitation link store
    │       └── utils.ts               ← Utility helpers (cn function)
    │
    ├── functions/                     ← Firebase Cloud Functions
    │   ├── index.js                   ← startUpload + onObjectFinalized triggers
    │   └── package.json               ← Cloud Functions dependencies
    │
    ├── firebase/                      ← Firebase config
    │   └── firestore.rules            ← Firestore security rules (duplicate of root)
    │
    ├── data/                          ← Runtime data
    │   └── vault.db                   ← SQLite database file (auto-created)
    │
    ├── uploads/                       ← Uploaded evidence files (multer destination)
    ├── dist/                          ← Production build output (vite build)
    └── node_modules/                  ← Dependencies
```
---
## Database Schema
### SQLite (`data/vault.db`) — Server-side persistence
```sql
-- User accounts
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'user',              -- 'user' | 'admin'
    dead_man_interval_hours INTEGER DEFAULT 24,
    last_checkin DATETIME DEFAULT CURRENT_TIMESTAMP,
    next_checkin DATETIME,
    status TEXT DEFAULT 'active',          -- 'active' | 'danger'
    trusted_contacts TEXT,                 -- JSON array of {name, email, role}
    reminder_minutes_before INTEGER DEFAULT 60,
    reminder_sent INTEGER DEFAULT 0,
    emergency_release_enabled INTEGER DEFAULT 0,
    emergency_release_sent INTEGER DEFAULT 0,
    emergency_custom_message TEXT,
    last_emergency_release TEXT
);
-- Investigation cases
CREATE TABLE cases (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    title TEXT,
    description TEXT,
    risk_score INTEGER,                    -- 0–10 from AI analysis
    risk_analysis TEXT,                     -- JSON blob from AI
    status TEXT DEFAULT 'open',            -- 'open' | 'escalated'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Evidence files with integrity verification
CREATE TABLE evidence (
    id TEXT PRIMARY KEY,
    case_id TEXT REFERENCES cases(id),
    user_id TEXT REFERENCES users(id),
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    client_sha256 TEXT,                    -- Hash computed in browser
    server_sha256 TEXT,                    -- Hash computed on server
    integrity_verified BOOLEAN,            -- client == server
    upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT                         -- Path on disk (uploads/)
);
-- Immutable audit trail
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    user_id TEXT,
    action TEXT,                           -- e.g., CASE_CREATED, EVIDENCE_UPLOADED
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived INTEGER DEFAULT 0            -- Soft delete flag
);
-- Time-limited download tokens for emergency access
CREATE TABLE tokens (
    token TEXT PRIMARY KEY,
    case_id TEXT,
    expires_at DATETIME,
    allowed_emails TEXT,                   -- JSON array of permitted emails
    file_path TEXT                         -- Path to generated ZIP
);
```
### localStorage Keys — Client-side persistence

| Key | Type | Description |
| --- | --- | --- |
| `user` | `{ uid, email, role }` | Current logged-in user session (demo or Firebase) |
| `cases` | `Array<Case>` | Legacy evidence preservation cases |
| `evidence` | `Array<Evidence>` | Legacy evidence metadata |
| `ev_managed_cases` | `Array<ManagedCase>` | RBAC-enabled primary case store |
| `ev_users` | `Array<AppUser>` | RBAC user registry (demo mode) |
| `ev_audit_log` | `Array<AuditEntry>` | Global audit log (max 500 entries) |
| `ev_social_accounts` | `Array<ConnectedAccount>` | Connected social media accounts |
| `ev_social_scans` | `Array<ScannedConversation>` | Social media scan results |
| `ev_social_alerts` | `Array<SafetyAlert>` | Social monitoring alerts |
| `ev_social_settings` | `MonitorSettings` | Social monitor configuration |
| `ev_safety_monitor_settings` | `SafetyMonitorSettings` | Survivors safety monitor configuration |
| `ev_safety_monitor_activity` | `Record<caseId, ISO>` | Last activity timestamp per case |
| `ev_safety_monitor_alerts` | `Array<SafetyAlertEntry>` | Safety monitor alert log |
| `ev_safety_monitor_notified` | `string[]` | Case IDs already notified (to avoid duplicate emails) |

## API Reference
All endpoints are served from `server.ts` on port 3000.

### Authentication (Mocked)

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Login by email (returns mock JWT in demo mode) |
| GET | `/api/me` | Get current user (returns demo user or Firebase user) |

### Cases

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/cases` | List all cases for current user |
| POST | `/api/cases` | Create new case — body: `{ title, description }` |
| GET | `/api/cases/:id` | Get case with evidence and audit logs |
| POST | `/api/cases/:id/delete` | Delete case (cascade: evidence files, audit logs) |
| GET | `/api/cases/:id/export` | Export case as ZIP (metadata + evidence + SHA256SUMS + report) |
| GET | `/api/admin/cases` | List escalated cases (admin only) |

### Evidence

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/cases/:id/evidence` | Upload evidence file (multipart `file`, include `client_sha256` field) |
| POST | `/api/preserve` | Preserve evidence — body: `{ evidenceId, caseId, serverHash }` |
| POST | `/api/evidence/:id/link` | Link an existing evidence record to a case |
| POST | `/api/cases/:id/verify` | Log manual verification attempt |

### AI Analysis

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/analyze` | Analyze text (body: `{ title, description }`) → returns `{ risk_score, risk_analysis, analysisSource }` |

> Note: `/api/analyze` never returns 500 — it falls back to a local heuristic analyzer if Gemini fails.

### Dead-Man Switch (DMS)

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/deadman/checkin` | User check-in (resets DMS timer) |

### Safety Settings

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/safety` | Get trusted contacts and DMS interval |
| POST | `/api/safety` | Update trusted contacts and DMS interval (body: `{ trustedContacts, deadManIntervalHours, reminderMinutesBefore }`) |

### Emergency Release

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/emergency-release/config` | Retrieve emergency release configuration |
| POST | `/api/emergency-release/config` | Update emergency release configuration |
| POST | `/api/emergency-release/test` | Send a test emergency email (demo mode uses Ethereal) |
| POST | `/api/emergency-release/reset` | Reset the "sent" flag to allow re-sending |

### Social Monitor

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/social-monitor/dms-fire` | Trigger DMS emergency flow for a detected social media threat |

### Cloud Functions Compatibility

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/functions/startUpload` | Register evidence for upload (compatibility shim for Firebase Functions) |

### Report Download

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/download/report/:token` | Download ZIP by token (requires `?email=` query parameter for basic verification) |

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/download/report/:token` | Download ZIP by token (requires `?email=` query parameter for basic verification) |

## Frontend Pages & Routes

| Path | Component | Auth | Description |
| --- | --- | --- | --- |
| `/` | `HomePage` | Public | Animated landing page with feature highlights |
| `/login` | `Login` | Public | Firebase Auth login / demo-mode login |
| `/register` | `Login` (sign-up mode) | Public | Registration form (demo or Firebase) |
| `/unauthorized` | `UnauthorizedPage` | Public | 403/Access denied page |
| `/access/:token` | `EmergencyAccessPage` | Public | One-time emergency access for trusted contacts |
| `/dashboard` | `Dashboard` | Protected | Case management: create, view, filter, metrics |
| `/cases/:id` | `CaseDetails` | Protected | Individual case view (evidence, logs, actions) |
| `/upload` | `EvidenceUpload` | Protected | Evidence upload, client SHA-256, AI analysis, preserve workflow |
| `/ai-analysis` | `AIAnalysisPage` | Protected | Standalone AI threat analysis tool |
| `/authority` | `AuthorityDashboard` | Protected (admin) | Admin: escalated cases, metrics, investigator tools |
| `/social-monitor` | `SocialMonitoringPage` | Protected | Social media monitoring and DMS integration |
| `/settings` | `SettingsPage` | Protected | Dead-Man Switch config, trusted contacts, emergency release |
| `*` | Redirect to `/` | — | Catch-all redirect (404) |

### Route Guards
- **`ProtectedRoute`**: Redirects to `/login` if `user` is null.
- **`AuthRoute`**: Redirects authenticated users to `/dashboard`.
- Admin-only routes render an access-denied redirect for non-admin users.

- **`ProtectedRoute`**: Redirects to `/login` if `user` is null
- **`AuthRoute`**: Redirects to `/dashboard` if user is already authenticated
- **Admin check**: Authority Dashboard renders `<Navigate>` for non-admin users
---
## Library Modules (`src/lib/`)
### `firebase.ts`
Firebase app initialization. Gracefully catches initialization errors so the app works without Firebase. Exports: `app`, `auth`, `storage`.
### `rbac.ts`
Role-Based Access Control system.
- **Roles**: `admin`, `investigator`, `viewer`, `user`
- **Key exports**: `hasPermission()`, `canAccessCase()`, `canUpdateStatus()`, `getCurrentAppUser()`, `seedDemoUsers()`
- **User store**: localStorage key `ev_users`
### `caseStore.ts`
Primary case management CRUD operating on localStorage.
- **Type**: `ManagedCase` with full status workflow, priority, locking, tamper flags, digital signatures
- **Status workflow**: `Draft → Open → Under Investigation → Evidence Verified → Report Generated → Closed → Archived`
- **Key exports**: `createManagedCase()`, `updateManagedCase()`, `deleteManagedCase()`, `getCaseMetrics()`, `seedDemoCases()`
### `auditLog.ts`
Append-only audit logging system.
- **24 action types** covering full case lifecycle
- **Max 500 entries** in localStorage
- **Key exports**: `appendAuditEntry()`, `getCaseAuditLog()`, `getAuditStats()`, `seedDemoAuditLog()`
### `aiAnalyzer.ts`
Client-side wrapper for AI analysis. Calls `/api/analyze` endpoint.
### `safetyMonitor.ts`
Survivors Safety Monitor — tracks user inactivity on high-risk cases.
- If inactive beyond threshold, auto-escalates case and fires browser alert
- Exports: `runInactivityCheck()`, safety settings CRUD, `SafetyAlertEntry` type
### `socialMonitorStore.ts`
Social media monitoring store (620 lines, largest lib module).
- **Platforms**: WhatsApp, Messenger, SMS, Telegram, Instagram DM, Twitter DM
- **Features**: Account connection, conversation scanning, AI risk analysis, auto-case creation, DMS timer
- **Key types**: `ConnectedAccount`, `ScannedConversation`, `SafetyAlert`, `MonitorSettings`
### `ForensicReportGenerator.ts`
PDF report generator using jsPDF.
- Generates court-admissible reports with cover page, evidence inventory, chain of custody, integrity statements
- **Key type**: `ForensicReportData`, `ReportEvidence`, `ReportAuditEntry`
### `evidenceStore.ts`
Simple localStorage-based evidence metadata store.
### `evidenceDownload.ts`
Evidence export/download utilities (ZIP generation, file bundling).
### `emergencyAccessStore.ts`
Emergency access token management for trusted contacts.
### `investigatorRequests.ts` + `inviteStore.ts`
Investigator invitation and request handling logic.
---
## Key Workflows
### Evidence Preservation Flow
```
User uploads file
    → Browser computes SHA-256 (crypto.subtle.digest)
    → File sent to server via multipart POST
    → Server computes independent SHA-256
    → Hashes compared → integrity_verified: true/false
    → Evidence record stored in SQLite
    → Audit log entry created
    → User clicks "Preserve" → confirmation dialog
    → Case + evidence linked, preservation logged
```
### Dead-Man Switch Flow
```
User configures interval (e.g., 24 hours)
    → User checks in → timer resets
    → Timer expires (checked every 60 seconds via setInterval)
        → User status → 'danger'
        → All open cases → 'escalated'
        → For each case:
            → ZIP archive generated (metadata + evidence + audit logs + SHA256SUMS)
            → Download token created (24h expiry)
            → Emergency email built (professional HTML + plaintext fallback)
            → Email sent to trusted contacts (SMTP or Ethereal demo)
            → Forensic report attached as .txt
            → Case metadata attached as .json
        → emergency_release_sent = 1 (prevents duplicates)
```
### Social Monitor DMS Flow
```
Social account connected
    → AI scans conversations (Gemini or fallback)
    → Risk level assessed (1–10)
    → If risk ≥ threshold:
        → Case auto-created
        → DMS timer starts (configurable minutes)
        → User notified (in-app alert)
        → If user doesn't respond before timeout:
            → POST /api/social-monitor/dms-fire
            → Emergency email sent to trusted contacts
            → One-time access link included in email
```
---
## Authentication & Authorization
### Dual-Mode Authentication
1. **Firebase Auth** (production): Email/password via `firebase/auth`. Detects `authority` in email to assign admin role.
2. **Demo Mode** (default): Login form writes user data directly to localStorage. No real auth verification.
### Session Management
- User object stored in `localStorage` key `user`
- `App.tsx` reads localStorage on mount; Firebase `onAuthStateChanged` as secondary
- Logout clears both Firebase session and localStorage
### Authorization Flow
```
User logs in → role determined (admin if email contains 'authority')
    → ProtectedRoute checks user != null
    → Layout renders sidebar based on role (admin sees Authority Dashboard)
    → RBAC module checks permissions per action
    → caseStore filters cases based on role + assignments
```
---

### Why Dual Storage?
- **Demo mode**: Everything works offline with localStorage + SQLite, no Firebase required
- **Production mode**: Firebase provides cloud persistence, real auth, secure storage
- The server always uses SQLite; the frontend primarily uses localStorage for RBAC/case management, and falls back to API calls for evidence operations
---
## Firebase Integration
### Client-Side (`src/lib/firebase.ts`)
- Initializes Firebase app with hardcoded config (project: `evidence-vault-67dba`)
- Exports: `auth` (Firebase Auth), `storage` (Firebase Storage)
- Graceful failure: if Firebase init fails, app continues without it
### Security Rules (`firestore.rules`)
- Evidence documents: anyone can read, only authenticated users can create (with field validation)
- **Immutable fields**: `server_sha256`, `integrity_status`, `upload_timestamp`, `verification_timestamp` cannot be set by clients
- `client_sha256` and `uploaded_by` cannot be modified after creation
- Evidence cannot be deleted (`allow delete: if false`)
- Audit logs: read-only for clients; only Cloud Functions/admin SDK can write
### Cloud Functions (`functions/index.js`)
1. **`startUpload`** (HTTP trigger):
   - Registers evidence in Firestore
   - Captures client SHA-256, device info, IP hash
   - Creates initial audit log entry
2. **`onObjectFinalized`** (Storage trigger):
   - Fires when file upload completes
   - Downloads file to temp directory
   - Computes server-side SHA-256
   - Compares with client hash → sets `integrity_status` to `VERIFIED` or `FAILED`
   - Creates 3 audit log entries: `file_uploaded`, `hash_verified`, `integrity_checked`
   - Atomic batch write for consistency
---
## Environment Variables
```env
# Required: Google Gemini AI API key
GEMINI_API_KEY="your-gemini-api-key"
# Optional: App URL for self-referential links
APP_URL="http://localhost:3000"
# Optional: SMTP for real email delivery
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-gmail-app-password"
SMTP_FROM="Evidence Vault <your-email@gmail.com>"
# Optional: Firebase Admin (for server-side cleanup)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
FIREBASE_STORAGE_BUCKET="evidence-vault-67dba.firebasestorage.app"
# Optional: Base URL for email links
BASE_URL="http://localhost:3000"
```
If `SMTP_USER` and `SMTP_PASS` are not configured (or left as defaults), the system automatically falls back to **Ethereal** (free demo SMTP) and logs preview URLs to the console.
---
## Setup & Running
### Prerequisites
- Node.js (v18+)
- npm
### Quick Start
```bash
cd Evidence_Vault
npm install
cp .env.example .env.local
# Edit .env.local to set GEMINI_API_KEY
npm run dev
# Server starts at http://localhost:3000
```
### Available Scripts
|
 Script 
|
 Command 
|
 Description 
|
|
---
|
---
|
---
|
|
`dev`
|
`tsx server.ts`
|
 Start dev server (Express + Vite middleware) 
|
|
`build`
|
`vite build`
|
 Production build 
|
|
`preview`
|
`vite preview`
|
 Preview production build 
|
|
`clean`
|
`rm -rf dist`
|
 Clean build output 
|
|
`lint`
|
`tsc --noEmit`
|
 Type checking 
|
|
`start`
|
`node server.ts`
|
 Start production server 
|
---
## Demo Credentials
### Pre-seeded Users (SQLite)
|
 Email 
|
 Role 
|
 Password 
|
|
---
|
---
|
---
|
|
`victim@example.com`
|
 user 
|
*
(any — mock auth)
*
|
|
`authority@police.gov`
|
 admin 
|
*
(any — mock auth)
*
|
### Pre-seeded RBAC Users (localStorage)
|
 Email 
|
 Role 
|
 Name 
|
|
---
|
---
|
---
|
|
`authority@police.gov`
|
 admin 
|
 Authority Admin 
|
|
`rahman@investigation.bd`
|
 investigator 
|
 Detective Rahman 
|
|
`karim@investigation.bd`
|
 investigator 
|
 Officer Karim 
|
|
`victim@example.com`
|
 user 
|
 Victim User 
|
### Demo Cases (auto-seeded)
|
 ID 
|
 Title 
|
 Status 
|
 Priority 
|
|
---
|
---
|
---
|
---
|
|
`demo-case-001`
|
 Phishing Email Investigation 
|
 Under Investigation 
|
 High 
|
|
`demo-case-002`
|
 Financial Fraud Analysis 
|
 Evidence Verified 
|
 Critical 
|
|
`demo-case-003`
|
 Social Media Harassment Report 
|
 Open 
|
 Medium 
|
|
`demo-case-004`
|
 Data Breach Forensics 
|
 Draft 
|
 High 
|
---
## Design Decisions & Trade-offs
1. **Dual Storage (localStorage + SQLite)**: Allows offline-first demo without Firebase, while the server maintains authoritative state. Trade-off: data can diverge between client and server.
2. **Mock Authentication**: The server uses hardcoded `mockUserId` for all requests. Real Firebase Auth is optional and only used for the login flow. Trade-off: no real access control at the API level in demo mode.
3. **AI Analysis Separation**: `/api/analyze` is decoupled from `/api/cases`. Analysis can fail without blocking case creation. The analyze endpoint **never returns 500** — it always falls back to local heuristics.
4. **Evidence Immutability**: Firestore rules prevent clients from modifying `server_sha256`, `integrity_status`, and timestamps after creation. Evidence cannot be deleted. This ensures chain-of-custody integrity.
5. **Dead-Man Switch as `setInterval`**: For demo purposes, the DMS check runs every 60 seconds via `setInterval` in `server.ts`. In production, this would be a cron job or Cloud Scheduler.
6. **Ethereal Email Fallback**: If real SMTP is not configured, the system auto-creates a free Ethereal test account and logs preview URLs. This ensures email features are always demonstrable without configuration.
7. **Client-Side RBAC**: The RBAC system (`rbac.ts`) operates entirely on localStorage. The server doesn't enforce role-based permissions (mock auth). In production, RBAC would be enforced server-side.
8. **Large Page Components**: Some pages (e.g., `SocialMonitoringPage.tsx` at 68KB) contain significant logic inline. This is a hackathon trade-off for development speed over component decomposition.
---
## Context for AI Assistants
When working with this codebase:
- **Entry point**: `server.ts` is the single Express server file (~1361 lines) containing ALL API routes, database schema, AI analysis, email logic, and the Dead-Man Switch timer.
- **Frontend entry**: `src/App.tsx` defines all routes and the layout shell. Each route maps to a page in `src/pages/`.
- **Business logic**: `src/lib/` contains modular stores. Most use localStorage directly. The naming convention is `*Store.ts` for data stores and descriptive names for utilities.
- **The app works in two modes**: Demo (localStorage + SQLite, mock auth) and Production (Firebase Auth + Firestore + Cloud Functions). Most development/testing uses demo mode.
- **All data flows through two paths**: Client → localStorage (for RBAC, cases, audit logs) and Client → Express API → SQLite (for evidence, server-side cases, DMS).
- **The `cases` key in localStorage** is the legacy store; `ev_managed_cases` is the current RBAC-aware store. Both may coexist.
# Evidence-Vault
