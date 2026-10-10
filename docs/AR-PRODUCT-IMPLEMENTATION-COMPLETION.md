# Appointment Reminders — product implementation pass (2026-10-10)

Coordinated pass for **Priority 1–3** features plus **two-way calendar write-back integration** (preserved existing `external-sync.ts`). **Google Calendar, iCal feeds, and iCloud** remain deferred per product direction — legacy code and Microsoft-only connect policy unchanged.

## Preserved (not rewritten)

- Microsoft delta/import sync, reconcile, webhooks
- `ar_reminder_dispatches` + BullMQ dispatch executor
- Telnyx SMS pipeline and AI rescheduler
- `syncExternalCalendarOnReschedule` / `syncExternalCalendarOnCancel`
- Public email confirm/cancel/reschedule routes (`/api/public/appointments/...`)

## Completed / wired in this pass

| Area | Change |
|------|--------|
| Per-step **SMS / email / voice** channel | Settings UI (`reminder-settings-opus.tsx`) + existing delivery engine |
| **Email** subjects, branded HTML, ICS, action links | `reminder-email-html.ts`, `sendReminderEmailWithTracking`, delivery path |
| **Industry / tone / timing / policy presets** | `reminder-presets.ts` + `POST /api/appointment-reminders/settings/presets` |
| **Confirmation-aware skips** | `reminder-confirmation-guard.ts` in discovery + dispatch |
| **Analytics** | `GET /api/appointment-reminders/analytics` + `/appointment-reminders/analytics` |
| **No-show calculator** | Customer-facing estimate on analytics page; `PATCH` appointment attendance |
| **Manual appointments** | `POST /api/appointment-reminders/appointments` + UI sheet |
| **CSV import** | `POST /api/appointment-reminders/appointments/import` + preview/import UI |
| **Email test sends** | `sendTestReminderEmail` + test API accepts `email` |
| **Default preferences** | `reminderPreferences` on platform config |

## Still partial / blocked

| Item | Reason |
|------|--------|
| Google / iCal / iCloud as AR sources | Explicitly out of scope this pass |
| Per appointment-type reminder rules UI | Service metadata exists; rule UI not added |
| Full multilingual template packs | Locale selection stored; no auto-translate |
| Recipient-level channel preferences | Workspace default only (`defaultNotificationChannel`) |
| Production email deliverability audit | Uses existing Brevo path; no new DNS work |
| Write-back prod certification | Code preserved; no new prod Graph assert in this pass |

## 51-item mapping (summary)

- **Have / preserved:** M365 sync, dispatch ledger, inbound SMS stack, write-back functions, public confirm links
- **Completed wiring:** channels, email experience, presets, analytics, CSV, manual entry, confirmation skip, branding
- **Partial (unchanged depth):** voice reminders, appointment-type rules, advanced per-recipient prefs
- **Missing / deferred:** Google/iCal/iCloud customer launch, no-show ML, full Calendly-style booking

## Verification run (agent)

```bash
node --import tsx src/lib/appointment-reminders/reminder-confirmation-guard.test.ts
```

Run full repo gates before deploy: `npm run test:v1-production-readiness` (or targeted AR tests) and production build.
