# Appointments — Residual V1 Implementation Queue (Batch 8C)

**Generated:** 2026-09-10
**Type:** Mechanical reconciliation — implementation work only
**Total residual rows:** 39

## /appointments/automations/activity

### 11-13 — Automation activity log
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/automations/activity
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/automations/activity; routeExists=true; backend=null

## /appointments/availability

### 3-20 — Slot diagnostics
- **Gap type:** V1_CONTEXTUAL_FLOW_GAP
- **Section:** /appointments/availability
- **Missing:** Service → create staff contextual return
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** contextual audit; routeExists=true; backend=true

## /appointments/booking

### 19-1 — Contacts (shared)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=null

### 19-2 — Conversations / Inbox (shared)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=null

## /appointments/discounts

### 8-18 — Coupons / discounts
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/discounts
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/discounts; routeExists=false; backend=false

## /appointments/gift-cards

### 8-16 — Gift balance redemption at checkout
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/gift-cards
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/gift-cards; routeExists=true; backend=false

## /appointments/memberships

### 8-11 — Membership failed-payment suspension
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/memberships
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/memberships; routeExists=true; backend=false

### 8-12 — Membership payment recovery / entitlement restore
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/memberships
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/memberships; routeExists=true; backend=false

### 8-13 — Membership-only booking types / classes
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/memberships
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/memberships; routeExists=true; backend=false

### 8-14 — Recurring membership credit replenishment
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/memberships
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/memberships; routeExists=true; backend=false

## /appointments/new

### 6-2 — Create appointment (staff)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/new
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/new; routeExists=true; backend=true

## /appointments/packages

### 8-1 — Packages & memberships hub
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=null

### 8-3 — Package purchase
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=false

### 8-5 — Package lifecycle (restore on cancel)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=false

### 8-6 — Package credit forfeiture (late cancel / no-show)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=false

### 8-7 — Mixed-content package entitlements
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=false

### 8-33 — Policy fees (late cancel / no-show)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=true

## /appointments/polls

### 15-7 — Meeting polls
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/polls
- **Missing:** Per-booking-type permission editor
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** STILL_MISSING; routeExists=true; backend=true

## /appointments/pos

### 13-2 — Staff-initiated AI book
- **Gap type:** V1_BACKEND_GAP
- **Section:** /appointments/pos
- **Missing:** Poll vote → appointment booking
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** gap queue 8B-7; routeExists=true; backend=true

### 7-1 — Manage appointment link
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/pos
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/pos; routeExists=true; backend=false

## /appointments/products

### 8-25 — Products for sale
- **Gap type:** V1_BACKEND_GAP
- **Section:** /appointments/products
- **Missing:** POS tax engine
- **Backend:** YES / PARTIAL
- **Priority:** P1
- **Evidence:** gap queue 8B-5; routeExists=false; backend=false

## /appointments/recalls

### 10-9 — Recalls hub
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/recalls
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/recalls; routeExists=true; backend=true

### 10-11 — Appointment segments (recalls)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/recalls
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/recalls; routeExists=true; backend=true

## /appointments/routing-forms

### 15-1 — Routing forms builder
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/routing-forms
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/routing-forms; routeExists=true; backend=true

## /appointments/types/classes

### 9-6 — Seat selection / maps
- **Gap type:** V1_BACKEND_GAP
- **Section:** /appointments/types/classes
- **Missing:** Invoice email send
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** gap queue 8B-6; routeExists=true; backend=false

### 9-7 — Event admission tickets
- **Gap type:** V1_BACKEND_GAP
- **Section:** /appointments/types/classes
- **Missing:** Invoice PDF export polish
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** gap queue 8B-6; routeExists=true; backend=false

## /appointments/types/events

### 18-7 — Audit timeline on appointment
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/events
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/types/events; routeExists=true; backend=false

## /appointments/workflows

### 6-12 — Status workflow
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/workflows
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/workflows; routeExists=true; backend=null

### 11-12 — Automation templates
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/workflows
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/workflows; routeExists=true; backend=null

### 12-1 — Workflow list
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/workflows
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/workflows; routeExists=true; backend=false

### 12-3 — Workflow from template
- **Gap type:** V1_BACKEND_GAP
- **Section:** /appointments/workflows
- **Missing:** Backend incomplete
- **Backend:** NO / NO
- **Priority:** P2
- **Evidence:** `templates.ts`; routeExists=true; backend=false

## /integrations/calendars

### 17-1 — Google Calendar sync
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /integrations/calendars
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /integrations/calendars; routeExists=true; backend=null

### 17-2 — Microsoft / Outlook sync
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /integrations/calendars
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /integrations/calendars; routeExists=true; backend=null

### 20-1 — Outbound webhook endpoints
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /integrations/calendars
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /integrations/calendars; routeExists=true; backend=false

### 20-2 — Webhook signing (HMAC)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /integrations/calendars
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /integrations/calendars; routeExists=true; backend=false

### 20-3 — Webhook delivery queue
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /integrations/calendars
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /integrations/calendars; routeExists=true; backend=null

## Create / edit workflow

### 12-2 — Create / edit workflow
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** Create / edit workflow
- **Missing:** UA_PENDING — depth unverified
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** NO; Create / edit workflow; routeExists=null; backend=false

## PARITY_TEMP

### 3-21 — Dynamic pricing by slot
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** PARITY_TEMP
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** PARITY_TEMP; routeExists=null; backend=false

## SHELL_RUNTIME

### 1-3 — Mobile bottom nav
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** SHELL_RUNTIME
- **Missing:** Mobile bottom nav appointments
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** PARTIAL; routeExists=null; backend=false

## Proposed residual implementation batches (8D series)

| Batch | Domain | Approx rows |
|-------|--------|------------:|
| 8D-1 | Route convergence + wrong-placement (commerce hub → canonical pages) | 0 |
| 8D-2 | Public booking payment + class/event + AI public flows | 0 |
| 8D-3 | Portal depth (saved cards, membership self-service, household) | 0 |
| 8D-4 | Operations (calendar, detail, waitlist) | admin gaps on ops pages |
| 8D-5 | Automations canonical routes + voice reminder merge | wrong-placement automations |
| 8D-6 | Backend gaps (POS tax, invoice email/PDF, poll booking) | 5 |
