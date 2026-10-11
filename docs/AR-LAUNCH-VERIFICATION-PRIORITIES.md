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

## P2b — “I’m running 20 minutes late” on Starter (`notify`)

**Product promise:** Businesses see **verbatim customer text** on **Responses**, tied to the appointment when possible, with **staff notified** — **no** automated SMS back in notify mode. Reuses existing `conversationMessage` storage; **does not** duplicate C/R/X rows (structured letters are handled before the free-text path).

### Code status (launch branch — not prod sign-off)

| Step | Expected behavior (after PR #635) |
|------|-------------------------------------|
| `acceptArInboundSmsIngress` | Inbound stored on AR-tagged `conversationMessage`. |
| C / R / X | Structured handlers only; **no** duplicate `customer_message` outcome. |
| Free text, `notify` mode | `tryRecordNotifyModeFreeTextReply` → `ar_sms_outcome_customer_message` on appointment, `notifyWorkspace`, **no** outbound auto-reply. |
| **Responses** feed | `loadRecentArCustomerResponses` → kind **`replied`** with message snippet (`bodyPreview` on feed row). |
| **AI mode** (`Growth`+) | Free text may enter AI follow-up first; different path — P3 covers AI. |

**Marketing:** Treat as **implemented in code** until P2b **PASS** below. Do not claim “never miss a reply” in production copy until signed off.

### P2b production test (required)

After Starter reminder, text: `I'm running 20 minutes late.`

| # | Check | PASS |
|---|--------|------|
| 1 | **Responses** — row with verbatim preview | |
| 2 | **In-app notification** — “Customer replied to reminder” (or equivalent) | |
| 3 | Appointment detail — customer action / timeline shows inbound text | |
| 4 | Customer receives **no** automated SMS reply | |
| 5 | Underlying **conversation** still has inbound message (audit) | |

Record date, workspace ID, `commitSha`, PASS/FAIL.

---

## STOP / HELP on every plan (launch blocker)

**Requirement:** STOP/HELP on **all** plans (including **Free**), independent of notify/AI gates.

### Code status (launch branch — not prod sign-off)

| Item | Status |
|------|--------|
| `dispatchSharedPlatformSmsInbound` runs `handlePlatformSenderComplianceInbound` **before** AR routing | **Yes** (unconditional; not gated on MCTB flag) |
| STOP resolves AR workspaces via `listArWorkspaceIdsForPlatformStop` (sessions, assignments, AR conversations) | **Yes** |
| MCTB contexts still included via `loadPlatformMctbReplyContexts` when applicable | **Yes** |

**Marketing:** Treat as **implemented in code** until prod STOP/HELP **PASS** below.

### Production test (required)

From a phone that received an AR reminder on the **platform sender**:

1. **HELP** → help copy returned.  
2. **STOP** → opt-out recorded; further reminders suppressed for that contact/workspace.

Record date, workspace ID, `commitSha`, PASS/FAIL.

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
| Responses vs Conversations | Arbitrary SMS on Responses (notify) | **Coded** — verify **P2b** |
| STOP/HELP on AR-only platform ingress | AR workspace on STOP | **Coded** — verify prod STOP/HELP |

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

The question is not feature count vs competitors. It is whether **advantages we claim** — especially **seeing customer replies on Starter** and **compliance on every plan** — **match production behavior**. **Structured C/R/X**, **notify-mode free-text (P2b)**, and **STOP/HELP** are **implemented on the launch branch**; **prod runbook PASS** is still required before final GTM copy. No new product scope — complete the workflow already wired (conversation storage + Responses outcomes + existing notifications).
