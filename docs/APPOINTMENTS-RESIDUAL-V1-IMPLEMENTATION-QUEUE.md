# Appointments — Residual V1 Implementation Queue (Batch 8C)

**Generated:** 2026-09-10
**Type:** Mechanical reconciliation — implementation work only
**Total residual rows:** 145

## /appointments

### 6-1 — Appointments list
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments; routeExists=true; backend=true

## /appointments/[id]

### 6-9 — Internal notes
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/[id]
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/[id]; routeExists=true; backend=true

### 6-11 — Reminder timeline
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/[id]
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/[id]; routeExists=true; backend=null

### 6-13 — Multi-service lines on record
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/[id]
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/[id]; routeExists=true; backend=false

### 6-14 — Policy snapshot on record
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/[id]
- **Missing:** Backend writes snapshot; detail display may be partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/[id]; routeExists=true; backend=true

### 11-7 — Per-appointment reminder timeline
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/[id]
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/[id]; routeExists=true; backend=null

## /appointments/ai-booking

### 5-29 — Public AI booking chat
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/ai-booking
- **Missing:** Public AI booking chat customer flow
- **Backend:** YES / LIKELY
- **Priority:** P1
- **Evidence:** admin only wired; routeExists=true; backend=true

### 5-30 — Public email AI booking
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/ai-booking
- **Missing:** Public email AI booking
- **Backend:** YES / PARTIAL
- **Priority:** P1
- **Evidence:** channel card only; routeExists=true; backend=null

### 13-4 — Public AI chat booking
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/ai-booking
- **Missing:** Public AI chat booking
- **Backend:** YES / LIKELY
- **Priority:** P1
- **Evidence:** duplicate of 5-29; routeExists=true; backend=true

## /appointments/automations/activity

### 11-13 — Automation activity log
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/automations/activity
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/automations/activity; routeExists=true; backend=null

## /appointments/availability

### 3-8 — Booking limits (daily/weekly/per-type)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Waitlist priority rules admin
- **Backend:** YES / LIKELY
- **Priority:** P0
- **Evidence:** gap queue P0; routeExists=true; backend=false

### 3-9 — Fixed appointment start times
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Waitlist priority rank in table
- **Backend:** YES / LIKELY
- **Priority:** P0
- **Evidence:** gap queue P0; routeExists=true; backend=false

### 3-2 — Timezone
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Appointment detail recurring series UI
- **Backend:** YES / LIKELY
- **Priority:** P1
- **Evidence:** detail partial; routeExists=true; backend=null

### 3-3 — Minimum booking notice
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Appointment detail service phases display
- **Backend:** YES / LIKELY
- **Priority:** P1
- **Evidence:** detail partial; routeExists=true; backend=false

### 3-4 — Maximum booking horizon
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Appointment detail resource labels
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** detail partial; routeExists=true; backend=false

### 3-20 — Slot diagnostics
- **Gap type:** V1_CONTEXTUAL_FLOW_GAP
- **Section:** /appointments/availability
- **Missing:** Service → create staff contextual return
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** contextual audit; routeExists=true; backend=true

### 3-5 — Date overrides (custom hours)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/availability; routeExists=true; backend=false

### 3-7 — Holiday calendar
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/availability; routeExists=true; backend=false

### 3-10 — Custom start interval
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/availability; routeExists=true; backend=false

### 3-11 — Make Me Look Busy (hide slots)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/availability; routeExists=true; backend=false

### 3-17 — External calendar busy blocking
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/availability
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/availability; routeExists=true; backend=true

## /appointments/booking

### 2-25 — Booking page settings
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=true

### 2-26 — Share & embed hub
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=null

### 2-27 — Booking QR code generator
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=null

### 2-29 — Embed URL & iframe
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=false

### 2-31 — Scheduler theme / branding
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=false

### 2-32 — Custom booking domain
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=false

### 2-33 — Advanced custom CSS
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=false

### 2-34 — Custom terminology / locale
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=false

