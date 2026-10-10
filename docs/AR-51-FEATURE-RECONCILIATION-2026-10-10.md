# Appointment Reminders — 51-feature reconciliation (2026-10-10)

Baseline: October 9 inventory + October 10 product implementation pass + checklist gap pass (this branch).

| # | Feature | Status |
|---|---------|--------|
| 1 | Microsoft calendar sync | **Preserved** — import/delta/reconcile |
| 2 | SMS reminders | **Preserved + wired** — dispatch executor, Telnyx |
| 3 | Email reminders | **Completed Oct 10** — branded HTML, Brevo path |
| 4 | Multiple reminders | **Completed this pass** — additional steps UI + timeline includes all enabled steps |
| 5 | Per-step channel | **Completed Oct 10** |
| 6 | Custom timing | **Completed** — sequence editor + minutes/units + advanced skip rules in step sheet |
| 7 | SMS templates | **Template library pass** (separate) |
| 8 | Email templates | **Template library pass** (separate) |
| 9 | Personalization | **Template library + merge vars** (separate); custom fields in scheduling panel |
| 10 | Calendar → Transovo updates | **Preserved** |
| 11 | Phone/email mapping | **Completed this pass** — drawer contact PATCH, missing-phone states, email eligibility |
| 12 | Timezones & quiet hours | **Completed this pass** — skip weekends/off-hours/closed on steps; workspace weekly hours engine preserved |
| 13 | SMS consent/opt-out | **Preserved** — `sms-eligibility.ts`; UI surfaces in drawer |
| 14 | Email sender readiness | **Completed this pass** — `ar-email-readiness.ts`, activation blockers |
| 15 | Delivery tracking | **Completed this pass** — dispatch ledger in appointment drawer + timeline API |
| 16 | Three-step onboarding | **Completed this pass** — connect → configure → activate |
| 17 | Two-way SMS | **Preserved** |
| 18 | Email action links | **Completed Oct 10** |
| 19 | Confirmation status | **Completed this pass** — timeline API exposes status/source; drawer engagement |
| 20 | Cancel by SMS/email | **Preserved** |
| 21 | Reschedule links | **Preserved** |
| 22 | Confirm/reschedule dashboard | **Preserved** — overview, appointments, AI rescheduler approval |
| 23 | Branded HTML email | **Completed Oct 10** |
| 24 | ICS attachments | **Completed Oct 10** |
| 25 | Industry presets | **Template library pass** |
| 26 | Timing presets | **Completed Oct 10** |
| 27 | Lead-time rules | **Completed this pass** — `minimumLeadTimeMinutes` + discovery guard |
| 28 | Message previews | **Template library pass** |
| 29 | Preparation instructions | **Completed Oct 10** (settings) |
| 30 | Contact/directions merge | **Template library pass** |
| 31 | Basic analytics | **Completed Oct 10** |
| 32 | Duplicate prevention | **Preserved** |
| 33 | Per-appointment history | **Completed this pass** — dispatches + engagement + future schedule |
| 34 | Manual entry | **Completed Oct 10** |
| 35 | CSV import | **Completed Oct 10** |
| 36 | Google Calendar (customer) | **Deferred** |
| 37 | Custom reminder fields | **Completed this pass** — `customMergeFields` + merge at send |
| 38 | Tone presets | **Template library / Oct 10** |
| 39 | Cancellation policy templates | **Oct 10** |
| 40 | Confirmation-aware behavior | **Completed Oct 10** |
| 41 | Multilingual templates | **Partial** — locale tag stored; no auto-translate (by design) |
| 42 | Advanced analytics | **Completed Oct 10** |
| 43 | No-show tracking | **Completed Oct 10** |
| 44 | No-show calculator | **Completed Oct 10** |
| 45 | Booking confirmation email | **Completed this pass** — new imports only; skip stale historical import option |
| 46 | Calendar send-time controls | **Completed this pass** — per-step skip flags exposed |
| 47 | Rules by appointment type | **Completed this pass** — `serviceReminderRules` |
| 48 | iCal feed | **Deferred** |
| 49 | iCloud | **Deferred** |
| 50 | Recipient notification prefs | **Completed this pass** — default + per-appointment override |
| 51 | Two-way write-back | **Preserved** (prod cert still manual) |

## Genuine remaining blockers

- **Production certification:** live SMS dispatch webhook, email deliverability DNS audit, Graph write-back smoke (documented elsewhere).
- **Multilingual:** locale tags only — translated template packs are content work, not engine work.
- **Voice reminder depth:** channel exists; not expanded in this pass.

## Verification

```bash
npm run test:ar-reminder-template-library
node --import tsx src/lib/appointment-reminders/reminder-scheduling-policy.test.ts
node --import tsx src/lib/appointment-reminders/reminder-confirmation-guard.test.ts
```
