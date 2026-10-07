# Appointment Reminders E2E — A–Q certification matrix

**Branch:** `cursor/appointment-reminders-e2e-complete-f350` · **PR:** #614 (draft)  
**Updated:** 2026-10-07 (pass 3 — billing, reminders log scale, tests)  
**Evidence:** `npm run test:appointment-reminders` (unit + matrix script). DB-backed matrix rows require `DATABASE_URL`.

| ID | Requirement | Status | Evidence / blocker |
|----|-------------|--------|-------------------|
| **A** | Product entitlement + AR-scoped API auth | **Full** | `entitlement.ts`, `api-auth.ts`, all `/api/appointment-reminders/*`; `api-auth.test.ts` |
| **B** | Launch-certified live stack (Google/Microsoft/SMS/scheduler) | **Externally blocked** | Google: `GOOGLE_CALENDAR_CLIENT_ID` / `SECRET`; live PSTN/SMS; prod `appointments_platform_reminder_scan` worker; carrier-approved sender |
| **C** | Effective reminder phone (override at send) | **Full** | `effective-phone.ts`, `reminder-delivery.ts` `inviteePhone()`; matrix script |
| **D** | Consent / opt-out / eligibility before send | **Full** | `sms-eligibility.ts`; recheck in `trySendStep` SMS path; `sms-eligibility.test.ts` |
| **E** | Delivery pipeline (scan, confirmation on import, sanitize) | **Full** (code) | `reminder-delivery.ts`, `import-sync.ts`, `message-sanitize.test.ts`; live send **Externally blocked** |
| **F** | Activation + grandfather ready workspaces | **Full** (code) | `activation.ts`, `workspaceRemindersOperational()`; live activation UX not browser-certified in VM |
| **G** | Platform-sender template policy (PATCH + runtime) | **Full** | `platform-template-policy.ts` PATCH + `resolvePlatformLockedReminderTemplate` at send; `platform-template-policy.test.ts` |
| **H** | Setup connect / activate | **Full** (code) | `setup-pages.tsx`, `/api/appointment-reminders/setup/status`; browser not run in VM |
| **I** | Overview readiness | **Full** (code) | `load-ar-overview.ts`; browser not run in VM |
| **J** | Appointments list scale / filters | **Partial** | DB pagination when no heavy filters (`load-appointments-page.ts`); in-memory when q/reminder/calendar filters |
| **K** | Reminders log at scale | **Full** (code) | `reminders-log-query.ts` JSONB timeline pagination + future appointment pages; no silent 1500 cap |
| **L** | Reminder settings on AR APIs | **Full** | `reminder-settings-opus.tsx` → AR settings/test/workspace routes |
| **M** | AR monthly SMS metering / enforcement | **Full** (code) | `ar-sms-usage.ts`, `ar-commercial-entitlements.ts`; limits from platform trial/plan config (no Stripe `appointment_reminders` SKU in catalog yet — **business config**: populate `AR_PAID_SMS_LIMIT_BY_TIER` when SKU ships) |
| **N** | Security / reliability audit | **Partial** | AR auth + sync/test rate limits; workspace-scoped `getAppointment`; webhook/OAuth unchanged (shared integrations). Full adversarial suite not run |
| **O** | Automated test matrix | **Partial** | `npm run test:appointment-reminders` PASS; calendar import/integration/concurrency/browser regressions not fully automated |
| **P** | Wiring audit doc | **Full** | `APPOINTMENT-REMINDERS-E2E-WIRING-AUDIT.md` + this matrix |
| **Q** | Preserve Voice/MCTB/shared Appointments runtime | **Full** (code review) | No changes to MCTB TeXML pipeline; appointment SMS uses existing `sendAppointmentSms`; no dedicated MCTB regression run in VM |

## Billing configuration note (M)

- **Freemium allowance:** `platform_settings.trial.messages` via `getTrialLimits()` (default 100 in `platform-settings.ts`).
- **Paid legacy plans:** `workspace.billingPlan` → `platform_settings.plans[].messages`.
- **Override:** `workspace_limits.limits.arAppointmentRemindersMonthlySmsLimit`.
- **Future Stripe SKU:** `product_family = appointment_reminders` + `AR_PAID_SMS_LIMIT_BY_TIER` (empty until catalog defines tiers).

## Commands

```bash
npm run test:appointment-reminders
# With database:
DATABASE_URL=... npm run test:appointment-reminders
```
