# Appointment Reminders — launch gap inventory

**Date:** 2026-10-10  
**Purpose:** Honest picture of what a **new customer** needs to get **automated reminders working**, what is already built, and what still blocks a “flip the switch today” launch—not the full 51-item matrix, but **signup → reminders fire → settings stick**.

---

## What a new user must do today (intended path)

| Step | Where | What has to be true |
|------|--------|---------------------|
| 1. Get access | Signup / workspace | `workspaceHasAppointmentReminders()` is **very permissive** (MCTB/voice/sms entitlement, or typical `BUSINESS` workspace, or plan name hints). There is **no dedicated AR-only SKU** in billing yet. |
| 2. Connect calendar | `/appointment-reminders/setup/connect` or Settings → Integrations | Microsoft (and Google only if `AR_MICROSOFT_ONLY_CALENDAR` is off). At least one **import calendar** saved. |
| 3. Initial sync | Calendars / appointments UI | `lastSyncAt` must be set—activation blocks **“Run an initial calendar sync”** until then. This is **not** fully automatic after OAuth; someone has to run sync. |
| 4. Configure sequence | Setup step 2 or `/appointment-reminders/settings` | At least one enabled step; defaults exist. Patches go through `saveAppointmentPlatformConfig` (verified by `npm run verify:ar-settings-runtime`). |
| 5. Activate (recommended) | `/appointment-reminders/setup/activate` | Sets `solutionSetup` `appointment-reminders-product` `activatedAt`. |
| 6. Runtime sends | Scheduler | `appointments_platform_reminder_scan` → discovery → `ar_dispatch_reminder` → SMS/email. |

**Grandfather behavior:** If there is **no** activation row but readiness passes, `workspaceRemindersOperational()` still allows sends. So a savvy user could get reminders **without** clicking Activate—but blockers (no sync, no calendars, email enabled without Brevo, etc.) still stop real traffic.

**Key code references:**

- Entitlement: `src/lib/appointment-reminders/entitlement.ts`
- Activation / readiness: `src/lib/appointment-reminders/activation.ts`
- Operational gate: `workspaceRemindersOperational()` in `src/lib/appointments/reminder-delivery.ts`
- Discovery: `src/lib/appointment-reminders/reminder-discovery.ts`
- Jobs: `appointments_platform_reminder_scan`, `ar_dispatch_reminder`, `ar_process_inbound_sms` in `src/lib/jobs/job-handlers.ts`

---

## What is in good shape (already built)

- **Microsoft calendar → appointments → lifecycle** (reschedule/cancel on provider) was production-verified on the test workspace (`docs/AR-MICROSOFT-PRODUCTION-VERIFICATION-2026-10-09.md`).
- **Settings ↔ runtime** for timing, channels, quiet hours, deferred fire times, AI rescheduler modes (`reminders_only` | `notify` | `ai`) is wired and has `npm run verify:ar-settings-runtime` (`docs/AR-SETTINGS-RUNTIME-MATRIX.md`).
- **Outbound SMS** uses the **same platform toll-free path as MCTB** (`resolveAppointmentOutboundSmsRoute` in `src/lib/appointments/sms-sender.ts`), not the customer’s business line.
- **UI shell**: overview, appointments, calendar, reminders log, settings (Opus), setup 3-step routes, AI rescheduler, responses (incl. Held), email **staff-request** flow for reschedule/cancel (no Calendly slot picker on email at launch).
- **Jobs** exist: `appointments_platform_reminder_scan`, `ar_dispatch_reminder`, `ar_process_inbound_sms` (prod probe once showed hundreds of completed scan jobs).

**Summary:** Product logic and UI are largely **launch-shaped**. What’s missing is mostly **commercial packaging, proof, and a few sharp edges**—not rebuilding the engine.

**Related evidence doc:** `docs/AR-51-FEATURE-HAVE-VS-MISSING-2026-10-10.md`

---

## Hard gaps before “flip the switch today”

### 1. No AR row in official V1 launch certification

`docs/V1-PRODUCTION-CERTIFICATION.md` only gates **MCTB + Fax**. Appointment Reminders has its own evidence doc (`docs/AR-51-FEATURE-HAVE-VS-MISSING-2026-10-10.md`) but **no single “AR launch PASS”** checklist signed off like MCTB.

**You still need one deliberate launch runbook**, for example:

- New workspace → connect M365 → import calendars → sync → activate
- Graph-created appointment with **phone on attendee** → wait for (or force) 2h/24h step → **one live SMS** + Telnyx delivery → inbound **C/R/X** in chosen handling mode
- If email steps enabled: **one live Brevo** send + confirm link + request reschedule/cancel → staff notification

