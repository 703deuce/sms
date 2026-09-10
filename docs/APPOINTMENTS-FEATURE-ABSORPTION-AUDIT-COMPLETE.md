# Appointments Batch 8A — Complete Feature Absorption Audit (Single Download)

**Generated:** 2026-09-09  
**Type:** Discovery only — no implementation, no testing  
**Branch:** cursor/feature-absorption-audit-8a-709b  
**PR:** https://github.com/703deuce/sms/pull/342

This file combines:
1. Master absorption audit
2. Existing-page gap queue (P0/P1/P2)
3. Full feature ledger (308 rows, CSV embedded)
4. Summary statistics (JSON)

---

# PART 1 — EXECUTIVE SUMMARY

## Statistics

```json
{
  "total": 308,
  "v1": 297,
  "v2": 11,
  "unassigned": 0,
  "complete": 11,
  "extend": 235,
  "move": 23,
  "backendReadyUiMissing": 184,
  "publicGap": 34,
  "portalGap": 20,
  "provider": 6,
  "runtime": 17,
  "v2defer": 11,
  "tempUnique": 29,
  "uiPresentBackendGap": 89,
  "contextualGaps": 13,
  "newSplitGaps": 20,
  "pagesNoChange": 1,
  "pagesSmall": 27,
  "pagesMedium": 11,
  "pagesMajor": 9
}
```

## Quick-reference gap counts

| Page | Gaps | Priority |
|------|-----:|----------|
| Calendar | 7 | P1 — colors, filters, staff lanes, drag-reschedule, recurring display, availability overlays, blocked events |
| Appointment Detail | 9 | P0/P1 — phases, rooms, add-ons, intake files, package/membership credits, partial refund, recurring series UI, resource labels |
| Waitlist | 2 | P0 — priority rules admin UI; show priority rank in table |
| Home / Overview | 2 | P2 — decorative date picker; missing KPIs |
| Routing | 6 | P1 — live types/staff in rules, real analytics, public form link, submission log |
| Team Booking | 2 | P1 — hardcoded workspace slug; no live preview |
| Meeting Polls | 2 | P2 — mock residue; public poll link verification |
| POS | 5 | P1 — payment capture, wallet, coupon picker, tax, receipt/history |
| Public booking | 34 | P0 — certify flows (ledger rows) |
| Customer portal | 20 | P1 — depth on packages, wallet, payment methods |
| Transactions | 2 | P1 — refund UI depth; appointment linkage |
| Settings → Meetings | 1 | P2 — video/notetaker defaults |
| Contacts → Fields/Import | 3 | P0 — absorb commerce duplicates |

## Completion gate

| Gate | Status |
|------|--------|
| Every master inventory row audited | PASS (308 rows) |
| Every V1 feature has final destination | PASS |
| Parity features cross-checked | PASS |
| UNASSIGNED count = 0 | PASS |
| No UI/backend changes | PASS |
| No testing/certification | PASS |

---

# PART 2 — MASTER ABSORPTION AUDIT

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

---

# PART 3 — EXISTING PAGE GAP QUEUE

**Status:** Audit-only output — do not implement from this document without explicit directive.
**Generated:** 2026-09-09
**Authority:** `docs/APPOINTMENTS-FEATURE-ABSORPTION-AUDIT.md`

Features that must be **added to or moved into** existing final pages (not new page creation).

## PAGE: /appointments

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P2]** Appointments list
  - Section: /appointments
  - Backend: YES (`appointments-service.ts`)

---

## PAGE: /appointments/[id]

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=5

### MISSING / INCOMPLETE

- **[P0]** Policy snapshot on record
  - Section: Policies snapshot
  - Gap: Backend writes snapshot; detail display may be partial
  - Backend: YES (`policy-snapshot.ts`)
- **[P2]** Appointment detail
  - Section: /appointments/[id]
  - Backend: YES (detail page)
- **[P2]** Internal notes
  - Section: Appointment Detail
  - Backend: YES (`internal-notes.ts`)
- **[P2]** Reminder timeline
  - Section: Appointment Detail
  - Backend: YES (reminder-timeline API)
- **[P2]** Multi-service lines on record
  - Section: Service lines
  - Backend: YES (`multi-service.ts`)
- **[P2]** Per-appointment reminder timeline
  - Section: Appointment Detail
  - Backend: YES (—)

---

## PAGE: /appointments/ai-booking

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=5, P1=0, P2=2

### MISSING / INCOMPLETE

- **[P0]** Public AI booking chat
  - Section: AI Booking
  - Backend: YES (`ai-scheduling/`)
- **[P0]** Public email AI booking
  - Section: AI Booking
  - Gap: Public customer flow not fully exposed
  - Backend: YES (email-ai route)
- **[P0]** AI channels (SMS, email)
  - Section: AI Booking
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (channels API)
- **[P0]** NL understand / execute
  - Section: AI Booking
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`understand.ts`, `execute.ts`)
- **[P0]** AI booking protection
  - Section: AI Booking
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`booking-protection.ts`)
- **[P2]** AI booking settings
  - Section: AI Booking
  - Backend: YES (ai-booking config)
- **[P2]** Public AI chat booking
  - Section: AI Booking
  - Backend: YES (`ai-scheduling/`)

---

## PAGE: /appointments/analytics/booking

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P2]** Booking analytics
  - Section: Analytics Booking
  - Backend: YES (analytics)

---

## PAGE: /appointments/analytics/reminders

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P2]** Reminder analytics
  - Section: Analytics Reminders
  - Backend: YES (analytics)

---

## PAGE: /appointments/analytics/reports

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=2, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P0]** Service booking reports
  - Section: /appointments/analytics/reports
  - Gap: Structured panel on analytics; legacy JSON dump remains
  - Temp/parity: `/appointments/reports/service-booking`
  - Backend: YES (`reporting.ts`)
- **[P0]** CSV / PDF export
  - Section: Reports
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (—)
- **[P2]** Reports hub
  - Section: Reports
  - Backend: YES (`reporting.ts`)

---

## PAGE: /appointments/automations/activity

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P2]** Automation activity log
  - Section: Activity
  - Backend: YES (—)

---

## PAGE: /appointments/automations/no-show

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=2, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** No-show recovery
  - Section: /appointments/automations/no-show
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: `/appointments/no-show-recovery`
  - Backend: YES (`no-show-recovery.ts`)
- **[P0]** No-show scan job
  - Section: Automations
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (—)

---

## PAGE: /appointments/automations/recall

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** Recall campaigns
  - Section: /appointments/automations/recall
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: `/appointments/recall-campaigns`
  - Backend: YES (`recall-campaigns.ts`)

---

## PAGE: /appointments/availability

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=8, P1=0, P2=6

### MISSING / INCOMPLETE

- **[P0]** Custom start interval
  - Section: Availability
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`slotStepMinutes()`)
- **[P0]** Minimize gaps / compact scheduling
  - Section: Availability
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`minimize-gaps.ts`)
- **[P0]** Group / collective scheduling
  - Section: Availability
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`scheduling-domain.ts`)
- **[P0]** Resource-constrained slots
  - Section: Availability
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`resource-availability.ts`)
- **[P0]** Atomic slot booking
  - Section: Availability
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`slot-booking.ts`)
- **[P0]** Slot validation
  - Section: Availability
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`slot-validation.ts`)
- **[P0]** Slot diagnostics
  - Section: Availability
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`slot-diagnostics.ts`)
- **[P0]** Admin availability query
  - Section: Availability
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`availability-engine.ts`)
- **[P2]** Date overrides (custom hours)
  - Section: Availability
  - Backend: YES (`dateOverrides`)
- **[P2]** Blackout dates
  - Section: Availability
  - Backend: YES (platform config)
- **[P2]** Holiday calendar
  - Section: Availability
  - Backend: YES (`holidays`)
- **[P2]** Fixed appointment start times
  - Section: Availability
  - Backend: YES (`fixed-start-times.ts`)
- **[P2]** Make Me Look Busy (hide slots)
  - Section: Availability
  - Backend: YES (`availability-density.ts`)
- **[P2]** External calendar busy blocking
  - Section: Availability
  - Backend: YES (`scheduling-domain.ts`)

---

## PAGE: /appointments/booking

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=3, P1=0, P2=9

### MISSING / INCOMPLETE

- **[P0]** Share & embed hub
  - Section: Share & Embed
  - Backend: YES (share hub client)
- **[P0]** Scheduler theme / branding
  - Section: Branding
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`scheduler-theme.ts`)
- **[P0]** Embeddable widget
  - Section: Booking Pages
  - Backend: YES (embed route)
- **[P2]** Booking page settings
  - Section: Booking Pages
  - Backend: YES (`settings.ts`)
- **[P2]** Booking QR code generator
  - Section: Share & Embed → QR
  - Backend: YES (Share hub + QR API)
- **[P2]** Embed URL & iframe
  - Section: Booking Pages
  - Backend: YES (`scheduler-theme.ts`)
- **[P2]** Custom booking domain
  - Section: Branding → Custom domain
  - Backend: YES (`SchedulerThemeConfig.customDomain`)
- **[P2]** Advanced custom CSS
  - Section: Branding → Advanced CSS
  - Backend: YES (`SchedulerThemeConfig.customCss`)
- **[P2]** Custom terminology / locale
  - Section: Branding → Terminology
  - Backend: YES (`bookingTerminology`)
- **[P2]** Direct booking links per type
  - Section: Booking Pages
  - Backend: YES (`directLinksForWorkspace()`)
- **[P2]** Contacts (shared)
  - Section: Booking Pages
  - Backend: YES (contacts product)
- **[P2]** Conversations / Inbox (shared)
  - Section: Booking Pages
  - Backend: YES (inbox product)

---

## PAGE: /appointments/booking/forms

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=1, P1=1, P2=1

### MISSING / INCOMPLETE

- **[P0]** Intake form templates
  - Section: Intake templates
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`intake-forms.ts`)
- **[P1]** Formal contracts + e-signature
  - Section: Contracts
  - Gap: API-first; Forms & Documents page may be thin
  - Backend: YES (`booking-contracts.ts`)
- **[P2]** Intake forms on type
  - Section: Intake templates
  - Backend: YES (`intake-forms.ts`)

---

## PAGE: /appointments/booking/rooms-equipment

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=2, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P0]** Resources (rooms, equipment)
  - Section: /appointments/booking/rooms-equipment
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: `/appointments/resources`
  - Backend: YES (`resources.ts`)
- **[P0]** Resource pools (any-one-in-group)
  - Section: Rooms & Equipment
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`resource-pools.ts`)
- **[P2]** Resource quantity / capacity
  - Section: Rooms & Equipment
  - Backend: YES (`SchedulingResource.quantity`)

---

## PAGE: /appointments/calendar

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=1, P2=4

### MISSING / INCOMPLETE

- **[P1]** Staff / service calendar colors
  - Section: Color legend / indicators
  - Gap: Heuristic colors only; not tied to type color config
  - Backend: YES (`CalendarColorConfig`)
- **[P2]** Calendar slot-click create
  - Section: Slot click → create
  - Backend: YES (calendar components)
- **[P2]** Meeting / video indicators
  - Section: Meeting indicators
  - Backend: YES (meeting-indicators API)
- **[P2]** Reschedule (staff)
  - Section: Calendar & Operations
  - Backend: YES (`booking-platform.ts`)
- **[P2]** Cancel (staff)
  - Section: Calendar & Operations
  - Backend: YES (`booking-platform.ts`)

---

## PAGE: /appointments/discounts

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** Coupons / discounts
  - Section: /appointments/discounts
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`coupons.ts`)

---

## PAGE: /appointments/gift-cards

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=2, P1=1, P2=1

### MISSING / INCOMPLETE

- **[P0]** Portal: gift balances
  - Section: Gift Cards
  - Backend: YES (entitlements)
- **[P0]** Gift balance redemption history
  - Section: Gift Cards
  - Backend: YES (`gift-certificates.ts`)
- **[P1]** Gift certificates
  - Section: /appointments/gift-cards
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`gift-certificates.ts`)
- **[P2]** Gift balance redemption at checkout
  - Section: Gift Cards
  - Backend: YES (`gift-certificates.ts`)

---

## PAGE: /appointments/locations

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=4, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** Locations
  - Section: Locations
  - Backend: YES (platform `locations`)
- **[P0]** Location-specific timezone
  - Section: Locations
  - Backend: YES (platform `locations`)
