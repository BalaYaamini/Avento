# AVENTO — Production Deployment & Hosting Handover Guide

**Project:** AVENTO — University Event Management Platform
**Document type:** Production deployment audit & handover guide (audit-only; no code was modified)
**Audience:** University hosting / infrastructure team
**Audit date:** 2026-11-02
**Repository:** `avento-monorepo` v1.0.0 (monorepo: root + `client/` + `server/` + `ui-designs/`)

**Status legend used throughout this document:**

| Tag | Meaning |
|---|---|
| **[VERIFIED]** | Confirmed directly from repository source code / configuration during this audit |
| **[OPTIONAL]** | Feature or variable that can be omitted; code degrades gracefully or feature is unused |
| **[LEGACY]** | Present in the repository but NOT on the runtime path — kept for migration/compatibility only |
| **[NEEDS CONFIRMATION]** | Ambiguous, environment-specific, or a decision the hosting team must make |

---

## 1. Project Overview

AVENTO is a university event management platform supporting event proposals & approval workflows, team and individual registrations, slot scheduling, panel allocation, QR-based attendance, scoring, certificate generation (PDF + QR verification), announcements, feedback, and payment-verification workflows.

**Deployment targets found in the repository:**

| Target | Frontend | Backend | Status |
|---|---|---|---|
| Web app | React SPA built with Vite (currently deployed to Vercel) | Express API (currently deployed to Render at a hardcoded URL) | **[VERIFIED]** active deployment config (`client/vercel.json`, `client/src/main.jsx`) |
| Android app | Capacitor 8 wrapper around the same SPA | Same Express API | **[VERIFIED]** build config exists; **[NEEDS CONFIRMATION]** release signing missing (debug APK only) |
| Desktop app | Electron 41 shell | Bundled Express server (spawned as child process) | **[VERIFIED]** dev/source-run flow exists; **[NEEDS CONFIRMATION]** no installer/packaging exists |

**Runtime architecture summary [VERIFIED]:**
- Single Node.js/Express process (`server/server.js`) serves the REST API **and** (optionally) the built SPA from `client/dist/`.
- Database is **Supabase (PostgreSQL)** accessed via `@supabase/supabase-js` with a service-role key (bypasses RLS).
- Authentication is **JWT-based** (custom app JWT issued by the API), with Google Sign-In via **Supabase Auth OAuth**.
- There is **NO custom WebSocket server** — the `ws` package exists only as a Node polyfill for Supabase Realtime transport. Client "live" features use Supabase Realtime channels.
- Two in-process **cron jobs** (node-cron) run inside the API process.
- Emails are sent via **Brevo API** (primary) with **Gmail SMTP** fallback.

---

## 2. Verified Technology Stack

### 2.1 Runtimes & frameworks

| Component | Technology | Version (declared → installed) | Status |
|---|---|---|---|
| Server runtime | Node.js | **>= 20.x required** (per README; no `engines` field, no `.nvmrc`) | **[VERIFIED]** |
| Backend framework | Express | ^4.19.2 → 4.22.2 (CommonJS) | **[VERIFIED]** |
| Frontend framework | React + ReactDOM | ^18.2.0 → 18.3.1 (JSX SPA) | **[VERIFIED]** |
| Router | react-router-dom | ^6.22.3 → 6.30.6 | **[VERIFIED]** |
| Build tool | Vite + @vitejs/plugin-react | vite ^5.2.0 → 5.4.21 | **[VERIFIED]** |
| Styling | Tailwind CSS + PostCSS + Autoprefixer | tailwindcss ^3.4.3 → 3.4.19 | **[VERIFIED]** |
| Desktop shell | Electron | ^41.7.1 | **[OPTIONAL]** (desktop target only) |
| Mobile shell | Capacitor (core/android) | ^8.4.1 → 8.5.0 | **[OPTIONAL]** (Android target only) |
| Orchestration (dev) | concurrently, wait-on (via npx) | concurrently ^8.2.2 | **[VERIFIED]** dev-only |

### 2.2 Server dependencies — usage-verified

Every dependency below was checked for actual `require`/`import` in the runtime code path (`server.js` → routes → controllers/services/middleware/jobs/config).

| Dependency | Version | Usage status | Evidence / purpose |
|---|---|---|---|
| express | ^4.19.2 | **[VERIFIED]** | API framework |
| cors | ^2.8.5 | **[VERIFIED]** | Single-origin CORS (`server.js:85`) |
| dotenv | ^16.4.5 | **[VERIFIED]** | Loads `server/.env` (`server.js:38`) |
| @supabase/supabase-js | ^2.109.0 | **[VERIFIED]** | Sole database layer (`config/supabaseClient.js`) |
| ws | ^8.21.0 | **[VERIFIED]** (polyfill only) | Supabase Realtime transport shim — **no WS server exists** |
| jsonwebtoken | ^9.0.3 | **[VERIFIED]** | App JWT sign/verify |
| multer | ^2.2.0 | **[VERIFIED]** | Multipart uploads (memory storage) |
| axios | ^1.18.1 | **[VERIFIED]** | Brevo email API + outbound HTTP |
| nodemailer | ^9.0.1 | **[VERIFIED]** | Gmail SMTP email fallback |
| node-cron | ^4.6.0 | **[VERIFIED]** | 2 scheduled jobs |
| pdf-lib | ^1.17.1 | **[VERIFIED]** | Certificate & score-report PDFs |
| qrcode | ^1.5.4 | **[VERIFIED]** | Certificate QR generation |
| sharp | ^0.35.3 | **[VERIFIED]** | Avatar image processing (native binary) |
| file-type | ^20.5.0 | **[VERIFIED]** | Magic-byte file sniffing (dynamic `import()`) |
| bcryptjs | ^2.4.3 | **[LEGACY]** | Only in `server/scratch/` scripts — zero runtime use |
| mongoose | ^8.3.1 | **[LEGACY]** | Models orphaned; `config/db.js` is a no-op stub ("MongoDB has been removed") |
| pg | ^8.23.0 | **[LEGACY]** | Only one-off `apply-patch-v*.js` scripts; not on runtime path |
| nodemon | ^3.1.0 (dev) | **[VERIFIED]** | Dev auto-reload |
| png-to-ico | ^3.0.2 (dev) | **[OPTIONAL]** | One-off favicon script |

