# Appointment Reminders — where you are today (full picture)

**As of:** 2026-10-10  
**Production:** `GET /api/health` on the primary Transovo web app → commit **`79f729092`** (commercial launch, live Stripe IDs, legacy fix, metering fixes). In-container `npx tsx scripts/verify-ar-stripe-catalog.ts --live-stripe` **PASS** on Starter/Growth/Business prices.

This is an evidence-based read of **routes, code, docs, and prod config** — not a substitute for walking every screen and one live paid checkout. It updates the Oct 10 gap inventory now that **standalone commercial** is shipped.

---

## Executive summary

| Dimension | Status |
|-----------|--------|
| **Product UI (Opus shell)** | **Broadly complete** — overview, appointments, calendar, reminders log, responses, AI rescheduler, analytics, settings (7 tabs incl. billing), 3-step setup, pricing, booking submodule |
| **Backend engine** | **Built and wired** — M365 sync, discovery, dispatch, inbound SMS, AI rescheduler, email path, plan gates, metering |
| **Standalone commercial** | **Implemented** — Free/Starter/Growth/Business, Stripe checkout, webhooks, usage meters, billing tab |
| **“Flip switch for any stranger on the internet”** | **Not signed off** — no formal AR launch cert; **one golden-tenant live SMS + optional email + paid Stripe** still on you |
| **51-feature marketing checklist** | **~6 Have, ~28 Partial, ~7 Missing** per `docs/AR-51-FEATURE-HAVE-VS-MISSING-2026-10-10.md` — engine exists; prod proof is thin on many rows |

**Bottom line:** You are in **“code-complete for M365-first standalone AR launch; customer E2E + live telephony/email proof still required”** — not “needs another dev phase,” but also not “certified without your phone and card.”

---

## Customer journey: start → finish

### 1. Discovery and marketing

| Step | What exists | Notes |
|------|-------------|--------|
| Marketing landing | `src/components/landing/appointments/appointments-landing-page.tsx` | CTAs → `/appointment-reminders/pricing` |
| Launch IA | `APPOINTMENT_REMINDERS_V1_PRIMARY = true` | AR is the visible product; MCTB hidden from primary nav |
| Pricing | `/appointment-reminders/pricing` | Four plans from `ar-plan-catalog.ts`; “Start free” / “Subscribe” |

**Gap:** There is no separate `/onboarding/appointment-reminders` wizard like MCTB. Onboarding is **setup routes + overview CTAs**.

---

### 2. Account creation + choosing a plan

| Step | Route / behavior | Working? (code) |
|------|------------------|-----------------|
| Pick plan (logged out) | Pricing → `appointmentRemindersProductOpenPath` → `/api/appointment-reminders/product-open` | **Yes** — redirects to login with `product=appointment_reminders` + `plan` |
| Sign up | `/signup?product=appointment_reminders&plan=…` | **Yes** — same redirect target as login (`signup/page.tsx`, `login/page.tsx`) |
| After auth | `product-open` | **Free:** `assignArFreePlan` → redirect `/appointment-reminders/setup/connect` |
| After auth | `product-open` | **Paid:** Stripe Checkout with committed live `price_*` IDs → success URL → setup connect |
| API entitlement | `workspaceHasAppointmentReminders()` | **Yes** — only if free marker, active AR Stripe sub, or explicit `TRANSOVO_AR_LEGACY_WORKSPACE_IDS` (unset in prod) |

**Important for launch:**

- A user who signs up **without** `product=appointment_reminders` and never hits **pricing / product-open** will get **403** on AR APIs (“not enabled”) until they activate a plan.
- `product-open` uses `ensureProductWorkspace(..., "voice")` — business workspace + legacy voice/MCTB bootstrap side paths; fine for launch but not a pure “AR-only tenant” model.

**Shell quirk:** App layout sets `hasAppointmentReminders={productAccess.hasVoice}` (`src/app/(app)/layout.tsx`), not `workspaceHasAppointmentReminders()`. Switcher visibility can diverge from AR commercial entitlement; APIs are still gated correctly.

---

### 3. Setup (three steps — real routes)