- **[P0]** Location-specific staff assignment
  - Section: Locations
  - Backend: YES (platform `locations`)
- **[P0]** Location-specific resource assignment
  - Section: Locations
  - Backend: YES (`resources.ts`)

---

## PAGE: /appointments/memberships

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=5, P1=1, P2=2

### MISSING / INCOMPLETE

- **[P0]** Portal: memberships
  - Section: Memberships
  - Backend: YES (entitlements)
- **[P0]** Membership subscriptions
  - Section: Memberships
  - Backend: YES (`memberships.ts`)
- **[P0]** Membership lifecycle (pause/cancel/past_due)
  - Section: Memberships
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`membership-lifecycle.ts`)
- **[P0]** Membership failed-payment suspension
  - Section: Memberships
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`membership-lifecycle.ts`)
- **[P0]** Membership payment recovery / entitlement restore
  - Section: Memberships
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`membership-lifecycle.ts`)
- **[P1]** Membership products
  - Section: /appointments/memberships
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`memberships.ts`)
- **[P2]** Membership-only booking types / classes
  - Section: Memberships
  - Backend: YES (`membership-lifecycle.ts`)
- **[P2]** Recurring membership credit replenishment
  - Section: Memberships
  - Backend: YES (`MembershipBenefits.includedCredits`)

---

## PAGE: /appointments/new

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P2]** Create appointment (staff)
  - Section: Create Appointment
  - Backend: YES (`booking-platform.ts`)

---

## PAGE: /appointments/overview

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P2]** Global search (overview)
  - Section: Header search
  - Backend: YES (`global-search.ts`)

---

## PAGE: /appointments/packages

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=10, P1=1, P2=1

### MISSING / INCOMPLETE

- **[P0]** Package / membership entitlements
  - Section: Packages
  - Backend: YES (`entitlements.ts`)
- **[P0]** Public store (packages)
  - Section: Packages
  - Backend: YES (`store-checkout.ts`)
- **[P0]** Portal: packages & credits
  - Section: Packages
  - Backend: YES (entitlements)
- **[P0]** Portal: package usage history
  - Section: Packages
  - Backend: YES (portal API)
- **[P0]** Packages & memberships hub
  - Section: /appointments/packages
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: `/appointments/commerce`
  - Backend: YES (commerce admin)
- **[P0]** Package purchase
  - Section: Packages
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`purchasePackageForContact`)
- **[P0]** Package credits & ledger
  - Section: Packages
  - Backend: YES (`packages.ts`)
- **[P0]** Package lifecycle (restore on cancel)
  - Section: Packages
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`package-lifecycle.ts`)
- **[P0]** Package credit forfeiture (late cancel / no-show)
  - Section: Packages
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`package-lifecycle.ts`)
- **[P0]** Policy fees (late cancel / no-show)
  - Section: Packages & Sales
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`policy-fees.ts`)
- **[P1]** Package products
  - Section: /appointments/packages
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`packages.ts`)
- **[P2]** Mixed-content package entitlements
  - Section: Packages
  - Backend: YES (`PackageCreditRule`)

---

## PAGE: /appointments/pos

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=11, P1=0, P2=5

### MISSING / INCOMPLETE

- **[P0]** Intake file / image upload
  - Section: Point of Sale
  - Backend: YES (`IntakeFieldType` file/image)
- **[P0]** Booking approval queue
  - Section: Point of Sale
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`booking-approval.ts`)
- **[P0]** Booking source / UTM attribution
  - Section: Point of Sale
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`booking-source.ts`)
- **[P0]** Resource persist on book
  - Section: Point of Sale
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`persistAppointmentResources`)
- **[P0]** Public booking home
  - Section: Point of Sale
  - Backend: YES (public book flow)
- **[P0]** Staff picker
  - Section: Point of Sale
  - Backend: YES (DateTime / Info)
- **[P0]** Location picker
  - Section: Point of Sale
  - Backend: YES (public flow)
- **[P0]** Multi-booking session (cart)
  - Section: Point of Sale
  - Backend: YES (`booking-session.ts`)
- **[P0]** Recurring booking
  - Section: Point of Sale
  - Backend: YES (`recurring.ts`)
- **[P0]** POS mixed checkout (service + package + membership + gift + product + discount + tip)
  - Section: /appointments/pos
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`pos-cart.ts`)
- **[P0]** Org roles API
  - Section: Point of Sale
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (—)
- **[P2]** Display order & bulk reorder
  - Section: Point of Sale
  - Backend: YES (types bulk API)
- **[P2]** Custom booking questions
  - Section: Point of Sale
  - Backend: YES (`bookingQuestions`)
- **[P2]** Terms & conditions acceptance
  - Section: Point of Sale
  - Backend: YES (`terms-acceptance.ts`)
- **[P2]** Manage appointment link
  - Section: Point of Sale
  - Backend: YES (`manage-appointment.ts`)
- **[P2]** Staff-initiated AI book
  - Section: Point of Sale
  - Backend: YES (`ai-booking`)

---

## PAGE: /appointments/products

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=1, P2=0

### MISSING / INCOMPLETE

- **[P1]** Products for sale
  - Section: /appointments/products
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`booking-products.ts`)

---

## PAGE: /appointments/recalls

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P0]** Appointment segments (recalls)
  - Section: Recalls
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: `/appointments/segments`
  - Backend: YES (`appointment-segments.ts`)
- **[P2]** Recalls hub
  - Section: /appointments/recalls
  - Backend: YES (`recalls-hub.ts`)

---

## PAGE: /appointments/reminders

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=3, P1=0, P2=5

### MISSING / INCOMPLETE

- **[P0]** ICS attachments
  - Section: Reminders
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`ics-builder.ts`)
- **[P0]** Email open / click tracking
  - Section: Reminders
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (—)
- **[P0]** Voice reminder retry job
  - Section: Reminders
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (—)
- **[P2]** SMS reminders
  - Section: Reminders
  - Backend: YES (`reminder-delivery.ts`)
- **[P2]** Email reminders
  - Section: Reminders
  - Backend: YES (`reminder-engine.ts`)
- **[P2]** Reminder test send
  - Section: Reminders
  - Backend: YES (—)
- **[P2]** Voice reminders
  - Section: Voice channel
  - Backend: YES (`appointment-voice-reminders/`)
- **[P2]** SMS consent disclosure
  - Section: Reminders
  - Backend: YES (`sms-consent-disclosure.ts`)

---

## PAGE: /appointments/routing-forms

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=2, P1=0, P2=2

### MISSING / INCOMPLETE

- **[P0]** Routing rules (legacy)
  - Section: /appointments/routing-forms
  - Temp/parity: `/appointments/routing`
  - Backend: NO (routing page)
- **[P0]** Routing form presets
  - Section: Routing
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`routing-forms-presets.ts`)
- **[P2]** Routing forms builder
  - Section: Routing
  - Backend: YES (`routing-forms.ts`)
- **[P2]** Public routing form
  - Section: Routing
  - Backend: YES (—)

---

## PAGE: /appointments/setup

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P2]** Platform setup wizard
  - Section: Setup
  - Backend: NO (setup page)

---

## PAGE: /appointments/staff

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P0]** Staff round-robin state
  - Section: Staff
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`roundRobinState`)
- **[P2]** Staff scheduling config
  - Section: Staff
  - Backend: YES (platform `staff[]`)

---

## PAGE: /appointments/team-pages

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=3

### MISSING / INCOMPLETE

- **[P2]** Scheduling groups
  - Section: Team Booking
  - Backend: YES (`team-scheduling.ts`)
- **[P2]** Team booking pages
  - Section: Team Booking
  - Backend: YES (`team-scheduling.ts`)
- **[P2]** Public team booking page
  - Section: Team Booking
  - Backend: YES (—)

---

## PAGE: /appointments/types

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=12

### MISSING / INCOMPLETE

- **[P0]** Single-use booking links
  - Section: Booking Types
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`booking-links.ts`)
- **[P2]** Booking types list & editor
  - Section: /appointments/types
  - Backend: YES (`types` API + TypeEditor)
- **[P2]** Archetypes MEETING / SERVICE / CLASS
  - Section: /appointments/types
  - Backend: YES (`booking-type-kind.ts`)
- **[P2]** Multiple duration options
  - Section: Booking Types
  - Backend: YES (type config)
- **[P2]** Recurring eligibility on type
  - Section: Booking Types
  - Backend: YES (`recurring` config)
- **[P2]** Staff assignment modes
  - Section: Booking Types
  - Backend: YES (`scheduling-domain.ts`)
- **[P2]** Location assignment
  - Section: Booking Types
  - Backend: YES (platform `locations`)
- **[P2]** Cancellation policy
  - Section: Booking Types
  - Backend: YES (`extendedCancellationPolicy`)
- **[P2]** Reschedule policy
  - Section: Booking Types
  - Backend: YES (`extendedReschedulePolicy`)
- **[P2]** Booking approval required
  - Section: Booking Types
  - Backend: YES (`booking-approval.ts`)
- **[P2]** Categories on type
  - Section: Booking Types
  - Backend: YES (`booking-category.ts`)
- **[P2]** Required resources on type
  - Section: Booking Types
  - Backend: YES (`resources.ts`)
- **[P2]** Named availability schedules
  - Section: Booking Types
  - Backend: YES (`scheduling-capabilities`)

---

## PAGE: /appointments/types/classes

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=4, P1=0, P2=2

### MISSING / INCOMPLETE

- **[P0]** Class series admin
  - Section: /appointments/types/classes
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: `/appointments/classes`
  - Backend: YES (`classes.ts`)
- **[P0]** Class check-in (QR)
  - Section: Class Editor
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`class-check-in.ts`)
- **[P0]** Seat selection / maps
  - Section: Class Editor
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`seat-selection.ts`)
- **[P0]** Event admission tickets
  - Section: Class Editor
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`event-tickets.ts`)
- **[P2]** Class occurrences
  - Section: Class Editor
  - Backend: YES (`classes.ts`)
- **[P2]** Staff class enrollment
  - Section: Classes
  - Backend: YES (classes admin)

---

## PAGE: /appointments/types/events

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=2

### MISSING / INCOMPLETE

- **[P2]** Calendar view
  - Section: Workshop/Event Editor
  - Backend: YES (calendar)
- **[P2]** Audit timeline on appointment
  - Section: Workshop/Event Editor
  - Backend: YES (metadata `timeline[]`)

---

## PAGE: /appointments/types/services

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=7, P1=0, P2=5

### MISSING / INCOMPLETE

- **[P0]** Categories admin
  - Section: Manage Categories drawer
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: `/appointments/categories`
  - Backend: YES (`booking-category.ts`)
- **[P0]** Location-specific hours/services
  - Section: Service Editor
  - Backend: YES (`location-scheduling.ts`)
- **[P0]** Deep link to one type
  - Section: Service Editor
  - Backend: YES (public flow)
- **[P0]** Service / type picker
  - Section: Service Editor
  - Backend: YES (ServiceStep)
- **[P0]** Multi-service chain
  - Section: Service Editor
  - Backend: YES (`multi-service.ts`)
- **[P0]** Multi-staff per service line
  - Section: Service Editor
  - Backend: YES (`multi-service.ts`)
- **[P0]** Add-on selection
  - Section: Service Editor
  - Backend: YES (`add-ons.ts`)
- **[P2]** Images on type
  - Section: Service Editor
  - Backend: YES (`imageUrl`)
- **[P2]** Add-ons on type
  - Section: Service Editor
  - Backend: YES (`add-ons.ts`)
- **[P2]** Add-on duration & resource effects
  - Section: Service Editor
  - Backend: YES (`add-ons.ts`)
- **[P2]** Service phases (multi-phase duration)
  - Section: Service Editor
  - Backend: YES (`service-phases.ts`)
- **[P2]** Provider-release processing time
  - Section: Service Editor
  - Backend: YES (`staff-phase-occupancy.ts`)

---

## PAGE: /appointments/waitlist

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=3, P1=1, P2=7

### MISSING / INCOMPLETE

- **[P0]** Public waitlist join
  - Section: Waitlist
  - Backend: YES (`waitlist.ts`)
- **[P0]** Waitlist slot notification
  - Section: Waitlist
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`waitlist.ts`)
- **[P0]** Waitlist auto-fill on cancel
  - Section: Waitlist
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`autoFillWaitlistSlot`)
- **[P1]** Waitlist priority rules
  - Section: Priority rules
  - Gap: API exists; no admin UI on waitlist page
  - Temp/parity: Commerce admin
  - Backend: YES (`waitlist-priority.ts`)
