# Appointment Reminders — launch readiness (now)

**As of:** 2026-10-11  
**Code baseline:** `master` @ **`b081ea02d`** and later (includes auto calendar sync, Free one-way SMS, no customer upgrade SMS, shell `workspaceHasAppointmentReminders`, billing redirect when AR entitled).  
**Companion:** `docs/AR-PLAN-PACKAGES-AND-GATES.md` (plan matrix + gates).  
**Supersedes (partially stale):** `docs/AR-LAUNCH-GAP-INVENTORY-2026-10-10.md` sections on entitlement, Stripe, merchant SMS readiness, Free inbound.

---

## Executive verdict

| Question | Answer |
|----------|--------|
| **Is the AR product built enough to sell M365 → automated SMS reminders?** | **Yes in code** — UI, billing, engine, metering, setup, ops pages exist. |
| **Can you flip a switch for any stranger with zero human testing?** | **No** — no signed **AR launch cert** (live SMS + optional email + paid Stripe on a **new** workspace). |
| **Is another big dev phase required?** | **No** — functional completion matrix is **FINISHED** (`docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md`). |
| **Is AR in `V1-PRODUCTION-CERTIFICATION.md`?** | **Yes** — listed as a **separate** automated + live gate (not part of MCTB/Fax V1 freeze). |

**One-line:** **Code + automated matrix closure complete; production “launch PASS” still requires the golden-tenant live SMS/Stripe runbook below on your tenant.**

---

## What “launch” should mean (minimum bar)

1. **Cold signup** → pricing → **Free** (or paid) → entitlement active.  
2. **Microsoft 365** connect → import calendar(s) → **appointments appear** (sync runs without forcing a hidden manual step).  
3. **Activate** when readiness passes → **one real SMS** to a phone on a future appointment → delivery visible in app/Telnyx.  
4. **Free:** SMS is **one-way** (no reply CTAs; no auto-reply to patient texts).  
5. **Starter:** appended C/R/X + inbound notify flows work.  
6. **Growth:** can enable **AI** mode; AI conversation meter increments.  
7. **Paid:** Stripe checkout → webhook → plan + usage limits in Settings → Plan & billing.  
8. **Ops:** reminder scan + dispatch + inbound jobs running on prod (embedded worker + scheduler).

---

## COMPLETE (built + wired — no major code hole for core path)

### Commercial & access

| Item | Evidence |
|------|----------|
| Plan catalog Free / Starter $9 / Growth $19 / Business $39 | `ar-plan-catalog.ts` |
| Free activation | `assignArFreePlan`, `POST .../billing/free` |
| Stripe live price IDs | `ar-stripe-catalog-ids-live.ts`, `verify-ar-stripe-catalog.ts` |
| Checkout, change plan, portal, cancel → Free | `stripe-checkout.ts`, billing API routes |
| Entitlement = explicit free / paid AR / legacy allowlist only | `ar-workspace-plan.ts`, `entitlement.ts` |
| SMS/email/AI limits from plan catalog | `ar-commercial-entitlements.ts` |
| Shell shows AR when entitled | `layout.tsx` → `workspaceHasAppointmentReminders()` |

### Customer journey (UI routes)

| Item | Route / module |
|------|----------------|
| Marketing landing | `appointments-landing-page.tsx` → pricing |
| Pricing (4 plans) | `/appointment-reminders/pricing` |
| Signup/login with `product=appointment_reminders` | signup/login pages |
| Product open | `/api/appointment-reminders/product-open` |
| Setup 3-step | `/setup/connect`, `/configure`, `/activate` |
| Operations | overview, appointments, calendar, reminders log, responses, analytics, AI rescheduler |
| Settings (7 tabs incl. billing) | `/appointment-reminders/settings` |
| AR billing tab | `ArBillingSettingsOpus`, `/api/appointment-reminders/billing` |
| Sidebar Plan & Billing → AR billing when entitled | `settings/billing/page.tsx` redirect |

### Engine

| Item | Evidence |
|------|----------|
| M365 import/sync/webhook stack | `lib/calendar/*`, Oct 9 prod verification doc |
| Discovery → dispatch → send | `reminder-discovery.ts`, `reminder-delivery.ts`, jobs |
| Platform toll-free SMS (shared with MCTB path) | `resolveAppointmentOutboundSmsRoute` |
| SMS segment metering | `reserveArReminderSmsUnit` |
| Email send path + metering | `reminder-engine.ts`, `ar-email-usage.ts` |
| Inbound SMS pipeline | `handle-inbound-body.ts`, `ar_process_inbound_sms` |
| AI reschedule (Growth+) | `inbound-follow-up.ts`, `reserveArAiConversation` |
| Settings persist ↔ runtime | `scripts/verify-ar-settings-runtime.ts` (run via `npx tsx`, not npm script name) |
| Template library (306) | `transovo-reminder-templates.json` |
| Reply CTAs not in templates; append on paid at send | `sms-reply-instructions.ts`, `reminder-delivery.ts` (post `b081ea02d`) |
| Free inbound: no upgrade SMS to patients | `handle-inbound-body.ts` early exit |

