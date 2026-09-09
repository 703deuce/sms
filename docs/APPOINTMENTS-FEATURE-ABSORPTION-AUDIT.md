# Appointments — Feature-to-Page Absorption Audit (Batch 8A)

**Status:** Discovery complete — audit only, no implementation
**Generated:** 2026-09-09
**Branch context:** Post Batch 7 (automations, analytics/reports, contacts canonicalization)

## Purpose

Reconcile every row in `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md` against the final IA. This is the authoritative gap list for the next implementation batch.

## Authority order applied

1. `docs/TRANSOVO-APPOINTMENTS-FINAL-PAGE-MANIFEST-IA-DIRECTIVE.md`
2. `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
3. `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md`
4. `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md`
5. `docs/APPOINTMENTS-PAGE-CLASSIFICATION-MANIFEST.md`
6. Page blueprints + existing code/UI (evidence only)

## Executive summary

| Metric | Count |
|--------|------:|
| Total inventory rows audited | 308 |
| V1 rows | 297 |
| V2 / deferred rows | 11 |
| Complete on final page (no UI work) | 11 |
| Extend existing page | 235 |
| Move from parity/temp | 23 |
| Public flow gaps | 34 |
| Portal flow gaps | 20 |
| Backend-ready / UI-missing | 184 |
| UI-present / backend-uncertain | 89 |
| Provider-blocked | 6 |
| Runtime-only (no admin UI) | 17 |
| Temp pages with unique V1 functionality | 29 |
| **Unassigned** | **0** |

Structured ledger: `docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv`
Implementation queue: `docs/APPOINTMENTS-EXISTING-PAGE-GAP-QUEUE.md`

### Quick-reference gap counts (existing pages)

Evidence from code/UI inspection (not browser UAT):

| Page | Gaps to absorb | Priority |
|------|---------------:|----------|
| Calendar | 7 | P1 — colors, filters, staff lanes, drag-reschedule, recurring display, availability overlays, blocked events |
| Appointment Detail | 9 | P0/P1 — phases, rooms, add-ons, intake files, package/membership credits, partial refund, recurring series UI, resource labels |
| Waitlist | 2 | P0 — priority rules admin UI; show priority rank in table |
| Home / Overview | 2 | P2 — decorative date picker; missing KPIs (approval, waitlist, unread) |
| Routing | 6 | P1 — live types/staff in rules, real analytics, public form link, submission log |
| Team Booking | 2 | P1 — hardcoded workspace slug in public URL; no live preview |
| Meeting Polls | 2 | P2 — mock residue; public poll link verification |
| POS | 5 | P1 — payment capture, wallet, coupon picker, tax, receipt/history |
| Public booking | 34 ledger rows | P0 — certify flows; many UA_PENDING not absorption |
| Customer portal | 20 ledger rows | P1 — depth on packages, wallet, payment methods |
| Transactions | 2 | P1 — refund UI depth; link to appointment |
| Settings → Meetings | 1 | P2 — video/notetaker defaults alignment |
| Contacts → Fields/Import | 3 | P0 — absorb commerce duplicates |

**Complete (no functional absorption needed):** Team Booking core CRUD, Meeting Polls admin shell, Reminders sequences (PASS), Analytics overview shell, POS session/cart foundation.

---

## Detailed page evidence (code inspection)

### Calendar (`/appointments/calendar`) — KEEP + 7 extensions

| Capability | Status | Evidence |
|------------|--------|----------|
| Slot-click create | **Present** | `calendar-connected.tsx` → `/appointments/new?startsAt=` |
| Meeting/video indicators | **Present** | `CalendarMeetingBadges`, meeting-indicators API |
| Current time indicator | **Present** | `nowLine` in week/day views |
| Staff/service colors from config | **Missing** | Hardcoded `TYPE_COLORS` name heuristics only |
| Class/event indicators | **Missing** | Classes render as generic appointments |
| Filters (staff/service/location) | **Missing** | No filter UI or fetch params |
| Multi-staff columns | **Missing** | Single lane calendar |
| Drag-reschedule | **Missing** | Click-to-open only |
| Recurring series on grid | **Missing** | Banner link only; no series badge |
| Availability overlays | **Missing** | No working-hours overlay |
| Blocked/busy events | **Missing** | External busy not visualized |

### Appointment Detail (`/appointments/[id]`) — EXTEND + 9 gaps

| Capability | Status | Evidence |
|------------|--------|----------|
| Multi-service lines | **Present** | `serviceLines[]` in detail mapper |
| Policy snapshot | **Partial** | `readPolicySnapshot` — display incomplete |
| Payment/deposit/refund | **Partial** | Refund button; no partial/wallet |
| Reminders + timeline | **Present** | `ReminderSchedule`, suppress toggle |
| Meeting join / notetaker | **Present** | `VideoMeetingPanel`, `NotetakerPanel` |
| Internal notes + activity | **Present** | PATCH notes, `metadata.timeline` |
| Phases/processing time | **Missing** | No phase timeline |
| Rooms/equipment | **Missing** | `resourceLabels` not mapped to UI |
| Add-ons on record | **Missing** | `addOnLabels` in metadata, not shown |
| Intake file uploads | **Missing** | Generic booking answers only |
| Package/membership credits | **Missing** | No ledger/credit display |
| Recurring series UI | **Missing** | No series scope actions |

### Commerce parity hub (`/appointments/commerce`) — 26 sections, 29 temp rows

Hub still holds unique V1 functionality for: Products, Gift certificates, Memberships, Loyalty, Add-ons, Seat maps, Programs, Processing phases, Households, Intake forms, Terms, Wallet, Referral, Webhooks, Invoices, and partial duplicates of migrated surfaces. See ledger `TEMP_PARITY_EXISTS=YES` rows. **Do not retire** until each section is absorbed into final canonical page.

### Parity cross-check (`APPOINTMENTS-FEATURE-SPLIT-ORIGINAL-VS-PARITY.md`)

Every Part B parity feature has a ledger row. Rows with `MOVE_INTO_EXISTING_PAGE` and `TEMP_PARITY_EXISTS=YES` are the highest-risk “polished original + temp parity never moved” set — **23 features** in this state.

---

## Final gap grouping

### A. NO CHANGE REQUIRED

**/appointments/analytics** (1): Analytics overview
**/appointments/analytics/reports** (1): Scheduled analytics report email
**/appointments/automations/no-show** (1): No-show scan
**/appointments/availability** (5): Weekly hours editor; Timezone; Minimum booking notice; Maximum booking horizon; Booking limits (daily/weekly/per-type)
**/appointments/calendar** (1): Reminder suppress / reset
**/appointments/overview** (1): Appointments overview (Home)
**/appointments/pos** (1): POS cart (session + line items)
**/appointments/reminders** (2): Reminder sequences; Voice reminder retry
**/appointments/waitlist** (1): Waitlist notify
**/appointments/workflows** (2): Workflow step execution; Workflow time scans / triggers
**/integrations/calendars** (1): Webhook deliver / sweep
**/settings/security** (1): Granular appointment permissions
**RUNTIME_ONLY** (7): Per-staff external calendar; Provider calendar sync; Platform reminder scan; Scheduled email reports; Provider appointment sync/cancel/reschedule…
**SHELL_RUNTIME** (3): Primary product nav; Progressive disclosure modules; V1 launch nav gating

### B. EXISTING PAGE — SMALL ADDITIONS (sample)

#### /appointments/[id]
- Policy snapshot on record: Backend writes snapshot; detail display may be partial
#### /appointments/automations/no-show
- No-show scan job: Backend exists; admin/contextual UI not exposed on final page
#### /appointments/availability
- Custom start interval: Backend exists; admin/contextual UI not exposed on final page
- Minimize gaps / compact scheduling: Backend exists; admin/contextual UI not exposed on final page
- Group / collective scheduling: Backend exists; admin/contextual UI not exposed on final page
- Resource-constrained slots: Backend exists; admin/contextual UI not exposed on final page
- Atomic slot booking: Backend exists; admin/contextual UI not exposed on final page
#### /appointments/booking/forms
- Formal contracts + e-signature: API-first; Forms & Documents page may be thin
#### /appointments/booking/rooms-equipment
- Resource pools (any-one-in-group): Backend exists; admin/contextual UI not exposed on final page
#### /appointments/calendar
- Staff / service calendar colors: Heuristic colors only; not tied to type color config
#### /appointments/gift-cards
- Gift certificates: Absorb from parity hub into final IA page
#### /appointments/memberships
- Membership products: Absorb from parity hub into final IA page
- Membership lifecycle (pause/cancel/past_due): Backend exists; admin/contextual UI not exposed on final page
- Membership failed-payment suspension: Backend exists; admin/contextual UI not exposed on final page
- Membership payment recovery / entitlement restore: Backend exists; admin/contextual UI not exposed on final page
#### /appointments/packages
- Package products: Absorb from parity hub into final IA page
- Package lifecycle (restore on cancel): Backend exists; admin/contextual UI not exposed on final page
- Package credit forfeiture (late cancel / no-show): Backend exists; admin/contextual UI not exposed on final page
- Policy fees (late cancel / no-show): Backend exists; admin/contextual UI not exposed on final page
#### /appointments/pos
- Booking approval queue: Backend exists; admin/contextual UI not exposed on final page
- Booking source / UTM attribution: Backend exists; admin/contextual UI not exposed on final page
- Resource persist on book: Backend exists; admin/contextual UI not exposed on final page
- POS mixed checkout (service + package + membership + gift + product + discount + tip): Absorb from parity hub into final IA page
#### /appointments/products
- Products for sale: Absorb from parity hub into final IA page
#### /appointments/reminders
- ICS attachments: Backend exists; admin/contextual UI not exposed on final page
- Email open / click tracking: Backend exists; admin/contextual UI not exposed on final page
- Voice reminder retry job: Backend exists; admin/contextual UI not exposed on final page
#### /appointments/staff
- Staff round-robin state: Backend exists; admin/contextual UI not exposed on final page
#### /appointments/types
- Single-use booking links: Backend exists; admin/contextual UI not exposed on final page
#### /appointments/types/classes
- Class check-in (QR): Backend exists; admin/contextual UI not exposed on final page
- Seat selection / maps: Backend exists; admin/contextual UI not exposed on final page
- Event admission tickets: Backend exists; admin/contextual UI not exposed on final page
#### /appointments/waitlist
- Waitlist slot notification: Backend exists; admin/contextual UI not exposed on final page
- Waitlist auto-fill on cancel: Backend exists; admin/contextual UI not exposed on final page
- Waitlist priority rules: API exists; no admin UI on waitlist page
#### /appointments/workflows
- Workflow test run: Backend exists; admin/contextual UI not exposed on final page
#### /payments/invoices
- Invoices: API-first; commerce panel duplicate

### C. MOVE FROM PARITY / TEMP (high priority)

| Feature | Temp location | Final page | Present on final? |
|---------|---------------|------------|-------------------|
| Share & embed hub | `/appointments/booking/share` | /appointments/booking | Missing/incomplete |
| Scheduler theme / branding | Commerce admin | /appointments/booking | Missing/incomplete |
| Categories admin | `/appointments/categories` | /appointments/types/services | Missing/incomplete |
| Client restrictions | `/appointments/client-restrictions` | /contacts/[id] | Missing/incomplete |
| Audience segments | `/appointments/segments` | /contacts/segments | Missing/incomplete |
| Dynamic pricing by slot | Commerce admin | PARITY_TEMP | Missing/incomplete |
| Resources (rooms, equipment) | `/appointments/resources` | /appointments/booking/rooms-equipment | Missing/incomplete |
| Custom client fields | Info step | /contacts/fields | Missing/incomplete |
| Packages & memberships hub | `/appointments/commerce` | /appointments/packages | Missing/incomplete |
| Package purchase | Commerce admin | /appointments/packages | Missing/incomplete |
| Coupons / discounts | Commerce admin | /appointments/discounts | Missing/incomplete |
| Class series admin | `/appointments/classes` | /appointments/types/classes | Missing/incomplete |
| Recall campaigns | `/appointments/recall-campaigns` | /appointments/automations/recall | Missing/incomplete |
| Appointment segments (recalls) | `/appointments/segments` | /appointments/recalls | Missing/incomplete |
| No-show recovery | `/appointments/no-show-recovery` | /appointments/automations/no-show | Missing/incomplete |
| Routing rules (legacy) | `/appointments/routing` | /appointments/routing-forms | Missing/incomplete |
| Service booking reports | `/appointments/reports/service-booking` | /appointments/analytics/reports | Missing/incomplete |
| Household / family accounts | Commerce admin | /contacts/[id] | Missing/incomplete |
| Contact merge | Commerce admin | /contacts | Missing/incomplete |
| Custom client fields | Commerce admin | /contacts/fields | Missing/incomplete |
| Intake form templates | Commerce admin | /appointments/booking/forms | Missing/incomplete |
| Import / export | Commerce admin | /contacts/imports | Missing/incomplete |
| Outbound webhook endpoints | Commerce admin | /integrations/calendars | Missing/incomplete |

### I. BACKEND-READY / UI-MISSING

| Feature | Backend | Final page | Required UI | Complexity |
|---------|---------|------------|-------------|------------|
| Mobile bottom nav | `appointments-nav.ts` | SHELL_RUNTIME | Product Shell | SMALL |
| Global search (overview) | `global-search.ts` | /appointments/overview | Header search | SMALL |
| Booking types list & editor | `types` API + TypeEditor | /appointments/types | /appointments/types | SMALL |
| Archetypes MEETING / SERVICE / CLASS | `booking-type-kind.ts` | /appointments/types | /appointments/types | SMALL |
| Multiple duration options | type config | /appointments/types | Booking Types | SMALL |
| Display order & bulk reorder | types bulk API | /appointments/pos | Point of Sale | SMALL |
| Custom booking questions | `bookingQuestions` | /appointments/pos | Point of Sale | SMALL |
| Recurring eligibility on type | `recurring` config | /appointments/types | Booking Types | SMALL |
| Staff assignment modes | `scheduling-domain.ts` | /appointments/types | Booking Types | SMALL |
| Location assignment | platform `locations` | /appointments/types | Booking Types | SMALL |
| Payment modes on type | `payments-extended.ts` | /payments/transactions | Transactions | SMALL |
| Cancellation policy | `extendedCancellationPolicy` | /appointments/types | Booking Types | SMALL |
| Reschedule policy | `extendedReschedulePolicy` | /appointments/types | Booking Types | SMALL |
| Booking approval required | `booking-approval.ts` | /appointments/types | Booking Types | SMALL |
| Categories on type | `booking-category.ts` | /appointments/types | Booking Types | SMALL |
| Images on type | `imageUrl` | /appointments/types/services | Service Editor | SMALL |
| Required resources on type | `resources.ts` | /appointments/types | Booking Types | SMALL |
| Add-ons on type | `add-ons.ts` | /appointments/types/services | Service Editor | SMALL |
| Add-on duration & resource effects | `add-ons.ts` | /appointments/types/services | Service Editor | SMALL |
| Intake forms on type | `intake-forms.ts` | /appointments/booking/forms | Intake templates | SMALL |
| Service phases (multi-phase duration) | `service-phases.ts` | /appointments/types/services | Service Editor | SMALL |
| Provider-release processing time | `staff-phase-occupancy.ts` | /appointments/types/services | Service Editor | SMALL |
| Booking page settings | `settings.ts` | /appointments/booking | Booking Pages | SMALL |
| Share & embed hub | share hub client | /appointments/booking | Share & Embed | SMALL |
| Booking QR code generator | Share hub + QR API | /appointments/booking | Share & Embed → QR | SMALL |
| Single-use booking links | `booking-links.ts` | /appointments/types | Backend exists; admin/contextual UI not exposed on final page | MEDIUM |
| Embed URL & iframe | `scheduler-theme.ts` | /appointments/booking | Booking Pages | SMALL |
| Booking approval queue | `booking-approval.ts` | /appointments/pos | Backend exists; admin/contextual UI not exposed on final page | MEDIUM |
| Scheduler theme / branding | `scheduler-theme.ts` | /appointments/booking | Absorb from parity hub into final IA page | SMALL |
| Custom booking domain | `SchedulerThemeConfig.customDomain` | /appointments/booking | Branding → Custom domain | SMALL |
| Advanced custom CSS | `SchedulerThemeConfig.customCss` | /appointments/booking | Branding → Advanced CSS | SMALL |
| Custom terminology / locale | `bookingTerminology` | /appointments/booking | Branding → Terminology | SMALL |
| Direct booking links per type | `directLinksForWorkspace()` | /appointments/booking | Booking Pages | SMALL |
| Booking source / UTM attribution | `booking-source.ts` | /appointments/pos | Backend exists; admin/contextual UI not exposed on final page | MEDIUM |
| Named availability schedules | `scheduling-capabilities` | /appointments/types | Booking Types | SMALL |
| Categories admin | `booking-category.ts` | /appointments/types/services | Absorb from parity hub into final IA page | SMALL |
| Client restrictions | `client-restrictions.ts` | /contacts/[id] | Absorb from parity hub into final IA page | SMALL |
| Audience segments | `appointment-segments.ts` | /contacts/segments | AppointmentSegmentsClient unrouted; redirect in place | SMALL |
| Terms & conditions acceptance | `terms-acceptance.ts` | /appointments/pos | Point of Sale | SMALL |
| Formal contracts + e-signature | `booking-contracts.ts` | /appointments/booking/forms | API-first; Forms & Documents page may be thin | SMALL |
| Date overrides (custom hours) | `dateOverrides` | /appointments/availability | Availability | SMALL |
| Blackout dates | platform config | /appointments/availability | Availability | SMALL |
| Holiday calendar | `holidays` | /appointments/availability | Availability | SMALL |
| Fixed appointment start times | `fixed-start-times.ts` | /appointments/availability | Availability | SMALL |
| Custom start interval | `slotStepMinutes()` | /appointments/availability | Backend exists; admin/contextual UI not exposed on final page | MEDIUM |
| Make Me Look Busy (hide slots) | `availability-density.ts` | /appointments/availability | Availability | SMALL |
| Minimize gaps / compact scheduling | `minimize-gaps.ts` | /appointments/availability | Backend exists; admin/contextual UI not exposed on final page | MEDIUM |
| Group / collective scheduling | `scheduling-domain.ts` | /appointments/availability | Backend exists; admin/contextual UI not exposed on final page | MEDIUM |
| Resource-constrained slots | `resource-availability.ts` | /appointments/availability | Backend exists; admin/contextual UI not exposed on final page | MEDIUM |
| External calendar busy blocking | `scheduling-domain.ts` | /appointments/availability | Availability | SMALL |

### K. PROVIDER-BLOCKED

- **iCloud / Apple Calendar sync** — Apple CalDAV
- **Reserve with Google / GBP** — Google Reserve partner
- **Facebook Book Now action** — Meta Business
- **Instagram booking action** — Meta Business
- **SAML SSO** — IdP
- **SCIM provisioning** — IdP

### L. V2 / INTENTIONALLY DEFERRED

- PWA registration
- Reminder diagnostics (support)
- Programs (multi-visit bundles)
- Payment plans (installments)
- Loyalty programs
- Caller Amy / appointment assistant
- Calendly mapping (vertical)
- Native appointments integration hub
- Integration status diagnostics
- Enterprise scheduling (legacy)
- Treatment records (vertical-adjacent)

### M. UNASSIGNED

**Count: 0** — audit complete.

---

## Page-by-page absorption audit

### Home / Overview

| Field | Value |
|-------|-------|
| Route | /appointments/overview |
| Classification | KEEP |
| Expected feature rows | 2 |
| Features actually present | 2 |
| Features partially present | 1 |
| Features missing / to absorb | 0 |
| Page change required next batch? | **NO** |

### Calendar

| Field | Value |
|-------|-------|
| Route | /appointments/calendar |
| Classification | KEEP / EXTEND |
| Expected feature rows | 6 |
| Features actually present | 3 |
| Features partially present | 1 |
| Features missing / to absorb | 7 |
| Page change required next batch? | **YES** |

**Missing / absorb:** staff colors, service/type colors, class/event indicators, filters, multi-staff view, drag-reschedule, recurring display, availability overlays, blocked events (7 functional gaps; slot-click + meeting indicators + now-line already work)

### Appointments List

| Field | Value |
|-------|-------|
| Route | /appointments |
| Classification | KEEP / EXTEND |
| Expected feature rows | 1 |
| Features actually present | 1 |
| Features partially present | 1 |
| Features missing / to absorb | 0 |
| Page change required next batch? | **NO** |

### Appointment Detail

| Field | Value |
|-------|-------|
| Route | /appointments/[id] |
| Classification | EXTEND |
| Expected feature rows | 6 |
| Features actually present | 6 |
| Features partially present | 3 |
| Features missing / to absorb | 9 |
| Page change required next batch? | **YES** |

**Missing / absorb:** phases/processing time, rooms/equipment labels, add-ons display, intake file uploads, package/membership credit ledger, partial/wallet refund UI, recurring series scope UI, policy snapshot display polish, hardcoded avatar residue

### Waitlist

| Field | Value |
|-------|-------|
| Route | /appointments/waitlist |
| Classification | EXTEND |
| Expected feature rows | 12 |
| Features actually present | 8 |
| Features partially present | 8 |
| Features missing / to absorb | 2 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Waitlist slot notification — Backend exists; admin/contextual UI not exposed on final page
- Waitlist auto-fill on cancel — Backend exists; admin/contextual UI not exposed on final page

### Recalls

| Field | Value |
|-------|-------|
| Route | /appointments/recalls |
| Classification | KEEP |
| Expected feature rows | 2 |
| Features actually present | 2 |
| Features partially present | 2 |
| Features missing / to absorb | 1 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Appointment segments (recalls) — Absorb from parity hub into final IA page

### Booking Pages

| Field | Value |
|-------|-------|
| Route | /appointments/booking |
| Classification | EXTEND |
| Expected feature rows | 12 |
| Features actually present | 11 |
| Features partially present | 11 |
| Features missing / to absorb | 2 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Share & embed hub
- Scheduler theme / branding — Absorb from parity hub into final IA page

### Booking Types Landing

| Field | Value |
|-------|-------|
| Route | /appointments/types |
| Classification | SPLIT |
| Expected feature rows | 13 |
| Features actually present | 12 |
| Features partially present | 12 |
| Features missing / to absorb | 1 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Single-use booking links — Backend exists; admin/contextual UI not exposed on final page

### Service Editor

| Field | Value |
|-------|-------|
| Route | /appointments/types/services |
| Classification | NEW/SPLIT |
| Expected feature rows | 12 |
| Features actually present | 7 |
| Features partially present | 6 |
| Features missing / to absorb | 1 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Categories admin — Absorb from parity hub into final IA page

### Meeting Editor

| Field | Value |
|-------|-------|
| Route | /appointments/types/meetings |
| Classification | NEW/SPLIT |
| Expected feature rows | 0 |
| Features actually present | 0 |
| Features partially present | 0 |
| Features missing / to absorb | 0 |
| Page change required next batch? | **NO** |

### Class Editor

| Field | Value |
|-------|-------|
| Route | /appointments/types/classes |
| Classification | NEW/SPLIT |
| Expected feature rows | 6 |
| Features actually present | 3 |
| Features partially present | 3 |
| Features missing / to absorb | 4 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Class series admin — Absorb from parity hub into final IA page
- Class check-in (QR) — Backend exists; admin/contextual UI not exposed on final page
- Seat selection / maps — Backend exists; admin/contextual UI not exposed on final page
- Event admission tickets — Backend exists; admin/contextual UI not exposed on final page

### Packages

| Field | Value |
|-------|-------|
| Route | /appointments/packages |
| Classification | NEW |
| Expected feature rows | 12 |
| Features actually present | 4 |
| Features partially present | 4 |
| Features missing / to absorb | 5 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Packages & memberships hub — Absorb from parity hub into final IA page
- Package purchase — Absorb from parity hub into final IA page
- Package lifecycle (restore on cancel) — Backend exists; admin/contextual UI not exposed on final page
- Package credit forfeiture (late cancel / no-show) — Backend exists; admin/contextual UI not exposed on final page
- Policy fees (late cancel / no-show) — Backend exists; admin/contextual UI not exposed on final page

### Memberships

| Field | Value |
|-------|-------|
| Route | /appointments/memberships |
| Classification | NEW |
| Expected feature rows | 8 |
| Features actually present | 3 |
| Features partially present | 3 |
| Features missing / to absorb | 3 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Membership lifecycle (pause/cancel/past_due) — Backend exists; admin/contextual UI not exposed on final page
- Membership failed-payment suspension — Backend exists; admin/contextual UI not exposed on final page
- Membership payment recovery / entitlement restore — Backend exists; admin/contextual UI not exposed on final page

### Point of Sale

| Field | Value |
|-------|-------|
| Route | /appointments/pos |
| Classification | KEEP/EXTEND |
| Expected feature rows | 17 |
| Features actually present | 8 |
| Features partially present | 6 |
| Features missing / to absorb | 4 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Booking approval queue — Backend exists; admin/contextual UI not exposed on final page
- Booking source / UTM attribution — Backend exists; admin/contextual UI not exposed on final page
- Resource persist on book — Backend exists; admin/contextual UI not exposed on final page
- Org roles API — Backend exists; admin/contextual UI not exposed on final page

### Transactions

| Field | Value |
|-------|-------|
| Route | /payments/transactions |
| Classification | KEEP |
| Expected feature rows | 14 |
| Features actually present | 8 |
| Features partially present | 8 |
| Features missing / to absorb | 0 |
| Page change required next batch? | **YES** |

### Invoices

| Field | Value |
|-------|-------|
| Route | /payments/invoices |
| Classification | KEEP/EXTEND |
| Expected feature rows | 1 |
| Features actually present | 1 |
| Features partially present | 1 |
| Features missing / to absorb | 0 |
| Page change required next batch? | **NO** |

### Routing

| Field | Value |
|-------|-------|
| Route | /appointments/routing-forms |
| Classification | KEEP |
| Expected feature rows | 4 |
| Features actually present | 3 |
| Features partially present | 3 |
| Features missing / to absorb | 2 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Routing rules (legacy)
- Routing form presets — Backend exists; admin/contextual UI not exposed on final page

### Team Booking

| Field | Value |
|-------|-------|
| Route | /appointments/team-pages |
| Classification | KEEP |
| Expected feature rows | 3 |
| Features actually present | 3 |
| Features partially present | 3 |
| Features missing / to absorb | 0 |
| Page change required next batch? | **NO** |

### Meeting Polls

| Field | Value |
|-------|-------|
| Route | /appointments/polls |
| Classification | KEEP |
| Expected feature rows | 0 |
| Features actually present | 0 |
| Features partially present | 0 |
| Features missing / to absorb | 0 |
| Page change required next batch? | **NO** |

### Analytics Overview

| Field | Value |
|-------|-------|
| Route | /appointments/analytics |
| Classification | KEEP |
| Expected feature rows | 1 |
| Features actually present | 1 |
| Features partially present | 0 |
| Features missing / to absorb | 0 |
| Page change required next batch? | **NO** |

### Segments

| Field | Value |
|-------|-------|
| Route | /contacts/segments |
| Classification | KEEP |
| Expected feature rows | 1 |
| Features actually present | 1 |
| Features partially present | 1 |
| Features missing / to absorb | 1 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Audience segments — AppointmentSegmentsClient unrouted; redirect in place

### Public Booking

| Field | Value |
|-------|-------|
| Route | PUBLIC_BOOKING |
| Classification | EXTEND |
| Expected feature rows | 53 |
| Features actually present | 0 |
| Features partially present | 0 |
| Features missing / to absorb | 6 |
| Page change required next batch? | **YES** |

**Missing / absorb:**
- Custom client fields
- Returning invitee cookie — Public customer flow not fully exposed
- Single-use token links — Public customer flow not fully exposed
- Public email AI booking — Public customer flow not fully exposed
- Public email AI handler — Public customer flow not fully exposed
- Slot diagnostics API — Public customer flow not fully exposed

### Customer Portal

| Field | Value |
|-------|-------|
| Route | CUSTOMER_PORTAL |
| Classification | EXTEND |
| Expected feature rows | 21 |
| Features actually present | 2 |
| Features partially present | 2 |
| Features missing / to absorb | 0 |
| Page change required next batch? | **NO** |

---

## Contextual-creation absorption matrix

| Dependency | Select existing? | Create new? | Manage? | Draft preserved? | Auto-select? | Destination correct? |
|------------|------------------|-------------|---------|------------------|--------------|------------------------|
| SERVICE → STAFF | PARTIAL | YES | YES | UNKNOWN | PARTIAL | YES — staff page + service editor |
| SERVICE → LOCATION | YES | YES | YES | UNKNOWN | PARTIAL | YES |
| SERVICE → ROOM/EQUIPMENT | PARTIAL | YES | YES | UNKNOWN | NO | PARTIAL — rooms page exists; contextual from service editor weak |
| SERVICE → INTAKE FORM | PARTIAL | YES | YES | UNKNOWN | NO | PARTIAL — forms page new |
| SERVICE → CONTRACT | NO | YES | YES | UNKNOWN | NO | PARTIAL |
| SERVICE → PACKAGE | PARTIAL | YES | YES | UNKNOWN | NO | PARTIAL |
| SERVICE → MEMBERSHIP | PARTIAL | YES | YES | UNKNOWN | NO | PARTIAL |
| MEETING → HOST | YES | YES | YES | UNKNOWN | PARTIAL | YES |
| MEETING → AVAILABILITY | YES | N/A | YES | N/A | N/A | YES |
| CLASS → INSTRUCTOR | PARTIAL | YES | YES | UNKNOWN | NO | PARTIAL |
| LOCATION → STAFF | YES | N/A | YES | N/A | N/A | YES |
| CONTACT → PACKAGE | PARTIAL | YES | YES | UNKNOWN | NO | PARTIAL — commerce parity |
| CONTACT → APPOINTMENT | YES | YES | YES | N/A | N/A | YES |

## Parity vs final page cross-check

See `docs/APPOINTMENTS-FEATURE-SPLIT-ORIGINAL-VS-PARITY.md`. Every parity feature checked against final destination in ledger column `TEMP_PARITY_EXISTS`.

## Mock / placeholder audit (meaningful hits)

| Feature area | Location | Type | V1? | Required |
|--------------|----------|------|-----|----------|
| Booking channel integrations | `booking-channel-integrations.ts` | Provider placeholder | V1 scaffold | Live OAuth when partner access |
| Analytics routing funnel | `kimi-ui/analytics/types.ts` | Demo sample data | V1 | Wire to real analytics API |
| Waitlist types | waitlist page imports | mock-data residue | V1 | Use runtime types |
| Commerce admin | `service-booking-admin-client.tsx` | Parity hub (24 sections) | V1 | Absorb into final pages |
| Overview date picker | overview page | Decorative non-functional | V1 | Optional: wire or remove interactivity |

## Next batch size estimate

| Category | Count |
|----------|------:|
| Existing pages with no change | 1 |
| Existing pages needing small extension | 27 |
| Existing pages needing medium extension | 11 |
| Existing pages needing major extension | 9 |
| New/split pages still missing features | 20 |
| Contextual UI gaps | 13 |
| Public booking gaps | 34 |
| Portal gaps | 20 |
| Backend-ready / UI-missing | 184 |
| UI-present / backend-missing | 89 |
| Provider-blocked | 6 |
| V2 deferred | 11 |
| Unassigned | 0 |

---

## Ordered existing pages needing implementation (P0 first)

1. `/appointments/calendar` — colors, filters, indicators (7 gaps)
2. `/appointments/[id]` — commerce/policy/intake depth (9 gaps)
3. `/appointments/waitlist` — priority rules UI (2 gaps)
4. `/appointments/booking` — absorb branding/share from parity (5+ gaps)
5. `/appointments/types/services` — categories, phases, add-ons from parity
6. `/appointments/packages` + `/memberships` + `/gift-cards` + `/products` + `/discounts` — absorb commerce hub
7. `/appointments/booking/forms` — intake + contracts from parity
8. `/appointments/booking/rooms-equipment` — absorb `/appointments/resources`
9. `/contacts/segments` + `/contacts/fields` + `/contacts/imports` — finish commerce migration
10. `/appointments/analytics/reports` — retire legacy JSON dump
11. `/appointments/routing-forms` — live data + analytics (6 gaps)
12. `/appointments/team-pages` — workspace slug fix (2 gaps)
13. `/appointments/pos` — payment capture + wallet (5 gaps)
14. `/payments/invoices` + `/payments/transactions` — surface API-first features
15. `PUBLIC_BOOKING` + `CUSTOMER_PORTAL` — certify existing flows (not redesign)

---

## Batch 8A completion gate

| Gate | Status |
|------|--------|
| Every master inventory row audited | **PASS** (308 rows, sections 1–21) |
| Every V1 feature has final destination | **PASS** |
| Parity features cross-checked | **PASS** |
| Existing final pages audited | **PASS** |
| Public booking separately audited | **PASS** (section 5 + ledger) |
| Portal/self-service separately audited | **PASS** (section 7 + ledger) |
| Contextual creation matrix | **PASS** |
| Backend-ready/UI-missing identified | **PASS** (184 rows) |
| UI-present/backend-missing identified | **PASS** (89 rows) |
| Temp pages with unique V1 functionality | **PASS** (29 rows) |
| Existing-page queue produced | **PASS** |
| No UI/backend changes made | **PASS** |
| No testing/certification performed | **PASS** |
| UNASSIGNED count = 0 | **PASS** |

---

*End of Batch 8A absorption audit. Do not implement until explicit Batch 8B+ directive.*