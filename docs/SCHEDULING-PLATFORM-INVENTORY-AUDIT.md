# Transovo — Original Scheduling Platform Inventory (Audit Only)

**Date:** 2026-10-13  
**Scope:** Read-only discovery — no code, nav, or deploy changes.  
**Goal:** Separate **Appointment Reminders** (current launch product) from **Scheduling** (full Acuity-style platform) and inventory what exists in the repo.

---

## Executive summary

| Area | Finding |
|------|---------|
| **Scheduling platform code** | **Largely intact** — ~93 admin routes under `/appointments/**`, public booking under `/book/**`, 109+ `/api/appointments/**` handlers, and a deep `src/lib/appointments/service-booking/**` domain (~56 modules). |
| **Appointment Reminders** | **Separate product shell** — 25 routes under `/appointment-reminders/**`, calendar-sync + SMS reminder/reschedule focus (`src/lib/appointment-reminders/**`). |
| **Why scheduling feels “gone”** | Launch flags in `src/lib/workspace/platform-launch.ts`: `APPOINTMENT_REMINDERS_V1_PRIMARY = true`, `APPOINTMENTS_V1_PRIMARY = false`. Product switcher resolves to AR nav; full scheduling nav is defined in `src/lib/products/appointments-nav.ts` but is not the default shell. |
| **Classes / workshops** | **Distinct admin surfaces** (`/appointments/classes`, `/appointments/workshops`) + public `/book/[slug]/classes` and `/workshops`; Prisma `ClassSeries`, `ClassOccurrence`, `ClassEnrollment`; APIs under `/api/appointments/service-booking/classes` and public book routes. |
| **Packages / memberships** | **Implemented** — admin catalog/editors, store checkout, Stripe membership webhooks; models `PackageProduct`, `PackageBalance`, `ServiceMembershipProduct`, `ServiceMembershipSubscription`. |
| **Payments** | **Stripe + Square** — merchant connect (`src/lib/merchant-payments/`), public book checkout, Square step in `use-public-booking-flow.ts`. |
| **Calendars** | **Google + Microsoft** (workspace calendar connections, MCTB/AR sync); **Calendly** as integration + voice/MCTB booking path (`src/lib/voice/calendar/calendly-voice.ts`), not the native Transovo scheduler core. |
| **Certification** | `docs/ACUITY-PARITY-MATRIX.md` documents many **PASS** rows for core booking/classes/packages/memberships; numerous **FAIL** rows for polish (SEO, deep links, manage-link payments, etc.). |
| **Git deletion** | **No evidence** of mass deletion of `/appointments` pages in recent history; hiding is primarily **nav + launch flags**, not removed routes. |

**Intended future IA (not implemented):** Scheduling becomes its own main-sidebar product; Appointment Reminders stays separate. Shared backend (calendar, SMS, payments) remains shared — no duplicate engines required.

---

## Product boundary (current code)

### Appointment Reminders (`appointment_reminders` shell)

| Item | Location |
|------|----------|
| Routes | `src/lib/appointment-reminders/routes.ts` → `/appointment-reminders/*` |
| Nav | `src/lib/products/appointment-reminders-nav.ts` |
| Hide booking submodule | `src/lib/appointment-reminders/ar-launch-nav.ts` (`AR_HIDE_BOOKING_NAV` / `isAppointmentRemindersV1Primary()`) |
| APIs | `src/app/api/appointment-reminders/**` (appointments list, reminder timeline, calendar write-back, import) |
| UI | `src/app/(app)/appointment-reminders/**`, `src/newui-transplant/connected/appointment-reminders/**` |

**AR pages (25):** Overview (`/appointment-reminders`), Calendar, Appointments, Reminders (activity, sequences, templates), Responses, AI Rescheduler, Analytics, Calendars/Integrations, Settings, Setup (connect/configure/activate), Pricing, optional Booking (meetings/services) when booking nav not hidden.

### Scheduling platform (`appointments` shell)