### 2-35 — Direct booking links per type
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking; routeExists=true; backend=false

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

## /appointments/booking/forms

### 2-20 — Intake forms on type
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking/forms
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/booking/forms; routeExists=true; backend=false

### 2-42 — Formal contracts + e-signature
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking/forms
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking/forms; routeExists=true; backend=false

### 19-6 — Intake form templates
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking/forms
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/booking/forms; routeExists=true; backend=false

## /appointments/booking/rooms-equipment

### 4-9 — Resource quantity / capacity
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking/rooms-equipment
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/booking/rooms-equipment; routeExists=true; backend=false

### 4-10 — Resource pools (any-one-in-group)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/booking/rooms-equipment
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/booking/rooms-equipment; routeExists=true; backend=false

## /appointments/calendar

### 4-14 — Staff / service calendar colors
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/calendar
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/calendar; routeExists=true; backend=false

### 6-7 — Reschedule (staff)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/calendar
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/calendar; routeExists=true; backend=true

## /appointments/discounts

### 8-18 — Coupons / discounts
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/discounts
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/discounts; routeExists=false; backend=false

## /appointments/gift-cards

### 7-14 — Portal: gift balances
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** /appointments/gift-cards
- **Missing:** Portal depth incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /portal; routeExists=true; backend=null

### 8-16 — Gift balance redemption at checkout
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/gift-cards
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/gift-cards; routeExists=true; backend=false

### 8-17 — Gift balance redemption history
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** /appointments/gift-cards
- **Missing:** Portal depth incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /portal; routeExists=true; backend=false

## /appointments/memberships

### 8-10 — Membership lifecycle (pause/cancel/past_due)
- **Gap type:** V1_BACKEND_GAP
- **Section:** /appointments/memberships
- **Missing:** Membership customer pause/cancel API
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** portal view-only; routeExists=true; backend=false

### 7-13 — Portal: memberships
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** /appointments/memberships
- **Missing:** Portal depth incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /portal; routeExists=true; backend=null

### 8-9 — Membership subscriptions
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** /appointments/memberships
- **Missing:** Portal depth incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /portal; routeExists=true; backend=false

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

## /appointments/overview

### 1-1 — Appointments overview (Home)
- **Gap type:** V1_MOCK_OR_PLACEHOLDER
- **Section:** /appointments/overview
- **Missing:** Overview decorative date picker / KPI gaps
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** overview partial; routeExists=true; backend=true

## /appointments/packages

### 5-16 — Package / membership entitlements
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Info step; routeExists=true; backend=false

### 5-31 — Public store (packages)
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Public consumer incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** `/book/[slug]/store`; routeExists=true; backend=false

### 7-15 — Portal: package usage history
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Portal depth incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /portal; routeExists=true; backend=null

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

### 8-4 — Package credits & ledger
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** /appointments/packages
- **Missing:** Portal depth incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /portal; routeExists=true; backend=false

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

### 5-11 — Multi-booking session (cart)
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/pos
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** DateTime cart; routeExists=true; backend=true

### 5-19 — Recurring booking
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/pos
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Info step; routeExists=true; backend=true

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

## /appointments/staff

### 4-12 — Staff round-robin state
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/staff
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/staff; routeExists=true; backend=false

## /appointments/types

### 2-8 — Recurring eligibility on type
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types
- **Missing:** Calendar staff lanes / colors
- **Backend:** YES / LIKELY
- **Priority:** P1
- **Evidence:** calendar-connected partial; routeExists=true; backend=true

### 2-9 — Staff assignment modes
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types
- **Missing:** Calendar drag-reschedule
- **Backend:** YES / LIKELY
- **Priority:** P1
- **Evidence:** not wired; routeExists=true; backend=true

### 2-11 — Payment modes on type
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types
- **Missing:** Calendar availability overlays
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** partial; routeExists=true; backend=false

### 2-28 — Single-use booking links
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/types; routeExists=true; backend=true

