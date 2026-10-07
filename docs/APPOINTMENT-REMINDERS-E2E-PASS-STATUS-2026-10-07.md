# Appointment Reminders E2E — status (pass 3)

**Branch:** `cursor/appointment-reminders-e2e-complete-f350` · **PR:** #614 (draft, do not merge without approval)

## Code-complete bar

| Area | State |
|------|--------|
| **A–Q (implementation)** | **Mostly complete in code** — see `docs/APPOINTMENT-REMINDERS-E2E-A-Q-CERTIFICATION.md` for per-letter status |
| **Launch certified** | **Not done** — external Google OAuth, live calendars, prod scheduler, authorized SMS |

## Pass 3 deliverables

1. **M — Billing:** Platform-sender workspaces meter SMS via `reserveArReminderSmsUnit` / `releaseArReminderSmsReservation`; allowance from configured platform trial/plan (not invented prices). Stripe `appointment_reminders` family not in catalog — document in certification matrix.
2. **K — Reminders log:** DB-backed timeline pagination (`reminders-log-query.ts`); global summary not capped to latest N appointments.
3. **N (continued):** Consent recheck + runtime template lock on send path.
4. **O:** `npm run test:appointment-reminders` — eligibility, sanitize, auth roles, timeline, usage constants, template policy, matrix script.

## Tests (this VM)

```bash
npm run test:appointment-reminders
```

All **PASS**. DB section skipped without `DATABASE_URL`.

## Still externally blocked

- Google OAuth env vars
- Live Microsoft/Google calendar certification
- Production `appointments_platform_reminder_scan` + real SMS delivery proof
- Stripe AR SKU tier limits when product family is added to `platform-billing-catalog-definitions.ts`

## Still partial (not external)

- **J:** Appointments directory DB pagination when search/reminder/calendar filters active
- **O:** Full calendar-import integration tests, browser customer journey, MCTB/Voice CI regression in this run
- **N:** Full adversarial security audit