| Item | Location |
|------|----------|
| Routes manifest | `src/lib/products/appointments-routes.ts`, static segments `APPOINTMENTS_STATIC_SEGMENTS` |
| Nav (full Acuity-style tree) | `src/lib/products/appointments-nav.ts` — Home, Booking, Calendar, Availability, Clients, Messages, Reminders, Workflows*, Meetings*, Payments, Analytics, Integrations, Settings |
| Module flags | `src/lib/products/scheduling-modules.ts` — defaults: `classes: false`, `workflows: false`, `meetings: false`, `commerce: true` (packages/memberships nav gated on `commerce`) |
| Domain | `docs/TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md`, `src/lib/appointments/**`, `src/lib/appointments/service-booking/**` |
| Connected UI pattern | `src/components/appointments/**`, `src/features/appointments/kimi/**` |

\*Workflows / Meetings nav children only appear when workspace `schedulingModules` enables them.

### Overlap / redirects

- `/appointments/reminders` → redirects to AR settings (`src/app/(app)/appointments/reminders/page.tsx`) — reminders **product** canonical home is AR, not scheduling shell.
- Scheduling shell still has Reminders **children** in nav pointing at `/appointments/reminders` (legacy bridge).
- Both products can use shared `/settings/**`, `/integrations/**`, `/conversations` when appointments shell is active.

---

## A. Complete page inventory (Scheduling — `/appointments` + public booking)

**Status legend:**  
**W** = Working (connected UI + real APIs/lib; matrix or code evidence)  
**P** = Partial (UI + some backend; gaps or legacy paths)  
**H** = Hidden/disconnected (route exists; not in default AR launch nav)  
**L** = Legacy naming or redirect  
**U** = UI/mock fallbacks in public Kimi shells (dev/error paths use `mock-data`)  
**N** = Not found

### Core operations

| Page | Route | Original section | Status | Backend? | Notes |
|------|-------|------------------|--------|----------|-------|
| Home / dashboard | `/appointments/overview` | Home | W/P | Yes | `AppointmentsOverviewClient`; metrics APIs |
| Calendar | `/appointments/calendar` | Calendar | W | Yes | `AppointmentsCalendarClient` |
| Appointments list | `/appointments/scheduled` | Calendar | W | Yes | `AppointmentsListClient` |
| Appointment detail | `/appointments/[id]` | Calendar | W | Yes | `AppointmentDetailClient`; reserved slug redirects |
| New appointment | `/appointments/new` | Calendar | W | Yes | `NewAppointmentPage` |
| Waitlist | `/appointments/waitlist` | Calendar | W | Yes | `WaitlistAdminClient`; `AppointmentWaitlistEntry` |
| Recalls | `/appointments/recalls` | Calendar | W | Yes | `RecallsHubClient` |
| Recall campaigns | `/appointments/recall-campaigns` | Calendar | P | Yes | Client + API |
| No-show recovery | `/appointments/no-show-recovery` | Calendar | P | Yes | Admin surface |

### Booking types — meetings, services, classes, workshops

| Page | Route | Section | Status | Backend? | Notes |
|------|-------|---------|--------|----------|-------|
| Services workspace | `/appointments/services`, `/[id]`, `/new` | Booking | W | Yes | `ServicesWorkspaceConnected` |
| Meetings workspace | `/appointments/meetings`, `/[id]`, `/new` | Booking | W | Yes | `MeetingsWorkspaceConnected` |
| Classes workspace | `/appointments/classes`, `/[id]`, `/new` | Booking | W | Yes | `ClassesWorkspaceConnected`; `ClassSeries` |
| Workshops workspace | `/appointments/workshops`, `/[id]`, `/new` | Booking | W | Yes | `WorkshopsWorkspaceConnected` |
| Types hub (legacy) | `/appointments/types` | Booking | L | Partial | `LegacyAppointmentTypesPage` |
| Types by kind | `/appointments/types/services`, `classes`, `workshops` | Booking | W | Yes | `BookingTypesKindListConnected` |
| Types editor | `/appointments/types/editor`, `meetings/*` | Booking | P | Yes | Mixed legacy + editor routes |
| Booking pages admin | `/appointments/booking` | Booking | W | Yes | `AppointmentBookingPage` |
| Booking branding | `/appointments/booking/branding` | Booking | W | Yes | Theme API |
| Booking forms | `/appointments/booking/forms` | Booking | L | Partial | `LegacyBookingFormsPage` |
| Booking share/embed | `/appointments/booking/share` | Booking | W | Yes | Share links |
| Booking contracts | `/appointments/booking/contracts` | Booking | W | Yes | Contract templates |
| Team booking | `/appointments/team-booking` | Booking | W | Yes | `TeamBookingConnected` |
| Team pages | `/appointments/team-pages` | Booking | P | Yes | `TeamPagesClient` |
| Routing forms | `/appointments/routing-forms` | Booking | W | Yes | `RoutingFormsClient` |
| Meeting polls | `/appointments/meeting-polls`, `/[pollId]` | Booking | W | Yes | `MeetingPollsLibraryConnected` |
| Legacy polls | `/appointments/polls` | Booking | L | Partial | `LegacyMeetingPollsPage` |
| AI booking admin | `/appointments/ai-booking` | Booking | P | Yes | `AiBookingAdminPage` |

