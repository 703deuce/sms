# Appointment Reminders — competitive packaging notes (launch)

**Date:** 2026-10-11  
**Purpose:** Align GTM/pricing narrative with competitors and with `ar-plan-catalog.ts`. **No scope expansion** for launch — verify and position what exists.

**Catalog source of truth:** `src/lib/appointment-reminders/commercial/ar-plan-catalog.ts`  
**Plan gates:** `docs/AR-PLAN-PACKAGES-AND-GATES.md`  
**Verification:** `docs/AR-LAUNCH-VERIFICATION-PRIORITIES.md`

---

## Transovo catalog (current code)

| Plan | Price | SMS segments / mo | Emails / mo | Import calendars | Reminder steps | Two-way SMS (C/R/X + inbound handling) | AI reschedule |
|------|-------|-------------------|-------------|------------------|----------------|----------------------------------------|---------------|
| Free | $0 | 25 | 100 | 1 | 1 | **No** (one-way outbound only) | No |
| Starter | $9 | 200 | 500 | 1 | 3 | **Yes** (`notify`) | No |
| Growth | $19 | 500 | 1,500 | 3 | 3 | Yes | **Optional** (`ai`, 25 AI convos/mo) |
| Business | $39 | 1,200 | 3,000 | 10 | 3 | Yes | **Optional** (`ai`, 100 AI convos/mo) |

**Metering:** Outbound reminder and customer auto-reply SMS consume **segments** via `reserveArReminderSmsUnit` (GSM-7 vs Unicode can be **>1 segment** per message). Starter **notify** suffix adds characters → slightly higher segment use per reminder.

---

## Competitor patterns (summary)

### AppointmentReminder.com — capacity tiers without mandatory AI

Published tiers (~$29 / $49 / $89 / $150) scale **reminder volume** (400 → 3,200/mo) while keeping **two-way SMS, unlimited calendars, team, workflows** on every paid plan. Higher price ≠ more “communication capability” — it’s **more sends**.

**Implication for Transovo Business ($39):** Justify with **volume + calendars (+ optional AI)**, not “Business must use AI.” A customer can pay $39 for **1,200 segments and 10 calendars** in `reminders_only` or `notify` mode.

### Reminderly — usage calculator

Pay by message/call/email volume rather than named tiers. Different GTM; not a reason to add tiers pre-launch.

### GoReminders / Apptoto (launch lens)

- **GoReminders:** Reply **visibility** at low tier — Transovo must **prove or fix** Starter story vs structured C/R/X only (`AR-LAUNCH-VERIFICATION-PRIORITIES.md` P2b).
- **Apptoto:** Broader product (voice, inbox, integrations). Transovo launch = **calendar-first reminders**, not parity with full Apptoto.

---

## How to sell Transovo plans (recommended framing)

| Plan | Primary value | Who upgrades |
|------|----------------|--------------|
| **Free** | Automatic one-way reminders | Try core outbound SMS without paid commitment |
| **Starter $9** | Customer **response handling** (C/R/X, staff-notified changes) | Catch cancellations/changes; far below $29+ competitors |
| **Growth $19** | More segments, **3 calendars**, optional AI | Growing practice; AI optional |
| **Business $39** | **10 calendars**, highest segment pool, team-scale ops | Larger org — **AI optional** |

**Do not** position Business as “the AI plan.” Position it as **capacity + calendars**, with AI available.

---

## SMS segments vs “how many appointments?” (conversion risk)

Competitors often quote **reminders/month**; Transovo quotes **SMS segments/month**. They are not 1:1.

**Pricing page requirement:** State clearly that plans are metered in **SMS segments**, not “appointments” or “reminders.” A competitor’s “400 reminders” is not directly comparable to Transovo’s “200 segments” without knowing reminders-per-appointment and segments-per-message.

**Rough planning math (ideal case):**

- Assume **1 segment** per outbound reminder SMS (GSM-7, short template; **notify suffix on Starter+ increases length**).
- **Free** allows **one reminder step** only — do **not** divide Free segments by three.
- Paid plans may enable up to **three steps** per appointment; appointment capacity depends on how many steps you send per visit.

| Plan | SMS segments/mo | 1 SMS per appointment | 2 SMS per appointment | 3 SMS per appointment |
|------|-----------------|----------------------|----------------------|----------------------|
| **Free** | 25 | **25** | Not available (1 step max) | Not available |
| **Starter $9** | 200 | 200 | 100 | **66** |
| **Growth $19** | 500 | 500 | 250 | **166** |
| **Business $39** | 1,200 | 1,200 | 600 | **400** |

These are **theoretical maximums** before multi-segment Unicode messages, notify suffix length, and automated **outbound** replies (C/R/X acks, AI, approval SMS, tests) consume the allowance. **Inbound SMS does not** increment the segment meter.

**Before changing tiers:** instrument prod usage (median segments per step + reply rate). Upgrade pressure from volume is **by design** — explain segments on pricing, not only competitor headline numbers.

Optional post-launch (not launch scope): segment **pack add-on** or higher Business tier — only if usage data supports it.

---

## Where Transovo is strong (launch message)

- **Price:** $9 with response handling vs $29+ entry competitors.
- **AI optional** on Growth/Business — unlike “AI tier” positioning.
- **Free** real product (not time-limited trial) — one-way reminders.
- **Microsoft-first** workflow for businesses already on Outlook (no full scheduling platform required).

## Two upgrade axes (capacity vs capability)

Customers upgrade for **independent** reasons:

1. **Capacity** — more SMS segments, emails, import calendars.
2. **Capability** — on paid plans, **see and act on customer responses** (C/R/X + free-text in notify mode); optional AI on Growth/Business only.

A Business customer may pay **$39 for ten calendars and 1,200 segments** with AI **disabled**. Do not make AI the centerpiece of Business positioning.

## Launch claims vs verification (Starter free-text)

| Claim | Code (PR #635 branch) | Production (P2b runbook) |
|-------|------------------------|---------------------------|
| Arbitrary SMS stored on AR conversation | Yes (`acceptArInboundSmsIngress`) | Verify |
| `customer_message` outcome + **Responses** row | Yes (`handle-notify-customer-message.ts`) | Verify |
| Staff alert (`notifyWorkspace`) | Yes | Verify |
| No auto-reply in **notify** mode | Yes (`handled: false`) | Verify |

**Do not** market “never miss a reply” until **P2b PASS** is recorded in `AR-LAUNCH-VERIFICATION-PRIORITIES.md`.

## Where to be honest / verify

- **Starter vs GoReminders / Cal.com:** Structured C/R/X was already coded; **verbatim free-text** is **implemented in code** — **prod P2b required** before final pricing copy.
- **Calendar limits** vs “unlimited” competitors — intentional; sell **10 calendars on Business** for multi-provider teams, not unlimited.
- **Voice reminders** — not launch; don’t compare to Apptoto voice on day one.

---

## Decision (frozen launch)

- **Keep** $0 / $9 / $19 / $39 and feature split in `ar-plan-catalog.ts`.
- **Do not** add competitor feature parity (voice, unlimited calendars, workflows builder) pre-launch.
- **Do:** prod verification per `AR-LAUNCH-VERIFICATION-PRIORITIES.md` (P2b + STOP/HELP); plan UI copy alignment (P5). Final functional corrections before launch: **(1)** Starter+ arbitrary reply visibility + notify, **(2)** STOP/HELP on AR-only platform sender — both **in code** on launch branch; **sign off in prod**.
