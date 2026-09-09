# Appointments Page Classification Manifest (Batch 0)

**Status:** Living document — update before each implementation batch  
**Authority:** `docs/TRANSOVO-APPOINTMENTS-FINAL-PAGE-MANIFEST-IA-DIRECTIVE.md`  
**Rule:** Classify every route **before** touching UI. **KEEP** = hands off.

**Legend:** `→` = target canonical home after migration

---

## Classification summary

| Classification | Count (approx.) | Action |
|----------------|-----------------|--------|
| KEEP | 18 | No UI work unless explicitly reclassified |
| EXTEND | 14 | Add features in existing design language |
| REORGANIZE | 6 | Same page, better sections/local nav |
| SPLIT | 3 | New focused surfaces |
| MERGE | 22 | Move into canonical home, then retire source |
| RETIRE | 4 | Remove nav/route after merge verified |
| NEW | 12 | Create with Home art direction + blueprint |

---

## Home & shell

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/appointments/overview` | **KEEP** | Primary visual art-direction reference |
| `/appointments/setup` | **EXTEND** | Platform wizard — align copy with new IA labels only |
| `/getting-started` | **KEEP** | Help |

---

## Appointments (operational)

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/appointments/calendar` | **KEEP** | EXTEND only: slot-click create, colors, meeting indicators |
| `/appointments` (list) | **KEEP** | EXTEND: approval as filter/status |
| `/appointments/new` | **KEEP** | Staff create flow |
| `/appointments/[id]` | **EXTEND** | Reorganize sections per directive; no full redesign |
| `/appointments/waitlist` | **EXTEND** | Absorb waitlist priority from commerce |
| `/appointments/recalls` | **KEEP** | Operational queue |
| `/appointments/scheduled` | **MERGE** | → Contact history / appointment history |
| `/appointments/enterprise` | **RETIRE** | Legacy; hide from nav if not already |

---

## Booking — types (SPLIT — Batch 1 priority)

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/appointments/types` | **SPLIT** | → Lightweight landing: Meetings / Services / Classes / Workshops & Events |
| `/appointments/types` (editor) | **SPLIT** | → Four focused editors (not one mega conditional form) |
| `/appointments/classes` | **MERGE** | → Booking Types → Classes + class management (retire tab-shell duplicate) |
| `/appointments/categories` | **MERGE** | → Services → Manage Categories |

**First blueprint required:** Booking Types landing (`docs/appointments-page-blueprints/01-booking-types-landing.md`)

---

## Booking — pages & distribution

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/appointments/booking` | **EXTEND** | Canonical Booking Pages hub |
| `/appointments/booking/share` | **MERGE** | → Booking Pages → Share & Embed section |
| `/appointments/booking/branding` | **MERGE** | → Booking Pages → Branding section |
| `/appointments/booking/contracts` | **MERGE** | → Booking → Forms & Documents → Contracts |

---

## Booking — availability & capacity

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/appointments/availability` | **REORGANIZE** | Schedules / Special Dates / Booking Rules / Preferences / Diagnostics |
| `/appointments/staff` | **EXTEND** | Profile, services, availability, locations, calendar, color |
| `/appointments/locations` | **EXTEND** | Single location editor with all subsections |
| `/appointments/resources` | **MERGE** | → Booking → **Rooms & Equipment** (rename label) |

---

## Booking — forms, routing, polls

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| *(none)* Forms & Documents | **NEW** | `/appointments/booking/forms` or section under Booking |
| `/appointments/routing-forms` | **KEEP** | Booking → Routing |
| `/appointments/routing` | **RETIRE** | Legacy routing — redirect to routing-forms if needed |
| `/appointments/team-pages` | **KEEP** | Booking → Team Booking |
| `/appointments/polls` | **KEEP** | Booking → Meeting Polls |
| `/appointments/ai-booking` | **KEEP** | Booking → AI Booking |

---

## Packages & Sales (split from mega-page)

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/appointments/commerce` | **RETIRE** | SPLIT contents → real destinations; **do not use "Commerce" label** |
| `/appointments/service-booking` | **RETIRE** | Alias hub — remove after migration |
| `/appointments/pos` | **KEEP** or **EXTEND** | Packages & Sales → Point of Sale |
| *(none)* Packages | **NEW** | `/appointments/packages` (or under packages-sales group) |
| *(none)* Memberships | **NEW** | Dedicated memberships page |
| *(none)* Gift Cards | **NEW** | Dedicated gift cards page |
| *(none)* Products | **NEW** | Dedicated products page |
| `/appointments/coupons` | **MERGE** | → Packages & Sales → **Discounts** |
| Commerce → Programs | **V2** | MERGE into Packages if same object |
| Commerce → Loyalty | **V2** | → **Rewards** when surfaced |

---