### Availability, staff, locations, resources

| Page | Route | Section | Status | Backend? | Notes |
|------|-------|---------|--------|----------|-------|
| Availability / schedules | `/appointments/availability` | Availability | W | Yes | `AppointmentAvailabilityPage` |
| Routing rules | `/appointments/routing` | Availability | W | Yes | `RoutingConnected` |
| Locations | `/appointments/locations`, `/[locationId]` | Availability | W | Yes | `LocationsConnected` |
| Resources | `/appointments/resources`, `/[resourceId]` | Availability | W | Yes | `ResourcesConnected` |
| Staff | `/appointments/staff`, `/[staffId]` | Availability | W | Yes | `StaffConnected` |

### Clients & CRM (scheduling context)

| Page | Route | Section | Status | Backend? | Notes |
|------|-------|---------|--------|----------|-------|
| Clients list | `/appointments/clients` | Clients | W | Yes | `ClientsConnected` |
| Client detail | `/appointments/clients/[clientId]` | Clients | W | Yes | `ClientDetailConnected` |
| Segments | `/appointments/segments` | Clients | P | Yes | `AppointmentSegmentsClient` |
| Client restrictions | `/appointments/client-restrictions` | Clients | W | Yes | Service-booking restrictions API |
| Contact merge | `/appointments/commerce/contact-merge` | Commerce | W | Yes | API route |

### Packages, memberships, commerce

| Page | Route | Section | Status | Backend? | Notes |
|------|-------|---------|--------|----------|-------|
| Packages catalog | `/appointments/packages` | Commerce | W | Yes | `PackagesCatalogConnected` |
| Package editor | `/appointments/packages/[id]`, `/new` | Commerce | W | Yes | `PackageEditorConnected` |
| Memberships catalog | `/appointments/memberships` | Commerce | W | Yes | `MembershipsCatalogConnected` |
| Membership editor | `/appointments/memberships/[id]`, `/new` | Commerce | W | Yes | `MembershipEditorConnected` |
| Commerce hub | `/appointments/commerce` | Commerce | W | Yes | `ServiceBookingCommercePage` |
| Pricing & payments | `/appointments/pricing-payments` | Commerce | W | Yes | `PricingPaymentsClient` |
| Point of sale | `/appointments/point-of-sale`, `/pos` | Commerce | W | Yes | `PointOfSaleConnected`; POS redirect |
| Coupons | `/appointments/coupons` | Commerce | W | Yes | `AppointmentCoupon` model |
| Categories | `/appointments/categories` | Commerce | W | Yes | `BookingCategoriesPage` |
| Gift certificates | (store + APIs) | Commerce | W | Yes | `gift-certificates` service-booking API |
| Service booking admin | `/appointments/service-booking` | Commerce | W | Yes | Hub `ServiceBookingAdminClient` |
| Payments (scheduling) | `/appointments/payments` | Payments | W | Yes | `ServiceBookingAdminClient` |
| Policies | `/appointments/policies` | Settings | P | Yes | `AppointmentsPoliciesClient` |
| Restrictions | `/appointments/restrictions` | Settings | W | Yes | Admin client |
| Contracts | `/appointments/contracts` | Booking | W | Yes | Templates + signed contracts |
| Forms & documents | `/appointments/forms-documents`, builder | Booking | W | Yes | `FormDetailConnected`, intake APIs |
| Enterprise | `/appointments/enterprise` | Settings | P | Unknown | `EnterpriseSchedulingPage` — verify entitlement |