Scripts referenced in `docs/AR-SETTINGS-RUNTIME-MATRIX.md` (`scripts/ar-prod-microsoft-2h-reminder-live.ts`, etc.) are the right shape; they are **not** a substitute for signing off on production.

### 2. Live SMS + delivery webhook not closed in the evidence pass

The 51-item doc still marks **automated SMS** and **delivery tracking** as **Partial**: mock/idempotency yes, **one production SMS through dispatch + webhook → delivered** not recorded in that pass.

Until that’s done, “launch right now” is a business risk, not a code mystery.

### 3. SMS “ready” on activation is misleading

`evaluateAppointmentRemindersSetupReadiness()` in `src/lib/appointment-reminders/activation.ts` sets `smsSenderReady` from `getMerchantPaymentStatus()`, which returns **Stripe/Square merchant connections**—not SMS at all—and the check `sms?.ready !== false` is **true when `sms` is undefined**. So the activate screen can show **“SMS reminders ready”** while the real gate is **`resolveAppointmentOutboundSmsRoute` + metering**.

**Real send blockers** for platform sender workspaces:

- Platform MCTB sender not configured/authorized in prod
- `reserveArReminderSmsUnit` → `unconfigured_limit` when monthly limit resolves to **0** (`AR_PAID_SMS_LIMIT_BY_TIER` is **empty** in `src/lib/appointment-reminders/ar-sms-usage-constants.ts`; quota falls through to trial/platform plan/override in `resolveArMonthlySmsLimit`)

**Launch action:** Confirm production **platform sender** + **`trial.messages` (or plan messages / override)** so new workspaces get a non-zero limit. Optionally fix readiness to match platform route + quota (product truth in UI).

### 4. Commercial / billing not productized for AR-only buyers

- Entitlement: “has voice/MCTB/sms or business workspace”—not **“purchased Appointment Reminders.”** (`src/lib/appointment-reminders/entitlement.ts`)
- `AR_PLATFORM_PRODUCT_FAMILY` / paid tier SMS map is **stubbed** (`AR_PAID_SMS_LIMIT_BY_TIER: {}`).
- No AR-specific Stripe checkout story surfaced in the gap scan.

You can launch **bundled** (existing voice/MCTB customers) more easily than **standalone AR signup → pay → remind.**

### 5. Onboarding is not “automatic” for a cold signup

There is **no** dedicated AR onboarding route that forces connect → sync → activate after signup (unlike MCTB’s wizard). User must discover setup or overview CTAs (`src/newui-transplant/connected/appointment-reminders/setup-pages.tsx`, overview).

**“Automatically start getting reminders”** requires:

- Calendar connected + import IDs + **manual sync**
- Appointments with **reachable phone** (import mapping) for SMS
- Operational workspace (activate or grandfather readiness)
- Scheduler + workers healthy

Missing phone/email on calendar events is still a common **silent skip** (eligibility via `evaluateSmsReminderEligibility` / `resolveEffectiveReminderPhone`), not a loud onboarding error.

### 6. Email is environment-gated

Email readiness is **global Brevo** (`src/lib/appointment-reminders/ar-email-readiness.ts`). If prod isn’t `productionReady`, activation **blocks only when email steps are enabled**—SMS can still go. Launch messaging should be: **SMS-first unless Brevo is fully configured.**

### 7. Ops dependencies (must be true in prod)

- Job scheduler processing **`appointments_platform_reminder_scan`** on interval
- Workers processing **`ar_dispatch_reminder`** and **`ar_process_inbound_sms`**
- Deploy includes email-request workflow (commits around email staff-request workflow, e.g. `64a75cf7b` area)—confirm `/api/health` `commitSha` on your host
- Microsoft webhooks + delta backstop (proven for test ws; not “10k calendars” soak)

---

## Softer gaps (launch with eyes open)

| Area | Notes |
|------|--------|
| **Google for AR** | Likely off if `AR_MICROSOFT_ONLY_CALENDAR` (`src/lib/appointment-reminders/calendar-provider-policy.ts`)—position as **M365 launch**. |
| **Pre-send Graph authority** | Discovery uses DB `startsAt`; no last-second Graph check (see `docs/AR-MICROSOFT-GRAPH-WEBHOOK-DELTA-BACKSTOP-STATUS.md`). |
| **Customer analytics** | Ops metrics exist; **customer-facing AR analytics** is thin vs checklist dreams. |
| **Industry presets / CSV / iCloud** | Explicitly missing or deferred—fine if you don’t sell them. |
| **Appointment-type rules** | Partial in `reminder-scheduling-policy.ts`; UI depth not launch-critical if you use global sequence. |
| **Two-way write-back** | Code exists (`src/lib/calendar/external-sync.ts`); prod proof was calendar→Transovo, not Transovo→Graph on staff edit. |
| **Workflow guard** | Active `appointment_booked` workflow can **disable** platform reminders for that type (`platform-guard.ts`). |

