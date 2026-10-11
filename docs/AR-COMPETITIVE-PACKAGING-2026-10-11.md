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

**Rough planning math (ideal case):**

- Assume **1 segment** per outbound SMS (GSM-7, short template; **notify suffix on Starter increases length**).
- **3 enabled steps** per appointment ≈ **3 segments** per appointment per cycle (confirmation + 24h + 2h — actual config varies).

| Plan | Segments | ≈ Appointments/mo @ 3 single-segment SMS each | Caveat |
|------|----------|-----------------------------------------------|--------|
| Free | 25 | ~**8** (only **1** step allowed on Free) | One-way only |
| Starter | 200 | ~**66** | + auto-replies + multi-segment Unicode |
| Growth | 500 | ~**166** | |
| Business | 1,200 | ~**400** | Matches your AppointmentReminder.com mental model at 3× SMS |

**Also consumes segments:** automated **outbound replies** (C/R/X flows, AI replies), business-approval SMS, tests. **Inbound SMS does not** increment segment meter (outbound only).

**Before changing tiers:** instrument or sample prod: median segments per reminder step + reply rate on Starter. If real practices exceed ~66–166 appointments/mo on Starter/Growth, upgrade pressure is **by design** — document in pricing FAQ (“how we count segments”) rather than adding features.

Optional post-launch (not launch scope): segment **pack add-on** or higher Business tier — only if prod usage data supports it.

---

## Where Transovo is strong (launch message)

- **Price:** $9 with response handling vs $29+ entry competitors.
- **AI optional** on Growth/Business — unlike “AI tier” positioning.
- **Free** real product (not time-limited trial) — one-way reminders.
- **Microsoft-first** workflow for businesses already on Outlook (no full scheduling platform required).

## Where to be honest / verify

- **Starter vs GoReminders:** Free-text SMS in **notify** mode records `customer_message` on the appointment, surfaces on **Responses**, and sends `notifyWorkspace` — **verify P2b on prod** after deploy (`AR-LAUNCH-VERIFICATION-PRIORITIES.md`).
- **Calendar limits** vs “unlimited” competitors — intentional; sell **10 calendars on Business** for multi-provider teams, not unlimited.
- **Voice reminders** — not launch; don’t compare to Apptoto voice on day one.

---

## Decision (frozen launch)

- **Keep** $0 / $9 / $19 / $39 and feature split in `ar-plan-catalog.ts`.
- **Do not** add competitor feature parity (voice, unlimited calendars, workflows builder) pre-launch.
- **Do:** prod verification per `AR-LAUNCH-VERIFICATION-PRIORITIES.md`; fix STOP/HELP and plan UI copy; resolve Starter **reply visibility** story before claiming GoReminders-class inbox.