| Step | Route | What customer must do |
|------|--------|------------------------|
| **1. Connect** | `/appointment-reminders/setup/connect` | Microsoft 365 OAuth; pick **import calendars**; save (Google hidden when `AR_MICROSOFT_ONLY_CALENDAR` default **on**) |
| **2. Configure** | `/appointment-reminders/setup/configure` | Business details, reminder sequence preview, industry/schedule (`ArSetupConfigurePanel`) |
| **3. Activate** | `/appointment-reminders/setup/activate` | POST setup status when readiness passes |

**Readiness blockers** (`evaluateAppointmentRemindersSetupReadiness` in `src/lib/appointment-reminders/activation.ts`):

- Calendar connected + import calendars selected
- **Initial calendar sync** (`lastSyncAt`) — still **manual** (“Run sync” from appointments/calendars UI); not fully automatic after OAuth
- At least one enabled reminder step
- If SMS steps on: platform Telnyx sender via `evaluateArSmsOutboundReadiness` (fixed — no longer fake Stripe merchant check)
- If email steps on: Brevo + `APPOINTMENTS_FROM_EMAIL` readiness

**Grandfather send path:** Even without clicking Activate, if readiness passes, `workspaceRemindersOperational()` may still allow sends — intentional.

**Automated check:** `npx tsx scripts/verify-ar-settings-runtime.ts` → **PASS** (settings persist ↔ runtime).

---

### 4. Day-to-day product (every major page)

| Nav / page | Route | Role | Implementation |
|------------|-------|------|----------------|
| Overview | `/appointment-reminders` | Health, upcoming, responses strip, setup status | `overview-page.tsx` + `/api/appointment-reminders/overview` |
| Appointments | `/appointment-reminders/appointments` | Imported rows, phones, response pills, reminder contact override | `appointments-page.tsx` |
| Calendar | `/appointment-reminders/calendar` | Month view + native actions | `ar-calendar-opus.tsx` |
| Reminders | `/appointment-reminders/reminders` | Dispatch log / timeline | `reminders-page.tsx` |
| Responses | `/appointment-reminders/responses` | Customer SMS outcomes + held inbound | `ar-responses-opus.tsx` |
| AI Rescheduler | `/appointment-reminders/ai-rescheduler` | Mode notify / AI / business approval | `ar-ai-rescheduler-opus.tsx` + APIs |
| Analytics | `/appointment-reminders/analytics` | Date range KPIs + no-show calculator | **Customer-facing** — `/api/appointment-reminders/analytics` |
| Settings | `/appointment-reminders/settings?tab=…` | Sequence, templates, scheduling, business, notifications, integrations, **Plan & billing** | `reminder-settings-opus.tsx` + `ArBillingSettingsOpus` |
| Calendars (legacy) | `/appointment-reminders/calendars` | Still routed; integrations also under settings | `calendars-page.tsx` |
| **Booking** (subsection) | `/appointment-reminders/booking/*` | Public booking + meetings/services editors | Full submodule (Calendly-style); **not** required for “import M365 → remind” |
| Pricing | `/appointment-reminders/pricing` | Plan picker | Logged-in → product-open; logged-out → login |

Sidebar “Plan & Billing” points to **`/settings/billing`** (shared account route), while the **AR-native** billing UX is **Settings → Plan & billing** tab inside AR settings — two entry points; AR tab is the one wired to `/api/appointment-reminders/billing/*`.

---

### 5. What actually runs when reminders fire

```
Calendar import/sync → voice_appointments
  → scheduler job appointments_platform_reminder_scan
  → ar_dispatch_reminder
  → reminder-delivery (SMS via platform sender OR email via Brevo)
  → metering: SMS segments, email units, AI conversations (Growth+)
```