## Payments

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/payments/transactions` | **KEEP** | Payments → Transactions |
| `/payments/invoices` | **KEEP** or **EXTEND** | Payments → Invoices |
| `/appointments/payments` | **REORGANIZE** | V2 payment plans only; product pricing stays in product editors |

---

## Contacts & customer data

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/contacts` | **KEEP** | Main contacts list |
| `/contacts/lists` | **KEEP** | |
| `/contacts/segments` | **KEEP** | Absorb `/appointments/segments` |
| `/appointments/segments` | **MERGE** | → Contacts → Segments |
| `/appointments/commerce/contact-merge` | **MERGE** | → Contacts (merge tool) |
| `/appointments/restrictions` | **MERGE** | → Contact Detail → Booking Access |
| `/appointments/client-restrictions` | **MERGE** | → same as restrictions |
| Commerce → households | **MERGE** | → Contacts → household on detail |
| Commerce → custom fields | **MERGE** | → Contacts → Fields |
| Commerce → import/export | **MERGE** | → Contacts Import / Analytics Reports |

---

## Automations

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/appointments/reminders` | **KEEP** | Automations → Reminders |
| `/appointments/voice-reminders` | **EXTEND** | Channel inside Reminders (not separate product area) |
| `/appointments/workflows` | **KEEP** | Automations → Workflows |
| `/appointments/workflows/new`, `[id]/edit`, `setup/[templateId]` | **KEEP** | Workflow builder surfaces |
| `/appointments/automations/templates` | **KEEP** | Automations → Templates |
| `/appointments/automations/activity` | **KEEP** | Automations → Activity |
| `/appointments/recall-campaigns` | **MERGE** | → Automations / Workflows |
| `/appointments/no-show-recovery` | **MERGE** | → Automations / Workflows |

---

## Messages · Meetings · Analytics

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/conversations` | **KEEP** | Messages → Inbox |
| `/video` | **KEEP** | Meetings → Upcoming |
| `/meetings` | **KEEP** | Meetings → Recaps |
| `/appointments/analytics` | **KEEP** | Analytics → Overview |
| `/appointments/analytics/booking` | **KEEP** | |
| `/appointments/analytics/reminders` | **KEEP** | |
| `/appointments/analytics/automations` | **KEEP** | |
| `/appointments/analytics/reports` | **KEEP** | Absorb service-booking reports |
| `/appointments/reports/service-booking` | **MERGE** | → Analytics → Reports |
| *(none)* Revenue | **NEW** | Analytics → Revenue (when backend ready) |

---

## Integrations & settings

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/integrations/calendars` | **KEEP** | Integrations → Calendars |
| `/integrations/payments` | **KEEP** | Integrations → Payments |
| `/appointments/integrations` | **EXTEND** | If used — align with global integrations |
| Commerce → webhooks | **MERGE** | → Integrations → Developer |
| `/settings/*` | **KEEP** | Org-wide only |

---

## Policies & contracts (parity temps)

| Current route | Classification | Target / notes |
|---------------|----------------|----------------|
| `/appointments/policies` | **MERGE** | → Service/Class/Workshop editors → Policies sections |
| `/appointments/contracts` | **MERGE** | → Forms & Documents → Contract Templates |

---

## Public / customer (reference — mostly KEEP runtime)

| Route | Classification | Notes |
|-------|----------------|-------|
| `/book/[slug]` | **EXTEND** | Public book — wire contextual flows only |
| `/book/[slug]/classes` | **KEEP** | Public class enrollment |
| `/book/[slug]/store` | **KEEP** | Public store |
| `/embed/book/[slug]` | **KEEP** | |
| `/manage/[token]` | **EXTEND** | Self-service |
| `/portal/[token]` | **EXTEND** | Client portal |
| `/contracts/sign/[token]` | **KEEP** | |
| `/pay/invoice/[token]` | **KEEP** | |

---

## Nav migration checklist

When a batch completes, update `src/lib/products/appointments-nav.ts`:

| From (current) | To (target label) |
|----------------|-------------------|
| Packages & Memberships → `/appointments/commerce` | **Packages & Sales** with children |
| Resources | **Rooms & Equipment** |
| Share & embed (top-level under Booking) | Section under Booking Pages |
| Contact merge under Booking | Contacts |
| Service booking report under Analytics | Reports only |
| Coupons | Discounts under Packages & Sales |

**Do not ship nav changes until destination pages work.**

---

## Batch 2A gate: Meetings list + editor

- [x] Blueprints: `02-meetings-list.md`, `03-meeting-editor.md`
- [x] Routes: `/appointments/types/meetings`, `/meetings/new`, `/meetings/[id]`
- [x] Legacy editor redirect for `segment=meetings`
- [ ] Browser UAT (Tests 1–9)

## Batch 1 gate: Booking Types landing

Before implementing Meetings/Services/Classes/Workshops editors:

- [x] Blueprint finalized: `docs/appointments-page-blueprints/01-booking-types-landing.md`
- [x] Screenshot baseline: legacy mega-editor at `/appointments/types` (pre-split)
- [x] Screenshot reference: `/appointments/overview`
- [x] Feature rows mapped from master inventory §2
- [x] Old editor route strategy: landing at `/appointments/types`; transitional editor at `/appointments/types/editor`; per-segment lists at `/appointments/types/{meetings,services,classes,workshops}`
- [x] Workshops domain: CLASS engine + `classPresentation` (`recurring_class` \| `workshop_event`) — no duplicate backend
- [x] Browser UAT pass (desktop, mobile, keyboard) — 2026-09-09

---

*Update this manifest when classification changes. Do not reclassify KEEP pages without explicit product approval.*