**Note [VERIFIED]:** an orphaned `razorpay` package is present in `server/node_modules` but is NOT declared in `package.json` and has zero code references — leftover from a removed integration. Run `npm prune` during packaging.

### 2.3 Client dependencies — usage-verified

| Dependency | Version | Usage status | Purpose |
|---|---|---|---|
| react / react-dom | ^18.2.0 | **[VERIFIED]** | UI framework |
| react-router-dom | ^6.22.3 | **[VERIFIED]** | SPA routing |
| axios | ^1.6.8 | **[VERIFIED]** | All HTTP (no `fetch` used) |
| @supabase/supabase-js | ^2.108.2 | **[VERIFIED]** | Google OAuth, Supabase Auth, Realtime, storage uploads |
| @capacitor/core | ^8.4.1 | **[VERIFIED]** | Native platform detection |
| @capacitor/android | ^8.4.1 | **[OPTIONAL]** | Native Android platform package (build-time only) |
| html2canvas | ^1.4.1 | **[VERIFIED]** | Ticket/export image capture |
| html5-qrcode | ^2.3.8 | **[VERIFIED]** | QR scanning (attendance) |
| qrcode.react | ^4.2.0 | **[VERIFIED]** | QR rendering (tickets, ID cards) |
| react-easy-crop | ^6.2.3 | **[VERIFIED]** | Avatar cropping |
| xlsx | ^0.18.5 | **[VERIFIED]** | Excel import/export — **known CVE line (0.18.x)**; plan upgrade |
| tailwindcss/postcss/autoprefixer/vite/@vitejs/plugin-react | (dev) | **[VERIFIED]** | Build tooling |
| @capacitor/cli | ^7.6.7 (dev) | **[OPTIONAL]** | Android build CLI — **version mismatch (CLI 7 vs runtime 8)** |

### 2.4 Tooling folders (excluded from production)

- `ui-designs/` — Puppeteer-based HTML→PNG design mockup tooling. **[LEGACY/INTERNAL]** Not part of the deployable app; `puppeteer` is declared but not installed.
- `server/scratch/`, `server/seed*.js`, `server/test*.js`, `server/apply-patch-v*.js` — dev/ops scripts, not referenced by any npm script. **[LEGACY]**

---

## 3. Architecture

### 3.1 Architecture diagram

```
                         ┌─────────────────────────────────────────────┐
                         │                 USERS                       │
                         │  Web browser   Android app    Desktop app   │
                         └──────┬──────────────┬────────────────┬──────┘
                                │              │                │
              HTTPS (Vercel SPA)│   HTTPS API  │   http://localhost:5001
                                ▼              ▼                │
        ┌───────────────────────────┐   ┌─────────────────────────────┐
        │  Vercel (static SPA)      │   │  Electron shell (optional)  │
        │  client/dist + SPA rewrite│   │  spawns node server.js      │
        └────────────┬──────────────┘   └──────────────┬──────────────┘
                     │  REST calls (axios, Bearer JWT) │
                     ▼                                 ▼
        ┌─────────────────────────────────────────────────────────┐
        │         Node.js / Express API  (server/server.js)       │
        │  Port: process.env.PORT || 5001  (binds 0.0.0.0)        │
        │  ┌───────────────────────────────────────────────────┐  │
        │  │ CORS: single origin = CLIENT_URL                  │  │
        │  │ Routes: /api/auth /api/events /api/registrations   │  │
        │  │ /api/users /api/tasks /api/certificates /api/...   │  │
        │  │ Static: /uploads -> server/uploads (local disk)    │  │
        │  │         / -> client/dist (SPA, if built)           │  │
        │  │ Cron: eventCompletionJob (*/5), regClosing (*/10)  │  │
        │  └───────────────────────────────────────────────────┘  │
        └──────┬───────────────────┬───────────────────┬───────────┘
               │                   │                   │
   service-role key         Brevo API / SMTP      Local disk
               ▼                   ▼                   ▼
   ┌───────────────────┐   ┌──────────────┐   ┌─────────────────┐
   │ Supabase          │   │ Email out    │   │ server/uploads/ │
   │ - PostgreSQL (RLS)│   │ (Brevo>SMTP) │   │ templates/ etc  │
   │ - Auth (Google)   │   └──────────────┘   │ [LEGACY files]  │
   │ - Storage buckets │                       └─────────────────┘
   │ - Realtime        │◄──── Supabase Realtime channels (client-side)
   └───────────────────┘
```

### 3.2 Frontend ↔ backend communication **[VERIFIED]**

| Mode | API base URL resolution | Location |
|---|---|---|
| Web production | **Hardcoded** `https://avento-7hnx.onrender.com` (env `VITE_API_URL` deliberately ignored in PROD) | `client/src/main.jsx:13-15` |
| Dev (Vite) | Relative URLs + Vite proxy `/api`, `/uploads` → `http://127.0.0.1:5001` | `client/vite.config.js:7-21` |
| Capacitor native | `import.meta.env.VITE_API_URL` (emulator `localhost` → `http://10.0.2.2:5001`) — **but see §8.2: this branch is dead code in real APK builds** | `client/src/main.jsx:16-22` |
| Electron prod | Same-origin: `http://localhost:${PORT}` served by Express | `main.js:88-91` |