| Piece | Status (code) | Prod proof |
|-------|---------------|------------|
| M365 lifecycle (provider → Transovo) | **Verified** (Oct 9 doc: `docs/AR-MICROSOFT-PRODUCTION-VERIFICATION-2026-10-09.md`) | Create/update/delete + sync backstop |
| Discovery + idempotent dispatch | **Implemented** + tests | **Not** one signed-off live SMS through dispatch → Telnyx → delivered webhook in AR cert |
| Inbound SMS C/R/X + AI | **Implemented**; prior live SMS docs exist | Re-run on **your** new workspace |
| Email reminders + staff request links | **Implemented** (`reminder-engine`, public token routes) | **Live Brevo send** not in AR cert pass |
| Workers | Embedded **`worker-all`** in web container (per AR Microsoft verification doc); scheduler container `tgjridm6vrmrgljkfrr0rpjn` **up** on prod host | `/api/health` shows `smsWorkerCommitSha: null` — no separate SMS worker parity line; rely on embedded worker |

---

### 6. Commercial plans (what each tier gets)

From `src/lib/appointment-reminders/commercial/ar-plan-catalog.ts` (enforced in `ar-feature-gates.ts`, metering libs, settings PATCH):

| | Free | Starter $9 | Growth $19 | Business $39 |
|--|------|------------|------------|--------------|
| SMS segments/mo | 25 | 200 | 500 | 1200 |
| Emails/mo | 100 | 500 | 1500 | 3000 |
| Import calendars | 1 | 1 | 3 | 10 |
| Reminder steps | 1 | 3 | 3 | 3 |
| SMS confirm/respond (C/R/X) | **No** (catalog) | Yes | Yes | Yes |
| Staff notified reschedule/cancel | No | Yes | Yes | Yes |
| AI modes | reminders only | + notify | + **AI** | + AI |
| AI conversations/mo | 0 | 0 | 25 | 100 |

**Stripe live price IDs (committed):**

| Plan | Price ID |
|------|----------|
| Starter | `price_1UP8QhKjM2RWgyrvrm1dl9SP` |
| Growth | `price_1UP8QiKjM2RWgyrv9t3acn3k` |
| Business | `price_1UP8QiKjM2RWgyrvJnD8q7XX` |

**Billing lifecycle (code):**

- Upgrade: immediate Stripe update (`changeAppointmentRemindersSubscriptionPlan`)
- Downgrade: schedule at period end
- Cancel: portal / manage → paid through period → delete webhook → `assignArFreePlan`
- Usage period follows Stripe or rolling free month; upgrade does not erase same-period usage

**Caveat:** `smsConfirmationsAndResponses` is defined on the plan but **not clearly enforced on inbound SMS** in messaging code (no grep hits in `messaging/`). Free tier might still process inbound replies unless gated elsewhere — **worth one test on Free**; fix if replies work when catalog says they should not.

---

### 7. Feature areas vs “everything working”

**Strong (build + partial prod evidence)**

- Microsoft calendar connect, import, sync, webhook/delta stack
- Reminder sequence editor ↔ runtime (`verify-ar-settings-runtime` PASS)
- Platform SMS sender path (same as MCTB toll-free)
- AI rescheduler modes + business approval flows
- Responses / needs-attention / contact override in UI
- Analytics page (real API, not mock)
- Commercial: pricing, checkout, billing snapshot, usage meters

**Partial (code yes, you must prove)**

- Automated **SMS** end-to-end on a **brand-new** workspace after Free activation
- **Email** reminders if you enable email steps (Brevo + from-address)
- **Paid Stripe** checkout → webhook → tier + limits in UI
- **Upgrade / downgrade / cancel** on a real subscription
- **Growth AI** conversation counting under load
- Transovo → Microsoft **write-back** on staff reschedule (code in `external-sync.ts`, not in Oct 9 prod proof)

**Missing / deferred (don’t sell yet)**

- CSV import, iCloud, industry template packs, no-show revenue calculator as product, Google as **launch** story (policy defaults Microsoft-only), many P3 checklist items

---

## What’s done vs what’s missing (launch lens)

### Done (no further implementation required for core launch)

1. Standalone **pricing + signup/login + product-open + Stripe live IDs**
2. **Free plan provisioning** (`assignArFreePlan`)
3. **Full Opus AR app** (pages listed above)
4. **3-step setup + activation readiness** (SMS readiness fix from functional pass)
5. **Plan limits + metering** on main send paths (+ business-approval SMS metering)
6. **Settings ↔ runtime** verification script PASS
7. **Production deploy** on commercial commits + Stripe catalog verify

