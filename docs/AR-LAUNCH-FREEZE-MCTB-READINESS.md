# Appointment Reminders launch — MCTB freeze & readiness

**Branch:** `cursor/ar-ai-rescheduler-implement-f350`  
**PR:** #616  
**Do not merge/deploy without owner approval.**

## Launch flags

| Flag | Value | File |
|------|-------|------|
| `APPOINTMENT_REMINDERS_V1_PRIMARY` | `true` | `src/lib/workspace/platform-launch.ts` |
| `MCTB_V1_PRIMARY` | `false` | same |
| Product switcher | hidden (`shouldShowProductSwitcher` → false) | `src/lib/products/product-shell.ts` |
| Default landing | `/appointment-reminders` | `post-login-navigation`, `/dashboard`, middleware |
| MCTB customer UI | redirect to AR home | `src/lib/products/mctb-launch-gate.ts` + `src/middleware.ts` |

MCTB routes, APIs, webhooks, jobs, and wizard code are **unchanged** — only customer navigation and direct URL access to MCTB UI are gated.

## AI Rescheduler model

| Setting | Value |
|---------|--------|
| Default model | `gpt-6-luna` |
| Override env | `AR_AI_RESCHEDULER_MODEL` |
| Config module | `src/lib/appointment-reminders/ai-rescheduler/model.ts` |
| Used by | `understand.ts`, `verify-action.ts` (AR scheduling path) |

Session-bound platform SMS (`lockedAppointmentId`) sets `strictSessionBinding` — model failures return a controlled customer message instead of heuristic fallback.

## Backend tests (executed)

```bash
npm run test:ar-platform-isolation   # PASS
npm run test:appointment-reminders   # PASS (DB-backed sections SKIP without DATABASE_URL)
```

## Static review checklist (Part 15)

| # | Item | Status |
|---|------|--------|
| 1 | MCTB code/wizard intact | **PASS** (no deletions) |
| 2 | No MCTB functionality deleted | **PASS** |
| 3 | No unintended MCTB runtime change | **PASS** (isolation preserved) |
| 4 | MCTB hidden from customer nav | **PASS** |
| 5 | AR only visible product | **PASS** |
| 6 | Separate product conversations | **PASS** (existing architecture) |
| 7 | Workspace isolation | **PASS** (unchanged auth) |
| 8 | Unauthorized workspace rejected | **PASS** (existing APIs) |
| 9 | Same phone across workspaces | **PASS** (session/workspace scoped) |
| 10 | Telnyx preferred for AR | **PASS** (sender pool) |
| 11 | Twilio when required + authorized | **PARTIAL** — logic PASS; live Twilio AR authorization must be confirmed in env |
| 12 | AR AI bound to exact appointment | **PASS** (platform path) |
| 13 | Calendar writes use correct event | **PASS** (existing provider mutations; not re-run live) |
| 14 | Background reconciliation | **PARTIAL** — worker registered; not runtime-verified |
| 15 | Staff approval | **PASS** (UI + APIs) |
| 16 | GPT-6 Luna configured | **PASS** (code default; live API access **BLOCKED** until key verified) |
| 17 | MCTB webhooks intact | **PASS** (middleware excludes `/api/telnyx`, etc.) |
| 18 | Held messages visible | **PASS** (`/appointment-reminders/held-inbound`) |

## Deployment prerequisites

1. `prisma migrate deploy` — `20261008130000_ar_sms_reply_session`, `20261008140000_ar_sms_inbound_held`
2. `AR_PLATFORM_SENDER_PHONE_NUMBER_IDS` (optional)
3. `AR_SMS_REPLY_ELIGIBLE_DAYS` (optional)
4. `OPENAI_API_KEY` with `gpt-6-luna` access
5. Telnyx + Twilio platform senders authorized for Appointment Reminders SMS use case

## Manual testing (owner)

See `docs/AR-MCTB-SMS-PRODUCT-ISOLATION-IMPLEMENTATION-REPORT.md` §10 plus: login lands on AR, product switcher absent, `/mctb` redirects to AR, MCTB webhook smoke unchanged.