- **[P2]** Waitlist offer accept
  - Section: Waitlist
  - Backend: YES (`waitlist.ts`)
- **[P2]** Class waitlist (capacity-full join)
  - Section: Waitlist
  - Backend: YES (`waitlist.ts` + `classes.ts`)
- **[P2]** Waitlist admin queue
  - Section: Waitlist
  - Backend: YES (`waitlist.ts`)
- **[P2]** Public waitlist join
  - Section: Waitlist
  - Backend: YES (waitlist API)
- **[P2]** Waitlist preferences (staff/date/time)
  - Section: Waitlist
  - Backend: YES (waitlist model)
- **[P2]** Waitlist offer + atomic accept
  - Section: Waitlist
  - Backend: YES (`waitlist.ts`)
- **[P2]** Waitlist party size (group / class)
  - Section: Waitlist
  - Backend: YES (`groupBooking` + waitlist model)

---

## PAGE: /appointments/workflows

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=6, P1=0, P2=6

### MISSING / INCOMPLETE

- **[P0]** Workflow test run
  - Section: Workflows
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (—)
- **[P0]** Workflow preview
  - Section: Workflows
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`preview.ts`)
- **[P0]** Execution logs
  - Section: Workflows
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (—)
- **[P0]** Unknown SMS reply triage
  - Section: Workflows
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (—)
- **[P0]** Time-based triggers
  - Section: Workflows
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`workflow-scanners.ts`)
- **[P0]** Before/after appointment triggers
  - Section: Workflows
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (triggers)
- **[P2]** Status workflow
  - Section: Workflows
  - Backend: YES (status enums)
- **[P2]** Automation templates
  - Section: Workflows
  - Backend: YES (workflow templates)
- **[P2]** Workflow list
  - Section: Workflows
  - Backend: YES (`appointment-workflows/`)
- **[P2]** Create / edit workflow
  - Section: Workflows
  - Backend: YES (engine + editor)
- **[P2]** Workflow from template
  - Section: Workflows
  - Backend: NO (`templates.ts`)
- **[P2]** Automation analytics
  - Section: Workflows
  - Backend: YES (analytics)

---

## PAGE: /contacts

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** Contact merge
  - Section: Merge tool
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`contact-merge.ts`)

---

## PAGE: /contacts/[id]

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=2, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** Client restrictions
  - Section: Booking Access
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: `/appointments/client-restrictions`
  - Backend: YES (`client-restrictions.ts`)
- **[P0]** Household / family accounts
  - Section: Household
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`household.ts`)

---

## PAGE: /contacts/fields

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=2, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** Custom client fields
  - Section: /contacts/fields
  - Temp/parity: Info step
  - Backend: YES (`custom-fields.ts`)
- **[P0]** Custom client fields
  - Section: /contacts/fields
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`custom-fields.ts`)

---

## PAGE: /contacts/imports

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** Import / export
  - Section: /contacts/imports
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`import-export.ts`)

---

## PAGE: /contacts/segments

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** Audience segments
  - Section: /contacts/segments
  - Gap: AppointmentSegmentsClient unrouted; redirect in place
  - Temp/parity: `/appointments/segments`
  - Backend: YES (`appointment-segments.ts`)

---

## PAGE: /integrations/calendars

**CLASSIFICATION:** KEEP VISUAL / ABSORB FROM PARITY
**PRIORITY SUMMARY:** P0=3, P1=0, P2=2

### MISSING / INCOMPLETE

- **[P0]** Outbound webhook endpoints
  - Section: Developer webhooks (verify final home)
  - Gap: Absorb from parity hub into final IA page
  - Temp/parity: Commerce admin
  - Backend: YES (`webhooks.ts`)
- **[P0]** Webhook signing (HMAC)
  - Section: Webhooks
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`webhook-delivery.ts`)
- **[P0]** Webhook delivery queue
  - Section: Webhooks
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (delivery jobs)
- **[P2]** Google Calendar sync
  - Section: Integrations
  - Backend: YES (calendar sync)
- **[P2]** Microsoft / Outlook sync
  - Section: Integrations
  - Backend: YES (calendar sync)

---

## PAGE: /meetings

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=0, P2=1

### MISSING / INCOMPLETE

- **[P2]** Public shared recap
  - Section: Meetings Recaps
  - Backend: YES (—)

---

## PAGE: /payments/invoices

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=0, P1=1, P2=0

### MISSING / INCOMPLETE

- **[P1]** Invoices
  - Section: /payments/invoices
  - Gap: API-first; commerce panel duplicate
  - Backend: YES (`booking-invoices.ts`)

---

## PAGE: /payments/transactions

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=6, P1=0, P2=8

### MISSING / INCOMPLETE

- **[P0]** Saved card on file
  - Section: Transactions
  - Backend: YES (merchant payments)
- **[P0]** Stripe checkout
  - Section: Transactions
  - Backend: YES (merchant payments)
- **[P0]** Square in-page payment
  - Section: Transactions
  - Backend: YES (merchant payments)
- **[P0]** Portal: purchase & payment history
  - Section: Transactions
  - Backend: YES (`client-portal.ts` + payments)
- **[P0]** Portal saved payment methods
  - Section: Transactions
  - Backend: YES (merchant payments)
- **[P0]** Saved cards
  - Section: Transactions
  - Backend: YES (merchant payments)
- **[P2]** Payment modes on type
  - Section: Transactions
  - Backend: YES (`payments-extended.ts`)
- **[P2]** Deposits & full payment
  - Section: Transactions
  - Backend: YES (merchant payments)
- **[P2]** Refunds (full / partial / wallet)
  - Section: Refund actions
  - Backend: YES (`appointment-refunds.ts`)
- **[P2]** Refund to original payment method
  - Section: Transactions
  - Backend: YES (`appointment-refunds.ts`)
- **[P2]** Refund to client wallet (store credit)
  - Section: Transactions
  - Backend: YES (`appointment-refunds.ts`)
- **[P2]** Payment transaction ledger
  - Section: /payments/transactions
  - Backend: YES (merchant payments)
- **[P2]** Stripe Connect payments
  - Section: Transactions
  - Backend: YES (merchant payments)
- **[P2]** Square payments
  - Section: Transactions
  - Backend: YES (merchant payments)

---

## PAGE: /settings/security

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=0

### MISSING / INCOMPLETE

- **[P0]** Per-type access control
  - Section: Security & Org
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (RBAC filters)

---

## PAGE: /video

**CLASSIFICATION:** KEEP VISUAL / EXTEND FUNCTIONALITY
**PRIORITY SUMMARY:** P0=1, P1=0, P2=8

### MISSING / INCOMPLETE

- **[P0]** Teams meeting auto-create
  - Section: Meetings Upcoming
  - Gap: Backend exists; admin/contextual UI not exposed on final page
  - Backend: YES (`calendar/teams-meeting.ts`)
- **[P2]** Upcoming meetings list
  - Section: Meetings Upcoming
  - Backend: YES (transovo-video)
- **[P2]** Host video for appointment
  - Section: Meetings Upcoming
  - Backend: YES (transovo-video)
- **[P2]** Public video join
  - Section: Meetings Upcoming
  - Backend: YES (transovo-video)
- **[P2]** Meeting recaps / notetaker
  - Section: Meetings Upcoming
  - Backend: YES (meeting-assistant)
- **[P2]** Transovo Video settings
  - Section: Meetings Upcoming
  - Backend: YES (—)
- **[P2]** AI Notetaker settings
  - Section: Meetings Upcoming
  - Backend: YES (—)
- **[P2]** Calendar meeting indicators
  - Section: Meetings Upcoming
  - Backend: YES (meeting-indicators)
- **[P2]** Meeting polls
  - Section: Meetings Upcoming
  - Backend: YES (`meeting-polls.ts`)

---


---

# PART 4 — FULL FEATURE LEDGER (308 rows)

CSV format. Columns: FEATURE_ID, FEATURE_NAME, V1_V2, CURRENT_IMPL_STATUS, CURRENT_UI_LOCATION, CURRENT_ROUTE, BACKEND_LOCATION, FINAL_USER_NAME, FINAL_PARENT_DOMAIN, FINAL_CANONICAL_PAGE, FINAL_SECTION, FINAL_SURFACE_TYPE, FINAL_CONTEXTUAL_ENTRY, PAGE_CLASSIFICATION, UI_PRESENT, UI_COMPLETE, BACKEND_PRESENT, BACKEND_COMPLETE, PUBLIC_PRESENT, PUBLIC_COMPLETE, PORTAL_PRESENT, PORTAL_COMPLETE, PROVIDER_DEPENDENCY, DUPLICATE_UI, TEMP_PARITY_EXISTS, IMPL_STATE, MISSING_UI, MISSING_BACKEND, NEXT_ACTION, UAT_STATUS, NOTES

