# Appointments — Existing Page Gap Queue (Batch 8A)

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

## Batch 8B-3 resolution notes (Operations family — 2026-09-10)

**Branch:** `cursor/batch8b3-operations-709b`  
**Scope:** Calendar, Appointment Detail, Waitlist, Recalls, Staff/Locations residuals  
**Status:** ABSORBED_CANONICAL_UI / RUNTIME_UI_EFFECT — UAT not run (per batch directive)

### `/appointments/calendar`

| Gap | Resolution | Remaining |
|-----|------------|-----------|
| Staff / service calendar colors (P1) | `CalendarColorConfig` via `/api/calendar/context`; staff colors edited on Staff → Calendar display | Per-type color editor on booking types (if not yet on type editor) |
| Filters | `CalendarFiltersPanel` — staff, booking types, locations, status | Session persistence across hard refresh |
| Class/event distinction | Kind badges + capacity labels on events | Workshop-specific copy polish |
| Multi-staff view | Staff view toggle + `StaffCalendar` lanes | Spanning multi-staff appointments (complex shared visual) |
| Drag reschedule | Drag → `MoveAppointmentDialog` → PATCH | Pre-drop availability validation API; recurring scope on PATCH |
| Recurring display | Repeat badge + metadata label | Series total count from backend series query |
| Availability overlay | Toggle + background bands from platform hours | Per-staff/location overlay (uses business hours today) |
| External busy | `/api/calendar/busy-blocks` + busy event cards | Provider-specific titles when sync allows |

### `/appointments/[id]`

| Gap | Resolution | Remaining |
|-----|------------|-----------|
| Policy snapshot (P0) | Documents & Policies section via `readPolicySnapshot` + enrichment | Contract PDF viewer depth |
| Service phases | `appointment-detail-enrichment` → Service schedule timeline | Live phase completion (not in runtime) |
| Rooms/equipment, add-ons | Enrichment panels | Post-booking resource reassignment (if unsupported) |
| Intake files/images | Attachment thumbnails/links in enrichment | Signed URL proxy for private buckets |
| Package/membership credits | Payments & Access entitlement block | Membership remaining cycle from billing |
| Partial refund / account credit | `RefundModal` + `/api/appointments/service-booking/refund` | Package credit restoration on cancel messaging |
| Recurring series | Recurring section + scope-ready actions | Edit-future-series dedicated flow |
| Demo avatar | Removed; initials from contact name | — |

### `/appointments/waitlist`

| Gap | Resolution | Remaining |
|-----|------------|-----------|
| Slot notification (P0) | `WaitlistSettingsPanel` — notify toggle + expiration | Channel picker if backend adds email-only |
| Auto-fill (P0) | Settings panel exposes `waitlistAutoFill` | Distinguish offer vs auto-book if backend adds mode |
| Priority rules (P1) | `PriorityRulesDrawer` + priority column | Advanced weighted rules UI if backend expands |
| Public waitlist join (P0) | **PUBLIC_WAVE_PENDING** — admin only this batch | Public booking join flow |

### `/appointments/recalls`

| Gap | Resolution | Remaining |
|-----|------------|-----------|
| Appointment segments (P0) | `RecallSavedViews` — recall groups, not Contacts Segments | Full segment builder (deferred; filters + save view) |
| Automation link | Link to Automations → Recall | — |

### `/appointments/staff`

| Gap | Resolution | Remaining |
|-----|------------|-----------|
| Round-robin state (P0) | Scheduling tab — eligible toggle + explanation | Last-assigned timestamp if exposed by API |
| Staff scheduling config (P2) | Round-robin participation + weight | Conflict with booking-type assignment mode banner |
| Calendar display color | Calendar display tab color picker | — |

### `/appointments/locations`

| Gap | Resolution | Remaining |
|-----|------------|-----------|
| P0 location gaps | Prior B14.3 work verified sufficient; no shell change this batch | Contextual room create from location row (verify E2E) |

**Temp routes not retired:** `/appointments/segments`, Commerce waitlist priority, parity hubs remain.

---
