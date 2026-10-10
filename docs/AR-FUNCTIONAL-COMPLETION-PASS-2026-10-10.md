# Appointment Reminders — functional completion pass (2026-10-10)

Scope: fix operational gaps from `docs/AR-LAUNCH-GAP-INVENTORY-2026-10-10.md`. **No** pricing, Stripe, entitlements, or signup routing.

---

## 1. Already implemented (no code changes required)

| Area | Finding |
|------|---------|
| **Initial calendar sync (server)** | `patchWorkspaceCalendarConnection` already calls `enqueueCalendarConnectionSync` when import calendars are newly enabled (`connection-settings.ts`). |
| **Contact override** | `/api/appointment-reminders/appointments/:id/reminder-contact` + appointment drawer; appointments table already flags missing/invalid phone. |
| **Response visibility** | Overview customer responses strip, Appointments customer-response pills, Responses page + `loadRecentArCustomerResponses` — wired. |
| **Reminder discovery/dispatch** | Unchanged; no dispatcher redesign. |
| **Grandfather activation** | `workspaceRemindersOperational()` still allows sends when no activation row but `canActivate` (intentional). |

---

## 2. Genuinely incomplete (fixed in this pass)

| Priority | Gap | Fix |
|----------|-----|-----|
| 1 | SMS readiness used Stripe/Square merchant status | New `evaluateArSmsOutboundReadiness()` — platform Telnyx route via `resolveAppointmentOutboundSmsRoute`; commercial allowance reported separately, not an activation blocker. |
| 2 | Brevo false negatives | Added `APPOINTMENTS_FROM_EMAIL` to shared sender resolution; clearer readiness copy when API key exists without from-address. |
| 3 | Auto sync UX | AR calendar UI defaulted `syncEnabled` to off; save now enables sync when imports are selected; copy + status notice after save. |
| 4 | Missing contact | Email-step eligibility surfaced in aggregate reminder view; appointments table hints to open drawer. |
| 5 | Workflow conflicts | `platform-reminder-workflow.ts` + surfaced on appointments aggregate, needs-attention, and future reminders log rows. |
| 6 | Activation accuracy | Blockers only when SMS **steps** enabled; warnings for unconfigured commercial allowance; setup UI shows platform sender detail. |
| 7 | Status labels | Timeline mapping shows **Suppressed** instead of generic “Recorded”. |
| 8 | Responses | No new pages; needs-attention includes workflow + existing response kinds. |

---

## 3. Files changed (summary)

- `src/lib/appointment-reminders/ar-sms-readiness.ts` (new)
- `src/lib/appointment-reminders/activation.ts`
- `src/lib/appointment-reminders/platform-reminder-workflow.ts` (new)
- `src/lib/appointment-reminders/aggregate-reminder-status.server.ts`
- `src/lib/appointment-reminders/load-appointments-page.ts`
- `src/lib/appointment-reminders/load-ar-needs-attention.ts`
- `src/lib/appointment-reminders/load-ar-overview.ts`
- `src/lib/appointment-reminders/reminders-log-query.ts`
- `src/lib/appointment-reminders/sms-reminder-timeline.ts`
- `src/lib/appointment-reminders/ar-email-readiness.ts`
- `src/lib/email/brevo.ts`
- `src/newui-transplant/connected/integrations/calendar-integrations-opus.tsx`
- `src/newui-transplant/connected/appointment-reminders/setup-pages.tsx`
- `src/newui-transplant/connected/appointment-reminders/appointments-page.tsx`

---

## 4. Remaining for commercial pass (not this work)

- Standalone AR plans, Stripe checkout, `AR_PAID_SMS_LIMIT_BY_TIER`, entitlements, signup routing.
- Enforcing monthly SMS/email/AI allowances at send time (metering code stays; connect to plans later).
- Production certification / live SMS+email runbooks (owner-driven).

---

## 5. Readiness API shape (for UI)

`evaluateAppointmentRemindersSetupReadiness` now includes:

- `smsRemindersEnabled`, `smsSenderDetail`
- `smsCommercialAllowanceConfigured`, `smsCommercialAllowanceDetail`
- `warnings[]` (e.g. allowance not configured — does not block activation)