### Calendar sync UX (recent)

| Item | Evidence |
|------|----------|
| Auto sync on connect save / setup status / overview / appointments load | `ensure-calendars-synced.ts`, API routes |

### Activation readiness (recent)

| Item | Evidence |
|------|----------|
| SMS readiness = platform sender route (not Stripe merchant) | `ar-sms-readiness.ts`, `activation.ts` |

---

## PARTIAL (exists but not “launch done” until proved or tightened)

### Human certification (biggest gap)

| Item | Status | What “done” looks like |
|------|--------|-------------------------|
| **Live AR SMS** on **new** Free workspace | **Not signed off** | Dispatch → Telnyx → phone receives → delivery state in UI |
| **Live email** reminder | **Not signed off** | Brevo + from-address; one delivered message |
| **Paid Stripe E2E** | **Not signed off** | Card → webhook → Growth tier in billing snapshot |
| **Plan change lifecycle** | **Not signed off** | Upgrade, downgrade at period end, cancel → Free limits |
| **Starter inbound C/R/X** | **Not signed off** on new tenant | Staff notification / request flow |
| **Growth AI path** | **Not signed off** on new tenant | Reply → AI turn → meter |
| **Formal AR launch checklist doc** | **Missing** | Parallel to MCTB matrix — process artifact |
| **600-reminder throughput test** | **Not completed** | `test-ar-reminder-throughput.ts` |
| **Delivery webhook → `delivered`** | **Thin evidence** | Reconcile + dispatch row proof on prod |
| **Transovo → Microsoft write-back** | **Code, not prod cert** | `external-sync.ts` |

### Product / UX (code present, polish or truth gaps)

| Item | Issue |
|------|--------|
| **No AR onboarding wizard** | Unlike MCTB — user must find setup/overview; no forced connect → sync → activate |
| **Signup without `product=appointment_reminders`** | AR APIs 403 until pricing/product-open — easy to confuse |
| **AI Rescheduler UI** | All three modes shown; **does not disable** Notify/AI by plan (API blocks illegal `ai` only) |
| **Default config `aiRescheduler.mode: notify`** | Runtime caps Free to `reminders_only`; settings UI can **look** like notify until saved/capped |
| **Pricing page copy** | Lists caps; does **not** explain one-way vs $9 notify vs $19 AI |
| **`aiInsights` plan flag** | In catalog; **no feature gated** on it |
| **Feature gate helpers unused** | `requireArProductAccess`, `assertSmsCustomerResponsesAllowed`, `assertStaffNotifiedFlowsAllowed` — **not called** from APIs (runtime-only enforcement) |
| **Some inbound code** | Still uses uncapped `resolveAiReschedulerConfig(platform)` in places — safe only because top-level inbound gate exits on Free |
| **Two billing entry points** | AR settings tab (canonical) vs global `/settings/billing` (redirects when AR entitled) — OK but document for support |
| **`product-open` → `ensureProductWorkspace(..., "voice")`** | AR-only tenant model not pure — legacy bootstrap |
| **Booking submodule** | Built under `/appointment-reminders/booking/*`; **hidden from launch nav** — don’t sell as launch |
| **Google Calendar for AR** | Deferred when `AR_MICROSOFT_ONLY_CALENDAR` (default) — **M365-only GTM** |
| **51-item marketing checklist** | ~6 Have / ~28 Partial / ~7 Missing per `AR-51-FEATURE-HAVE-VS-MISSING-2026-10-10.md` — breadth ≠ launch blockers |

### Ops / infra (assume true; verify on prod)

| Item | Risk |
|------|------|
| Embedded `worker-all` in web container | `/api/health` may not show separate SMS worker SHA |
| Scheduler container | Must run `appointments_platform_reminder_scan` on interval |
| Redis/BullMQ | Stuck queue = no reminders |
| Platform MCTB sender authorized | If down, **all** AR SMS fails |
| Brevo + `APPOINTMENTS_FROM_EMAIL` | Email steps blocked at activation if not ready |

---

## MISSING / NOT THERE (do not promise at launch)

| Item | Notes |
|------|--------|
| AR row in `V1-PRODUCTION-CERTIFICATION.md` | By design today — add if you want one gate command |
| CSV appointment import | Not built for AR |
| iCloud calendar | Not built |
| Industry packs as sold SKU | Library exists; not full “pick industry” launch SKU |
| No-show **revenue** calculator as product | Missing |
| Google as **launch** calendar story | Policy off by default |
| Customer upgrade / plan SMS to **patients** | Removed — must stay gone |
| Dedicated `/onboarding/appointment-reminders` | No equivalent of MCTB wizard |
| Multilingual AR templates | Not audited / not launch |
| Per-appointment-type reminder rules (deep UI) | Partial backend only |
| Email “confirm button” product parity | Not confirmed in 51-item pass |
| Fax / MCTB launch PASS | Separate — **V1 cert still NOT READY** for those products |