### Automations & reminders (scheduling shell)

| Page | Route | Section | Status | Backend? | Notes |
|------|-------|---------|--------|----------|-------|
| Reminders (redirect) | `/appointments/reminders` | Automations | L | N/A | Redirects to AR settings |
| Voice reminders | `/appointments/voice-reminders` | Automations | P | Yes | `VoiceRemindersClient` |
| Workflows list | `/appointments/workflows` | Automations | P/H | Yes | Gated by `schedulingModules.workflows` |
| Workflow builder | `/appointments/workflows/new`, `[id]/edit`, setup | Automations | P/H | Yes | `AppointmentWorkflow` models |
| Automation templates | `/appointments/automations/templates` | Automations | W | Yes | Shares reminder template infra |
| Automation activity | `/appointments/automations/activity` | Automations | W | Yes | Activity feed |

### Analytics, integrations, setup

| Page | Route | Section | Status | Backend? | Notes |
|------|-------|---------|--------|----------|-------|
| Analytics overview | `/appointments/analytics` | Analytics | W | Yes | APIs under `/api/appointments/analytics` |
| Analytics subpages | `.../booking`, `reminders`, `automations`, `reports` | Analytics | W/P | Yes | |
| Service booking reports | `/appointments/reports/service-booking` | Analytics | W | Yes | |
| Integrations | `/appointments/integrations` | Integrations | L | Yes | Redirect hub |
| Setup wizard | `/appointments/setup` | Settings | P | Yes | `AppointmentsSetupClient` |
| List (legacy) | `/appointments/list` | Calendar | L | Partial | Alternate list entry |

### Public customer booking (Scheduling)

| Page | Route | Section | Status | Backend? | Notes |
|------|-------|---------|--------|----------|-------|
| Public book home | `/book/[slug]` | Public | W | Yes | `public-booking-flow`; large `api/public/book/[slug]` |
| Book service | `/book/[slug]/[serviceId]` | Public | W | Yes | |
| Classes / workshops | `/book/[slug]/classes`, `/workshops` | Public | W | Yes | Dedicated public APIs |
| Store / packages | `/book/[slug]/store` | Public | W | Yes | Checkout + fulfill APIs |
| Embed | `/embed/book/[slug]` | Public | W | Yes | Matrix APT-PUB-013 PASS |
| Payment return | `/book/payment/success`, `canceled` | Public | W | Yes | |
| Manage appointment | `/appointments/manage/[token]` | Public | W | Yes | `manage-appointment.ts`; matrix APT-MGT-* |
| Confirm / cancel / reschedule | `/appointments/confirm|cancel|reschedule/[token]` | Public | W/P | Yes | Kimi shells; **U** mock fallbacks on error in some components |
| Client portal | `/client/appointments/[appointmentId]` | Public | P | Yes | Portal APIs |

---

## A2. Appointment Reminders pages (separate product)

| Page | Route | Status | Backend? | Notes |
|------|-------|--------|----------|-------|
| Overview | `/appointment-reminders` | W | Yes | AR home |
| Calendar (synced view) | `/appointment-reminders/calendar` | W | Yes | Read-only provider mirror |
| Appointments | `/appointment-reminders/appointments` | W | Yes | AR APIs |
| Reminders | `/appointment-reminders/reminders` | W | Yes | Delivery activity |
| Sequences / templates | `.../sequences`, `.../templates` | W | Yes | Opus UI |
| Responses | `/appointment-reminders/responses` | W | Yes | SMS reply handling |
| AI Rescheduler | `/appointment-reminders/ai-rescheduler` | W | Yes | `docs/AR-AI-RESCHEDULER-*` |
| Analytics | `/appointment-reminders/analytics` | W | Yes | |
| Calendars / OAuth | `/appointment-reminders/calendars`, setup | W | Yes | Not full scheduling admin |
| Settings | `/appointment-reminders/settings` | W | Yes | |
| Booking (optional) | `/appointment-reminders/booking/**` | H/P | Partial | Hidden when `appointmentRemindersHideBookingNav()` |

