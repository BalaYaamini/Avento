# Avento — Changes Log

## Overview

This document covers all changes made during the development session, including bug fixes, new features, and configuration updates.

---

## 1. Email Notifications (SMTP Setup)

### What Changed
- Replaced nodemailer/Gmail SMTP with Resend API, then reverted back to nodemailer/Gmail SMTP
- Added `verifySMTPConnection()` to verify SMTP on server startup
- Added `sendBulkEmails()` for batch email sending with rate limiting
- Added MongoDB fallback for email resolution in `notifyUser()`
- Added debug logging for email delivery troubleshooting

### Files Modified
- `server/services/notificationService.js` — SMTP verification, bulk send, debug logging
- `server/.env` — SMTP configuration (`EMAIL_USER`, `EMAIL_PASS`, `EMAIL_NOTIFICATIONS_ENABLED`)
- `server/.env.example` — Updated template
- `server/server.js` — SMTP verification on startup

### Email Behavior
| Trigger | In-App | Email |
|---------|--------|-------|
| Event published | ✅ | ❌ Disabled |
| Individual registration | ✅ | ✅ |
| Team registration | ✅ | ✅ |
| Team approval | ✅ | ✅ |
| Event approval/rejection | ✅ | ✅ |

### Daily Limits
- Gmail SMTP: 2,000 emails/day per account
- SMTP Relay: 10,000 recipients/day (needs IT setup)

---

## 2. Team Registration — Admin Approval Flow

### What Changed
- After team leader confirms, status changes to `pending_approval` (was `registered`)
- Admin/faculty must approve teams before they are fully registered
- Auto-approval when team meets `min_team_size` requirement
- Added approve/reject endpoints with notifications

### New Flow
```
Leader creates team → status: 'pending'
Members accept/reject invitations
Leader confirms team →
  ├─ If acceptedCount >= min_team_size → auto-approved → status: 'registered'
  └─ If acceptedCount < min_team_size → status: 'pending_approval' → admin approves
```

### New Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/registrations/team/:teamId/admin-approve` | POST | Admin approves team |
| `/api/registrations/team/:teamId/admin-reject` | POST | Admin rejects team (with optional reason) |

### Files Modified
- `server/controllers/registrationController.js` — `confirmTeamRegistration` logic, new `adminApproveTeam`, `adminRejectTeam` functions
- `server/routes/registrationRoutes.js` — New routes
- `client/src/components/OrganizerRegistrations.jsx` — Approve/Reject buttons, status badges

### Status Badges
| Status | Badge |
|--------|-------|
| `registered` | Green "Confirmed" |
| `pending_approval` | Blue "Pending Approval" |
| `rejected` | Red "Rejected" |
| `pending` | Amber "In Progress" |

---

## 3. MongoDB Fallback for Profile Data

### What Changed
- All registration endpoints now fall back to MongoDB when Supabase `profiles` table is empty
- Team member names/emails resolved from MongoDB `User` collection

### Problem Solved
- Team members showing as "Unknown" / "No members found" in student and admin views
- Caused by empty `profiles` table (users exist in MongoDB, not Supabase Auth)

### Files Modified
- `server/controllers/registrationController.js` — MongoDB fallback in:
  - `getMyRegistrations` (student view)
  - `getEventRegistrations` (admin/organizer view)
  - `getAllRegistrations` (global admin view)

---

## 4. Event Creation — Email Disabled

### What Changed
- Removed email notification when event is published to all students
- In-app notification only (no email blast on event creation)

### Why
- Prevents spamming all students on every event publish
- Students can check events in the app instead

### File Modified
- `server/controllers/eventController.js` — `publishEvent` function uses `sendInAppNotification` instead of `notifyUser`

---

## 5. Supabase Setup Files

### Files Created
| File | Description |
|------|-------------|
| `server/supabase-complete-setup.sql` | Full setup with all 17 tables (includes scoring) |
| `server/supabase-setup-no-scoring.sql` | Full setup without scoring tables (15 tables) |
| `server/supabase-patch-drop-auth-fks.sql` | Drops all `REFERENCES auth.users(id)` FKs |

### Tables (without scoring)
1. `profiles` — User profiles (links to Supabase Auth)
2. `events` — Event details
3. `event_members` — Event volunteers/staff
4. `event_teams` — Team registrations
5. `event_registrations` — Individual/team registrations
6. `event_organizers` — Event organizer assignments
7. `organizer_requests` — Student organizer requests
8. `tasks` — Event tasks
9. `task_comments` — Task comments
10. `notifications` — In-app notifications
11. `proposal_discussions` — Event proposal discussions
12. `proposal_documents` — Proposal attachments
13. `proposal_timeline` — Proposal activity log
14. `feedbacks` — Event feedback
15. `certificates` — Generated certificates

### Scoring Tables (excluded)
- `scoring_configs` — Scoring configuration per event
- `event_scores` — Team/individual scores per round

---

## 6. Bug Fixes

### Profile Resolution
- Fixed `getFacultyCoordinators` to query MongoDB instead of empty profiles
- Fixed `getStudents` and `searchUsers` to query MongoDB with profiles fallback
- Fixed `notifyUser` to resolve email from MongoDB first, then Supabase profiles

