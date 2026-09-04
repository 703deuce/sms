# Appointments — Page-by-Page Frontend Certification

Serialized certification on production. **One browser, one page at a time.** No production build during browser QA.

| # | Page | Status | Commit | Notes |
|---|------|--------|--------|-------|
| 1 | Overview | PASS | — | production frontend cert |
| 2 | Calendar | PASS | — | production frontend cert |
| 3 | Scheduled | PASS | — | production frontend cert |
| 4 | Appointment Detail | PASS | — | production frontend cert |
| 5 | Appointment Types | PASS | — | production frontend cert |
| 6 | Availability | PASS | — | production frontend cert |
| 7 | Reminder Settings | PASS | — | test SMS sent to 5714776175 |
| 8 | Booking Settings | PASS | — | production frontend cert |
| 9 | Public Booking | PASS | — | production frontend cert |
| 10 | Get Started | PASS | — | production frontend cert |
| 11 | Analytics | PASS | — | production frontend cert |
| 12 | Conversations Integration | PASS | — | production frontend cert |
| 13 | Contacts Integration | PASS | — | production frontend cert |

## Rules
- One Chromium instance per page cert run; close browser after each page
- No browser QA during production builds
- No parallel browsers / builds / full test suites
- After each page PASS: save → commit → update this file → next page
- Resume from first row not marked PASS if VM restarts

## Commands
```bash
UI_AGENT_BASE_URL=$PRODUCTION_URL npx tsx scripts/appointments-frontend-certify-serial.ts next
UI_AGENT_BASE_URL=$PRODUCTION_URL npx tsx scripts/appointments-frontend-certify-serial.ts overview
APPOINTMENTS_TEST_PHONE=5714776175 npx tsx scripts/appointments-frontend-certify-serial.ts reminders
```

## Final certification (optional)
After all 13 individually pass: one production build + lightweight route smoke (single browser).
