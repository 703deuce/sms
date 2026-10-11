# Appointment Reminders — packages, access, and gates

**Authoritative catalog (code):** `src/lib/appointment-reminders/commercial/ar-plan-catalog.ts`  
**Entitlement resolution:** `src/lib/appointment-reminders/commercial/ar-workspace-plan.ts`  
**Feature gates:** `src/lib/appointment-reminders/commercial/ar-feature-gates.ts`  
**Stripe (live):** `src/lib/appointment-reminders/commercial/ar-stripe-catalog-ids-live.ts`

Last updated: 2026-10-11 (includes Free SMS one-way + no customer upgrade SMS fixes on branch `cursor/ar-free-sms-no-reply-copy-f350` / PR #635).

---

## Product rules (non-negotiable)

1. **End customers** (the business’s patients/clients who receive reminder SMS) are **not** Transovo subscribers. They must **never** receive plan, pricing, or “upgrade” messaging.
2. **Free plan:** outbound reminders are **one-way only** — template body only. No “Reply C / YES / …” in stored templates; no reply suffix at send; inbound replies are **not** handled (no auto-reply SMS).
3. **Starter (~$9):** **notify** — reply instructions are **appended at send time** (not baked into templates). C/R/X (and related) inbound flows + staff-notified reschedule/cancel.
4. **Growth (~$19) and above:** **AI** reschedule mode allowed (with monthly AI conversation caps). Business is a higher tier on the same axes.
5. **Upgrade / limit messaging** is for the **workspace owner in the app** (Plan & billing, API errors when saving settings) — **never** SMS to appointment recipients.

---

## What went wrong (2026 launch fixes)

| Mistake | Who was affected | Fix |
|--------|------------------|-----|
| Auto-SMS “upgrade to Starter” when someone texted C/R/X/YES | **Your customer’s customer** | Removed — Free inbound returns `handled: false` (no SMS back) |
| “Reply YES / Reply C…” inside default + library templates | Recipients looked like two-way on Free | Removed from templates; strip at send; append suffix only on paid |
| Outbound used platform default `notify` without plan cap | Free could get C/R/X suffix | `resolveArAiReschedulerConfigForWorkspace` + `workspaceAllowsSmsCustomerResponses` on send |

---

## Plan catalog (as defined in code today)

| Plan | Price (catalog) | Outbound SMS / mo | Email / mo | Import calendars | Reminder steps | Custom timing | SMS confirmations & responses (two-way) | Staff-notified R/C | AI modes allowed | AI conversations / mo | `aiInsights` flag |
|------|-----------------|-------------------|------------|------------------|----------------|---------------|----------------------------------------|--------------------|------------------|-------------------------|-------------------|
| **Free** | $0 | 25 segments | 100 | 1 | **1** | basic only | **No** | **No** | `reminders_only` only | 0 | No |
| **Starter** | **$9** (`900` cents) | 200 | 500 | 1 | 3 | full | **Yes** | **Yes** | `reminders_only`, **`notify`** (not `ai`) | 0 | No |
| **Growth** | **$19** (`1900` cents) | 500 | 1,500 | 3 | 3 | full | Yes | Yes | `reminders_only`, `notify`, **`ai`** | 25 | Yes* |
| **Business** | **$39** (`3900` cents) | 1,200 | 3,000 | 10 | 3 | full | Yes | Yes | all three modes | 100 | Yes* |

\*`aiInsights` is in the catalog but **no feature in the repo is gated on it yet** — placeholder only.

### Stripe live IDs (synced)

| Plan | Product ID | Monthly price ID |
|------|------------|------------------|
| Starter | `prod_VPyNCYYsfFUdxI` | `price_1UP8QhKjM2RWgyrvrm1dl9SP` |
| Growth | `prod_VPyNNh2lJfsSr5` | `price_1UP8QiKjM2RWgyrv9t3acn3k` |
| Business | `prod_VPyNajS5pPWNu3` | `price_1UP8QiKjM2RWgyrvJnD8q7XX` |

Free has no Stripe price (`ar-stripe-catalog.ts`).

---

## AI Rescheduler “handling level” (modes)

Modes are **workspace settings**, **capped by plan** at runtime via `resolveArAiReschedulerConfigForWorkspace()`.

| Mode | Outbound SMS to recipient | Inbound from recipient |
|------|---------------------------|-------------------------|
| **`reminders_only`** | Template only; **no** appended C/R/X suffix | No confirm / reschedule / cancel automation |
| **`notify`** (Starter+) | Template + **canonical suffix appended at send** | C/R/X letter handling, staff notifications, request flows |
| **`ai`** (Growth+) | Same suffix as notify when SMS replies enabled | AI reschedule workflow; metered by `reserveArAiConversation` |

Canonical suffix strings live in `src/lib/appointment-reminders/ai-rescheduler/types.ts` / `ar-sms-action-policy.ts`.

**Template rule:** Stored templates (defaults, library, platform-locked bodies) should **not** contain reply CTAs. Reply lines are **strip**ped at send, then **append**ed only when plan allows SMS responses and mode is `notify` or `ai`.

---

## Who “has” Appointment Reminders (`hasProductAccess`)

From `resolveArWorkspaceCommercial(workspaceId)`:

| State | `planKey` | `hasProductAccess` |
|-------|-----------|---------------------|
| Active Stripe subscription (`active` / `trialing` / `past_due`) | starter / growth / business | **true** |
| Explicit free activation (`assignArFreePlan`, `arCommercialPlanKey: free` in workspace limits) | free | **true** |
| `TRANSOVO_AR_LEGACY_WORKSPACE_IDS` env allowlist | business | **true** (grandfather) |
| No activation, no paid sub, not on allowlist | free | **false** |

Shell / nav: `workspaceHasAppointmentReminders()` → `hasProductAccess` (platform admin bypass).

---

## Intended package story (subscriber-facing)

| Plan | What the **recipient** gets | What the **subscriber** gets |
|------|----------------------------|------------------------------|
| **Free** | One-way reminder text only | Calendar connect, 1 reminder step, tight SMS/email caps, no two-way SMS |
| **Starter ($9)** | Reminder + appended notify suffix | C/R/X handling, staff notifications, 3 steps, full timing |
| **Growth ($19)** | Same when in notify; AI when mode = `ai` | AI reschedule (25 AI convos/mo), 3 calendars |
| **Business ($39)** | Same | Higher caps, 10 calendars, 100 AI convos/mo |

---

## Feature gates — enforced in code today

| Capability | Free | Starter | Growth | Business | Enforcement location |
|------------|------|---------|--------|----------|----------------------|
| Product access | ✓ if activated | ✓ | ✓ | ✓ | `resolveArWorkspaceCommercial`, `workspaceHasAppointmentReminders` |
| Max enabled reminder steps | 1 | 3 | 3 | 3 | `validateReminderConfigForPlan` → `PATCH /api/appointment-reminders/settings` |
| Custom reminder timing | basic | full | full | full | same |
| Max imported calendars | 1 | 1 | 3 | 10 | `assertImportCalendarCountAllowed` → calendar import patch (`ar-calendar-limits.ts`) |
| Outbound SMS quota | 25 seg/mo | 200 | 500 | 1200 | `reserveArReminderSmsUnit` (reminder delivery, customer SMS jobs, etc.) |
| Outbound email quota | 100 | 500 | 1500 | 3000 | `reserveArReminderEmailUnit` (`reminder-engine.ts`) |
| Two-way SMS (suffix + inbound pipeline) | **No** | Yes | Yes | Yes | `workspaceAllowsSmsCustomerResponses` → `handle-inbound-body.ts`, `buildReminderSmsBodyForOutbound` in `reminder-delivery.ts` |
| Save AI mode `ai` in settings | No | No | Yes | Yes | `assertAiReschedulerModeAllowed` → `PATCH /api/appointment-reminders/ai-rescheduler` |
| AI conversation metering | 0 | 0 | 25/mo | 100/mo | `reserveArAiConversation` → `inbound-follow-up.ts` (mode must be `ai`) |
| Staff-notified public email R/C | No | Yes* | Yes* | Yes* | `publicEmailActionsUseStaffRequestWorkflow` — needs `staffNotifiedRescheduleCancel` + mode ≠ `reminders_only` |

\*Depends on workspace **mode** in settings, not plan alone.

### Runtime mode cap (important)

Even if settings say `notify` or `ai`, **Free** is forced to `reminders_only` for send/inbound via `resolveArAiReschedulerConfigForWorkspace()`.

Default new workspace platform config still sets `aiRescheduler.mode: "notify"` in `DEFAULT_PLATFORM_CONFIG` (`src/lib/appointments/types.ts`) — runtime caps Free; UI may show notify until settings are aligned.

---

## Feature gates — defined but NOT wired (gaps)

Functions in `ar-feature-gates.ts` with **no callers** outside that file:

- `requireArProductAccess()`
- `assertSmsCustomerResponsesAllowed()` (message is app-only: “Upgrade in Plan & billing” — correct audience, but unused)
- `assertStaffNotifiedFlowsAllowed()`

Other gaps:

1. **AI Rescheduler UI** (`ar-ai-rescheduler-opus.tsx`) does not disable Notify/AI by plan; API only blocks illegal **`ai`** save on lower tiers — **notify may still be saved on Free** while runtime ignores it.
2. **`aiInsights`** — catalog flag only, no gates.
3. **Pricing UI** (`ar-pricing-page.tsx`) — lists caps but not one-way vs notify vs AI.
4. **`inbound-replies.ts`** uses uncapped `resolveAiReschedulerConfig(platform)` in places; safe today only because `handle-inbound-body` exits early when Free — fragile if new inbound entry points are added.
5. **AI quota exhausted:** recipient may get a neutral auto-reply (“assistant unavailable… team will follow up”) — not an upgrade pitch; paid AI path only.

---

## Customer flows (billing)

- Pricing: `/appointment-reminders/pricing`
- Free activation: `POST /api/appointment-reminders/billing/free` → `assignArFreePlan`
- Paid: Stripe Checkout / `change-plan` / portal (see `docs/AR-COMMERCIAL-LAUNCH-COMPLETION.md`)
- Cancel paid → may fall back to `assignArFreePlan` after period end

---

## Key files (quick index)

| Area | Path |
|------|------|
| Plan definitions | `src/lib/appointment-reminders/commercial/ar-plan-catalog.ts` |
| Workspace plan + access | `src/lib/appointment-reminders/commercial/ar-workspace-plan.ts` |
| Plan capabilities snapshot | `src/lib/appointment-reminders/commercial/ar-plan-capabilities.ts` |
| Gates | `src/lib/appointment-reminders/commercial/ar-feature-gates.ts` |
| Mode cap at runtime | `src/lib/appointment-reminders/commercial/ar-ai-rescheduler-plan.ts` |
| Outbound SMS body | `src/lib/appointments/reminder-delivery.ts` (`buildReminderSmsBodyForOutbound`) |
| Strip reply CTAs from text | `src/lib/appointment-reminders/sms-reply-instructions.ts` |
| Inbound AR SMS | `src/lib/appointment-reminders/messaging/handle-inbound-body.ts` |
| Template library (no reply CTAs in bodies) | `docs/transovo_reminder_templates.md` → `template-library/transovo-reminder-templates.json` |
| Billing snapshot API | `GET /api/appointment-reminders/billing` → `ar-billing-snapshot.ts` |

---

## Verification checklist (manual)

1. **Free workspace:** send test reminder → body has **no** Reply C/YES/X lines; if recipient texts back → **no** outbound SMS from Transovo.
2. **Starter:** reminder includes **one** appended notify suffix at end; C/R/X inbound handled.
3. **Growth** with mode `ai`: AI follow-up works until monthly AI conversation cap.
4. **Subscriber** on Free trying to enable AI in settings → API error (app), not SMS to patients.
5. Search codebase for patient-facing upgrade copy — should be **empty** (grep: `Upgrade to Starter`, `aren't included on the Free plan`).

---

## Related docs

- `docs/AR-COMMERCIAL-LAUNCH-COMPLETION.md` — Stripe, metering, launch checklist
- `docs/AR-CUSTOMER-LAUNCH-STATUS-2026-10-10.md` — end-to-end journey audit (if present on branch)