### 2-37 — Named availability schedules
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/types; routeExists=true; backend=true

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

### 9-1 — Class series admin
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/classes
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/types/classes; routeExists=true; backend=false

### 9-2 — Class occurrences
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/classes
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/types/classes; routeExists=true; backend=false

### 9-3 — Staff class enrollment
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/classes
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/types/classes; routeExists=true; backend=null

### 9-5 — Class check-in (QR)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/classes
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/types/classes; routeExists=true; backend=false

## /appointments/types/events

### 6-5 — Calendar view
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/events
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/types/events; routeExists=false; backend=null

### 18-7 — Audit timeline on appointment
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/events
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/types/events; routeExists=false; backend=false

## /appointments/types/services

### 2-19 — Add-on duration & resource effects
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/services
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/types/services; routeExists=false; backend=false

### 2-22 — Service phases (multi-phase duration)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/services
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/types/services; routeExists=false; backend=false

### 2-23 — Provider-release processing time
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/services
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/types/services; routeExists=false; backend=false

### 2-38 — Categories admin
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/types/services
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/types/services; routeExists=false; backend=false

### 5-9 — Multi-service chain
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/types/services
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** DateTime step; routeExists=false; backend=false

### 5-10 — Multi-staff per service line
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/types/services
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Public book; routeExists=false; backend=false

### 5-15 — Add-on selection
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /appointments/types/services
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Info step; routeExists=false; backend=false

## /appointments/waitlist

### 10-5 — Waitlist offer + atomic accept
- **Gap type:** V1_MOCK_OR_PLACEHOLDER
- **Section:** /appointments/waitlist
- **Missing:** Service-booking report JSON dump on temp route
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** reports/service-booking; routeExists=true; backend=true

### 7-20 — Waitlist offer accept
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/waitlist
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/waitlist; routeExists=true; backend=true

### 9-10 — Class waitlist (capacity-full join)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/waitlist
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/waitlist; routeExists=true; backend=true

### 10-1 — Waitlist admin queue
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/waitlist
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/waitlist; routeExists=true; backend=true

### 10-2 — Public waitlist join
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/waitlist
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/waitlist; routeExists=true; backend=null

### 10-3 — Waitlist preferences (staff/date/time)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/waitlist
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/waitlist; routeExists=true; backend=null

### 10-4 — Waitlist slot notification
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/waitlist
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/waitlist; routeExists=true; backend=true

### 10-6 — Waitlist auto-fill on cancel
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/waitlist
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/waitlist; routeExists=true; backend=false

### 10-7 — Waitlist party size (group / class)
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/waitlist
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/waitlist; routeExists=true; backend=false

### 10-8 — Waitlist priority rules
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/waitlist
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/waitlist; routeExists=true; backend=false

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

## /contacts/fields

### 5-13 — Custom client fields
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** /contacts/fields
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Info step; routeExists=true; backend=false

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

## CUSTOMER_PORTAL

### 7-18 — Portal saved payment methods
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** CUSTOMER_PORTAL
- **Missing:** Portal add/remove saved card (Stripe Elements)
- **Backend:** YES / PARTIAL
- **Priority:** P1
- **Evidence:** display only; routeExists=null; backend=null

### 8-29 — Saved cards
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** CUSTOMER_PORTAL
- **Missing:** Portal saved card management
- **Backend:** YES / PARTIAL
- **Priority:** P1
- **Evidence:** setup API exists, no portal UI; routeExists=null; backend=null

### 5-18 — Saved card on file
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** CUSTOMER_PORTAL
- **Missing:** Public consumer incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** Info step; routeExists=null; backend=null

### 7-4 — Recurring series cancel scopes
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** CUSTOMER_PORTAL
- **Missing:** Portal depth incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /portal; routeExists=null; backend=true

### 7-5 — Recurring series reschedule scopes
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** CUSTOMER_PORTAL
- **Missing:** Portal depth incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /portal; routeExists=null; backend=true