Auth header: `Authorization: Bearer <JWT>` set globally from `localStorage` (`client/src/context/AuthContext.jsx`). JWT lifetime: **30 days** (`authController.js:278,633`). **[VERIFIED]**

### 3.3 API surface **[VERIFIED]**

13 route modules mounted at `/api/*` (`server.js:103-115`). Full endpoint inventory lives in `server/routes/`; group summary:

| Prefix | Domain |
|---|---|
| `/api/auth` | OTP, register, login, Google login, password reset/set, profile |
| `/api/events` | Events CRUD, publishing, proposals & workspace, organizers, scoring endpoints, attachments, official permissions |
| `/api/registrations` | Individual/team registration, invites (incl. external email invites), payment status, imports, admin ops, **drive-proxy** |
| `/api/users` | User management, profiles, avatars, bulk import/delete, contact form |
| `/api/tasks` | Task board + comments |
| `/api/certificates` | Template upload, generation, public verification |
| `/api/attendance` | QR verify + periodic attendance |
| `/api/feedbacks` | Feedback + custom questions |
| `/api/notifications`, `/api/announcements` | In-app notifications/announcements |
| `/api/allocations` | Problem statements, team/individual allocations |
| `/api/slots` | Event slots, booking, rescheduling (atomic RPCs) |
| `/api/panels` | Panel allocation & scheduling |

Public (unauthenticated) endpoints: event list/detail, organizers, confirmed team members, slots listing, certificate verify, invite preview, **drive-proxy**, contact form, and most of `/api/auth`. **[VERIFIED]**

### 3.4 WebSockets **[VERIFIED — important correction]**

There is **no application WebSocket server**. No `WebSocketServer`, upgrade handler, or WS protocol exists. The `ws` npm package is used exclusively as the Node transport polyfill for **Supabase Realtime** (`server/config/supabaseClient.js:4,29-31`) and in throwaway seed scripts. Client live updates (slots, registrations, panels, workspace) use **Supabase Realtime channels** directly in the browser. Hosting implication: no WS port or sticky-session requirement for the Express process, but **Supabase Realtime must remain enabled** on the Supabase project.

### 3.5 Production vs development architecture **[VERIFIED]**

| | Development | Production |
|---|---|---|
| Frontend | Vite dev server `:3000`, proxy to API | Static `client/dist` on Vercel (or served by Express at `/`) |
| Backend | `nodemon server.js` on `:5001` | `node server.js` on `PORT` (Render-style platform port) |
| API base | Relative + proxy | Hardcoded Render URL in bundle |
| DB | Supabase dev project | Supabase production project |
| Launcher | `npm run dev` (concurrently) | Platform process manager / container |

---

## 4. Repository Structure

```
avento/
├── main.js                     # Electron desktop shell (spawns server)
├── package.json                # Root: orchestrator scripts + electron/concurrently
├── .env                        # [dev] duplicate VITE_ vars only
├── AVENTO_PRODUCTION_DEPLOYMENT_GUIDE.md   # this document
├── client/                     # React SPA (Vite)
│   ├── src/
│   │   ├── main.jsx            # entry; API base URL logic
│   │   ├── App.jsx             # routes/layout
│   │   ├── components/         # 37 components
│   │   ├── pages/              # 29 pages
│   │   ├── context/            # Auth, Theme, Sidebar contexts
│   │   └── utils/
│   ├── public/, dist/          # static assets / build output
│   ├── android/                # Capacitor Android project (Gradle)
│   ├── vite.config.js, tailwind.config.js, postcss.config.js
│   ├── capacitor.config.json, vercel.json, .env
├── server/                     # Express API (CommonJS)
│   ├── server.js               # entry: middleware, routes, static, cron, startup probes
│   ├── config/supabaseClient.js# Supabase client (service-role) + ws polyfill
│   ├── config/db.js            # [LEGACY] no-op MongoDB stub
│   ├── routes/ (13 files), controllers/ (14 files), services/, middleware/, jobs/, models/ [LEGACY]
│   ├── uploads/                # [LEGACY] local-disk files, publicly served at /uploads
│   ├── schema.sql, supabase-full-schema.sql, supabase-patch*.sql  # 77 SQL migration files
│   ├── seed*.js, test*.js, apply-patch*.js, scratch/   # [LEGACY] dev/ops scripts
│   └── .env                    # ALL backend secrets live here
├── ui-designs/                 # [EXCLUDE FROM PROD] Puppeteer design mockups
└── Documents/, .github/, .vscode/
```

---

## 5. Environment Variable Checklist (names only — never commit values)

`.gitignore` covers `.env` and `.env.*` at all levels **[VERIFIED]** — no `.env` files are tracked in git. Nevertheless, `server/.env` currently contains live credentials and must be handled as a secret during handover.

### 5.1 Backend (`server/.env` or hosting-platform env) — loaded by `server/server.js:38`

