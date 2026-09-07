# Transovo V1 — Appointments Platform Scope (Mode 4 Authority)

**Status:** Active — **highest product-scope authority for Kimi Mode 4**  
**Audience:** Kimi Mode 4, Cursor orchestration  
**Supersedes:** Any stale passages in `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` that reference MCTB, standalone Compliance, standalone Numbers, mass SMS, Grow, Campaigns, legacy `/voice/**`, or pre–10-domain IA.

**Governance:** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`  
**Page allowlist:** `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`  
**Nav flags (code):** `src/lib/products/v1-launch-nav.ts`  
**Canonical IA (code):** `src/lib/products/appointments-nav.ts`

---

## What Transovo is (current customer-facing product)

Transovo is an **appointments and scheduling platform** for businesses that need:

- calendar and list views of appointments
- booking types, booking pages, and availability
- appointment SMS reminders and automation workflows
- shared Messages (inbox) with appointment context
- contacts tied to appointments
- meetings (notetaker recaps)
- payments for appointments (where enabled)
- operational analytics
- integrations and workspace settings

This is **one coherent product** — not a collection of legacy SMS marketing, telephony, or growth tools.

---

## Launch products IN SCOPE for Mode 4 UI rebuild

Per `v1-launch-nav.ts` and the 57-surface manifest:

| Product area | In Mode 4 rebuild | Notes |
|--------------|-------------------|-------|
| Appointments / Scheduling | **Yes** | Calendar, list, waitlist, recalls, detail, create |
| Appointment SMS reminders | **Yes** | Reminder sequences, workflow steps |
| Conversations (Messages) | **Yes** | `/conversations` — appointment-context inbox |
| Contacts | **Yes** | Lists, segments, fields, imports |
| Booking (types, pages, availability, AI booking, routing, polls) | **Yes** | |
| Automations (reminders, workflows, templates, activity) | **Yes** | Appointment workflows — not mass-SMS drip builder |
| Meetings (upcoming + recaps) | **Yes** | |
| Payments (transactions) | **Yes** | |
| Analytics (operational) | **Yes** | Appointment/booking/reminder/automation metrics |
| Integrations | **Yes** | Calendars, payments |
| Settings | **Yes** | Business, team, messaging, calendar, meetings, security, billing |
| Public booking + token actions | **Yes** | Book, confirm, cancel, reschedule, waitlist accept |
| Help / Getting started | **Yes** | |

---

## Explicitly OUT OF SCOPE for Mode 4 UI rebuild

**Do not create, preserve, surface, route to, or visually incorporate these in Mode 4 jobs** — even if code exists in the repo:

| Excluded area | Examples | Flag / reason |
|---------------|----------|---------------|
| **Missed Call Text Back (MCTB)** | `/voice/missed-calls`, `/voice/setup`, MCTB onboarding | `MISSED_CALL_TEXT_BACK_IN_V1_NAV = false` |
| **Mass SMS marketing** | `/campaigns`, `/send`, drip broadcast builder | `MASS_MESSAGING_IN_V1_NAV = false` |
| **Grow / lead capture** | `/grow/**` keywords, forms, QR, popups | Hidden from appointments nav |
| **Legacy SMS automations** | `/automations` mass-SMS flow builder | `AUTOMATIONS_IN_V1_NAV = false` |
| **Playbooks** | `/playbooks` | `PLAYBOOKS_IN_V1_NAV = false` |
| **AI Receptionist / voice agents** | `/voice/agents/**` | `AI_RECEPTIONIST_IN_V1_NAV = false` |
| **Smart Routing** | `/smart-routing/**` | `SMART_ROUTING_IN_V1_NAV = false` |
| **Standalone Compliance page** | `/compliance` as primary nav | `COMPLIANCE_IN_V1_NAV = false` — consent in-context per standards |
| **Standalone Numbers marketplace** | `/numbers`, `/numbers/buy` | `NUMBERS_IN_V1_NAV = false` — sender config under Settings/Messaging |
| **Legacy dashboard** | `/dashboard`, `/sms/**` | Replaced by `/appointments/overview` |

**Preserved in repo ≠ in scope for rebuild.** Backend/routes may exist for safety; Mode 4 must not reactivate them in customer-facing UI.

---

## Canonical global IA (10 work domains)

From `src/lib/products/appointments-nav.ts` — **do not invent additional top-level areas**:

1. **Home** — `/appointments/overview`
2. **Appointments** — Calendar · List · Waitlist · Recalls
3. **Booking** — Booking Types · Booking Pages · Availability · AI Booking · Routing · Meeting Polls
4. **Contacts** — `/contacts` (+ lists, segments, fields, imports as reachable surfaces)
5. **Messages** — `/conversations` (+ saved replies)
6. **Automations** — Reminder Sequences · Workflows · Templates · Activity
7. **Meetings** — Upcoming (`/video`) · Recaps (`/meetings`)
8. **Payments** — Transactions
9. **Analytics** — Overview · Booking · Reminders · Automations · Reports
10. **Integrations** — Calendars · Payments
11. **Settings** — Business · Team · Messaging · Calendar · Meetings · Security · Billing

Plus **Help** (`/getting-started`).

Local navigation within each domain is governed by `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`.

---

## Per-page feature authority

Detailed per-page requirements remain in `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` **sections 6–17, 21–23, 27, 32** (appointments, booking, conversations, contacts, analytics, settings, integrations, public booking).

**Ignore for Mode 4** in that same file:

- §3 (obsolete nav table — use this document + `appointments-nav.ts`)
- §18 Missed Call Text Back
- §19 Numbers (standalone)
- §20 Compliance (standalone page)
- MCTB metrics in §21 Analytics
- MCTB onboarding track in §28
- MCTB positioning in §31
- MCTB implementation steps in §33
- Appendix A rows for MCTB, Campaigns, Grow, legacy automations

---

## Domain engines (reuse — do not recreate in UI)

| Engine | Location | UI consumes |
|--------|----------|-------------|
| Appointments / calendar | `src/lib/agents/appointment-booking/**`, appointments APIs | Calendar, list, detail |
| Reminders | `src/lib/jobs/*`, messaging dispatch | Reminder sequences |
| Appointment workflows | `src/lib/appointment-workflows/**` | `/appointments/workflows` |
| Messaging / inbox | `src/lib/messaging/**`, inbox components | `/conversations` |
| Contacts | contacts APIs + components | `/contacts/**` |
| Booking public | public book routes | `/book/[slug]` |
| Payments | payments APIs | `/payments/transactions` |

See `docs/appointments-workflows-architecture.md` for workflow UI surfaces.

---

## Mode 4 conflict resolution rule

If any document in the standards pack conflicts with this scope document or `TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`:

**This document + Governance win.**

Kimi must not follow instructions to build MCTB UI, mass-SMS UI, Grow UI, standalone compliance/numbers pages, or legacy nav — even when quoted verbatim from older specs.

---

## Art direction vs product scope

Campaign and Inbox reference videos establish **visual polish only**. They must never import competitor product structure, Campaigns navigation, or Grow features into Transovo.