### Missing before you call it “launched” (your work, not a dev sprint)

1. **One cold customer path on prod:** landing → pricing → Free → M365 → sync → activate → future appt with mobile → **SMS received**
2. **Optional:** same with **email** step enabled
3. **One paid path:** Growth checkout → confirm plan/usage in Settings → billing
4. **Plan change:** upgrade then schedule downgrade/cancel and confirm UI + entitlements
5. **Inbound:** on **Starter+**, test C/R/X; on **Free**, confirm whether replies are blocked as marketed
6. **Ops:** confirm embedded workers processing `appointments_platform_reminder_scan` / `ar_dispatch_reminder` on prod (BullMQ/redis healthy; scheduler deployed)

### Engineering follow-ups (small, not blockers if tests pass)

- Tie shell `hasAppointmentReminders` to real AR entitlement (`layout.tsx`)
- Enforce **Free = no SMS confirmations/responses** on inbound if tests show a leak
- Align sidebar “Plan & Billing” with AR settings billing tab (or redirect)
- Formal **AR launch checklist** doc (parallel to MCTB V1 cert) — process, not code

---

## Suggested E2E script (your “am I ready?”)

Use two browsers or incognito + your phone.

**Path A — Free**

1. `/appointment-reminders/pricing` → Start free (new account).
2. Confirm redirect to **setup/connect** and APIs work (overview loads).
3. Connect Microsoft, select calendar, save, **run sync** on appointments.
4. Configure one SMS step, activate.
5. Create or import appointment **>2h out** with **your mobile** on attendee.
6. Wait or use internal smoke scripts if you have DB access; confirm SMS + usage counter.

**Path B — Growth + AI**

1. New account → Growth → complete Stripe test payment.
2. Settings → AI rescheduler → **AI** mode (should be allowed).
3. Reply to reminder; confirm AI path and conversation meter.

**Path C — Billing**

1. Upgrade Starter → Growth; check immediate tier.
2. Downgrade to Starter at period end; cancel; confirm eventual Free + limits.

---

## Docs: stale vs current

| Doc | Note |
|-----|------|
| `docs/AR-LAUNCH-GAP-INVENTORY-2026-10-10.md` | **Partially stale** on entitlement, Stripe, `AR_PAID_SMS_LIMIT_BY_TIER`, activation SMS — commercial + functional passes supersede those sections |
| `docs/AR-COMMERCIAL-LAUNCH-COMPLETION.md` | **Current** for Stripe + verification steps |
| `docs/AR-51-FEATURE-HAVE-VS-MISSING-2026-10-10.md` | Still valid for **feature breadth** vs marketing list |
| `docs/AR-FUNCTIONAL-COMPLETION-PASS-2026-10-10.md` | **Current** for ops UX fixes |

---

## Route / file quick index

| Area | Paths |
|------|--------|
| Routes manifest | `src/lib/appointment-reminders/routes.ts` |
| Entitlement | `src/lib/appointment-reminders/entitlement.ts`, `commercial/ar-workspace-plan.ts` |
| Setup UI | `src/newui-transplant/connected/appointment-reminders/setup-pages.tsx` |
| Settings UI | `src/newui-transplant/connected/appointment-reminders/reminder-settings-opus.tsx` |
| Billing UI | `ar-billing-settings-opus.tsx`, `/api/appointment-reminders/billing/*` |
| Pricing | `ar-pricing-page.tsx`, `product-open/route.ts` |
| Nav | `src/lib/products/appointment-reminders-nav.ts` |
| Verify scripts | `scripts/verify-ar-settings-runtime.ts`, `scripts/verify-ar-stripe-catalog.ts` |

---

## Closing

**Where you are:** The **application customers would use** — signup, plans, setup, settings, operations, billing — is **built and on production** at `79f729092`, with **live Stripe** confirmed. What you do **not** have yet is **your** signed-off story that a stranger can complete that path with **real SMS, optional email, and real payment** without surprises. That is one focused testing day, not another implementation phase — unless Free inbound or shell entitlement tests fail and need small fixes.