### 7-8 — ICS calendar download
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** CUSTOMER_PORTAL
- **Missing:** Portal depth incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /portal; routeExists=null; backend=null

### 7-19 — Legacy confirm / cancel / reschedule tokens
- **Gap type:** V1_PORTAL_UI_GAP
- **Section:** CUSTOMER_PORTAL
- **Missing:** Portal depth incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /portal; routeExists=null; backend=null

## PARITY_TEMP

### 3-21 — Dynamic pricing by slot
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** PARITY_TEMP
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** PARITY_TEMP; routeExists=null; backend=false

## PUBLIC_BOOKING

### 5-26 — Stripe checkout
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Stripe checkout depth in public booking
- **Backend:** YES / PARTIAL
- **Priority:** P0
- **Evidence:** PUBLIC_WAVE_PENDING; routeExists=null; backend=null

### 5-27 — Square in-page payment
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Square in-page payment in public flow
- **Backend:** YES / PARTIAL
- **Priority:** P0
- **Evidence:** PUBLIC_WAVE_PENDING; routeExists=null; backend=null

### 8-28 — Deposits & full payment
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Deposits/full payment public depth
- **Backend:** YES / PARTIAL
- **Priority:** P0
- **Evidence:** PARTIAL; routeExists=null; backend=null

### 5-14 — Intake forms
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public poll vote page
- **Backend:** YES / LIKELY
- **Priority:** P1
- **Evidence:** PUBLIC_WAVE_PENDING; routeExists=null; backend=false

### 5-32 — Public class enrollment
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Workshop/Event dedicated public flow (no EVENT kind)
- **Backend:** YES / LIKELY
- **Priority:** P1
- **Evidence:** BACKEND_GAP; routeExists=null; backend=false

### 3-23 — Class capacity display mode
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Public classes; routeExists=null; backend=false

### 5-7 — Duration picker
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** Public flow; routeExists=null; backend=null

### 5-12 — Custom booking questions
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Public flow; routeExists=null; backend=null

### 5-17 — Wallet balance at checkout
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Info step; routeExists=null; backend=false

### 5-20 — Recurring date preview
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Info step; routeExists=null; backend=true

### 5-25 — Single-use token links
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public customer flow not fully exposed
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** —; routeExists=null; backend=null

### 7-2 — Reschedule via manage link
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Manage page; routeExists=null; backend=null

### 7-3 — Cancel via manage link
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Manage page; routeExists=null; backend=null

### 7-6 — Pay balance via manage link
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** Manage page; routeExists=null; backend=false

### 7-7 — Edit intake via manage link
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** Manage page; routeExists=null; backend=false

### 7-9 — Book again link
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** Manage page; routeExists=null; backend=null

### 8-26 — Pay-what-you-want / tipping
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** Type + public; routeExists=null; backend=false

### 8-35 — SMS payment links
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** `/messaging/payments`; routeExists=null; backend=null

### 9-4 — Public class enrollment
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** `/book/[slug]/classes`; routeExists=null; backend=null

### 9-8 — Group capacity on types
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Public; routeExists=null; backend=false

### 9-9 — Remaining spaces display
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public consumer incomplete
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** Public classes; routeExists=null; backend=false

### 13-5 — Public email AI handler
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public customer flow not fully exposed
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** —; routeExists=null; backend=null

### 20-4 — Slot diagnostics API
- **Gap type:** V1_PUBLIC_UI_GAP
- **Section:** PUBLIC_BOOKING
- **Missing:** Public customer flow not fully exposed
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** —; routeExists=null; backend=true

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
| 8D-2 | Public booking payment + class/event + AI public flows | 35 |
| 8D-3 | Portal depth (saved cards, membership self-service, household) | 12 |
| 8D-4 | Operations (calendar, detail, waitlist) | admin gaps on ops pages |
| 8D-5 | Automations canonical routes + voice reminder merge | wrong-placement automations |
| 8D-6 | Backend gaps (POS tax, invoice email/PDF, poll booking) | 6 |