---

## B. Feature inventory (selected)

| Feature | Implemented? | UI location | Backend / service | Missing pieces |
|---------|--------------|-------------|-------------------|----------------|
| Appointment CRUD + calendar | Yes | `/appointments/calendar`, `[id]` | `booking-platform.ts`, Prisma `VoiceAppointment` | Launch visibility |
| Public booking + slots | Yes | `/book/**` | `/api/public/book/[slug]` | Some deep-link matrix FAILs |
| Manage appointment URL | Yes | `/appointments/manage/[token]` | `manage-appointment.ts` | Pay balance on manage (FAIL) |
| Classes + occurrences | Yes | `/appointments/classes` | `service-booking/classes.ts` | Nav module flag default off |
| Workshops | Yes | `/appointments/workshops` | Workshop workspace + book APIs | Same |
| Waitlist | Yes | waitlist admin + public API | `AppointmentWaitlistEntry` | |
| Packages + ledger | Yes | packages admin + store | `packages.ts`, `PackageBalance` | |
| Memberships + Stripe | Yes | memberships admin | `memberships.ts`, webhooks | Square membership less clear |
| Deposits / checkout | Yes | public flow | checkout + entitlements | Refund edge cases |
| Intake forms | Yes | forms-documents | `intake-forms.ts` | Manage-link intake edit FAIL |
| Staff / locations / resources | Yes | availability section | staff/location APIs | |
| Team / round-robin booking | Yes | team-booking | simulate + workspace APIs | |
| Routing forms | Yes | routing-forms | APIs | |
| Meeting polls | Yes | meeting-polls | workspace APIs | Legacy `/polls` |
| SMS reminder sequences (platform) | Yes | AR + `/appointments/automations` | reminder jobs | Product split confusing |
| Workflows / scans | Yes | workflows (hidden) | `workflow-scanners`, job types | `workflows: false` default |
| No-show / recall | Yes | recalls, no-show-recovery | hub APIs | |
| POS / multi-item cart | Yes | point-of-sale | `pos-cart` API | |
| Service phases / multi-service | Yes | service-booking lib | `multi-service.ts`, phases API | Certification BA rows |
| Gift certificates | Yes | store + API | `gift-certificates.ts` | |
| Coupons | Yes | coupons page | `coupons.ts` | |
| Household / dependents | Yes | lib | `household.ts` | Matrix BE |
| Seat maps / check-in | Yes | APIs | `ClassSeatMap`, check-in API | UI exposure |
| Webhooks (appointment) | Yes | service-booking | `webhook-delivery.ts` | |
| AI booking (admin) | Partial | ai-booking | config APIs | |
| Enterprise tier UI | Partial | enterprise | TBD | |

---

## C. Original navigation structure

**Canonical scheduling nav** — `buildAppointmentsV1Nav()` in `src/lib/products/appointments-nav.ts`:

```
Home → /appointments/overview
Booking → Meetings, Services, Classes, Workshops, Booking Pages, Share, [Packages, Memberships, Pricing, Forms, Contact merge, POS if commerce], Segments, Routing forms, Team booking, Team pages, Meeting Polls, AI Booking
Calendar → Calendar, Appointments, Clients, Waitlist, Recalls
Availability → Schedules, Routing, Locations, Resources
Clients → /appointments/clients
Messages → Inbox, Campaigns (if conversations in V1 nav)
Reminders → Reminder Sequences, Templates, Activity  (note: /appointments/reminders redirects to AR)
[Workflows] if module on
[Meetings] → /video, /meetings if module on
[Payments] → /payments/*
[Analytics] → multiple children
Integrations → Calendars, Payments
Settings → business, team, messaging, calendar, meetings, security, billing
Help → /getting-started
```

**Currently hidden from default customer experience:**

- Entire `appointments` shell when `APPOINTMENT_REMINDERS_V1_PRIMARY` (`platform-launch.ts`).
- AR booking subsection when `appointmentRemindersHideBookingNav()` (default true under AR-primary).
- Nav children gated by `schedulingModules`: **classes**, **workflows**, **meetings** default **off**; **commerce** default **on** (packages/memberships visible in nav config when appointments shell is shown).