```csv
FEATURE_ID,FEATURE_NAME,V1_V2,CURRENT_IMPL_STATUS,CURRENT_UI_LOCATION,CURRENT_ROUTE,BACKEND_LOCATION,FINAL_USER_NAME,FINAL_PARENT_DOMAIN,FINAL_CANONICAL_PAGE,FINAL_SECTION,FINAL_SURFACE_TYPE,FINAL_CONTEXTUAL_ENTRY,PAGE_CLASSIFICATION,UI_PRESENT,UI_COMPLETE,BACKEND_PRESENT,BACKEND_COMPLETE,PUBLIC_PRESENT,PUBLIC_COMPLETE,PORTAL_PRESENT,PORTAL_COMPLETE,PROVIDER_DEPENDENCY,DUPLICATE_UI,TEMP_PARITY_EXISTS,IMPL_STATE,MISSING_UI,MISSING_BACKEND,NEXT_ACTION,UAT_STATUS,NOTES
1-1,Appointments overview (Home),V1,UA_PENDING,`/appointments/overview`,`/appointments/overview`,`overview` API + overview page,Appointments overview (Home),Appointments,/appointments/overview,/appointments/overview,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,UA_PENDING,KEEP visual; verify KPIs match runtime
1-2,Primary product nav,V1,PASS,Shell sidebar,Shell sidebar,`appointments-nav.ts`,Primary product nav,Appointments,SHELL_RUNTIME,Product Shell,RUNTIME_ONLY,,KEEP,YES,YES,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,RUNTIME_ONLY_COMPLETE,,,Extend on canonical page per IA directive,PASS,
1-3,Mobile bottom nav,V1,UA_PENDING,Mobile shell,Mobile shell,`appointments-nav.ts`,Mobile bottom nav,Appointments,SHELL_RUNTIME,Product Shell,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
1-4,Progressive disclosure modules,V1,UA_PENDING,Nav gating,Nav gating,`scheduling-modules.ts`,Progressive disclosure modules,Appointments,SHELL_RUNTIME,Product Shell,RUNTIME_ONLY,,KEEP,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,RUNTIME_ONLY_COMPLETE,,,Extend on canonical page per IA directive,UA_PENDING,
1-5,Platform setup wizard,V1,UA_PENDING,`/appointments/setup`,`/appointments/setup`,setup page,Platform setup wizard,Appointments,/appointments/setup,Setup,PAGE_SECTION,,EXTEND,YES,PARTIAL,NO,NO,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
1-6,Global search (overview),V1,UA_PENDING,Overview header,Overview header,`global-search.ts`,Global search (overview),Appointments,/appointments/overview,Header search,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
1-7,V1 launch nav gating,V1,PASS,Shell,Shell,`v1-launch-nav.ts`,V1 launch nav gating,Appointments,SHELL_RUNTIME,Product Shell,RUNTIME_ONLY,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,RUNTIME_ONLY_COMPLETE,,,Extend on canonical page per IA directive,PASS,
2-1,Booking types list & editor,V1,UA_PENDING,`/appointments/types`,`/appointments/types`,`types` API + TypeEditor,Booking types list & editor,Booking,/appointments/types,/appointments/types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,Split landing exists; mega-editor still partially shared
2-2,Archetypes MEETING / SERVICE / CLASS,V1,UA_PENDING,Type editor,Type editor,`booking-type-kind.ts`,Archetypes MEETING / SERVICE / CLASS,Booking,/appointments/types,/appointments/types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-3,Multiple duration options,V1,UA_PENDING,Type editor,Type editor,type config,Multiple duration options,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-4,Visibility (public / unlisted / secret),V1,UA_PENDING,Type editor,Type editor,type config,Visibility (public / unlisted / secret),Booking,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-5,Display order & bulk reorder,V1,UA_PENDING,Type editor,Type editor,types bulk API,Display order & bulk reorder,Booking,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-6,Custom booking questions,V1,UA_PENDING,Type editor + public Info,Type editor + public Info,`bookingQuestions`,Custom booking questions,Booking,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-7,Group booking / attendee count,V1,UA_PENDING,Type + public,Type + public,`groupBooking`,Group booking / attendee count,Booking,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-8,Recurring eligibility on type,V1,UA_PENDING,Type editor,Type editor,`recurring` config,Recurring eligibility on type,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-9,Staff assignment modes,V1,UA_PENDING,Type editor + staff picker,Type editor + staff picker,`scheduling-domain.ts`,Staff assignment modes,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-10,Location assignment,V1,UA_PENDING,Type editor,Type editor,platform `locations`,Location assignment,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-11,Payment modes on type,V1,UA_PENDING,Type editor,Type editor,`payments-extended.ts`,Payment modes on type,Booking,/payments/transactions,Transactions,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,Stripe / Square,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-12,Cancellation policy,V1,UA_PENDING,Type editor,Type editor,`extendedCancellationPolicy`,Cancellation policy,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-13,Reschedule policy,V1,UA_PENDING,Type editor,Type editor,`extendedReschedulePolicy`,Reschedule policy,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-14,Booking approval required,V1,UA_PENDING,Type editor,Type editor,`booking-approval.ts`,Booking approval required,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-15,Categories on type,V1,UA_PENDING,Type editor,Type editor,`booking-category.ts`,Categories on type,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-16,Images on type,V1,UA_PENDING,Type + public Service step,Type + public Service step,`imageUrl`,Images on type,Booking,/appointments/types/services,Service Editor,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-17,Required resources on type,V1,UA_PENDING,Type editor,Type editor,`resources.ts`,Required resources on type,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-18,Add-ons on type,V1,UA_PENDING,Type + commerce,Type + commerce,`add-ons.ts`,Add-ons on type,Booking,/appointments/types/services,Service Editor,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-19,Add-on duration & resource effects,V1,UA_PENDING,Type + public Info,Type + public Info,`add-ons.ts`,Add-on duration & resource effects,Booking,/appointments/types/services,Service Editor,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-20,Intake forms on type,V1,UA_PENDING,Type + public Info,Type + public Info,`intake-forms.ts`,Intake forms on type,Booking,/appointments/booking/forms,Intake templates,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-21,Intake file / image upload,V1,CODE_COMPLETE,Public Info (field type),Public Info (field type),`IntakeFieldType` file/image,Intake file / image upload,Booking,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,YES,LIKELY,YES,PARTIAL,N/A,N/A,N/A,N/A,Object storage (S3/Supabase),NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,CODE_COMPLETE,
2-22,Service phases (multi-phase duration),V1,UA_PENDING,Type editor phases,Type editor phases,`service-phases.ts`,Service phases (multi-phase duration),Booking,/appointments/types/services,Service Editor,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-23,Provider-release processing time,V1,UA_PENDING,Type phases (`staffRequired`),Type phases (`staffRequired`),`staff-phase-occupancy.ts`,Provider-release processing time,Booking,/appointments/types/services,Service Editor,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-24,Confirmation page customization,V1,UA_PENDING,Public Done step,Public Done step,`confirmationPage`,Confirmation page customization,Booking,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-25,Booking page settings,V1,UA_PENDING,`/appointments/booking`,`/appointments/booking`,`settings.ts`,Booking page settings,Booking,/appointments/booking,Booking Pages,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-26,Share & embed hub,V1,UA_PENDING,`/appointments/booking/share`,`/appointments/booking/share`,share hub client,Share & embed hub,Booking,/appointments/booking,Share & Embed,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,POSSIBLE,NO,MOVE_INTO_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-27,Booking QR code generator,V1,UA_PENDING,`/appointments/booking/share`,`/appointments/booking/share`,Share hub + QR API,Booking QR code generator,Booking,/appointments/booking,Share & Embed → QR,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,`qrcode` npm,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-28,Single-use booking links,V1,UA_PENDING,—,—,`booking-links.ts`,Single-use booking links,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
2-29,Embed URL & iframe,V1,UA_PENDING,`/embed/book/[slug]`,`/embed/book/[slug]`,`scheduler-theme.ts`,Embed URL & iframe,Booking,/appointments/booking,Booking Pages,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-30,Booking approval queue,V1,UA_PENDING,—,—,`booking-approval.ts`,Booking approval queue,Booking,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
2-31,Scheduler theme / branding,V1,UA_PENDING,Commerce admin,Commerce admin,`scheduler-theme.ts`,Scheduler theme / branding,Booking,/appointments/booking,Branding,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
2-32,Custom booking domain,V1,UA_PENDING,Theme config,Theme config,`SchedulerThemeConfig.customDomain`,Custom booking domain,Booking,/appointments/booking,Branding → Custom domain,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,DNS / TLS,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-33,Advanced custom CSS,V1,UA_PENDING,Theme config,Theme config,`SchedulerThemeConfig.customCss`,Advanced custom CSS,Booking,/appointments/booking,Branding → Advanced CSS,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-34,Custom terminology / locale,V1,UA_PENDING,Theme + public labels,Theme + public labels,`bookingTerminology`,Custom terminology / locale,Booking,/appointments/booking,Branding → Terminology,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-35,Direct booking links per type,V1,UA_PENDING,Share hub,Share hub,`directLinksForWorkspace()`,Direct booking links per type,Booking,/appointments/booking,Booking Pages,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-36,Booking source / UTM attribution,V1,UA_PENDING,—,—,`booking-source.ts`,Booking source / UTM attribution,Booking,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
2-37,Named availability schedules,V1,UA_PENDING,`/appointments/availability`,`/appointments/availability`,`scheduling-capabilities`,Named availability schedules,Booking,/appointments/types,Booking Types,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-38,Categories admin,V1,UA_PENDING,`/appointments/categories`,`/appointments/categories`,`booking-category.ts`,Categories admin,Booking,/appointments/types/services,Manage Categories drawer,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/categories`
2-39,Client restrictions,V1,UA_PENDING,`/appointments/client-restrictions`,`/appointments/client-restrictions`,`client-restrictions.ts`,Client restrictions,Booking,/contacts/[id],Booking Access,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/client-restrictions`
2-40,Audience segments,V1,UA_PENDING,`/appointments/segments`,`/appointments/segments`,`appointment-segments.ts`,Audience segments,Booking,/contacts/segments,/contacts/segments,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,AppointmentSegmentsClient unrouted; redirect in place,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/segments`
2-41,Terms & conditions acceptance,V1,UA_PENDING,Public Info checkbox,Public Info checkbox,`terms-acceptance.ts`,Terms & conditions acceptance,Booking,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
2-42,Formal contracts + e-signature,V1,UA_PENDING,— (API-first),— (API-first),`booking-contracts.ts`,Formal contracts + e-signature,Booking,/appointments/booking/forms,Contracts,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,API-first; Forms & Documents page may be thin,,Extend on canonical page per IA directive,UA_PENDING,
3-1,Weekly hours editor,V1,PASS,`/appointments/availability`,`/appointments/availability`,`availability-engine.ts`,Weekly hours editor,Booking,/appointments/availability,Availability,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,PASS,
3-2,Timezone,V1,PASS,Availability + settings,Availability + settings,platform config,Timezone,Booking,/appointments/availability,Availability,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,PASS,
3-3,Minimum booking notice,V1,PASS,Availability,Availability,`scheduling-limits.ts`,Minimum booking notice,Booking,/appointments/availability,Availability,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,PASS,
3-4,Maximum booking horizon,V1,PASS,Availability,Availability,`scheduling-limits.ts`,Maximum booking horizon,Booking,/appointments/availability,Availability,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,PASS,
3-5,Date overrides (custom hours),V1,UA_PENDING,Availability,Availability,`dateOverrides`,Date overrides (custom hours),Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
3-6,Blackout dates,V1,UA_PENDING,Availability UI,Availability UI,platform config,Blackout dates,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
3-7,Holiday calendar,V1,UA_PENDING,Availability,Availability,`holidays`,Holiday calendar,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
3-8,Booking limits (daily/weekly/per-type),V1,PASS,Availability,Availability,`scheduling-limits.ts`,Booking limits (daily/weekly/per-type),Booking,/appointments/availability,Availability,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,PASS,
3-9,Fixed appointment start times,V1,UA_PENDING,Availability config,Availability config,`fixed-start-times.ts`,Fixed appointment start times,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
3-10,Custom start interval,V1,UA_PENDING,—,—,`slotStepMinutes()`,Custom start interval,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
3-11,Make Me Look Busy (hide slots),V1,UA_PENDING,Availability config,Availability config,`availability-density.ts`,Make Me Look Busy (hide slots),Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
3-12,Minimize gaps / compact scheduling,V1,UA_PENDING,—,—,`minimize-gaps.ts`,Minimize gaps / compact scheduling,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
3-13,Native slot generation,V1,PASS,Public DateTime,Public DateTime,`availability-engine.ts`,Native slot generation,Booking,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,LIKELY,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,PASS,
3-14,Staff-aware slots,V1,PASS,Public staff picker,Public staff picker,`staff-availability.ts`,Staff-aware slots,Booking,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,LIKELY,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,PASS,
3-15,Group / collective scheduling,V1,UA_PENDING,—,—,`scheduling-domain.ts`,Group / collective scheduling,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
3-16,Resource-constrained slots,V1,UA_PENDING,—,—,`resource-availability.ts`,Resource-constrained slots,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
3-17,External calendar busy blocking,V1,UA_PENDING,Integrations,Integrations,`scheduling-domain.ts`,External calendar busy blocking,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Google / Microsoft OAuth,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
3-18,Atomic slot booking,V1,PASS,—,—,`slot-booking.ts`,Atomic slot booking,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,PostgreSQL,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,PASS,
3-19,Slot validation,V1,PASS,—,—,`slot-validation.ts`,Slot validation,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,PASS,
3-20,Slot diagnostics,V1,UA_PENDING,—,—,`slot-diagnostics.ts`,Slot diagnostics,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
3-21,Dynamic pricing by slot,V1,UA_PENDING,Commerce admin,Commerce admin,`dynamic-pricing.ts`,Dynamic pricing by slot,Booking,PARITY_TEMP,Parity Temp,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
3-22,Admin availability query,V1,PASS,—,—,`availability-engine.ts`,Admin availability query,Booking,/appointments/availability,Availability,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,PASS,
3-23,Class capacity display mode,V1,UA_PENDING,Public classes,Public classes,`class-capacity-display.ts`,Class capacity display mode,Booking,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
4-1,Staff scheduling config,V1,UA_PENDING,`/appointments/staff`,`/appointments/staff`,platform `staff[]`,Staff scheduling config,Booking,/appointments/staff,Staff,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
4-2,Any employee / round-robin,V1,PASS,Public staff picker,Public staff picker,`scheduling-domain.ts`,Any employee / round-robin,Booking,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,LIKELY,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,PASS,
4-3,Locations,V1,CODE_COMPLETE,`/appointments/locations`,`/appointments/locations`,platform `locations`,Locations,Booking,/appointments/locations,Locations,PAGE_SECTION,,EXTEND,YES,LIKELY,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,CODE_COMPLETE,
4-4,Location-specific hours/services,V1,CODE_COMPLETE,Locations,Locations,`location-scheduling.ts`,Location-specific hours/services,Booking,/appointments/types/services,Service Editor,PAGE_SECTION,,EXTEND,YES,LIKELY,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,CODE_COMPLETE,
4-5,Location-specific timezone,V1,CODE_COMPLETE,Locations,Locations,platform `locations`,Location-specific timezone,Booking,/appointments/locations,Locations,PAGE_SECTION,,EXTEND,YES,LIKELY,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,CODE_COMPLETE,
4-6,Location-specific staff assignment,V1,CODE_COMPLETE,Locations + type editor,Locations + type editor,platform `locations`,Location-specific staff assignment,Booking,/appointments/locations,Locations,PAGE_SECTION,,EXTEND,YES,LIKELY,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,CODE_COMPLETE,
4-7,Location-specific resource assignment,V1,CODE_COMPLETE,Locations / resources,Locations / resources,`resources.ts`,Location-specific resource assignment,Booking,/appointments/locations,Locations,PAGE_SECTION,,EXTEND,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,CODE_COMPLETE,
4-8,"Resources (rooms, equipment)",V1,UA_PENDING,`/appointments/resources`,`/appointments/resources`,`resources.ts`,"Resources (rooms, equipment)",Booking,/appointments/booking/rooms-equipment,/appointments/booking/rooms-equipment,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/resources`
4-9,Resource quantity / capacity,V1,UA_PENDING,Resources admin,Resources admin,`SchedulingResource.quantity`,Resource quantity / capacity,Booking,/appointments/booking/rooms-equipment,Rooms & Equipment,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
4-10,Resource pools (any-one-in-group),V1,UA_PENDING,—,—,`resource-pools.ts`,Resource pools (any-one-in-group),Booking,/appointments/booking/rooms-equipment,Rooms & Equipment,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
4-11,Resource persist on book,V1,UA_PENDING,—,—,`persistAppointmentResources`,Resource persist on book,Booking,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
4-12,Staff round-robin state,V1,UA_PENDING,—,—,`roundRobinState`,Staff round-robin state,Booking,/appointments/staff,Staff,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
4-13,Scheduling groups,V1,UA_PENDING,Team pages,Team pages,`team-scheduling.ts`,Scheduling groups,Booking,/appointments/team-pages,Team Booking,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
4-14,Staff / service calendar colors,V1,UA_PENDING,Calendar,Calendar,`CalendarColorConfig`,Staff / service calendar colors,Booking,/appointments/calendar,Color legend / indicators,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Heuristic colors only; not tied to type color config,,Extend on canonical page per IA directive,UA_PENDING,
4-15,Per-staff external calendar,V1,UA_PENDING,Integrations,Integrations,calendar sync jobs,Per-staff external calendar,Booking,RUNTIME_ONLY,Background,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,Google / Microsoft,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
5-1,Public booking home,V1,UA_PENDING,`/book/[slug]`,`/book/[slug]`,public book flow,Public booking home,Public,/appointments/pos,Point of Sale,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-2,Deep link to one type,V1,UA_PENDING,`/book/[slug]/[serviceId]`,`/book/[slug]/[serviceId]`,public flow,Deep link to one type,Public,/appointments/types/services,Service Editor,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-3,Embeddable widget,V1,UA_PENDING,`/embed/book/[slug]`,`/embed/book/[slug]`,embed route,Embeddable widget,Public,/appointments/booking,Booking Pages,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-4,Service / type picker,V1,UA_PENDING,Public flow,Public flow,ServiceStep,Service / type picker,Public,/appointments/types/services,Service Editor,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-5,Staff picker,V1,UA_PENDING,Public flow,Public flow,DateTime / Info,Staff picker,Public,/appointments/pos,Point of Sale,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-6,Location picker,V1,UA_PENDING,Public flow,Public flow,public flow,Location picker,Public,/appointments/pos,Point of Sale,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-7,Duration picker,V1,UA_PENDING,Public flow,Public flow,public flow,Duration picker,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-8,Live availability slots,V1,PASS,DateTime step,DateTime step,`availability-engine.ts`,Live availability slots,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,LIKELY,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,PASS,
5-9,Multi-service chain,V1,UA_PENDING,DateTime step,DateTime step,`multi-service.ts`,Multi-service chain,Public,/appointments/types/services,Service Editor,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-10,Multi-staff per service line,V1,UA_PENDING,Public book,Public book,`multi-service.ts`,Multi-staff per service line,Public,/appointments/types/services,Service Editor,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-11,Multi-booking session (cart),V1,UA_PENDING,DateTime cart,DateTime cart,`booking-session.ts`,Multi-booking session (cart),Public,/appointments/pos,Point of Sale,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-12,Custom booking questions,V1,UA_PENDING,Public flow,Public flow,InfoStep,Custom booking questions,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-13,Custom client fields,V1,UA_PENDING,Info step,Info step,`custom-fields.ts`,Custom client fields,Public,/contacts/fields,/contacts/fields,PUBLIC_BOOKING,,MERGE,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,YES,YES,MOVE_INTO_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-14,Intake forms,V1,UA_PENDING,Info step,Info step,`intake-forms.ts`,Intake forms,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-15,Add-on selection,V1,UA_PENDING,Info step,Info step,`add-ons.ts`,Add-on selection,Public,/appointments/types/services,Service Editor,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-16,Package / membership entitlements,V1,UA_PENDING,Info step,Info step,`entitlements.ts`,Package / membership entitlements,Public,/appointments/packages,Packages,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-17,Wallet balance at checkout,V1,UA_PENDING,Info step,Info step,`client-wallet.ts`,Wallet balance at checkout,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-18,Saved card on file,V1,UA_PENDING,Info step,Info step,merchant payments,Saved card on file,Public,/payments/transactions,Transactions,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,Stripe,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-19,Recurring booking,V1,UA_PENDING,Info step,Info step,`recurring.ts`,Recurring booking,Public,/appointments/pos,Point of Sale,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-20,Recurring date preview,V1,UA_PENDING,Info step,Info step,`recurring-schedule.ts`,Recurring date preview,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-21,Group attendee count,V1,UA_PENDING,Info step,Info step,public flow,Group attendee count,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-22,Email OTP verification,V1,UA_PENDING,Email step,Email step,public book,Email OTP verification,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,Email provider,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-23,Booking protection / bot checks,V1,PASS,Public flow,Public flow,`booking-protection.ts`,Booking protection / bot checks,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,LIKELY,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,PASS,
5-24,Returning invitee cookie,V1,UA_PENDING,—,—,`booking-links.ts`,Returning invitee cookie,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,NO,PARTIAL,N/A,N/A,—,NO,NO,PUBLIC_FLOW_MISSING,Public customer flow not fully exposed,,Extend on canonical page per IA directive,UA_PENDING,
5-25,Single-use token links,V1,UA_PENDING,—,—,booking-links,Single-use token links,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,NO,PARTIAL,N/A,N/A,—,NO,NO,PUBLIC_FLOW_MISSING,Public customer flow not fully exposed,,Extend on canonical page per IA directive,UA_PENDING,
5-26,Stripe checkout,V1,UA_PENDING,Payment redirect,Payment redirect,merchant payments,Stripe checkout,Public,/payments/transactions,Transactions,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,Stripe Connect,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-27,Square in-page payment,V1,UA_PENDING,Payment step,Payment step,merchant payments,Square in-page payment,Public,/payments/transactions,Transactions,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,Square,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-28,Public waitlist join,V1,UA_PENDING,Waitlist step,Waitlist step,`waitlist.ts`,Public waitlist join,Public,/appointments/waitlist,Waitlist,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,SMS (optional),NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-29,Public AI booking chat,V1,UA_PENDING,AI step,AI step,`ai-scheduling/`,Public AI booking chat,Public,/appointments/ai-booking,AI Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,LLM provider,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-30,Public email AI booking,V1,UA_PENDING,—,—,email-ai route,Public email AI booking,Public,/appointments/ai-booking,AI Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,NO,PARTIAL,N/A,N/A,LLM + email,NO,NO,PUBLIC_FLOW_MISSING,Public customer flow not fully exposed,,Extend on canonical page per IA directive,UA_PENDING,
5-31,Public store (packages),V1,UA_PENDING,`/book/[slug]/store`,`/book/[slug]/store`,`store-checkout.ts`,Public store (packages),Public,/appointments/packages,Packages,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,Stripe,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-32,Public class enrollment,V1,UA_PENDING,`/book/[slug]/classes`,`/book/[slug]/classes`,`classes.ts`,Public class enrollment,Public,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
5-33,PWA registration,V2,N/A,Public shell,Public shell,public PWA register,PWA registration,Public,V2_DEFERRED,V2_DEFERRED,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,V2_DEFERRED,,,Defer from V1 UI batch,N/A,
5-34,Reminder diagnostics (support),V2,N/A,`/book/[slug]/reminders`,`/book/[slug]/reminders`,—,Reminder diagnostics (support),Public,RUNTIME_ONLY,RUNTIME_ONLY,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,V2_DEFERRED,,,Defer from V1 UI batch,N/A,
6-1,Appointments list,V1,UA_PENDING,`/appointments`,`/appointments`,`appointments-service.ts`,Appointments list,Operations,/appointments,/appointments,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-2,Create appointment (staff),V1,UA_PENDING,`/appointments/new`,`/appointments/new`,`booking-platform.ts`,Create appointment (staff),Operations,/appointments/new,Create Appointment,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-3,Calendar slot-click create,V1,UA_PENDING,`/appointments/calendar`,`/appointments/calendar`,calendar components,Calendar slot-click create,Operations,/appointments/calendar,Slot click → create,PAGE_SECTION,,EXTEND,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-4,Appointment detail,V1,UA_PENDING,`/appointments/[id]`,`/appointments/[id]`,detail page,Appointment detail,Operations,/appointments/[id],/appointments/[id],PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-5,Calendar view,V1,UA_PENDING,`/appointments/calendar`,`/appointments/calendar`,calendar,Calendar view,Operations,/appointments/types/events,Workshop/Event Editor,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-6,Meeting / video indicators,V1,UA_PENDING,Calendar,Calendar,meeting-indicators API,Meeting / video indicators,Operations,/appointments/calendar,Meeting indicators,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-7,Reschedule (staff),V1,UA_PENDING,Detail,Detail,`booking-platform.ts`,Reschedule (staff),Operations,/appointments/calendar,Calendar & Operations,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-8,Cancel (staff),V1,UA_PENDING,Detail,Detail,`booking-platform.ts`,Cancel (staff),Operations,/appointments/calendar,Calendar & Operations,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-9,Internal notes,V1,UA_PENDING,Detail,Detail,`internal-notes.ts`,Internal notes,Operations,/appointments/[id],Appointment Detail,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-10,Reminder suppress / reset,V1,PASS,Detail,Detail,`reminder-delivery.ts`,Reminder suppress / reset,Operations,/appointments/calendar,Calendar & Operations,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,PASS,
6-11,Reminder timeline,V1,UA_PENDING,Detail,Detail,reminder-timeline API,Reminder timeline,Operations,/appointments/[id],Appointment Detail,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-12,Status workflow,V1,UA_PENDING,Detail,Detail,status enums,Status workflow,Operations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-13,Multi-service lines on record,V1,UA_PENDING,Detail,Detail,`multi-service.ts`,Multi-service lines on record,Operations,/appointments/[id],Service lines,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
6-14,Policy snapshot on record,V1,UA_PENDING,—,—,`policy-snapshot.ts`,Policy snapshot on record,Operations,/appointments/[id],Policies snapshot,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend writes snapshot; detail display may be partial,,Extend on canonical page per IA directive,UA_PENDING,
6-15,Provider calendar sync,V1,UA_PENDING,—,—,sync jobs,Provider calendar sync,Operations,RUNTIME_ONLY,Background,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,Google / Microsoft,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
7-1,Manage appointment link,V1,UA_PENDING,`/manage/[token]`,`/manage/[token]`,`manage-appointment.ts`,Manage appointment link,Portal,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-2,Reschedule via manage link,V1,UA_PENDING,Manage page,Manage page,manage actions,Reschedule via manage link,Portal,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-3,Cancel via manage link,V1,UA_PENDING,Manage page,Manage page,manage actions,Cancel via manage link,Portal,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-4,Recurring series cancel scopes,V1,UA_PENDING,Manage page,Manage page,`recurring.ts`,Recurring series cancel scopes,Portal,CUSTOMER_PORTAL,Customer Portal,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,LIKELY,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-5,Recurring series reschedule scopes,V1,UA_PENDING,Manage page,Manage page,`recurring.ts`,Recurring series reschedule scopes,Portal,CUSTOMER_PORTAL,Customer Portal,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,LIKELY,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-6,Pay balance via manage link,V1,UA_PENDING,Manage page,Manage page,`manage-payments.ts`,Pay balance via manage link,Portal,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,Stripe / Square,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-7,Edit intake via manage link,V1,UA_PENDING,Manage page,Manage page,`manage-intake.ts`,Edit intake via manage link,Portal,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-8,ICS calendar download,V1,UA_PENDING,Manage page,Manage page,client ICS builder,ICS calendar download,Portal,CUSTOMER_PORTAL,Customer Portal,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,LIKELY,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-9,Book again link,V1,UA_PENDING,Manage page,Manage page,manage page,Book again link,Portal,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-10,Client portal (unified account),V1,UA_PENDING,`/portal/[token]`,`/portal/[token]`,`client-portal.ts`,Client portal (unified account),Portal,CUSTOMER_PORTAL,Customer Portal,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-11,Portal: upcoming / past appointments,V1,UA_PENDING,Portal UI,Portal UI,portal API,Portal: upcoming / past appointments,Portal,CUSTOMER_PORTAL,Customer Portal,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-12,Portal: packages & credits,V1,UA_PENDING,Portal UI,Portal UI,entitlements,Portal: packages & credits,Portal,/appointments/packages,Packages,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-13,Portal: memberships,V1,UA_PENDING,Portal UI,Portal UI,entitlements,Portal: memberships,Portal,/appointments/memberships,Memberships,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-14,Portal: gift balances,V1,UA_PENDING,Portal UI,Portal UI,entitlements,Portal: gift balances,Portal,/appointments/gift-cards,Gift Cards,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-15,Portal: package usage history,V1,UA_PENDING,Portal UI,Portal UI,portal API,Portal: package usage history,Portal,/appointments/packages,Packages,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-16,Portal: purchase & payment history,V1,UA_PENDING,Portal UI,Portal UI,`client-portal.ts` + payments,Portal: purchase & payment history,Portal,/payments/transactions,Transactions,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,Stripe / Square,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-17,Portal wallet,V1,UA_PENDING,Portal UI,Portal UI,`client-wallet.ts`,Portal wallet,Portal,CUSTOMER_PORTAL,Customer Portal,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,LIKELY,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-18,Portal saved payment methods,V1,UA_PENDING,Portal UI,Portal UI,merchant payments,Portal saved payment methods,Portal,/payments/transactions,Transactions,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,Stripe,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
7-19,Legacy confirm / cancel / reschedule tokens,V1,metadata tokens,`/appointments/confirm,`/appointments/confirm,legacy routes,Legacy confirm / cancel / reschedule tokens,Portal,CUSTOMER_PORTAL,Customer Portal,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,LIKELY,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,metadata tokens,
7-20,Waitlist offer accept,V1,UA_PENDING,`/waitlist/accept/[token]`,`/waitlist/accept/[token]`,`waitlist.ts`,Waitlist offer accept,Portal,/appointments/waitlist,Waitlist,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-1,Packages & memberships hub,V1,UA_PENDING,`/appointments/commerce`,`/appointments/commerce`,commerce admin,Packages & memberships hub,Commerce,/appointments/packages,/appointments/packages,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/commerce`
8-2,Package products,V1,UA_PENDING,Commerce admin,Commerce admin,`packages.ts`,Package products,Commerce,/appointments/packages,/appointments/packages,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,YES,EXTEND_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
8-3,Package purchase,V1,UA_PENDING,Commerce admin,Commerce admin,`purchasePackageForContact`,Package purchase,Commerce,/appointments/packages,Packages,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Stripe,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
8-4,Package credits & ledger,V1,UA_PENDING,Portal / book,Portal / book,`packages.ts`,Package credits & ledger,Commerce,/appointments/packages,Packages,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,LIKELY,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-5,Package lifecycle (restore on cancel),V1,UA_PENDING,—,—,`package-lifecycle.ts`,Package lifecycle (restore on cancel),Commerce,/appointments/packages,Packages,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
8-6,Package credit forfeiture (late cancel / no-show),V1,UA_PENDING,—,—,`package-lifecycle.ts`,Package credit forfeiture (late cancel / no-show),Commerce,/appointments/packages,Packages,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
8-7,Mixed-content package entitlements,V1,UA_PENDING,Commerce config,Commerce config,`PackageCreditRule`,Mixed-content package entitlements,Commerce,/appointments/packages,Packages,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-8,Membership products,V1,UA_PENDING,Commerce admin,Commerce admin,`memberships.ts`,Membership products,Commerce,/appointments/memberships,/appointments/memberships,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,YES,EXTEND_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
8-9,Membership subscriptions,V1,UA_PENDING,Commerce / portal,Commerce / portal,`memberships.ts`,Membership subscriptions,Commerce,/appointments/memberships,Memberships,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,Stripe Billing,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-10,Membership lifecycle (pause/cancel/past_due),V1,UA_PENDING,—,—,`membership-lifecycle.ts`,Membership lifecycle (pause/cancel/past_due),Commerce,/appointments/memberships,Memberships,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,Stripe webhooks,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
8-11,Membership failed-payment suspension,V1,UA_PENDING,—,—,`membership-lifecycle.ts`,Membership failed-payment suspension,Commerce,/appointments/memberships,Memberships,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,Stripe webhooks,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
8-12,Membership payment recovery / entitlement restore,V1,UA_PENDING,—,—,`membership-lifecycle.ts`,Membership payment recovery / entitlement restore,Commerce,/appointments/memberships,Memberships,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,Stripe webhooks,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
8-13,Membership-only booking types / classes,V1,UA_PENDING,Type editor + public,Type editor + public,`membership-lifecycle.ts`,Membership-only booking types / classes,Commerce,/appointments/memberships,Memberships,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-14,Recurring membership credit replenishment,V1,UA_PENDING,Commerce config,Commerce config,`MembershipBenefits.includedCredits`,Recurring membership credit replenishment,Commerce,/appointments/memberships,Memberships,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Stripe Billing,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-15,Gift certificates,V1,UA_PENDING,Commerce admin,Commerce admin,`gift-certificates.ts`,Gift certificates,Commerce,/appointments/gift-cards,/appointments/gift-cards,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,YES,EXTEND_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
8-16,Gift balance redemption at checkout,V1,UA_PENDING,Public Info / POS,Public Info / POS,`gift-certificates.ts`,Gift balance redemption at checkout,Commerce,/appointments/gift-cards,Gift Cards,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-17,Gift balance redemption history,V1,UA_PENDING,Portal / commerce,Portal / commerce,`gift-certificates.ts`,Gift balance redemption history,Commerce,/appointments/gift-cards,Gift Cards,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-18,Coupons / discounts,V1,UA_PENDING,Commerce admin,Commerce admin,`coupons.ts`,Coupons / discounts,Commerce,/appointments/discounts,/appointments/discounts,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
8-19,Programs (multi-visit bundles),V2,UA_PENDING,Commerce admin,Commerce admin,`programs.ts`,Programs (multi-visit bundles),Commerce,V2_DEFERRED,V2_DEFERRED,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,YES,V2_DEFERRED,,,Defer from V1 UI batch,UA_PENDING,
8-20,Payment plans (installments),V2,UA_PENDING,Commerce admin,Commerce admin,`payment-plans.ts`,Payment plans (installments),Commerce,/appointments/payments,Payment plans (V2 surface),V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,Stripe,NO,YES,V2_DEFERRED,,,Defer from V1 UI batch,UA_PENDING,
8-21,Client wallet,V1,UA_PENDING,Commerce / portal,Commerce / portal,`client-wallet.ts`,Client wallet,Commerce,CUSTOMER_PORTAL,Customer Portal,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,LIKELY,N/A,N/A,YES,PARTIAL,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-22,Loyalty programs,V2,UA_PENDING,Commerce admin,Commerce admin,`loyalty.ts`,Loyalty programs,Commerce,V2_DEFERRED,V2_DEFERRED,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,YES,V2_DEFERRED,,,Defer from V1 UI batch,UA_PENDING,
8-23,POS cart (session + line items),V1,CODE_COMPLETE,Commerce admin,Commerce admin,`pos-cart.ts`,POS cart (session + line items),Commerce,/appointments/pos,/appointments/pos,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,YES,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,CODE_COMPLETE,
8-24,POS mixed checkout (service + package + membership + gift + product + discount + tip),V1,CODE_COMPLETE,Commerce admin,Commerce admin,`pos-cart.ts`,POS mixed checkout (service + package + membership + gift + product + discount + tip),Commerce,/appointments/pos,/appointments/pos,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,Stripe (optional for in-person),NO,YES,EXTEND_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,CODE_COMPLETE,Parity route: Commerce admin
8-25,Products for sale,V1,UA_PENDING,Commerce admin,Commerce admin,`booking-products.ts`,Products for sale,Commerce,/appointments/products,/appointments/products,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,YES,EXTEND_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
8-26,Pay-what-you-want / tipping,V1,UA_PENDING,Type + public,Type + public,`payments-extended.ts`,Pay-what-you-want / tipping,Commerce,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-27,Invoices,V1,UA_PENDING,— (API-first),— (API-first),`booking-invoices.ts`,Invoices,Commerce,/payments/invoices,/payments/invoices,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Email for send,NO,NO,EXTEND_EXISTING_PAGE,API-first; commerce panel duplicate,,Extend on canonical page per IA directive,UA_PENDING,
8-28,Deposits & full payment,V1,UA_PENDING,Public payment,Public payment,merchant payments,Deposits & full payment,Commerce,/payments/transactions,Transactions,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Stripe / Square,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-29,Saved cards,V1,UA_PENDING,Portal / book,Portal / book,merchant payments,Saved cards,Commerce,/payments/transactions,Transactions,CUSTOMER_PORTAL,,EXTEND,N/A,N/A,YES,PARTIAL,N/A,N/A,YES,PARTIAL,Stripe,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-30,Refunds (full / partial / wallet),V1,UA_PENDING,Payments UI,Payments UI,`appointment-refunds.ts`,Refunds (full / partial / wallet),Commerce,/payments/transactions,Refund actions,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Stripe / Square,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-31,Refund to original payment method,V1,UA_PENDING,Payments UI,Payments UI,`appointment-refunds.ts`,Refund to original payment method,Commerce,/payments/transactions,Transactions,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Stripe / Square,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-32,Refund to client wallet (store credit),V1,UA_PENDING,Payments UI,Payments UI,`appointment-refunds.ts`,Refund to client wallet (store credit),Commerce,/payments/transactions,Transactions,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-33,Policy fees (late cancel / no-show),V1,UA_PENDING,—,—,`policy-fees.ts`,Policy fees (late cancel / no-show),Commerce,/appointments/packages,Packages & Sales,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,Stripe,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
8-34,Payment transaction ledger,V1,UA_PENDING,`/payments/transactions`,`/payments/transactions`,merchant payments,Payment transaction ledger,Commerce,/payments/transactions,/payments/transactions,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
8-35,SMS payment links,V1,UA_PENDING,`/messaging/payments`,`/messaging/payments`,messaging payments,SMS payment links,Commerce,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,YES,PARTIAL,N/A,N/A,Telnyx / Twilio,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
9-1,Class series admin,V1,UA_PENDING,`/appointments/classes`,`/appointments/classes`,`classes.ts`,Class series admin,Booking Types,/appointments/types/classes,/appointments/types/classes,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/classes`
9-2,Class occurrences,V1,UA_PENDING,Classes admin,Classes admin,`classes.ts`,Class occurrences,Booking Types,/appointments/types/classes,Class Editor,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
9-3,Staff class enrollment,V1,UA_PENDING,Classes admin,Classes admin,classes admin,Staff class enrollment,Booking Types,/appointments/types/classes,Classes,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
9-4,Public class enrollment,V1,UA_PENDING,`/book/[slug]/classes`,`/book/[slug]/classes`,classes client,Public class enrollment,Booking Types,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
9-5,Class check-in (QR),V1,UA_PENDING,—,—,`class-check-in.ts`,Class check-in (QR),Booking Types,/appointments/types/classes,Class Editor,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
9-6,Seat selection / maps,V1,UA_PENDING,—,—,`seat-selection.ts`,Seat selection / maps,Booking Types,/appointments/types/classes,Class Editor,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
9-7,Event admission tickets,V1,UA_PENDING,—,—,`event-tickets.ts`,Event admission tickets,Booking Types,/appointments/types/classes,Class Editor,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
9-8,Group capacity on types,V1,UA_PENDING,Public,Public,`groupBooking`,Group capacity on types,Booking Types,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
9-9,Remaining spaces display,V1,UA_PENDING,Public classes,Public classes,`class-capacity-display.ts`,Remaining spaces display,Booking Types,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,LIKELY,YES,PARTIAL,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
9-10,Class waitlist (capacity-full join),V1,UA_PENDING,Public classes,Public classes,`waitlist.ts` + `classes.ts`,Class waitlist (capacity-full join),Booking Types,/appointments/waitlist,Waitlist,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,SMS (optional),NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
10-1,Waitlist admin queue,V1,UA_PENDING,`/appointments/waitlist`,`/appointments/waitlist`,`waitlist.ts`,Waitlist admin queue,Operations,/appointments/waitlist,Waitlist,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
10-2,Public waitlist join,V1,UA_PENDING,Public book,Public book,waitlist API,Public waitlist join,Operations,/appointments/waitlist,Waitlist,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,SMS,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
10-3,Waitlist preferences (staff/date/time),V1,UA_PENDING,Public + admin,Public + admin,waitlist model,Waitlist preferences (staff/date/time),Operations,/appointments/waitlist,Waitlist,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
10-4,Waitlist slot notification,V1,UA_PENDING,—,—,`waitlist.ts`,Waitlist slot notification,Operations,/appointments/waitlist,Waitlist,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,SMS provider,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
10-5,Waitlist offer + atomic accept,V1,UA_PENDING,`/waitlist/accept/[token]`,`/waitlist/accept/[token]`,`waitlist.ts`,Waitlist offer + atomic accept,Operations,/appointments/waitlist,Waitlist,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
10-6,Waitlist auto-fill on cancel,V1,UA_PENDING,—,—,`autoFillWaitlistSlot`,Waitlist auto-fill on cancel,Operations,/appointments/waitlist,Waitlist,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
10-7,Waitlist party size (group / class),V1,UA_PENDING,Public waitlist,Public waitlist,`groupBooking` + waitlist model,Waitlist party size (group / class),Operations,/appointments/waitlist,Waitlist,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
10-8,Waitlist priority rules,V1,UA_PENDING,Commerce admin,Commerce admin,`waitlist-priority.ts`,Waitlist priority rules,Operations,/appointments/waitlist,Priority rules,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,YES,EXTEND_EXISTING_PAGE,API exists; no admin UI on waitlist page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
10-9,Recalls hub,V1,UA_PENDING,`/appointments/recalls`,`/appointments/recalls`,`recalls-hub.ts`,Recalls hub,Operations,/appointments/recalls,/appointments/recalls,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,Operational due-customer list added Batch 7
10-10,Recall campaigns,V1,UA_PENDING,`/appointments/recall-campaigns`,`/appointments/recall-campaigns`,`recall-campaigns.ts`,Recall campaigns,Operations,/appointments/automations/recall,/appointments/automations/recall,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,SMS,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/recall-campaigns`
10-11,Appointment segments (recalls),V1,UA_PENDING,`/appointments/segments`,`/appointments/segments`,`appointment-segments.ts`,Appointment segments (recalls),Operations,/appointments/recalls,Recalls,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/segments`
10-12,No-show recovery,V1,UA_PENDING,`/appointments/no-show-recovery`,`/appointments/no-show-recovery`,`no-show-recovery.ts`,No-show recovery,Operations,/appointments/automations/no-show,/appointments/automations/no-show,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/no-show-recovery`
10-13,No-show scan job,V1,UA_PENDING,—,—,—,No-show scan job,Operations,/appointments/automations/no-show,Automations,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
11-1,Reminder sequences,V1,PASS,`/appointments/reminders`,`/appointments/reminders`,`reminder-engine.ts`,Reminder sequences,Automations,/appointments/reminders,Reminders,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,PASS,
11-2,SMS reminders,V1,UA_PENDING,Reminders admin,Reminders admin,`reminder-delivery.ts`,SMS reminders,Automations,/appointments/reminders,Reminders,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Telnyx / Twilio,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
11-3,Email reminders,V1,UA_PENDING,Reminders admin,Reminders admin,`reminder-engine.ts`,Email reminders,Automations,/appointments/reminders,Reminders,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Email provider,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
11-4,ICS attachments,V1,UA_PENDING,—,—,`ics-builder.ts`,ICS attachments,Automations,/appointments/reminders,Reminders,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
11-5,Reminder test send,V1,UA_PENDING,Reminders admin,Reminders admin,—,Reminder test send,Automations,/appointments/reminders,Reminders,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,SMS / email,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
11-6,Email open / click tracking,V1,UA_PENDING,—,—,—,Email open / click tracking,Automations,/appointments/reminders,Reminders,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
11-7,Per-appointment reminder timeline,V1,UA_PENDING,Appointment detail,Appointment detail,—,Per-appointment reminder timeline,Automations,/appointments/[id],Appointment Detail,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
11-8,Voice reminders,V1,UA_PENDING,`/appointments/voice-reminders`,`/appointments/voice-reminders`,`appointment-voice-reminders/`,Voice reminders,Automations,/appointments/reminders,Voice channel,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,Telnyx voice,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
11-9,Voice reminder retry job,V1,UA_PENDING,—,—,—,Voice reminder retry job,Automations,/appointments/reminders,Reminders,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,Telnyx,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
11-10,Platform reminder scan,V1,UA_PENDING,—,—,—,Platform reminder scan,Automations,RUNTIME_ONLY,Background,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
11-11,SMS consent disclosure,V1,UA_PENDING,Public Info,Public Info,`sms-consent-disclosure.ts`,SMS consent disclosure,Automations,/appointments/reminders,Reminders,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
11-12,Automation templates,V1,UA_PENDING,`/appointments/automations/templates`,`/appointments/automations/templates`,workflow templates,Automation templates,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
11-13,Automation activity log,V1,UA_PENDING,`/appointments/automations/activity`,`/appointments/automations/activity`,—,Automation activity log,Automations,/appointments/automations/activity,Activity,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
12-1,Workflow list,V1,UA_PENDING,`/appointments/workflows`,`/appointments/workflows`,`appointment-workflows/`,Workflow list,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
12-2,Create / edit workflow,V1,UA_PENDING,"`/appointments/workflows/new`, `[id]/edit`","`/appointments/workflows/new`, `[id]/edit`",engine + editor,Create / edit workflow,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
12-3,Workflow from template,V1,UA_PENDING,`/appointments/workflows/setup/[templateId]`,`/appointments/workflows/setup/[templateId]`,`templates.ts`,Workflow from template,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,YES,PARTIAL,NO,NO,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
12-4,Workflow test run,V1,UA_PENDING,—,—,—,Workflow test run,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
12-5,Workflow preview,V1,UA_PENDING,—,—,`preview.ts`,Workflow preview,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
12-6,Execution logs,V1,UA_PENDING,—,—,—,Execution logs,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
12-7,Unknown SMS reply triage,V1,UA_PENDING,—,—,—,Unknown SMS reply triage,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,SMS,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
12-8,Time-based triggers,V1,UA_PENDING,—,—,`workflow-scanners.ts`,Time-based triggers,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
12-9,Before/after appointment triggers,V1,UA_PENDING,—,—,triggers,Before/after appointment triggers,Automations,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
13-1,AI booking settings,V1,UA_PENDING,`/appointments/ai-booking`,`/appointments/ai-booking`,ai-booking config,AI booking settings,Booking,/appointments/ai-booking,AI Booking,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
13-2,Staff-initiated AI book,V1,UA_PENDING,AI booking admin,AI booking admin,`ai-booking`,Staff-initiated AI book,Booking,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,LLM,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
13-3,"AI channels (SMS, email)",V1,UA_PENDING,—,—,channels API,"AI channels (SMS, email)",Booking,/appointments/ai-booking,AI Booking,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,Telnyx / email,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
13-4,Public AI chat booking,V1,UA_PENDING,Public AI step,Public AI step,`ai-scheduling/`,Public AI chat booking,Booking,/appointments/ai-booking,AI Booking,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,LLM,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
13-5,Public email AI handler,V1,UA_PENDING,—,—,—,Public email AI handler,Booking,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,NO,PARTIAL,N/A,N/A,LLM + email,NO,NO,PUBLIC_FLOW_MISSING,Public customer flow not fully exposed,,Extend on canonical page per IA directive,UA_PENDING,
13-6,NL understand / execute,V1,UA_PENDING,—,—,"`understand.ts`, `execute.ts`",NL understand / execute,Booking,/appointments/ai-booking,AI Booking,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,LLM,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
13-7,AI booking protection,V1,PASS,—,—,`booking-protection.ts`,AI booking protection,Booking,/appointments/ai-booking,AI Booking,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,PASS,
13-8,Caller Amy / appointment assistant,V2,UA_PENDING,`/solutions/…/appointment-assistant`,`/solutions/…/appointment-assistant`,voice agent vertical,Caller Amy / appointment assistant,Booking,V2_DEFERRED,V2_DEFERRED,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,Telnyx voice,NO,NO,V2_DEFERRED,,,Defer from V1 UI batch,UA_PENDING,AI Receptionist out of V1 scope
14-1,Upcoming meetings list,V1,UA_PENDING,`/video`,`/video`,transovo-video,Upcoming meetings list,Meetings,/video,Meetings Upcoming,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,Telnyx Video,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
14-2,Host video for appointment,V1,UA_PENDING,`/appointments/[id]/video/host`,`/appointments/[id]/video/host`,transovo-video,Host video for appointment,Meetings,/video,Meetings Upcoming,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Telnyx Video,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
14-3,Public video join,V1,UA_PENDING,`/video/[token]`,`/video/[token]`,transovo-video,Public video join,Meetings,/video,Meetings Upcoming,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Telnyx Video,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
14-4,Meeting recaps / notetaker,V1,UA_PENDING,"`/meetings`, `/meetings/[id]`","`/meetings`, `/meetings/[id]`",meeting-assistant,Meeting recaps / notetaker,Meetings,/video,Meetings Upcoming,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,Telnyx / AI,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
14-5,Public shared recap,V1,UA_PENDING,`/recap/[token]`,`/recap/[token]`,—,Public shared recap,Meetings,/meetings,Meetings Recaps,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
14-6,Transovo Video settings,V1,UA_PENDING,`/settings/transovo-video`,`/settings/transovo-video`,—,Transovo Video settings,Meetings,/video,Meetings Upcoming,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Telnyx,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
14-7,AI Notetaker settings,V1,UA_PENDING,`/settings/ai-notetaker`,`/settings/ai-notetaker`,—,AI Notetaker settings,Meetings,/video,Meetings Upcoming,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
14-8,Teams meeting auto-create,V1,UA_PENDING,—,—,`calendar/teams-meeting.ts`,Teams meeting auto-create,Meetings,/video,Meetings Upcoming,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,Microsoft Graph,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
14-9,Calendar meeting indicators,V1,UA_PENDING,Calendar,Calendar,meeting-indicators,Calendar meeting indicators,Meetings,/video,Meetings Upcoming,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
15-1,Routing forms builder,V1,UA_PENDING,`/appointments/routing-forms`,`/appointments/routing-forms`,`routing-forms.ts`,Routing forms builder,Booking,/appointments/routing-forms,Routing,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
15-2,Routing rules (legacy),V1,UA_PENDING,`/appointments/routing`,`/appointments/routing`,routing page,Routing rules (legacy),Booking,/appointments/routing-forms,/appointments/routing-forms,PAGE_SECTION,,MERGE,YES,PARTIAL,NO,NO,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
15-3,Routing form presets,V1,UA_PENDING,—,—,`routing-forms-presets.ts`,Routing form presets,Booking,/appointments/routing-forms,Routing,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
15-4,Public routing form,V1,UA_PENDING,`/routing/[slug]/[formSlug]`,`/routing/[slug]/[formSlug]`,—,Public routing form,Booking,/appointments/routing-forms,Routing,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
15-5,Team booking pages,V1,UA_PENDING,`/appointments/team-pages`,`/appointments/team-pages`,`team-scheduling.ts`,Team booking pages,Booking,/appointments/team-pages,Team Booking,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
15-6,Public team booking page,V1,UA_PENDING,`/team/[slug]/[pageSlug]`,`/team/[slug]/[pageSlug]`,—,Public team booking page,Booking,/appointments/team-pages,Team Booking,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
15-7,Meeting polls,V1,UA_PENDING,`/appointments/polls`,`/appointments/polls`,`meeting-polls.ts`,Meeting polls,Booking,/video,Meetings Upcoming,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
16-1,Analytics overview,V1,UA_PENDING,`/appointments/analytics`,`/appointments/analytics`,`analytics.ts`,Analytics overview,Analytics,/appointments/analytics,/appointments/analytics,PAGE_SECTION,,KEEP,YES,LIKELY,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,UA_PENDING,
16-2,Booking analytics,V1,UA_PENDING,`/appointments/analytics/booking`,`/appointments/analytics/booking`,analytics,Booking analytics,Analytics,/appointments/analytics/booking,Analytics Booking,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
16-3,Reminder analytics,V1,UA_PENDING,`/appointments/analytics/reminders`,`/appointments/analytics/reminders`,analytics,Reminder analytics,Analytics,/appointments/analytics/reminders,Analytics Reminders,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
16-4,Automation analytics,V1,UA_PENDING,`/appointments/analytics/automations`,`/appointments/analytics/automations`,analytics,Automation analytics,Analytics,/appointments/workflows,Workflows,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
16-5,Reports hub,V1,UA_PENDING,`/appointments/analytics/reports`,`/appointments/analytics/reports`,`reporting.ts`,Reports hub,Analytics,/appointments/analytics/reports,Reports,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
16-6,Service booking reports,V1,UA_PENDING,`/appointments/reports/service-booking`,`/appointments/reports/service-booking`,`reporting.ts`,Service booking reports,Analytics,/appointments/analytics/reports,/appointments/analytics/reports,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Structured panel on analytics; legacy JSON dump remains,,Extend on canonical page per IA directive,UA_PENDING,Parity route: `/appointments/reports/service-booking`
16-7,CSV / PDF export,V1,UA_PENDING,—,—,—,CSV / PDF export,Analytics,/appointments/analytics/reports,Reports,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
16-8,Scheduled email reports,V1,UA_PENDING,—,—,—,Scheduled email reports,Analytics,RUNTIME_ONLY,Background,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,Email,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
17-1,Google Calendar sync,V1,UA_PENDING,`/integrations/calendars`,`/integrations/calendars`,calendar sync,Google Calendar sync,Platform,/integrations/calendars,Integrations,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Google OAuth,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
17-2,Microsoft / Outlook sync,V1,UA_PENDING,`/integrations/calendars`,`/integrations/calendars`,calendar sync,Microsoft / Outlook sync,Platform,/integrations/calendars,Integrations,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Microsoft OAuth,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
17-3,iCloud / Apple Calendar sync,V1,PROVIDER_BLOCKED,Integrations,Integrations,channel stub,iCloud / Apple Calendar sync,Platform,/integrations/calendars,Integrations,PROVIDER_BLOCKED,,PROVIDER_BLOCKED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,Apple CalDAV,NO,NO,PROVIDER_BLOCKED,,,Blocked on external provider access,PROVIDER_BLOCKED,
17-4,Calendly mapping (vertical),V2,N/A,`/realtor/appointments/types`,`/realtor/appointments/types`,realtor mapping,Calendly mapping (vertical),Platform,V2_DEFERRED,V2_DEFERRED,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,NO,NO,N/A,N/A,N/A,N/A,Calendly API,NO,NO,V2_DEFERRED,,,Defer from V1 UI batch,N/A,
17-5,Stripe Connect payments,V1,UA_PENDING,`/integrations/payments`,`/integrations/payments`,merchant payments,Stripe Connect payments,Platform,/payments/transactions,Transactions,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Stripe,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
17-6,Square payments,V1,UA_PENDING,`/integrations/payments`,`/integrations/payments`,merchant payments,Square payments,Platform,/payments/transactions,Transactions,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,Square,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
17-7,Native appointments integration hub,V2,N/A,`/integrations/native/appointments`,`/integrations/native/appointments`,—,Native appointments integration hub,Platform,V2_DEFERRED,V2_DEFERRED,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,NO,NO,N/A,N/A,N/A,N/A,—,NO,NO,V2_DEFERRED,,,Defer from V1 UI batch,N/A,
17-8,Integration status diagnostics,V2,N/A,—,—,—,Integration status diagnostics,Platform,RUNTIME_ONLY,RUNTIME_ONLY,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,V2_DEFERRED,,,Defer from V1 UI batch,N/A,
17-9,Reserve with Google / GBP,V1,PROVIDER_BLOCKED,Theme / channels,Theme / channels,`booking-channel-integrations.ts`,Reserve with Google / GBP,Platform,/integrations/calendars,Integrations,PROVIDER_BLOCKED,,PROVIDER_BLOCKED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,Google Reserve partner,NO,NO,PROVIDER_BLOCKED,,,Blocked on external provider access,PROVIDER_BLOCKED,
17-10,Facebook Book Now action,V1,PROVIDER_BLOCKED,channels config,channels config,channel stub,Facebook Book Now action,Platform,/integrations/calendars,Integrations,PROVIDER_BLOCKED,,PROVIDER_BLOCKED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,Meta Business,NO,NO,PROVIDER_BLOCKED,,,Blocked on external provider access,PROVIDER_BLOCKED,
17-11,Instagram booking action,V1,PROVIDER_BLOCKED,channels config,channels config,channel stub,Instagram booking action,Platform,/integrations/calendars,Integrations,PROVIDER_BLOCKED,,PROVIDER_BLOCKED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,Meta Business,NO,NO,PROVIDER_BLOCKED,,,Blocked on external provider access,PROVIDER_BLOCKED,
18-1,Granular appointment permissions,V1,PASS,Settings,Settings,`org-permissions.ts`,Granular appointment permissions,Settings,/settings/security,Settings,PAGE_SECTION,,KEEP,YES,LIKELY,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,COMPLETE_CURRENT_UI,,,Extend on canonical page per IA directive,PASS,
18-2,Per-type access control,V1,PASS,—,—,RBAC filters,Per-type access control,Settings,/settings/security,Security & Org,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,PASS,
18-3,Org roles API,V1,UA_PENDING,—,—,—,Org roles API,Settings,/appointments/pos,Point of Sale,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
18-4,SAML SSO,V1,PROVIDER_BLOCKED,—,—,org API,SAML SSO,Settings,/settings/security,Settings,PROVIDER_BLOCKED,,PROVIDER_BLOCKED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,IdP,NO,NO,PROVIDER_BLOCKED,,,Blocked on external provider access,PROVIDER_BLOCKED,
18-5,SCIM provisioning,V1,PROVIDER_BLOCKED,—,—,org API,SCIM provisioning,Settings,/settings/security,Settings,PROVIDER_BLOCKED,,PROVIDER_BLOCKED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,IdP,NO,NO,PROVIDER_BLOCKED,,,Blocked on external provider access,PROVIDER_BLOCKED,
18-6,Enterprise scheduling (legacy),V2,N/A,`/appointments/enterprise`,`/appointments/enterprise`,—,Enterprise scheduling (legacy),Settings,V2_DEFERRED,V2_DEFERRED,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,NO,NO,N/A,N/A,N/A,N/A,—,NO,YES,V2_DEFERRED,,,Defer from V1 UI batch,N/A,
18-7,Audit timeline on appointment,V1,UA_PENDING,Detail,Detail,metadata `timeline[]`,Audit timeline on appointment,Settings,/appointments/types/events,Workshop/Event Editor,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
19-1,Contacts (shared),V1,UA_PENDING,`/contacts`,`/contacts`,contacts product,Contacts (shared),Contacts,/appointments/booking,Booking Pages,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
19-2,Conversations / Inbox (shared),V1,UA_PENDING,`/conversations`,`/conversations`,inbox product,Conversations / Inbox (shared),Contacts,/appointments/booking,Booking Pages,PAGE_SECTION,,EXTEND,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,,,Extend on canonical page per IA directive,UA_PENDING,
19-3,Household / family accounts,V1,UA_PENDING,Commerce admin,Commerce admin,`household.ts`,Household / family accounts,Contacts,/contacts/[id],Household,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
19-4,Contact merge,V1,UA_PENDING,Commerce admin,Commerce admin,`contact-merge.ts`,Contact merge,Contacts,/contacts,Merge tool,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
19-5,Custom client fields,V1,UA_PENDING,Commerce admin,Commerce admin,`custom-fields.ts`,Custom client fields,Contacts,/contacts/fields,/contacts/fields,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,YES,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
19-6,Intake form templates,V1,UA_PENDING,Commerce admin,Commerce admin,`intake-forms.ts`,Intake form templates,Contacts,/appointments/booking/forms,Intake templates,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,LIKELY,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
19-7,Treatment records (vertical-adjacent),V2,N/A,Commerce admin,Commerce admin,`treatment-records.ts`,Treatment records (vertical-adjacent),Contacts,V2_DEFERRED,V2_DEFERRED,V2_DEFERRED,,DEFERRED,UNKNOWN,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,YES,V2_DEFERRED,,,Defer from V1 UI batch,N/A,
19-8,Import / export,V1,UA_PENDING,Commerce admin,Commerce admin,`import-export.ts`,Import / export,Contacts,/contacts/imports,/contacts/imports,PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,YES,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
20-1,Outbound webhook endpoints,V1,UA_PENDING,Commerce admin,Commerce admin,`webhooks.ts`,Outbound webhook endpoints,Integrations,/integrations/calendars,Developer webhooks (verify final home),PAGE_SECTION,,MERGE,YES,PARTIAL,YES,PARTIAL,N/A,N/A,N/A,N/A,—,POSSIBLE,YES,MOVE_INTO_EXISTING_PAGE,Absorb from parity hub into final IA page,,Extend on canonical page per IA directive,UA_PENDING,Parity route: Commerce admin
20-2,Webhook signing (HMAC),V1,UA_PENDING,—,—,`webhook-delivery.ts`,Webhook signing (HMAC),Integrations,/integrations/calendars,Webhooks,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
20-3,Webhook delivery queue,V1,UA_PENDING,—,—,delivery jobs,Webhook delivery queue,Integrations,/integrations/calendars,Webhooks,PAGE_SECTION,,EXTEND,NO,UNKNOWN,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,EXTEND_EXISTING_PAGE,Backend exists; admin/contextual UI not exposed on final page,,Extend on canonical page per IA directive,UA_PENDING,
20-4,Slot diagnostics API,V1,UA_PENDING,—,—,`slot-diagnostics.ts`,Slot diagnostics API,Integrations,PUBLIC_BOOKING,Public Booking,PUBLIC_BOOKING,,EXTEND,N/A,N/A,YES,PARTIAL,NO,PARTIAL,N/A,N/A,—,NO,NO,PUBLIC_FLOW_MISSING,Public customer flow not fully exposed,,Extend on canonical page per IA directive,UA_PENDING,
21-1,Workflow step execution,V1,UA_PENDING,—,—,`appointment-workflows/engine.ts`,Workflow step execution,Runtime,/appointments/workflows,Workflows,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,LIKELY,N/A,N/A,N/A,N/A,BullMQ / Redis,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
21-2,Webhook deliver / sweep,V1,UA_PENDING,—,—,`webhook-delivery.ts`,Webhook deliver / sweep,Runtime,/integrations/calendars,Webhooks,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
21-3,Waitlist notify,V1,UA_PENDING,—,—,`waitlist.ts`,Waitlist notify,Runtime,/appointments/waitlist,Waitlist,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,SMS,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
21-4,Voice reminder retry,V1,UA_PENDING,—,—,voice reminders,Voice reminder retry,Runtime,/appointments/reminders,Reminders,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,LIKELY,N/A,N/A,N/A,N/A,Telnyx,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
21-5,Provider appointment sync/cancel/reschedule,V1,UA_PENDING,—,—,sync jobs,Provider appointment sync/cancel/reschedule,Runtime,RUNTIME_ONLY,Background,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,Google / Microsoft,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
21-6,Starting-soon / completed scans,V1,UA_PENDING,—,—,integration triggers,Starting-soon / completed scans,Runtime,RUNTIME_ONLY,Background,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
21-7,Workflow time scans / triggers,V1,UA_PENDING,—,—,`workflow-scanners.ts`,Workflow time scans / triggers,Runtime,/appointments/workflows,Workflows,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,LIKELY,N/A,N/A,N/A,N/A,—,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
21-8,No-show scan,V1,UA_PENDING,—,—,—,No-show scan,Runtime,/appointments/automations/no-show,Automations,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,—,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
21-9,Scheduled analytics report email,V1,UA_PENDING,—,—,`analytics-reports.ts`,Scheduled analytics report email,Runtime,/appointments/analytics/reports,Reports,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,PARTIAL,N/A,N/A,N/A,N/A,Email,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,UA_PENDING,
21-10,Platform reminder scan,V1,PASS,—,—,`reminder-engine.ts`,Platform reminder scan,Runtime,RUNTIME_ONLY,Background,RUNTIME_ONLY,,KEEP,N/A,N/A,YES,LIKELY,N/A,N/A,N/A,N/A,SMS / email,NO,NO,RUNTIME_ONLY_COMPLETE,,,No admin UI required,PASS,
```

---

*End of complete Batch 8A download. Regenerate via: node scripts/generate-feature-absorption-audit.mjs*
