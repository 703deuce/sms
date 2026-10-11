# Appointment Reminders — launch verification priorities (frozen scope)

**Date:** 2026-10-11  
**Stance:** Product scope is **frozen** for launch (no Calendly/GoReminders feature expansion). Work is **verify**, **minor correction**, and **honest positioning**.

**Related:** `docs/AR-LAUNCH-READINESS-NOW.md`, `docs/AR-PLAN-PACKAGES-AND-GATES.md`

---

## Assessment alignment (code + docs — not independent prod test)

| Area | Status |
|------|--------|
| Core product (M365 → remind → inbound) | **Built in code** |
| Pricing + Stripe | **Implemented** (live price IDs committed) |
| Free / Notify / AI enforcement | **Mostly runtime-correct**; **UI/settings copy** still misaligned |
| Live end-to-end customer verification | **Not signed off** (your phone + card + prod) |

---

## Your priority order (launch runbook)

| P | Action | Pass criteria |
|---|--------|----------------|
| **1** | New **Free** workspace → Outlook → real reminder SMS | One-way body only; no reply CTAs; usage meter moves |
| **2** | **Starter** → C/R/X + staff notifications | Confirm/cancel/reschedule **structured** flows + in-app staff notify where coded |
| **3** | **Growth** → AI rescheduling | Mode `ai`; reply opens AI turn; AI conversation meter |
| **4** | Live **Stripe** checkout + entitlements | Checkout → webhook → billing tab matches plan limits |
| **5** | Fix **Free/Notify/AI** settings + pricing descriptions | UI matches `ar-plan-catalog.ts`; no false “notify on Free” |

**Also verify (compliance):** **STOP** and **HELP** on platform sender for **every** plan — see gap below.

---

## Competitive question: “I’m running 20 minutes late” on Starter (notify)

**What we want to promise:** Businesses see **what customers actually text**, not only C/R/X — a reason to choose Transovo over Cal.com SMS.

### What the code does today (Starter, `notify` mode)

| Step | Behavior |
|------|----------|
| Webhook → `acceptArInboundSmsIngress` | **Yes** — inbound SMS is stored as `conversationMessage` on an AR-tagged conversation (`productSource: APPOINTMENT_REMINDERS`, `unread: true`). |
| `handleAppointmentRemindersInboundBody` | **C/R/X / policy / yes** → handled; **free text** → `tryHandleArReminderFollowUp` runs only when mode is **`ai`** → on Starter **notify**, returns **`handled: false`**. |
| Auto-reply SMS to customer | **No** for unhandled free text (correct for “human reads it”). |
| **`/appointment-reminders/responses` feed** | Built from **`loadRecentArCustomerResponses`** → appointment **metadata outcomes** (`ar_sms_outcome_*`, cancel/reschedule structs, legacy `reminders_stopped_on_reply`). **Arbitrary free text does not create an outcome row.** |
| Staff `notifyWorkspace` | Used for **reschedule/cancel request** paths in `business-approval.ts` / public email actions — **not** called for unhandled notify-mode free text. |
| AR sidebar | **Responses** page exists; **no** primary nav link to shared **Conversations** (`/conversations`). |

### Honest positioning until verified/fixed

- **Today:** “Running 20 minutes late” is **likely persisted on the AR SMS conversation thread** (backend), but **not** surfaced as a first-class row on **Responses** and **not** guaranteed to trigger a **staff notification** on Starter notify-only.
- **Starter’s strong suit in code today** is **structured** C/R/X + staff-notified **change requests**, not general inbox parity.
- **Growth `ai` mode:** free text can enter **AI follow-up** (`tryHandleArReminderFollowUp`) — still not the same as “show verbatim message on Responses.”

### Launch verification item (add to P2)

After Starter reminder, text: `I'm running 20 minutes late.` Then check:

1. **Responses** — does it appear? (expect **no** today unless other metadata exists)  
2. **Conversations** (`/conversations`, filter if any) — does thread show inbound body?  
3. **In-app notification** — any alert to workspace users?  
4. Appointment detail **customer action history** — does it list the message?

Record PASS/FAIL. If FAIL on Responses/notify, either **fix before marketing** (record outcome + notify on notify-mode unhandled inbound) or **narrow sales copy** to structured replies + Conversations.

---

## STOP / HELP on every plan (critical compliance gap)

**Requirement:** STOP/HELP must work on **all** plans, independent of Free vs paid feature gates.

**Code finding:** `dispatchSharedPlatformSmsInbound` only calls `handlePlatformSenderComplianceInbound` when `isPlatformSharedSmsMctbInboundEnabled()` is true.

With **`APPOINTMENT_REMINDERS_V1_PRIMARY`** (current launch), that flag is **`false`** → compliance handler is **skipped** → STOP/HELP may **not** run on the shared platform toll-free path.

Even when compliance runs, `handlePlatformSenderComplianceInbound` resolves opt-out workspaces via **`loadPlatformMctbReplyContexts`** (MCTB `productSource` only), not **`APPOINTMENT_REMINDERS`** sessions — AR-only threads may not get correct workspace suppression.

**Launch verification:**

1. From a phone that received an AR reminder, text **HELP** → expect help copy.  
2. Text **STOP** → expect opt-out; further reminders suppressed for that contact/workspace.

**Engineering (minor, not scope expansion):** Always run platform STOP/HELP before AR routing; include **AR reply-session workspace** in opt-out resolution for platform sender.

---

## Business ($39) — no new features

Launch on **volume + calendars** only (already in catalog):

| | Growth $19 | Business $39 |
|--|------------|--------------|
| SMS segments/mo | 500 | 1,200 |
| Emails/mo | 1,500 | 3,000 |
| Import calendars | 3 | 10 |
| AI conversations/mo (optional) | 25 | 100 |

AI does **not** need to be enabled for Business to be justified.

---

## Minor corrections (frozen scope — no new product areas)

| Item | Issue | Target |
|------|--------|--------|
| AI Rescheduler UI | Free/Starter can still **select** notify/ai in UI | Disable/hide by `resolveArPlanCapabilities` |
| Default `aiRescheduler.mode: notify` | Confusing on Free | Default Free to `reminders_only`; API reject `notify` on Free |
| Pricing / landing copy | Doesn’t spell one-way vs notify vs AI | Match `AR-PLAN-PACKAGES-AND-GATES.md` |
| Responses vs Conversations | Arbitrary SMS not on Responses | Fix or document; verify P2 |
| STOP/HELP on AR-only platform ingress | Compliance skipped | Wire + AR workspace on STOP |

---

## What “launch PASS” means (single signature)

One **new** production workspace each for Free, Starter, Growth (or Starter + Growth if time-boxed), plus:

- [ ] P1 Free SMS one-way  
- [ ] P2 Starter C/R/X + staff paths  
- [ ] P2b Starter arbitrary reply visibility (document result)  
- [ ] P3 Growth AI (if sold)  
- [ ] P4 Stripe paid + entitlements  
- [ ] STOP + HELP on platform sender  
- [ ] P5 UI/pricing alignment committed or ticketed with known copy  

Sign-off block: date, `commitSha` from `/api/health`, tester, workspace IDs.

---

## Bottom line

The question is not feature count vs competitors. It is whether **advantages we claim** — especially **seeing customer replies on Starter** and **compliance on every plan** — **match runtime behavior**. Code review suggests **structured Starter flows are real**; **verbatim free-text on Responses + staff alert on notify** and **STOP/HELP under AR-only launch** need **prod verification and likely small fixes** before marketing says otherwise.