---

## Settings changes (“everything changes when I change settings”)

For launch, treat these as **true** (backed by `docs/AR-SETTINGS-RUNTIME-MATRIX.md` + tests):

- Step enable/disable, timing, channel, templates, quiet hours, weekly hours, scheduling prefs, AI rescheduler mode → **future** discovery/dispatch.
- **Not** retroactive magic on already-sent timeline rows.
- Per-appointment reminder contact override is honored in **eligibility** (`resolveEffectiveReminderPhone` in `src/lib/appointment-reminders/effective-phone.ts`); worth one prod spot-check on an edited phone.

**Verification commands:**

```bash
npm run verify:ar-settings-runtime
npx tsx src/lib/appointment-reminders/reminder-send-time-policy.test.ts
npx tsx src/lib/appointment-reminders/reminder-scheduling-policy.test.ts
```

---

## Handling levels (launch intent)

| Mode | SMS | Email (launch) |
|------|-----|----------------|
| **Reminders only** | Template only, no C/R/X append | No action buttons |
| **Notify staff** | C/R/X → notify team | Confirm + request reschedule/cancel → notify team |
| **AI handles** | AI + calendar per rules | Same as notify (requests only, no email AI agent) |

Types: `src/lib/appointment-reminders/ai-rescheduler/types.ts`  
UI: `src/newui-transplant/connected/appointment-reminders/ar-ai-rescheduler-opus.tsx`

---

## Practical “launch tonight” minimum checklist

1. **Prod config:** Platform toll-free sender authorized; Brevo ready if selling email; platform **`trial.messages` > 0** (or explicit workspace overrides) for new workspaces.
2. **Ops:** Reminder scan + dispatch + inbound jobs green; health `commitSha` current.
3. **One golden tenant:** M365 → sync → activate → future appointment with mobile on invitee → **SMS delivered** → reply tested in your chosen mode (`reminders_only` / `notify` / `ai`).
4. **Email (if on):** One reminder + confirm + request reschedule → staff sees request (no auto-book on email).
5. **GTM:** Who gets AR (bundle vs standalone) and **signup path** into `/appointment-reminders/setup/connect`.
6. **Fix or document** SMS readiness on activate page so you don’t tell customers they’re ready when quota/sender isn’t.

---

## Bottom line

| Dimension | Status |
|-----------|--------|
| **Engine + Opus UI + settings/runtime wiring** | Close enough to launch for **Microsoft-calendar customers** who complete setup and have phone numbers on events. |
| **“Any random signup, fully automatic”** | **Not yet** — missing formal live AR cert, SMS quota/sender truth vs UI, no AR-only billing SKU, manual sync + no forced onboarding, unproven live SMS/email/delivery loop at MCTB launch-matrix rigor. |

**Highest-leverage engineering follow-ups (optional):**

1. Align activation `smsSenderReady` with `resolveAppointmentOutboundSmsRoute` + `resolveArMonthlySmsLimit`.
2. Confirm prod trial/limit defaults for new workspaces.
3. Run + document the one golden-tenant live cert (SMS + optional email).

---

## Route / file quick index

| Area | Paths |
|------|--------|
| Setup UI | `src/newui-transplant/connected/appointment-reminders/setup-pages.tsx` |
| Settings UI | `src/newui-transplant/connected/appointment-reminders/reminder-settings-opus.tsx` |
| Setup API | `src/app/api/appointment-reminders/setup/status/route.ts` |
| Email public requests | `src/lib/appointment-reminders/public-customer-actions.ts`, `src/app/api/public/appointments/reschedule/[token]/route.ts`, `cancel/[token]/route.ts` |
| SMS route | `src/lib/appointments/sms-sender.ts`, `src/lib/mctb/messaging/outbound-sms-route.ts` |
| SMS metering | `src/lib/appointment-reminders/ar-sms-usage.ts`, `ar-commercial-entitlements.ts` |
| Nav / shell | `src/lib/products/appointment-reminders-nav.ts`, `product-shell.ts` |

---

*Generated from cloud agent launch-gap review, 2026-10-10.*