| Variable | Required | Purpose | Fallback if missing | Status |
|---|---|---|---|---|
| `SUPABASE_URL` | **REQUIRED** | Supabase project REST URL | Falls back to `VITE_SUPABASE_URL` → `REACT_APP_SUPABASE_URL`; startup CRITICAL log | **[VERIFIED]** |
| `SUPABASE_SERVICE_ROLE_KEY` | **REQUIRED** | Service-role key (bypasses RLS) for all server writes | **Silently falls back to anon key → RLS breaks writes** (logged CRITICAL) | **[VERIFIED]** |
| `JWT_SECRET` | **REQUIRED** | Signs/verifies 30-day app JWTs | **Hardcoded weak fallback in source — CRITICAL RISK (see §7)** | **[VERIFIED]** |
| `CLIENT_URL` | **REQUIRED** | CORS origin + base URL inside emails & certificate QR links | `http://localhost:3000` (would break prod CORS and emailed links) | **[VERIFIED]** |
| `PORT` | Optional | Express listen port | `5001` (platforms like Render inject it) | **[VERIFIED]** |
| `BREVO_API_KEY` | Optional* | Brevo transactional email API | Falls back to SMTP; else emails mock-logged | **[VERIFIED]** |
| `BREVO_SENDER_EMAIL` | Optional | From-address for Brevo | hardcoded default in code | **[VERIFIED]** |
| `BREVO_SENDER_NAME` | Optional | From-display-name | `Avento` default | **[VERIFIED]** |
| `EMAIL_USER` | Optional* | Gmail address for SMTP fallback | Disables SMTP fallback if absent | **[VERIFIED]** |
| `EMAIL_PASS` | Optional* | Gmail app password | Disables SMTP fallback if absent | **[VERIFIED]** |
| `EMAIL_NOTIFICATIONS_ENABLED` | Optional | Email kill-switch (`'false'` disables) | Enabled by default | **[VERIFIED]** |
| `EMAIL_LOGO_URL` | Optional | Logo in email headers | Supabase storage URL derived from `SUPABASE_URL` | **[VERIFIED]** |
| `ADMIN_EMAIL` | Optional | Support-contact recipient | `BREVO_SENDER_EMAIL` → hardcoded default | **[VERIFIED]** |
| `NODE_ENV` | Recommended | Set `production` on host | Not read by app code directly | **[VERIFIED]** (unused by first-party code) |
| `MONGO_URI` | **NOT NEEDED** | [LEGACY] only migration scripts | — | **[LEGACY]** |
| `DATABASE_URL` / `SUPABASE_DB_URL` | **NOT NEEDED** | Only `apply-patch-v*.js` scripts | — | **[LEGACY]** |
| `REACT_APP_SUPABASE_URL` / `REACT_APP_SUPABASE_ANON_KEY` | **NOT NEEDED** | Lowest-priority legacy fallbacks | — | **[LEGACY]** |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | **NOT USED** | **Zero code references** — dead placeholders in .env | — | **[LEGACY]** |

\* At least one email channel (Brevo key OR SMTP pair) is required if transactional email is a production requirement. **[NEEDS CONFIRMATION]** whether email is mandatory for the university deployment.

### 5.2 Frontend build-time (`client/.env` or CI build env) — baked into the bundle by Vite

| Variable | Required | Purpose | Status |
|---|---|---|---|
| `VITE_SUPABASE_URL` | **REQUIRED** | Supabase URL for browser client | **[VERIFIED]** |
| `VITE_SUPABASE_ANON_KEY` | **REQUIRED** | Public anon key (safe by design; RLS is the security boundary) | **[VERIFIED]** |
| `VITE_API_URL` | Optional | Intended for Capacitor builds — **currently ignored in PROD builds** (see §8.2) | **[NEEDS CONFIRMATION]** |
| `VITE_APP_URL` | Optional | Password-reset link base | **[VERIFIED]** (defaults to `window.location.origin`) |