**Appointment Reminders nav** — `buildAppointmentRemindersNav()`:

```
Calendar, Appointments, Reminders (activity, sequences, templates), Responses, AI Rescheduler, Analytics, Settings (+ billing/business)
[Optional Booking section: Booking page, Meetings]
```

**V1 launch nav flags** — `src/lib/products/v1-launch-nav.ts`: `APPOINTMENTS_IN_V1_NAV = true` (global marketing flag) does **not** override AR-primary shell selection.

---

## D. Classes, workshops, packages, memberships (dedicated)

### Classes

| Layer | Evidence |
|-------|----------|
| Admin UI | `src/app/(app)/appointments/classes/**` → `ClassesWorkspaceConnected` |
| Public | `/book/[slug]/classes`, seat APIs |
| API | `/api/appointments/service-booking/classes` (via service-booking), public book classes routes |
| DB | `ClassSeries`, `ClassOccurrence`, `ClassEnrollment`, `ClassSeatMap`, `ClassCheckIn`, `ClassAdmissionTicket` |
| Status | **Working** for core define/schedule/enroll; matrix APT-PUB-002 **PASS** |

### Workshops

| Layer | Evidence |
|-------|----------|
| Admin UI | `src/app/(app)/appointments/workshops/**` → `WorkshopsWorkspaceConnected` |
| Public | `/book/[slug]/workshops` |
| Types nav | `/appointments/types/workshops` |
| Status | **Working** (parallel to classes; separate workspace components) |

### Packages

| Layer | Evidence |
|-------|----------|
| Admin UI | `/appointments/packages/**` |
| Store | `/book/[slug]/store` |
| API | `service-booking/packages.ts`, store checkout |
| DB | `PackageProduct`, `PackageBalance`, `PackageLedgerEntry` |
| Status | **Working**; matrix package section **PASS** |

### Memberships

| Layer | Evidence |
|-------|----------|
| Admin UI | `/appointments/memberships/**` |
| API | `memberships.ts`, `membership-lifecycle.ts`, `membership-booking.ts` |
| Stripe | `membership-stripe-webhook.ts` |
| DB | `ServiceMembershipProduct`, `ServiceMembershipSubscription` |
| Status | **Working**; matrix **PASS** |

---

## E. Integrations (scheduling-related)

| Provider | Role | Implementation status | Key paths |
|----------|------|----------------------|-----------|
| **Google Calendar** | Sync + write-back | **Working** (workspace connections) | `src/lib/calendar/**`, integrations UI |
| **Microsoft Calendar** | Sync + write-back | **Working** | Same; heavy AR usage |
| **Calendly** | External scheduler / voice booking | **Partial** — not native Acuity replacement | `calendly` provider on connections, `ext-calendly` jobs, voice `calendly-voice.ts` |
| **Stripe** | Payments + memberships | **Working** | `src/lib/merchant-payments/stripe*`, checkout, webhooks |
| **Square** | Payments at booking | **Working** | `src/lib/merchant-payments/square.ts`, `SquarePaymentStep`, public book API |
| **Internal calendar** | Native scheduling | **Working** | `VoiceAppointment`, slot engine in scheduling domain |

**Distinction:** AR uses calendar connections for **mirror + reminders**; Scheduling uses the same connection layer plus **native booking** (`/book`, `VoiceAppointment`, service-booking).

---

## F. Recoverable legacy functionality

| Finding | Git / code evidence |
|---------|---------------------|
| Mass route deletion | **Not found** — `git log --diff-filter=D` on `src/app/(app)/appointments/**` returned empty in sample |
| Recovery mechanism | Re-enable **appointments product shell** + product switcher; set `APPOINTMENTS_V1_PRIMARY` / flip `APPOINTMENT_REMINDERS_V1_PRIMARY` in `platform-launch.ts` (launch config, not deleted code) |
| Legacy page variants | `LegacyAppointmentTypesPage`, `LegacyBookingFormsPage`, `LegacyMeetingPollsPage` — still in tree, parallel to newer surfaces |
| Kimi / Mode 4 drafts | `src/features/appointments/kimi/**`, `src/components/appointments/kimi-ui/**` — presentation + connected adapters |
| Old reminders path | `/appointments/reminders` → AR settings redirect |
| MCTB booking link mode | Separate from scheduling (`MctbBookingLink`) — not Acuity platform |

