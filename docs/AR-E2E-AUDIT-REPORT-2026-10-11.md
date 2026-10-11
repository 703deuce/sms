# Appointment Reminders — End-to-End Audit Report

**Date:** 2026-10-11  
**Branch:** `cursor/ar-full-functional-completion-f350`  
**Scope:** UI click → API → persistence → background jobs → UI refresh (code audit + automated wiring; live OAuth/Telnyx/Graph requires staging/production).

---

## How this audit was done

1. **UI → API wiring** — `scripts/test-ar-ui-api-wiring.ts` scans all AR UI for `/api/appointment-reminders/*` and asserts a matching `route.ts` exists (31 references, 42 routes). Run via `npm run test:appointment-reminders`.
2. **Path tracing** — Each major surface below lists the user action, frontend module, API route, and backend module.
3. **Bug fixes** — Issues found during tracing were fixed in the same branch (see § Bugs fixed).
4. **Not in cloud VM** — Microsoft OAuth, Telnyx SMS send, Stripe checkout, and Luna phone extraction require your staging/production environment and real credentials; those paths were verified by code inspection and existing unit/API tests, not live PSTN.

---

## Feature flows (end-to-end)

### Signup & product open

| User action | UI | API / redirect | Backend |
|-------------|-----|----------------|---------|
| AR signup | `/signup/appointment-reminders` → `/signup?product=appointment_reminders` | `POST /api/auth/signup` | `assignArFreePlan`, workspace + voice entitlement |
| Google signup (AR) | Google button with `next` → product-open | `GET /api/auth/google/callback` | **Fixed:** AR path → `assignArFreePlan`, no MCTB bootstrap |
| Return user / plan | Login → product-open URL | `GET /api/appointment-reminders/product-open` | `assignArFreePlan` or Stripe checkout |

### Setup wizard

| Step | UI | API | Backend |
|------|-----|-----|---------|
| Connect calendar | `setup-pages.tsx` + `calendar-integrations-opus` | `POST/PATCH /api/integrations/calendars`, OAuth | `patchWorkspaceCalendarConnection`, sync enqueue |
| Configure | `ar-setup-configure-panel.tsx` | `PATCH settings`, `POST presets`, `POST setup/configure-complete` | platform config, `setupConfigureCompletedAt` |
| Activate | `setup-pages.tsx` | `GET/POST setup/status`, `existing-sms-consent` | `activation.ts` gates |

### Calendars & import

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| Save import calendars & rules | `calendar-integrations-opus.tsx` | `PATCH /api/integrations/calendars/[id]` | `importRules`, `importRulesByCalendarId`, graph keys, **save error handling fixed** |
| Verify Microsoft | Connection row Verify | `POST .../verify` | Contacts probe + delegated mailbox probe |
| Sync now | Sync button | `POST .../sync` | `syncWorkspaceCalendarConnection` |
| Import runtime | (automatic) | webhooks + jobs | `import-sync.ts`, eligibility, phone merge, suppression |

### Appointments

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| List / filter | `appointments-page.tsx` | `GET /api/appointment-reminders/appointments` | `loadAppointmentRemindersPage` |
| Detail drawer | `appointment-detail-drawer.tsx` | `GET/PATCH appointment`, timeline, contact, suppress | Prisma + reminder state |
| Manual create | Appointments page modal | `POST appointments` | `createManualArAppointment` |
| Sync all | Sync button | `POST /api/appointment-reminders/sync` | calendar sync scheduler |

### Reminders log & export

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| View log | `reminders-page.tsx` | `GET /api/appointment-reminders/reminders` | operational page loader |
| Export CSV | **Added** Export button | `GET export/reminders` | CSV from operational rows |
| Test / preview SMS | `reminder-settings-opus.tsx`, configure panel | `GET/POST reminders/test` | merge vars, test send gates |

### Overview & pause

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| Dashboard | `overview-page.tsx` | `GET overview` | readiness, KPIs |
| Pause / resume | Overview buttons | `PATCH operational-pause` | `ar-operational-pause.ts`, **res.ok check fixed** |

### Settings & templates

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| Sequence editor | `reminder-settings-opus.tsx` | `PATCH settings`, presets, apply-template | platform config |
| Template library | `ar-template-library-browser.tsx` | `GET templates/library` | template library |

### Responses & held inbound

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| Response feeds | `ar-responses-opus.tsx` | `GET responses` | feed loaders |
| Export responses | **Added** Export button | `GET export/responses` | CSV |
| Held resolve | Held / responses UI | `POST held-inbound/[id]/resolve` | routing resolution |

### AI rescheduler

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| Settings | `ar-ai-rescheduler-opus.tsx` | `GET/PATCH ai-rescheduler` | rescheduler config |
| Approve / reject | Drawer + operations page | `POST approve/reject/reconcile` | M365 write-back path |

### Analytics & billing

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| Analytics | `analytics-page.tsx` | `GET analytics` | metrics service |
| Billing | `ar-billing-settings-opus.tsx` | `billing`, portal, change-plan | Stripe integration |

### Calendar view (staff)

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| Month/week view | `ar-calendar-opus.tsx` | `GET calendar/events` | event aggregation |
| Native actions | Event sheet | `calendar/native-actions` | provider actions |

### Booking (AR-hosted)

| User action | UI | API | Backend |
|-------------|-----|-----|---------|
| Booking settings | `booking-page-opus.tsx` | `GET/PATCH booking` | booking config |

---

## Bugs found and fixed (this audit)

| Area | Bug | Fix |
|------|-----|-----|
| Configure preview | Appointment dropdown used wrong row fields (`inviteeName` / `serviceName`) | Use `customerName` / `appointmentTitle` from `ArAppointmentRow` |
| Configure preview | Invalid step `advance_reminder` (404) | Use `reminder24h` (canonical step id) |
| Export | APIs existed but **no UI** to download CSV | Export buttons on Reminders log + Responses |
| Calendar save | PATCH failures ignored; user saw false success | Check `res.ok`, surface error in `syncNotice` |
| Per-calendar rules | Clearing overrides left stale `importRulesByCalendarId` in DB | Always send `importRulesByCalendarId` on save; empty → clear in patch |
| Overview pause | Failed PATCH still refreshed as success | Check `res.ok` before reload |
| Google AR signup | New Google users got MCTB bootstrap instead of AR Free | `isArPath` in google callback + `assignArFreePlan` |

---

## Automated checks (run after changes)

```bash
npm run test:appointment-reminders
```

Includes: UI↔API wiring, eligibility, import rules, suppression, API isolation, matrix integrity cert.

---

## What still requires your environment (not VM-automatable)

- Cold signup → Microsoft OAuth → first calendar import → first SMS on Telnyx  
- Stripe paid plan checkout  
- Luna phone extraction on real calendar body text  
- AI rescheduler approve → Microsoft Graph event move  

Use: `docs/AR-LAUNCH-READINESS-NOW.md`

---

## Summary

All AR UI routes referenced in product code map to implemented API handlers. Eight concrete UI/backend bugs that broke save feedback, preview, export, Google AR signup, or calendar persistence were fixed on this branch. Full “every click on production with real providers” certification remains a staging/production pass using the runbook above.