---

## Plan behavior vs your mental model (current code)

See full table in `docs/AR-PLAN-PACKAGES-AND-GATES.md`.

| Plan | Patient SMS | Subscriber |
|------|-------------|------------|
| **Free** | One-way reminder only | 25 SMS seg/mo, 1 step, 1 calendar, no two-way |
| **Starter ($9)** | + appended notify suffix | C/R/X inbound, staff flows, 3 steps |
| **Growth ($19+)** | + AI when mode = `ai` | 25 AI convos/mo (Growth), 100 (Business) |

---

## Engineering follow-ups (small — not a sprint)

Priority if you want **code truth = product truth** before marketing:

1. **PATCH ai-rescheduler:** reject `notify` on Free (not only `ai`); default new Free workspaces to `reminders_only` in stored config.  
2. **UI:** disable handling levels using billing snapshot / `resolveArPlanCapabilities`.  
3. **Wire** `assertSmsCustomerResponsesAllowed` on inbound-adjacent APIs if any bypass `handle-inbound-body`.  
4. **Use** `resolveArAiReschedulerConfigForWorkspace` everywhere in inbound reply handlers.  
5. **Pricing + landing copy** aligned to one-way / notify / AI.  
6. **Author** `docs/AR-LAUNCH-CERT-RUNBOOK.md` (single PASS checklist + sign-off block).  

---

## Golden-tenant runbook (you must run on prod)

**Path A — Free (one-way)**

1. Incognito → `/appointment-reminders/pricing` → Start free → new account.  
2. Setup connect → M365 → pick calendar → save → open Appointments (sync should run).  
3. One enabled **SMS** step → activate.  
4. Appointment **>2h** out with **your mobile** on attendee.  
5. Receive SMS — **no** Reply C/YES lines.  
6. Text back “C” — **no** Transovo SMS reply (especially no upgrade).  
7. Usage: 25-segment pool decrements.

**Path B — Starter**

1. New workspace → Starter → Stripe live payment.  
2. Mode **notify** (allowed).  
3. SMS includes **suffix** once at end.  
4. C/R/X inbound → staff/request behavior.

**Path C — Growth + AI**

1. Growth checkout → AI mode in settings.  
2. Inbound AI turn → AI conversation meter +1.

**Path D — Billing**

1. Upgrade / downgrade / cancel — UI matches `ar-plan-catalog` limits.

**Ops**

1. Confirm jobs completing on prod host.  
2. `GET /api/health` `commitSha` ≥ `b081ea02d`.  
3. `npx tsx scripts/verify-ar-stripe-catalog.ts --live-stripe` in prod container.

---

## Automated tests (repo — run before deploy)

```bash
npx tsx scripts/verify-ar-settings-runtime.ts
npx tsx scripts/verify-ar-stripe-catalog.ts
npm run test:appointment-reminders
npx tsx src/lib/appointment-reminders/sms-reply-instructions.test.ts
```

---

## Related docs (read order)

1. **This file** — launch lens now  
2. `docs/AR-PLAN-PACKAGES-AND-GATES.md` — plans + gates  
3. `docs/AR-CUSTOMER-LAUNCH-STATUS-2026-10-10.md` — journey map (update prod SHA when cert done)  
4. `docs/AR-COMMERCIAL-LAUNCH-COMPLETION.md` — Stripe + metering  
5. `docs/AR-51-FEATURE-HAVE-VS-MISSING-2026-10-10.md` — marketing checklist breadth  
6. `docs/AR-MICROSOFT-PRODUCTION-VERIFICATION-2026-10-09.md` — M365 lifecycle proof  
7. `docs/V1-PRODUCTION-CERTIFICATION.md` — **MCTB/Fax only** (not AR)

---

## Bottom line

| Dimension | Status |
|-----------|--------|
| **Core AR product in repo** | **Complete** for M365 import → remind → bill |
| **Commercial packaging** | **Complete** (Free + 3 paid tiers, live Stripe IDs) |
| **Free vs paid SMS behavior** | **Fixed in code** (`b081ea02d`); **re-prove on prod** |
| **Launch certification** | **Missing** — your golden-tenant + optional email + paid card |
| **Marketing 51-item list** | **Mostly partial** — don’t sell the long tail yet |
| **V1 platform cert (MCTB/Fax)** | **Separate** — still not PASS per `V1-PRODUCTION-CERTIFICATION.md` |

**You can launch Appointment Reminders when you have PASS on the golden-tenant runbook above — not when every row of the 51-item doc is green.**