---

## G. Restoration assessment

### 1. Already working — mostly needs exposure (nav / product shell / flags)

- Full `/appointments/**` admin surfaces with `*Connected` components  
- Public `/book/**` + manage/reschedule/cancel tokens  
- Service-booking backend (classes, packages, memberships, POS, waitlist)  
- Stripe/Square merchant flows  
- Core calendar OAuth (Google/Microsoft)

**Effort:** Low–medium — product IA, switcher, launch flags, QA pass; **no greenfield backend** for core booking.

### 2. Existing — needs wiring or polish

- Nav module defaults (`classes`, `workflows`, `meetings` off)  
- Matrix **FAIL** items (collapsible categories, type images, SEO, manage-link payments, staff/location deep links)  
- Public Kimi components with **mock fallbacks** on error (`public-cancel`, `public-reschedule`) — verify production always hits APIs  
- `/appointments/reminders` vs AR product duplication  
- Enterprise page entitlement clarity

**Effort:** Medium — targeted glue + certification rows.

### 3. Recoverable from legacy (in-repo, not deleted)

- Legacy types/forms/polls pages — migrate users to canonical surfaces or wire redirects  
- `schedulingModules` per-workspace toggles already in platform config loader

**Effort:** Low — mostly routing and deprecation cleanup.

### 4. Missing / new implementation required

- Items marked **FAIL** in `ACUITY-PARITY-MATRIX.md` without code counterparts  
- Automated alerting (operational, not scheduling UI)  
- **Separate top-level “Scheduling” sidebar** — **not built yet** (today: `appointments` shell vs `appointment_reminders` shell in `product-shell.ts`)

**Effort:** High only for explicit matrix gaps — not for core platform resurrection.

### Effort by functional area (evidence-based)

| Area | Evidence strength | Restoration effort |
|------|-------------------|--------------------|
| Core appointments + calendar | PASS rows + connected pages | **Low** (expose + test) |
| Public booking | Large API + PASS rows | **Low** |
| Classes / workshops | Full stack + PASS | **Low** (enable nav module + QA) |
| Packages / memberships | Full stack + PASS | **Low** |
| Payments | Stripe/Square wired | **Low–medium** (edge cases) |
| Workflows / enterprise | Module off by default | **Medium** |
| Manage link / policies | Mixed PASS/FAIL | **Medium** |
| New Scheduling sidebar product | Not in code | **Medium** (IA only; reuse `appointments` shell) |

---

## Key file index (for reviewers)

| Purpose | Path |
|---------|------|
| Launch / which product shows | `src/lib/workspace/platform-launch.ts` |
| Scheduling nav tree | `src/lib/products/appointments-nav.ts` |
| AR nav tree | `src/lib/products/appointment-reminders-nav.ts` |
| Shell resolution | `src/lib/products/resolve-product-nav.ts`, `product-shell.ts` |
| Route prefixes | `src/lib/products/appointments-routes.ts` |
| Module flags | `src/lib/products/scheduling-modules.ts` |
| Service-booking domain | `src/lib/appointments/service-booking/` |
| Public booking API | `src/app/api/public/book/[slug]/route.ts` |
| Parity certification | `docs/ACUITY-PARITY-MATRIX.md` |
| Domain map | `docs/TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md` |
| Parity requirement | `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md` |

---

## Critical restrictions observed

- **No application code, nav, sidebar, or deploy changes** were made for this audit.  
- **Appointment Reminders** and **New UI2 Opus** surfaces were not modified.  
- Status classifications are based on route presence, connected-component patterns, Prisma models, API inventory, and parity docs — **not** on live browser certification in this pass.

---

## Recommended next step (after approval)

1. Agree on **product switcher** behavior: Scheduling (`appointments` shell) vs Appointment Reminders.  
2. Run **read-only UA certification** on a staging workspace with `APPOINTMENTS_V1_PRIMARY` flipped for internal QA only.  
3. Design **Scheduling** sidebar as re-home of existing `buildAppointmentsV1Nav()` — not a rewrite.  
4. Triage matrix **FAIL** rows against restoration priority.