### Event Creation
- Removed `created_by` field from event creation
- Added `admin`/`faculty` roles to `POST /api/events` route
- Events created by admin/faculty get `status: 'published'` directly
- Added `published_at` and `published_by` to admin status update path

### Team Registration
- Fixed `event_members` inserts to include `name` and `email` fields (NOT NULL constraint)
- Fixed `addProposalTeamMember` to resolve name/email from MongoDB before insert
- Fixed `getProposalTeam` MongoDB fallback for user roles

### Database
- Fixed `profiles` table creation order (before other tables)
- Fixed `event_teams` creation before `event_registrations` (FK dependency)
- Added `handle_new_user()` trigger for auto-profile creation on Supabase Auth signup

---

## 7. Live Scoring Feature

### What Was Added
Complete scoring/leaderboard system for events with round-wise score tracking.

### Backend

#### New Endpoints
| Endpoint | Method | Access | Description |
|----------|--------|--------|-------------|
| `/api/scoring/config/:eventId` | GET | All | Get scoring config for event |
| `/api/scoring/config/:eventId` | POST | Admin/Faculty | Create/update scoring config |
| `/api/scoring/leaderboard/:eventId` | GET | All | Get leaderboard with weighted totals |
| `/api/scoring/scores/:eventId` | POST | Admin/Faculty | Submit score for a team/individual |
| `/api/scoring/scores/:eventId/:scoreId` | PUT | Admin/Faculty | Edit existing score |
| `/api/scoring/scores/:eventId/:scoreId` | DELETE | Admin/Faculty | Delete a score |

#### Database Tables
| Table | Purpose |
|-------|---------|
| `scoring_configs` | Scoring configuration per event (levels, weights, max scores) |
| `event_scores` | Individual scores per team/individual per round |

#### Scoring Config Structure
```json
{
  "num_levels": 3,
  "levels": [
    {"level": 1, "name": "Round 1", "max_score": 100, "weight": 1},
    {"level": 2, "name": "Round 2", "max_score": 100, "weight": 2},
    {"level": 3, "name": "Final", "max_score": 100, "weight": 3}
  ]
}
```

#### Leaderboard Calculation
- Weighted score = Σ (score × weight) / Σ (max_score × weight) × 100
- Students see only aggregate/weighted total
- Admin/faculty see round-wise breakdowns

### Frontend

#### New Pages
| File | Purpose |
|------|---------|
| `client/src/pages/ScoringDashboard.jsx` | Event list for scoring access |
| `client/src/pages/ScoringBoard.jsx` | Score submission and leaderboard view |

#### Access Control
| Role | Can Submit/Edit Scores | Can View Leaderboard |
|------|------------------------|----------------------|
| Admin | ✅ | ✅ (with breakdowns) |
| Faculty | ✅ | ✅ (with breakdowns) |
| Student | ❌ | ✅ (totals only) |

#### Features
- Round-wise score entry for teams/individuals
- Real-time leaderboard with weighted totals
- Export leaderboard functionality
- Styled with polaroid cards, floating orbs, pastel palette (matches events page)

### Files Modified
- `server/controllers/scoringController.js` — Scoring CRUD + leaderboard logic
- `server/routes/scoringRoutes.js` — API routes
- `server/server.js` — Registered scoring routes
- `client/src/pages/ScoringBoard.jsx` — Scoring UI
- `client/src/pages/ScoringDashboard.jsx` — Event selector for scoring
- `client/src/App.jsx` — Routes for scoring pages
- `client/src/components/Navbar.jsx` — Nav links for scoring

### Notes
- Scoring works for both team and individual events
- Team scores use `team_id`, individual scores use `user_id`
- Scores are linked to events via `event_id`
- MongoDB fallback applied for user name resolution in scoring

---

## 8. Environment Variables

### `.env` Configuration
```env
# Server
PORT=5001
MONGO_URI=mongodb://...
JWT_SECRET=avento_super_secret_key_12345
NODE_ENV=development

# SMTP Email
EMAIL_USER=admin.avento@gmail.com
EMAIL_PASS=your-16-char-app-password

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Frontend
CLIENT_URL=http://localhost:3000

# Email toggle
EMAIL_NOTIFICATIONS_ENABLED=true
```

---

## 9. Dependencies Added/Removed

| Package | Action | Purpose |
|---------|--------|---------|
| `@getbrevo/brevo` | Added then removed | Brevo email API (not used) |
| `nodemailer` | Kept | Gmail SMTP email sending |

---

## 10. Key Architecture Notes

### Dual Database
- **MongoDB** — User auth, profiles, roles (primary user store)
- **Supabase** — Events, registrations, notifications, certificates

### Why MongoDB Fallback Exists
- User IDs in MongoDB don't match Supabase Auth UUIDs
- `profiles` table is mostly empty
- All backend code queries MongoDB first, Supabase profiles as fallback

### Role System
5 roles: `admin`, `student`, `faculty`, `student_organizer`, `faculty_organizer`

Admin email hardcoded as `admin.avento@gmail.com` in `AuthContext.jsx:16`
