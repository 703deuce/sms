# Appointment Reminders E2E Pass — Status (2026-10-07)

## Status

This is **not** 100% code-complete or launch-certified yet. A substantial **first E2E wiring pass** is on branch `cursor/appointment-reminders-e2e-complete-f350` (commit `433720c7`), draft PR **#614** → `master`. Baseline remains **`5ce061c0`** (premium New UI 2). PR #613 / restraint pass untouched.

---

### What shipped in this pass

| Area | Change |
|------|--------|
| **A — Auth** | `requireAppointmentRemindersAccess()` on all `/api/appointment-reminders/*`; AR permission model with appointments-permission fallback (`permissions.ts`, `entitlement.ts`, `api-auth.ts`) |
| **C — Phone** | `resolveEffectiveReminderPhone()` used in **delivery scan** (override honored at send time) |
| **D — Consent** | Shared `evaluateSmsReminderEligibility()` in aggregate views, reminders log, and `scanPlatformAppointmentReminders` |
| **E — Confirmation** | `maybeSendImmediateConfirmationForAppointment()` after **new** imports when `event.start` is in the future (no historical backfill) |
| **I — Overview** | `readiness.operationalStatus` (import calendars + sync + SMS sender); pill uses it |
| **J — Appointments** | AR detail routes; drawer uses them; **`?open=`** deep link |
| **Scale** | Caps raised to **5000** / **1500** (still in-memory — **not** true DB pagination) |
| **P — Audit** | `docs/APPOINTMENT-REMINDERS-E2E-WIRING-AUDIT.md` + **Update — 2026-10-07** delta table |

**Test evidence:** `npx tsx src/lib/appointment-reminders/sms-eligibility.test.ts` — **PASS**

---

### Still open (from A–Q brief)

- **B** — Google OAuth remains env-dependent; no live Google/Microsoft exercise here
- **F** — No live SMS / scheduler certification in this environment
- **G** — Platform-sender template lock (API + runtime), not UI-only
- **H** — Setup Connect/Activate still static (no persisted activation)
- **L** — Reminder Settings still on `/api/appointments/*` + appointments permissions
- **M** — AR billing / SMS allowance wiring not traced
- **N** — Broader security/rate-limit audit
- **O** — Full automated matrix (OAuth, pagination at scale, regression on Voice/MCTB)
- **Scale** — Proper DB filtering/pagination for appointments & reminders log

---

### Finish lines

| Bar | State |
|-----|--------|
| **Code complete** | **In progress** — core auth, eligibility, confirmation-on-import, drawer, and overview readiness are wired; settings, billing, activation, template enforcement, and DB-scale lists remain |
| **Launch certified** | **Not met** — needs prod scheduler, real calendars, approved sender, and real authorized SMS |

---

### Git

- **Branch:** `cursor/appointment-reminders-e2e-complete-f350`
- **PR:** https://github.com/703deuce/sms/pull/614 (draft; **do not merge** without your approval)
- **Full audit + delta:** `docs/APPOINTMENT-REMINDERS-E2E-WIRING-AUDIT.md`

---

### Next slice (optional continuation)

Continue on the same branch with: AR settings/test APIs + platform template enforcement + activation state + billing + DB pagination + expanded tests — until the audit shows every prior **Partial** / **Not hooked** item as **Full** or an explicit external blocker.