> **Security rule [VERIFIED]:** all `VITE_*` values are inlined into the public browser bundle. **Never** place `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `BREVO_API_KEY`, `EMAIL_PASS`, or payment secrets in `client/.env` or under any `VITE_` name.

### 5.3 Security-sensitive behaviors to be aware of **[VERIFIED]**

1. If `SUPABASE_SERVICE_ROLE_KEY` is missing, the server silently downgrades to the anon key and logs a warning (`config/supabaseClient.js:9-22`).
2. If `JWT_SECRET` is missing, tokens are signed/verified with a literal hardcoded in source (`authController.js:277,632`, `authMiddleware.js:43`) — **anyone can forge admin tokens**.
3. Startup logs print the Supabase URL and the first 12 characters of the service-role key (`server.js:44,49-50`) — avoid shipping console output to shared log aggregation.

---

## 6. Database & Migration Requirements

### 6.1 Database verdict

| Database | Status | Evidence |
|---|---|---|
| **Supabase (PostgreSQL)** | **PRIMARY — sole runtime database [VERIFIED]** | `config/supabaseClient.js`; ~549 `supabase.*` call sites across controllers/jobs/middleware; startup connectivity probe in `server.js` |
| MongoDB (Atlas) | **[LEGACY] — fully removed from runtime** | `config/db.js` is a documented no-op; mongoose models in `server/models/` are imported by nothing; `MONGO_URI` read only by one-time migration scripts (`scripts/migrate-mongodb-to-supabase.js`); `supabase-patch-v39-mongodb-migration.sql` documents the Mongo → Supabase move |

### 6.2 Supabase feature usage **[VERIFIED]**

- **Auth:** Supabase Auth used for Google OAuth and password recovery links; the app's own JWT wraps Supabase identities.
- **Storage buckets:** `documents` (avatars `avatars/…`, proposal docs, problem-statement PDFs, official-permission files, confirmation attachments), `posters` (event/announcement images), `certificates` (templates + generated PDFs), `payment-qr`, `email-assets`, and `profile-photos` (created by SQL v40 but **unused by code**). Most buckets are public via `getPublicUrl`.
- **Realtime:** client subscribes to channels for live slot/registration/panel updates; publication config in `supabase-patch-v5-realtime.sql`, `v48-realtime-slot-sync.sql`.
- **RPC functions called at runtime:** `release_event_slot_atomic`, `allocate_event_slot_atomic`, `reschedule_event_slot_atomic`, `allocate_problem_statement_atomic`, `confirm_team_registration`, `decrement_registered_count_by`, `increment_registered_count`, `exec_sql` (see risk §7), plus trigger-invoked `accept_team_invitation`, `leave_team`, `enforce_panel_assignment_exclusivity`, `update_updated_at_column`.
- **Tables:** 34 business tables referenced in code (events, profiles, event_registrations, event_teams, event_members, event_organizers, event_slots, team_allocations, certificates, scoring_*, panel_*, team_email_invites, otps, announcements, notifications, feedbacks, tasks, proposal_*, problem_statement_documents, payment_verification_history, event_attendance_periods, event_periodic_attendance, organizer_requests, student_score_comments, …).

### 6.3 Migration inventory **[VERIFIED]**

77 `.sql` files in `server/`:

- **Base schemas (3):** `supabase-full-schema.sql` (fresh install, 17 tables + 44 RLS policies), `schema.sql` (earlier), `demo-auth.sql` (demo users — **do not run in production**).
- **Unversioned feature patches (11):** attendance, certificates, feedback, registration-method, tag-google-users (data fix), RLS fixes, FK fixes (+ `exec_sql`), service-role grant, payment, scoring.
- **Versioned patches v2–v54 (63):** covering organizers, tasks, team registration, notifications, proposals, registration deadlines, team leave/invite logic (repeatedly rewritten), storage buckets, allocations & problem statements, certificates, MongoDB→Supabase tables, external registration + periodic attendance, official permissions, event slots + atomic RPCs, panel allocation/scheduling, student scoring.
- **171 `CREATE POLICY`** statements across 30 files; 56 `ENABLE ROW LEVEL SECURITY`.
- **11 SQL functions**, **4 triggers** (`update_*_updated_at` ×3, `trg_panel_assignment_exclusivity`).

### 6.4 Fresh-database provisioning **[NEEDS CONFIRMATION — HIGH PRIORITY]**

> There is **no migration runner and no schema-version table**. `supabase-full-schema.sql` does **not** cover v32–v54 features (slots, panels, scoring tables, external invites, periodic attendance, announcements/otps, etc.). A fresh Supabase project requires applying `supabase-full-schema.sql` followed by ~35 patches **in exact filename order**. Several patches rewrite the same RPCs (e.g. `accept_team_invitation` in v12/v17/v18/v24), so out-of-order application silently regresses logic. **Recommended:** provision the production database as a clone/restore of the verified dev database state (or generate a consolidated schema dump from it) rather than replaying patch files. This decision must be made before handover.

### 6.5 Production data dependencies **[VERIFIED]**

- Core functionality does **not** depend on seed data.
- **Warning:** `seedDemoAuth.js` / `demo-auth.sql` create accounts with weak hardcoded passwords (e.g. an admin account with a trivial password). **Never run these against production.**
- `supabase-patch-tag-google-users.sql` contains a real personal email (data fix) — GDPR/hygiene item.
- Runtime self-healing writes buckets/tables from app code (`allocationController.js` creates the `documents` bucket if missing; boot-time slot-count reconciliation in `server.js:152-175`).

---

## 7. Production Risk Register

| # | Risk | Severity | Evidence | Status | Required action before go-live |
|---|---|---|---|---|---|
| R1 | Payment-status authorization broken — a second `updatePaymentStatus` definition shadows the admin-checked one; **any authenticated user can set any registration's `payment_status` (incl. `verified`)**, no audit trail | **CRITICAL** | `registrationController.js:1051` vs `:2454`; `registrationRoutes.js:15` | **[VERIFIED]** | Remove shadowed handler; enforce admin/organizer + whitelist `verified\|rejected` + history + notify |
| R2 | **Unauthenticated SSRF open proxy** `GET /api/registrations/drive-proxy?url=` — fetches and streams any URL server-side | **CRITICAL** | `registrationRoutes.js:48`; `registrationController.js:2955-2964` | **[VERIFIED]** | Add auth + role, host allowlist (Google Drive domains), https-only, block private IPs, size cap |
| R3 | JWT signing falls back to a **hardcoded secret committed in source**; 30-day token lifetime; tokens stored in localStorage | **HIGH** | `authController.js:277,632`; `authMiddleware.js:43` | **[VERIFIED]** | Set strong unique `JWT_SECRET`; make startup fail if unset; rotate; shorten expiry |
| R4 | **Hardcoded admin email backdoor** — one email auto-granted admin role at login (overrides DB role) | **HIGH** | `authController.js:10,231,543,591`; `authMiddleware.js:133,188` | **[VERIFIED]** | Remove all overrides; manage roles in DB only |
| R5 | **No rate limiting, no helmet, no security headers** — OTP send/verify, login, contact form unthrottled (OTP brute force, email bombing) | **HIGH** | `server.js:85-89`; no security middleware in deps | **[VERIFIED]** | Add helmet + express-rate-limit; OTP attempt counter + resend cooldown |
| R6 | OTPs stored plaintext, generated with `Math.random` (non-CSPRNG), no attempt limit | **HIGH** | `authController.js:425-431,70,849` | **[VERIFIED]** | `crypto.randomInt`, hash at rest, max attempts, constant-time compare |
| R7 | Upload validation gaps — `import-photos` (200 files, no size/type limit), certificate template (no size limit); ext-only filters elsewhere | **HIGH** | `registrationRoutes.js:4-5,49`; `certificateRoutes.js:33-40` | **[VERIFIED]** | Enforce multer `limits.fileSize` + magic-byte checks everywhere |
| R8 | `exec_sql` SECURITY DEFINER arbitrary-SQL RPC reachable via PostgREST and used at runtime with string interpolation (SQLi pattern) | **HIGH** | `supabase-fix-fks.sql`; `userController.js:857-859` | **[VERIFIED]** | Drop/revoke `exec_sql` from anon/authenticated in production |
| R9 | Fresh-install schema gap — no consolidated schema for v32–v54; no migration runner | **HIGH** | §6.4 | **[VERIFIED]** | Clone verified DB state or consolidate patches |
| R10 | In-memory state breaks multi-instance & loses data — email daily counter (300/day, silently drops), profile cache, cron runs on every instance (duplicate expiry emails) | **MEDIUM** | `notificationService.js:5-14,99-101`; `authMiddleware.js:6-27`; `jobs/*.js` | **[VERIFIED]** | Single-instance requirement **[NEEDS CONFIRMATION]** or move state to Redis/DB |
| R11 | Local-disk dependency — `server/uploads/` served publicly at `/uploads` (legacy files present); `fs.mkdirSync` at boot; ephemeral hosts lose writes | **MEDIUM** | `server.js:119`; `certificateRoutes.js:24-27` | **[VERIFIED]** | Purge legacy dir; restrict/remove `/uploads`; keep persistence in Supabase |
| R12 | Public storage buckets — avatars/payment QR/proposal docs world-readable; `documents` auto-created public | **MEDIUM** | `eventController.js:2643-2649` etc. | **[VERIFIED]** | Private buckets + signed URLs for sensitive content |
| R13 | Password-reset open redirect — `redirectTo` taken from request body | **MEDIUM** | `authController.js:314-343` | **[VERIFIED]** | Server-side redirect allowlist |
| R14 | SMTP TLS bypass retry (`rejectUnauthorized: false`) on Gmail fallback | **MEDIUM** | `notificationService.js:72-84` | **[VERIFIED]** | Prefer Brevo-only in prod; remove relaxed TLS |
| R15 | Static, unsigned attendance/pass QR codes (registration UUID) — replayable indefinitely | **MEDIUM** | `EventPassTicket.jsx:170-171`; `attendanceController.js:92-155` | **[VERIFIED]** | Signed, expiring, per-period tokens |
| R16 | CORS/HTTPS posture — single-origin CORS good, but env defaults to localhost; no HSTS/HTTPS redirect; `trust proxy` not set | **MEDIUM** | `server.js:85-88,149` | **[VERIFIED]** | Set real `CLIENT_URL`; TLS terminator + HSTS |
| R17 | Photo-import flows crash — `setEventAvatar` is an undefined function; drive-proxy client call mismatched (`?id=` vs `?url=`) | **LOW** | `registrationController.js:3015,3068`; `IDCardManager.jsx:731` | **[VERIFIED]** | Implement or remove |
| R18 | Email silently dropped at 300/day cap and on dual-channel failure (log claims "queued") | **LOW** | `notificationService.js:99-101,131-147` | **[VERIFIED]** | Real retry queue + alerting |
| R19 | Known-vulnerable `xlsx@0.18.x` (prototype pollution / ReDoS CVEs) | **LOW/MEDIUM** | `client/package.json` | **[VERIFIED]** | Upgrade or replace (e.g. exceljs) |
| R20 | `NODE_ENV=development` and localhost URLs in committed `server/.env` | **LOW** | `server/.env` | **[VERIFIED]** | Set production values on host env |

---

## 8. Additional Platforms (Android & Desktop)

### 8.1 Deployment matrix **[VERIFIED]**

| | Web | Android (Capacitor) | Desktop (Electron) |
|---|---|---|---|
| Build command | `npm run build --prefix client` | `npm run build:android` then `npm run apk:generate` (in `client/`) | `npm run desktop-prod` (root) |
| Output | `client/dist/` | `client/android/app/build/outputs/apk/debug/*.apk` (**debug only**) | No artifact — runs from source |
| Build-time env | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | same (see §8.2 caveat) | Vite build for `client/dist` |
| Backend URL | **Hardcoded Render URL** in `main.jsx:15` | same hardcoded URL | Local Express `http://localhost:5001` |
| Backend env needed | `CLIENT_URL` = Vercel origin | **+ CORS must also allow `https://localhost`** (Capacitor WebView origin) | Local `server/.env` |
| One backend serves all? | Yes | Yes | Local copy of same server |

### 8.2 Android-specific findings **[VERIFIED]**

- Gradle 8.11.1 / AGP 8.7.2, compileSdk/targetSdk 35, minSdk 23, Java 21. **[VERIFIED]**
- `AndroidManifest.xml` declares **only `INTERNET`** — **no `CAMERA` permission**, so QR scanning (`html5-qrcode`) will fail on-device until `CAMERA` is added. **[VERIFIED gap]**
- **No release signing config** (no keystore, no `signingConfig`) — `apk:generate` produces a debug APK only; Play Store distribution needs a keystore. **[NEEDS CONFIRMATION]**
- Capacitor CLI 7.x vs Android platform 8.x version mismatch. **[VERIFIED]**
- `server.cleartext: true` allows plain-HTTP dev traffic; not needed if the API is HTTPS. **[VERIFIED]**
- **Backend URL branch-order bug:** in packaged APKs `import.meta.env.PROD` is always true, so the hardcoded Render URL wins and the `VITE_API_URL`/emulator branch is dead code — the APK cannot be pointed at a different backend without a code change. **[VERIFIED]**
- CORS: WebView origin is `https://localhost`; the API's single-origin CORS (`CLIENT_URL`) will block APK requests unless extended (origin callback recommended). **[VERIFIED]**

### 8.3 Electron-specific findings **[VERIFIED]**

- Spawns `node server/server.js` as a child process; production mode loads the Express-served `client/dist` (same-origin, no CORS issue).
- **No packaging/installer config exists** (no electron-builder/forge/packager). Distribution today = clone + `npm install` + `npm run desktop-prod`, and the target machine **must have Node.js installed** (the server runs as a system `node` child process). **[NEEDS CONFIRMATION]** whether a packaged desktop build is required at all.
- `contextIsolation: true`, `nodeIntegration: false` — good defaults. **[VERIFIED]**

---

## 9. Deployment Requirements

### 9.1 Frontend (web)

```bash
cd client
npm ci
# set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY in client/.env (or CI env)
npm run build        # output: client/dist/
```
- Deploy `client/dist/` to any static host (currently Vercel with SPA rewrite `/(.*) -> /index.html` — see `client/vercel.json`).
- **[NEEDS CONFIRMATION]** The production API URL is **hardcoded** at `client/src/main.jsx:15`. Moving the backend requires editing this constant and rebuilding web + Android bundles.

### 9.2 Backend

```bash
cd server
npm ci --omit=dev     # prunes nodemon/png-to-ico; consider `npm prune` to drop orphaned razorpay
node server.js        # start; or `npm start`
```
- **Build step:** none (plain Node.js).
- **Port:** `process.env.PORT || 5001`; binds all interfaces (fine behind a platform proxy; set `trust proxy` if you rely on `req.ip`).
- **Health check:** `GET /` returns HTTP 200 (SPA HTML if `client/dist` exists, else a JSON `{status:'Running'}` welcome message). **There is no dedicated `/health` endpoint** — use `GET /` or `GET /api/events` as the readiness probe. **[VERIFIED]**
- **Required backing services:** Supabase project (Postgres + Auth + Storage + Realtime), outbound HTTPS to `api.brevo.com` (email), SMTP/465 or 587 to Gmail (fallback only), outbound HTTPS to Google OAuth.
- **Cron:** two in-process jobs — event auto-completion every 5 min; registration closing/team disqualification every 10 min. Requires a **single long-lived instance** (see R10). **[VERIFIED]**
- **WebSockets:** none required for the Express process (Supabase Realtime is client→Supabase). **[VERIFIED]**
- **Local disk:** only `server/uploads/templates/` is created at boot; treat the filesystem as **ephemeral** and keep all persistence in Supabase (R11).

### 9.3 CORS / domains / OAuth configuration **[VERIFIED]**

| Item | Value to configure |
|---|---|
| `CLIENT_URL` | Exact frontend origin (e.g. `https://<app>.vercel.app` or university domain) — drives CORS **and** email/certificate links |
| Android support | Add `https://localhost` (Capacitor WebView origin) to allowed origins, or implement an origin callback |
| Google Cloud Console | Authorized JavaScript origin: frontend URL(s); Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` |
| Supabase Auth redirect allowlist | `<frontend>/auth/callback`, `<frontend>/change-password` (and any `redirectTo` targets sent by the client) |
| Certificate QR links | Derived from `CLIENT_URL` (`certificateController.js:271`) — wrong value breaks verification QR URLs |
| Email CTA links | Derived from `CLIENT_URL` (`notificationService.js:226,232`) |

---

## 10. Third-Party Integration Requirements

| Integration | Status | Details | Hosting requirement |
|---|---|---|---|
| **Supabase** (Postgres + Auth + Storage + Realtime) | **[VERIFIED] REQUIRED** | Service-role key server-side; anon key client-side; Google OAuth provider configured | Managed Supabase project; RLS validated; Realtime enabled |
| **Brevo** (email API) | **[VERIFIED]** primary email channel | `api.brevo.com` POST; sender identity must be verified in Brevo | Outbound HTTPS; quota awareness (app caps 300/day in-process) |
| **Gmail SMTP** (nodemailer) | **[OPTIONAL]** fallback | Hardcoded `service:'gmail'` + app password; TLS-relaxed retry (R14) | Outbound SMTP; app password |
| **Google OAuth** | **[VERIFIED]** login path | Supabase OAuth intermediary; no direct Google API keys in repo | Redirect URIs per §9.3 |
| **Payment** | **[NEEDS CONFIRMATION]** | **No gateway integrated.** Flow is manual: static UPI/QR image (`payment-qr` bucket) + UTR submission + admin verification. `RAZORPAY_*` vars are dead placeholders (R1-R19) | None — but payment authorization bug (R1) must be fixed first |
| **QR generation** | **[VERIFIED]** internal | `qrcode` (server, certificates), `qrcode.react` (client, tickets/ID cards) | None |
| **QR scanning** | **[VERIFIED]** internal | `html5-qrcode` camera scanning → `/api/attendance/verify` | Camera permission on Android (§8.2) |
| **File storage** | **[VERIFIED]** Supabase Storage | Buckets: `documents`, `posters`, `certificates`, `payment-qr`, `email-assets` (all public-read); sharp for avatars | Supabase Storage quotas |
| **Google Drive** | **[VERIFIED]** via proxy | `drive-proxy` + photo/Drive-link import flows (currently buggy — R2, R17) | Outbound HTTPS (and must be locked down) |
| **Other external APIs** | None found | No SMS/maps/analytics/push | — |

---

## 11. Production Security Checklist

- [ ] `JWT_SECRET` set to a strong unique value; **startup fails if unset** (code change R3 recommended, or at minimum verify the env var is present)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (verify startup log shows "loaded", not the CRITICAL fallback warning)
- [ ] Remove/neutralize hardcoded admin email backdoor (R4) — **[NEEDS CONFIRMATION]** with project owners
- [ ] Fix `updatePaymentStatus` shadowing (R1) before any paid event goes live
- [ ] Lock down or disable `drive-proxy` (R2)
- [ ] Drop/revoke `exec_sql` RPC in the production Supabase project (R8)
- [ ] Validate final RLS policy set against the deployed schema (171 cumulative policies; patch-order dependent)
- [ ] Add rate limiting + helmet (R5); OTP attempt limits (R6)
- [ ] Enforce upload size/type limits (R7)
- [ ] Review bucket public/private posture for sensitive documents (R12)
- [ ] `CLIENT_URL` = real frontend origin; TLS + HSTS at the platform edge (R16)
- [ ] Confirm `.env` files are NOT included in any deployment artifact or VCS (gitignore verified; double-check bundles)
- [ ] Ensure demo/seed scripts (`seedDemoAuth.js`, `demo-auth.sql`) are never executed against production
- [ ] Consider shortening JWT lifetime / moving tokens out of localStorage (R3/R14)
- [ ] Rotate all credentials currently sitting in `server/.env` at handover time (they have been in a live dev file)

---

## 12. Hosting Handover Checklist

**Infrastructure accounts to transfer / recreate:**

- [ ] Supabase project (URL, service-role key, anon key) — or provision a new production project (see schema provisioning risk R9)
- [ ] Brevo account (API key, verified sender domain/address)
- [ ] Google Cloud OAuth client (client ID/secret configured inside Supabase Auth)
- [ ] Hosting platform accounts: Vercel (frontend), Render (backend) — **[NEEDS CONFIRMATION]** whether university hosting replaces these
- [ ] Domain/DNS records (if a university domain will be used)
- [ ] Gmail app-password account (if SMTP fallback is kept)

**Configuration to transfer (names only, values via secure channel):**

- [ ] All backend env vars per §5.1 (REQUIRED: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `CLIENT_URL`)
- [ ] All frontend build vars per §5.2
- [ ] Google OAuth redirect URIs and Supabase redirect allowlist per §9.3
- [ ] Supabase storage buckets + policies state

**Operational knowledge:**

- [ ] Single-instance requirement for cron jobs + in-memory caches (R10) — confirm hosting plan provides exactly one API instance, or accept duplicated cron side effects
- [ ] Email quota behavior: 300/day in-process cap, silent drop after (R18)
- [ ] Known broken features: photo/drive import (R17), payment verification authorization (R1)
- [ ] Seed/test scripts are dev-only; do not run against production
- [ ] Backups: rely on Supabase PITR/backup plan; `server/uploads` is legacy and not critical
- [ ] Log handling: startup logs contain partial secrets (§5.3) — restrict log access

**Excluded from production scope:** `ui-designs/`, `server/scratch/`, `Documents/`, all `seed*.js`/`test*.js`/`apply-patch*.js`, `server/models/` (legacy), `MONGO_URI`.

---

## 13. Post-Deployment Testing Checklist

**Smoke tests:**

- [ ] `GET /api/events` returns 200 (public) from the deployed API
- [ ] `GET /` returns the SPA (or API welcome JSON) — health probe works
- [ ] Frontend loads, login page renders, no mixed-content/CORS errors in browser console
- [ ] Email OTP registration flow: OTP arrives (Brevo or SMTP), registration succeeds
- [ ] Google login flow end-to-end (redirect back to `/auth/callback`, JWT issued)
- [ ] Event CRUD by organizer/admin; publish flow
- [ ] Team registration + external email invite + acceptance
- [ ] Payment flow (if enabled): UTR submission, admin verification — verify only admins/organizers can set status (regression test for R1)
- [ ] Certificate generation + public verification page (`/verify/<id>` and QR link uses the production domain, not localhost)
- [ ] Attendance QR scan flow (web cam); Android scan only after CAMERA permission fix
- [ ] Slot booking/reschedule (atomic RPCs) and Realtime updates
- [ ] Scoring + score report PDF email (attachment arrives)
- [ ] Cron behavior: event auto-completion within ~5 min of event end; registration deadline closing within ~10 min
- [ ] File uploads: avatar, event poster, proposal document, certificate template (check Supabase buckets)
- [ ] Email links in transactional mail point to the production frontend (CLIENT_URL)
- [ ] Negative tests: `drive-proxy` blocked/unauthenticated (after R2 fix); forged JWT rejected; rate limits effective (after R5)

**Platform-specific:**

- [ ] Vercel SPA deep links (client-side routes) refresh correctly (rewrite rule)
- [ ] Android APK: API reachable (CORS allows WebView origin), QR scanning works (CAMERA), debug/release signing as intended
- [ ] Electron: `npm run desktop-prod` boots server + window; quit terminates the server child process

---

## 14. Summary of Open Decisions for the Hosting Team

| # | Decision | Impact |
|---|---|---|
| 1 | Fresh Supabase provisioning strategy (clone current DB vs replay 77 SQL files) | **Blocks deployment** (R9) |
| 2 | Fix R1 (payment authorization) and R2 (drive-proxy SSRF) before go-live | **Blocks go-live** for any payment/Drive features |
| 3 | Keep Vercel+Render or move to university hosting (requires un-hardcoding `main.jsx:15` + rebuild) | Affects domains, CORS, OAuth redirects |
| 4 | Email channel: Brevo only, or keep SMTP fallback | Affects env vars + reliability |
| 5 | Payment: keep manual UPI/QR flow, or implement a real gateway (Razorpay placeholders are dead code) | Feature scope |
| 6 | Android release signing + CAMERA permission fix | Determines if an Android release is deliverable |
| 7 | Desktop: is a packaged installer required? (none exists today) | Determines Electron work |
| 8 | Single API instance acceptable? (cron + in-memory state) | Hosting plan sizing |

---

*End of document. Generated from a read-only audit of the repository; no code, configuration, environment, or schema files were modified.*
