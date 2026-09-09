# Appointments Platform — Master Feature Inventory

**Generated:** 2026-09-09  
**Updated:** 2026-09-09 (certification-phase tightening)  
**Branch:** `cursor/appt-full-parity-build-709b`  
**Scope:** General-purpose appointments / service-booking (excludes MCTB, Mass SMS, Smart Routing, Fax)  
**Competitor baseline:** Acuity Scheduling (**A**) · SimplyBook.me (**SB**) · Square Appointments (**SQ**)

> **Canonical source of truth.** This ledger is the master inventory for appointments parity and certification. Feature discovery is complete; remaining work is certification, closing **PARTIAL** rows, and provider-blocked external access — not broad feature addition unless a true omission is found here.

---

## How to read this document

| Column | Meaning |
|--------|---------|
| **Feature** | Canonical capability name |
| **Competitor(s)** | Which of A / SB / SQ offer equivalent general-purpose capability (`—` = Transovo-native) |
| **Transovo implementation** | Primary lib / module |
| **Route / UI** | Admin or public surface |
| **API / runtime** | HTTP route or job |
| **Database model** | Prisma table(s) or JSON config key |
| **Automated test** | Script or npm bundle that exercises it (`—` = no dedicated script) |
| **UAT status** | See legend below |
| **External dependency** | Third-party or partner requirement |

### UAT status legend

| Status | Meaning |
|--------|---------|
| **PASS** | Automated + prior certification evidence |
| **UA_PENDING** | Code complete; browser / live-provider UAT not yet signed off |
| **PARTIAL** | Foundation exists; depth or UI wiring incomplete |
| **PROVIDER_BLOCKED** | Requires external OAuth / partner program |
| **N/A** | Internal / infrastructure only |

### Competitor key

| Code | Platform |
|------|----------|
| **A** | Acuity Scheduling |
| **SB** | SimplyBook.me |
| **SQ** | Square Appointments |
| **All** | All three (general scheduling parity) |

### Primary automated test bundles

| Command / script | Covers |
|------------------|--------|
| `npm run test:appointments-v1` | Availability, protection, reminders, double-book, tenant isolation, nav |
| `npx tsx scripts/test-phase2-wiring.ts` | Phase 2 commerce / add-ons / entitlements |
| `npx tsx scripts/test-phases-3-17-wiring.ts` | Phases 3–17 parity wiring |
| `npx tsx scripts/test-clean-parity-gaps.ts` | Phase 18 clean parity modules |
| `npx tsx scripts/test-booking-protection.ts` | Bot / abuse protection |
| `npx tsx scripts/test-appointments-double-booking.ts` | Anti double-book |
| `npx tsx scripts/test-appointment-workflows-*.ts` | Workflow engine |

---

## Master ledger governance

### Phase status

| Phase | Status |
|-------|--------|
| Competitor parity discovery (A / SB / SQ) | **Complete** |
| Implementation breadth (Phases 1–18) | **Complete** |
| Implicit sub-capability visibility | **This pass** — explicit rows added below |
| **PARTIAL** depth closure | **Complete** — all queued rows at CODE_COMPLETE; UA certification pending |
| Journey-based UAT (UA_PENDING → PASS) | **Next bottleneck** |
| Provider-blocked channels | **Scaffold only** — separate from code gaps |

### PARTIAL vs PROVIDER_BLOCKED vs UA_PENDING

| Status | Launch meaning |
|--------|----------------|
| **PARTIAL** | Competitor-equivalent capability is **not fully represented** in product — code/UI depth still required |
| **UA_PENDING** | Implementation exists; needs browser + live-runtime certification |
| **PROVIDER_BLOCKED** | Scaffold exists; **Transovo cannot certify live parity** until external OAuth / partner credentials |
| **PASS** | Automated tests + prior certification evidence |

**Do not mix PROVIDER_BLOCKED with unfinished code** in launch planning. Provider-blocked items (Reserve with Google, Facebook Book Now, Instagram booking, iCloud sync, SAML/SCIM) stay in a separate track until access exists.

### PARTIAL priority queue (immediate)

_All former PARTIAL rows are now **CODE_COMPLETE** (2026-09-08). Next: browser UA journeys on production._

### Certification method (UA_PENDING → PASS)

Certify by **real customer journeys**, not isolated row-by-row checks. One journey validates 10–20 ledger rows.

| Journey | Certifies (examples) |
|---------|----------------------|
| **Trainer package** | Packages, entitlements, recurring booking, portal, payments, reminders, self-service, policy handling, package ledger, cancel/reschedule credit restore **and forfeiture** |
| **Membership** | Subscribe, entitlement activation, member-only types, monthly credit provision, booking consumption, failed payment → suspension → recovery |
| **Class + waitlist** | Class series, capacity display, enrollment, fill → waitlist → cancel opens seat → offer → atomic accept → QR check-in |
| **Multi-service** | Service A + B, per-line staff, processing-time release, resource reservation, single payment, single appointment record |

Update each row to **PASS** only when the journey that covers it has been signed off in browser + live runtime.

---

## 1. Product shell & navigation

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Appointments overview (Home) | All | `overview` API + overview page | `/appointments/overview` | `GET /api/appointments/overview` | `VoiceAppointment` aggregates | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Primary product nav | All | `appointments-nav.ts` | Shell sidebar | `buildAppointmentsV1Nav()` | — | `test-appointments-nav.ts` | PASS | — |
| Mobile bottom nav | All | `appointments-nav.ts` | Mobile shell | `buildAppointmentsMobileNav()` | — | `test-appointments-nav.ts` | UA_PENDING | — |
| Progressive disclosure modules | — | `scheduling-modules.ts` | Nav gating | `buildAppointmentsV1Nav({ modules })` | Workspace JSON config | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Platform setup wizard | All | setup page | `/appointments/setup` | — | `AppointmentPlatformConfig` JSON | — | UA_PENDING | — |
| Global search (overview) | A, SB | `global-search.ts` | Overview header | `GET …/service-booking/global-search` | `VoiceAppointment`, contacts | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| V1 launch nav gating | — | `v1-launch-nav.ts` | Shell | Feature flags | `Workspace` entitlements | `test-product-shell.ts` | PASS | — |

---

## 2. Booking types & configuration

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Booking types list & editor | All | `types` API + TypeEditor | `/appointments/types` | `GET/POST/PATCH /api/appointments/types` | `VoiceService` + config JSON | `test-booking-type-kind.ts` | UA_PENDING | — |
| Archetypes MEETING / SERVICE / CLASS | All | `booking-type-kind.ts` | Type editor | `bookingTypeKind` on config | `VoiceService.config` | `test-booking-type-kind.ts` | UA_PENDING | — |
| Multiple duration options | All | type config | Type editor | `durationOptions` | `VoiceService.config` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Visibility (public / unlisted / secret) | All | type config | Type editor | `visibility` | `VoiceService.config` | — | UA_PENDING | — |
| Display order & bulk reorder | All | types bulk API | Type editor | `POST /api/appointments/types/bulk` | `VoiceService` | — | UA_PENDING | — |
| Custom booking questions | All | `bookingQuestions` | Type editor + public Info | public book POST | `VoiceService.config` | `test-booking-intake.ts` | UA_PENDING | — |
| Group booking / attendee count | All, SB | `groupBooking` | Type + public | `attendeeCount` on book | `VoiceService.config` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Recurring eligibility on type | All | `recurring` config | Type editor | `recurring.enabled` | `VoiceService.config` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Staff assignment modes | All | `scheduling-domain.ts` | Type editor + staff picker | round_robin, collective, etc. | `VoiceService.config` + `staff[]` | `test-appointments-double-booking.ts` | UA_PENDING | — |
| Location assignment | All, SQ | platform `locations` | Type editor | `locationIds` | `AppointmentPlatformConfig` | — | UA_PENDING | — |
| Payment modes on type | All | `payments-extended.ts` | Type editor | deposit, full, PWYW, save card | `VoiceService.config` | `test-phase2-wiring.ts` | UA_PENDING | Stripe / Square |
| Cancellation policy | All | `extendedCancellationPolicy` | Type editor | policy on config | `VoiceService.config` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Reschedule policy | All | `extendedReschedulePolicy` | Type editor | policy on config | `VoiceService.config` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Booking approval required | A | `booking-approval.ts` | Type editor | `awaiting_confirmation` status | `VoiceAppointment.status` | `test-booking-workflow-states.ts` | UA_PENDING | — |
| Categories on type | SB | `booking-category.ts` | Type editor | `categoryId` | `BookingCategory` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Images on type | SB | `imageUrl` | Type + public Service step | public GET types | `VoiceService.config` | — | UA_PENDING | — |
| Required resources on type | SQ, SB | `resources.ts` | Type editor | `resourceIds` | `SchedulingResource` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Add-ons on type | All | `add-ons.ts` | Type + commerce | `addOnIds` | `BookingAddOn` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Add-on duration & resource effects | All | `add-ons.ts` | Type + public Info | `durationDeltaMinutes`, `resourceIds` on selection | `BookingAddOn` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Intake forms on type | A, SB | `intake-forms.ts` | Type + public Info | `intakeResponses` POST | `IntakeForm`, `IntakeFormResponse` | `test-booking-intake.ts` | UA_PENDING | — |
| Intake file / image upload | SB | `IntakeFieldType` file/image | Public Info (field type) | intake POST + storage | `IntakeFormResponse` | — | CODE_COMPLETE | Object storage (S3/Supabase) |
| Service phases (multi-phase duration) | SQ | `service-phases.ts` | Type editor phases | `ServicePhaseTemplate` API | `ServicePhaseTemplate` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Provider-release processing time | SQ | `staff-phase-occupancy.ts` | Type phases (`staffRequired`) | `validatePhasedSlot` | `ServicePhaseTemplate.staffRequired` | `test-clean-parity-gaps.ts` | UA_PENDING | — |
| Confirmation page customization | All | `confirmationPage` | Public Done step | public GET | `VoiceService.config` | — | UA_PENDING | — |
| Booking page settings | All | `settings.ts` | `/appointments/booking` | `GET/PATCH /api/appointments/settings` | `AppointmentPlatformConfig` | — | UA_PENDING | — |
| Share & embed hub | All | share hub client | `/appointments/booking/share` | embed URLs | — | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Booking QR code generator | SQ | Share hub + QR API | `/appointments/booking/share` | `GET/POST /api/appointments/booking/qr` | — | `test-clean-parity-gaps.ts` | UA_PENDING | `qrcode` npm |
| Single-use booking links | A | `booking-links.ts` | — | `booking-links` API | platform `singleUseLinks` JSON | — | UA_PENDING | — |
| Embed URL & iframe | All | `scheduler-theme.ts` | `/embed/book/[slug]` | public book API | — | — | UA_PENDING | — |
| Booking approval queue | A | `booking-approval.ts` | — | `POST …/booking/approval` | `VoiceAppointment` | — | UA_PENDING | — |
| Scheduler theme / branding | All | `scheduler-theme.ts` | Commerce admin | `scheduler-theme` API | platform `schedulerTheme` JSON | — | UA_PENDING | — |
| Custom booking domain | SB | `SchedulerThemeConfig.customDomain` | Theme config | `scheduler-theme` API | platform JSON | — | UA_PENDING | DNS / TLS |
| Advanced custom CSS | A, SB | `SchedulerThemeConfig.customCss` | Theme config | `scheduler-theme` API | platform JSON | — | UA_PENDING | — |
| Custom terminology / locale | SB | `bookingTerminology` | Theme + public labels | `scheduler-theme` API | platform JSON | — | UA_PENDING | — |
| Direct booking links per type | All | `directLinksForWorkspace()` | Share hub | deep links | — | — | UA_PENDING | — |
| Booking source / UTM attribution | A | `booking-source.ts` | — | UTM on book POST | `VoiceAppointment.metadata` | — | UA_PENDING | — |
| Named availability schedules | SB | `scheduling-capabilities` | `/appointments/availability` | platform `namedSchedules` | platform JSON | — | UA_PENDING | — |
| Categories admin | SB | `booking-category.ts` | `/appointments/categories` | `categories` API | `BookingCategory` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Client restrictions | SB | `client-restrictions.ts` | `/appointments/client-restrictions` | `client-restrictions` API | `ClientBookingRestriction` | — | UA_PENDING | — |
| Audience segments | — | `appointment-segments.ts` | `/appointments/segments` | `appointment-segments` API | — | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Terms & conditions acceptance | SB, A | `terms-acceptance.ts` | Public Info checkbox | book POST `termsAccepted` | `VoiceAppointment.metadata.termsAcceptance` | `test-clean-parity-gaps.ts` | UA_PENDING | — |
| Formal contracts + e-signature | SQ | `booking-contracts.ts` | — (API-first) | `contracts` API, `POST …/contracts/sign` | `BookingContractTemplate`, `SignedBookingContract` | — | UA_PENDING | — |

---

## 3. Availability & scheduling engine

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Weekly hours editor | All | `availability-engine.ts` | `/appointments/availability` | platform config | `AppointmentPlatformConfig.weeklyHours` | `test-availability-engine.ts` | PASS | — |
| Timezone | All | platform config | Availability + settings | `timezone` | `AppointmentPlatformConfig` | `test-availability-engine.ts` | PASS | — |
| Minimum booking notice | All | `scheduling-limits.ts` | Availability | `minimumBookingNoticeMinutes` | platform / type config | `test-availability-engine.ts` | PASS | — |
| Maximum booking horizon | All | `scheduling-limits.ts` | Availability | `maximumBookingDaysAhead` | platform / type config | `test-availability-engine.ts` | PASS | — |
| Date overrides (custom hours) | All | `dateOverrides` | Availability | platform JSON | `AppointmentPlatformConfig` | `test-availability-engine.ts` | UA_PENDING | — |
| Blackout dates | All | platform config | Availability UI | `blackoutDates` | `AppointmentPlatformConfig` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Holiday calendar | SB | `holidays` | Availability | platform JSON | `AppointmentPlatformConfig` | — | UA_PENDING | — |
| Booking limits (daily/weekly/per-type) | SB, SQ | `scheduling-limits.ts` | Availability | `bookingLimits` | platform JSON | `test-availability-engine.ts` | PASS | — |
| Fixed appointment start times | SB | `fixed-start-times.ts` | Availability config | slot generation filter | `schedulingLimits.fixedStartTimes` | `test-clean-parity-gaps.ts` | UA_PENDING | — |
| Custom start interval | A | `slotStepMinutes()` | — | availability engine | `customStartIntervalMinutes` | `test-clean-parity-gaps.ts` | UA_PENDING | — |
| Make Me Look Busy (hide slots) | SB | `availability-density.ts` | Availability config | slot filter | `availabilityDensityHidePercent` | `test-clean-parity-gaps.ts` | UA_PENDING | — |
| Minimize gaps / compact scheduling | SQ | `minimize-gaps.ts` | — | slot ranking | `minimizeGapsMode` | — | UA_PENDING | — |
| Native slot generation | All | `availability-engine.ts` | Public DateTime | `action: availability` | — | `test-availability-engine.ts` | PASS | — |
| Staff-aware slots | All | `staff-availability.ts` | Public staff picker | `scheduling-domain.ts` | `staff[]` config | `test-appointments-double-booking.ts` | PASS | — |
| Group / collective scheduling | SB | `scheduling-domain.ts` | — | `checkGroupCapacity` | `VoiceAppointment` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Resource-constrained slots | SQ, SB | `resource-availability.ts` | — | `assertResourcesAvailable` | `SchedulingResource` | `test-phase2-wiring.ts` | UA_PENDING | — |
| External calendar busy blocking | All | `scheduling-domain.ts` | Integrations | `getExternalBusyIntervals` | Calendar connection models | — | UA_PENDING | Google / Microsoft OAuth |
| Atomic slot booking | All | `slot-booking.ts` | — | advisory locks | `AppointmentSlotHold` | `test-appointments-double-booking.ts` | PASS | PostgreSQL |
| Slot validation | All | `slot-validation.ts` | — | pre-book check | — | `test-appointments-double-booking.ts` | PASS | — |
| Slot diagnostics | A | `slot-diagnostics.ts` | — | `diagnostics/slots` API | — | — | UA_PENDING | — |
| Dynamic pricing by slot | — | `dynamic-pricing.ts` | Commerce admin | `dynamic-pricing` API | `DynamicPricingRule` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Admin availability query | All | `availability-engine.ts` | — | `GET /api/appointments/availability` | — | `test-availability-engine.ts` | PASS | — |
| Class capacity display mode | SB | `class-capacity-display.ts` | Public classes | slot labels | `classCapacityDisplay` config | `test-clean-parity-gaps.ts` | UA_PENDING | — |

---

## 4. Staff, locations & resources

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Staff scheduling config | All | platform `staff[]` | `/appointments/staff` | scheduling-domain | JSON on platform | — | UA_PENDING | — |
| Any employee / round-robin | All, SB | `scheduling-domain.ts` | Public staff picker | staff assignment modes | platform JSON | `test-appointments-double-booking.ts` | PASS | — |
| Locations | All, SQ | platform `locations` | `/appointments/locations` | type `locationIds` | platform JSON | — | CODE_COMPLETE | — |
| Location-specific hours/services | SQ | `location-scheduling.ts` | Locations | per-location config | platform JSON | — | CODE_COMPLETE | — |
| Location-specific timezone | SQ | platform `locations` | Locations | per-location `timezone` | platform JSON | — | CODE_COMPLETE | — |
| Location-specific staff assignment | SQ | platform `locations` | Locations + type editor | `locationIds` + staff config | platform JSON | — | CODE_COMPLETE | — |
| Location-specific resource assignment | SQ | `resources.ts` | Locations / resources | `resourceIds` on location | `SchedulingResource` | `test-phase2-wiring.ts` | CODE_COMPLETE | — |
| Resources (rooms, equipment) | SQ, SB | `resources.ts` | `/appointments/resources` | `resources` API | `SchedulingResource` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Resource quantity / capacity | SB | `SchedulingResource.quantity` | Resources admin | `countResourceUsage` | `SchedulingResource` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Resource pools (any-one-in-group) | SB | `resource-pools.ts` | — | `resource-groups` API | `SchedulingResourceGroup` | — | UA_PENDING | — |
| Resource persist on book | SQ | `persistAppointmentResources` | — | book POST | `AppointmentServiceLine.resourceIds` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Staff round-robin state | SQ | `roundRobinState` | — | assignment | platform JSON | — | UA_PENDING | — |
| Scheduling groups | SB | `team-scheduling.ts` | Team pages | platform JSON | `schedulingGroups` | — | UA_PENDING | — |
| Staff / service calendar colors | SB, SQ | `CalendarColorConfig` | Calendar | platform JSON | platform JSON | — | UA_PENDING | — |
| Per-staff external calendar | All | calendar sync jobs | Integrations | provider sync | Calendar connections | — | UA_PENDING | Google / Microsoft |

---

## 5. Public booking (customer-facing)

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Public booking home | All | public book flow | `/book/[slug]` | `GET/POST /api/public/book/[slug]` | `VoiceAppointment` | `test-booking-protection.ts` | UA_PENDING | — |
| Deep link to one type | All | public flow | `/book/[slug]/[serviceId]` | `?type=` | — | — | UA_PENDING | — |
| Embeddable widget | All | embed route | `/embed/book/[slug]` | same API | — | — | UA_PENDING | — |
| Service / type picker | All | ServiceStep | Public flow | public GET | `VoiceService` | — | UA_PENDING | — |
| Staff picker | All | DateTime / Info | Public flow | `staffId` POST | — | — | UA_PENDING | — |
| Location picker | SQ | public flow | Public flow | `locationId` POST | — | — | UA_PENDING | — |
| Duration picker | All | public flow | Public flow | `durationOptions` | — | — | UA_PENDING | — |
| Live availability slots | All | `availability-engine.ts` | DateTime step | `action: availability` | — | `test-availability-engine.ts` | PASS | — |
| Multi-service chain | SQ | `multi-service.ts` | DateTime step | `multiServiceLines` POST | `AppointmentServiceLine` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Multi-staff per service line | SQ | `multi-service.ts` | Public book | `staffId` per line | `AppointmentServiceLine.staffId` | `test-clean-parity-gaps.ts` | UA_PENDING | — |
| Multi-booking session (cart) | SB | `booking-session.ts` | DateTime cart | `POST …/session` | session store | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Custom booking questions | All | InfoStep | Public flow | `bookingAnswers` | metadata | `test-booking-intake.ts` | UA_PENDING | — |
| Custom client fields | SB | `custom-fields.ts` | Info step | `customFieldValues` | `CustomerFieldDefinition` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Intake forms | A, SB | `intake-forms.ts` | Info step | `intakeResponses` | `IntakeFormResponse` | `test-booking-intake.ts` | UA_PENDING | — |
| Add-on selection | All | `add-ons.ts` | Info step | `addOnSelections` | `BookingAddOn` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Package / membership entitlements | All | `entitlements.ts` | Info step | auto-suggest | `PackageBalance`, subscriptions | `test-phase2-wiring.ts` | UA_PENDING | — |
| Wallet balance at checkout | — | `client-wallet.ts` | Info step | `walletApplyCents` | `ClientWalletAccount` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Saved card on file | SQ | merchant payments | Info step | `useSavedCard` | Stripe customer | — | UA_PENDING | Stripe |
| Recurring booking | All | `recurring.ts` | Info step | `recurring` POST | `AppointmentRecurringSeries` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Recurring date preview | All | `recurring-schedule.ts` | Info step | `preview_recurring` | — | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Group attendee count | SB | public flow | Info step | `attendeeCount` | metadata | `test-phase2-wiring.ts` | UA_PENDING | — |
| Email OTP verification | A | public book | Email step | `…/otp` | — | `test-booking-protection.ts` | UA_PENDING | Email provider |
| Booking protection / bot checks | A | `booking-protection.ts` | Public flow | honeypot, challenge | metadata | `test-booking-protection.ts` | PASS | — |
| Returning invitee cookie | A | `booking-links.ts` | — | cookie | — | — | UA_PENDING | — |
| Single-use token links | A | booking-links | — | `singleUseToken` | platform JSON | — | UA_PENDING | — |
| Stripe checkout | All | merchant payments | Payment redirect | `…/checkout` | `AppointmentMerchantPayment` | — | UA_PENDING | Stripe Connect |
| Square in-page payment | SQ | merchant payments | Payment step | `…/payment` | `AppointmentMerchantPayment` | — | UA_PENDING | Square |
| Public waitlist join | SQ | `waitlist.ts` | Waitlist step | `…/waitlist` | `AppointmentWaitlistEntry` | — | UA_PENDING | SMS (optional) |
| Public AI booking chat | — | `ai-scheduling/` | AI step | `…/ai` | — | `test-appointment-ai-hardening.ts` | UA_PENDING | LLM provider |
| Public email AI booking | — | email-ai route | — | `…/email-ai` | — | — | UA_PENDING | LLM + email |
| Public store (packages) | SB | `store-checkout.ts` | `/book/[slug]/store` | store APIs | commerce models | — | UA_PENDING | Stripe |
| Public class enrollment | SB | `classes.ts` | `/book/[slug]/classes` | `…/classes` | `ClassEnrollment` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| PWA registration | — | public PWA register | Public shell | client script | — | — | N/A | — |
| Reminder diagnostics (support) | — | — | `/book/[slug]/reminders` | `reminder-diagnostics` | — | — | N/A | — |

---

## 6. Appointments operations (staff-facing)

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Appointments list | All | `appointments-service.ts` | `/appointments` | `GET /api/appointments` | `VoiceAppointment` | `test-appointments-tenant-isolation.ts` | UA_PENDING | — |
| Create appointment (staff) | All | `booking-platform.ts` | `/appointments/new` | `POST /api/appointments` | `VoiceAppointment` | — | UA_PENDING | — |
| Calendar slot-click create | SQ | calendar components | `/appointments/calendar` | → `/appointments/new?startsAt=` | — | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Appointment detail | All | detail page | `/appointments/[id]` | `GET/PATCH …/[id]` | `VoiceAppointment` | — | UA_PENDING | — |
| Calendar view | All | calendar | `/appointments/calendar` | `GET /api/calendar/events` | `VoiceAppointment` | — | UA_PENDING | — |
| Meeting / video indicators | — | meeting-indicators API | Calendar | `meeting-indicators` | metadata | `test-voice-notetaker-wiring.ts` | UA_PENDING | — |
| Reschedule (staff) | All | `booking-platform.ts` | Detail | PATCH `startsAt` | `VoiceAppointment` | — | UA_PENDING | — |
| Cancel (staff) | All | `booking-platform.ts` | Detail | PATCH `status: canceled` | `VoiceAppointment` | — | UA_PENDING | — |
| Internal notes | All | `internal-notes.ts` | Detail | metadata | `VoiceAppointment.metadata` | — | UA_PENDING | — |
| Reminder suppress / reset | All | `reminder-delivery.ts` | Detail | reminder-state | metadata | `test-appointments-reminder-state.ts` | PASS | — |
| Reminder timeline | All | reminder-timeline API | Detail | `…/reminder-timeline` | — | `test-appointments-reminder-state.ts` | UA_PENDING | — |
| Status workflow | All | status enums | Detail | PATCH status | `VoiceAppointment.status` | `test-booking-workflow-states.ts` | UA_PENDING | — |
| Multi-service lines on record | SQ | `multi-service.ts` | Detail | service lines | `AppointmentServiceLine` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Policy snapshot on record | All | `policy-snapshot.ts` | — | at book time | metadata `policySnapshot` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Provider calendar sync | All | sync jobs | — | `voice_appointment_provider_sync` | external IDs | — | UA_PENDING | Google / Microsoft |

---

## 7. Customer self-service & portal

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Manage appointment link | All | `manage-appointment.ts` | `/manage/[token]` | `GET/POST /api/public/manage/[token]` | `ManageAppointmentToken` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Reschedule via manage link | All | manage actions | Manage page | `action: reschedule` | `VoiceAppointment` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Cancel via manage link | All | manage actions | Manage page | `action: cancel` | `VoiceAppointment` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Recurring series cancel scopes | All | `recurring.ts` | Manage page | this / future / all | `AppointmentRecurringSeries` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Recurring series reschedule scopes | All | `recurring.ts` | Manage page | this / future / all | series metadata | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Pay balance via manage link | SQ | `manage-payments.ts` | Manage page | `action: pay_balance` | payments | — | UA_PENDING | Stripe / Square |
| Edit intake via manage link | A | `manage-intake.ts` | Manage page | `action: save_intake` | `IntakeFormResponse` | — | UA_PENDING | — |
| ICS calendar download | All | client ICS builder | Manage page | client `.ics` | — | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Book again link | All | manage page | Manage page | → `/book/[slug]` | — | — | UA_PENDING | — |
| Client portal (unified account) | A | `client-portal.ts` | `/portal/[token]` | `portal/[token]` API | `ClientPortalSession` | — | UA_PENDING | — |
| Portal: upcoming / past appointments | A | portal API | Portal UI | portal GET | `VoiceAppointment` | — | UA_PENDING | — |
| Portal: packages & credits | A | entitlements | Portal UI | portal GET | `PackageBalance` | — | UA_PENDING | — |
| Portal: memberships | A | entitlements | Portal UI | portal GET | `ServiceMembershipSubscription` | — | UA_PENDING | — |
| Portal: gift balances | A | entitlements | Portal UI | portal GET | `GiftCertificateBalance` | — | UA_PENDING | — |
| Portal: package usage history | A | portal API | Portal UI | ledger entries | `PackageLedgerEntry` | — | UA_PENDING | — |
| Portal: purchase & payment history | A, SQ | `client-portal.ts` + payments | Portal UI | portal GET + merchant payments | `AppointmentMerchantPayment`, commerce purchases | — | UA_PENDING | Stripe / Square |
| Portal wallet | — | `client-wallet.ts` | Portal UI | `portal/…/wallet` | `ClientWalletAccount` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Portal saved payment methods | SQ | merchant payments | Portal UI | `portal/…/payment-methods` | Stripe | — | UA_PENDING | Stripe |
| Legacy confirm / cancel / reschedule tokens | A | legacy routes | `/appointments/confirm|cancel|reschedule/[token]` | public token APIs | metadata tokens | — | UA_PENDING | — |
| Waitlist offer accept | SQ | `waitlist.ts` | `/waitlist/accept/[token]` | atomic claim | `AppointmentWaitlistEntry` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |

---

## 8. Payments & commerce

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Packages & memberships hub | All | commerce admin | `/appointments/commerce` | service-booking APIs | multiple | `test-phase2-wiring.ts` | UA_PENDING | — |
| Package products | All | `packages.ts` | Commerce admin | `packages` API | `PackageProduct` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Package purchase | All | `purchasePackageForContact` | Commerce admin | purchase action | `PackageBalance` | — | UA_PENDING | Stripe |
| Package credits & ledger | All | `packages.ts` | Portal / book | redeem | `PackageLedgerEntry` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Package lifecycle (restore on cancel) | SB | `package-lifecycle.ts` | — | cancel hook | `PackageLedgerEntry` | `test-clean-parity-gaps.ts` | UA_PENDING | — |
| Package credit forfeiture (late cancel / no-show) | SB | `package-lifecycle.ts` | — | `restoreCreditsOnLateCancel` / `restoreCreditsOnNoShow` policy (default: forfeit) | `PackageLedgerEntry` | `test-clean-parity-gaps.ts` | UA_PENDING | — |
| Mixed-content package entitlements | SB | `PackageCreditRule` | Commerce config | credit rules | `PackageProduct.creditRules` | — | UA_PENDING | — |
| Membership products | All | `memberships.ts` | Commerce admin | `memberships` API | `ServiceMembershipProduct` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Membership subscriptions | All | `memberships.ts` | Commerce / portal | subscribe | `ServiceMembershipSubscription` | — | UA_PENDING | Stripe Billing |
| Membership lifecycle (pause/cancel/past_due) | SB, A | `membership-lifecycle.ts` | — | status transitions | subscription status | — | UA_PENDING | Stripe webhooks |
| Membership failed-payment suspension | SB, A | `membership-lifecycle.ts` | — | `suspendMembershipForFailedPayment` | `ServiceMembershipSubscription.status` | — | UA_PENDING | Stripe webhooks |
| Membership payment recovery / entitlement restore | SB, A | `membership-lifecycle.ts` | — | `restoreMembershipAfterPaymentRecovery` | subscription status | — | UA_PENDING | Stripe webhooks |
| Membership-only booking types / classes | A, SB | `membership-lifecycle.ts` | Type editor + public | `isMemberOnlyType`, `memberOnlyTypeIds` | `MembershipBenefits` on product | — | UA_PENDING | — |
| Recurring membership credit replenishment | SB | `MembershipBenefits.includedCredits` | Commerce config | subscription renewal hook | `PackageBalance` / ledger | — | UA_PENDING | Stripe Billing |
| Gift certificates | All | `gift-certificates.ts` | Commerce admin | `gift-certificates` API | `GiftCertificateProduct`, balances | `test-phase2-wiring.ts` | UA_PENDING | — |
| Gift balance redemption at checkout | All | `gift-certificates.ts` | Public Info / POS | `redeemGiftCertificate` | `GiftCertificateLedgerEntry` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Gift balance redemption history | A | `gift-certificates.ts` | Portal / commerce | ledger entries | `GiftCertificateLedgerEntry` | — | UA_PENDING | — |
| Coupons / discounts | All | `coupons.ts` | Commerce admin | `coupons` API | `AppointmentCoupon` | — | UA_PENDING | — |
| Programs (multi-visit bundles) | — | `programs.ts` | Commerce admin | `programs` API | metadata / packages | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Payment plans (installments) | A | `payment-plans.ts` | Commerce admin | `payment-plans` API | product metadata | `test-phases-3-17-wiring.ts` | UA_PENDING | Stripe |
| Client wallet | — | `client-wallet.ts` | Commerce / portal | `client-wallet` API | `ClientWalletAccount` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Loyalty programs | — | `loyalty.ts` | Commerce admin | `loyalty` API | `LoyaltyProgram` | `test-phase2-wiring.ts` | UA_PENDING | — |
| POS cart (session + line items) | SB | `pos-cart.ts` | Commerce admin | `pos-cart` API | `PosSession`, `PosLineItem` | `test-phase2-wiring.ts` | CODE_COMPLETE | — |
| POS mixed checkout (service + package + membership + gift + product + discount + tip) | SB, SQ | `pos-cart.ts` | Commerce admin | `addPosLineItem` kinds + checkout | `PosLineItem.kind`, metadata | `test-phase2-wiring.ts` | CODE_COMPLETE | Stripe (optional for in-person) |
| Products for sale | SB | `booking-products.ts` | Commerce admin | `products` API | `BookingProduct` | — | UA_PENDING | — |
| Pay-what-you-want / tipping | SQ | `payments-extended.ts` | Type + public | PWYW config | type config | — | UA_PENDING | — |
| Invoices | A, SQ | `booking-invoices.ts` | — (API-first) | `invoices` API | `BookingInvoice`, line items | — | UA_PENDING | Email for send |
| Deposits & full payment | All | merchant payments | Public payment | checkout | `AppointmentMerchantPayment` | — | UA_PENDING | Stripe / Square |
| Saved cards | SQ | merchant payments | Portal / book | saved-cards API | Stripe | — | UA_PENDING | Stripe |
| Refunds (full / partial / wallet) | SQ | `appointment-refunds.ts` | Payments UI | `merchant-payments/refund` | payment + wallet ledger | — | UA_PENDING | Stripe / Square |
| Refund to original payment method | SQ | `appointment-refunds.ts` | Payments UI | `refundMerchantAppointmentPayment` (default) | `AppointmentMerchantPayment` | — | UA_PENDING | Stripe / Square |
| Refund to client wallet (store credit) | SQ | `appointment-refunds.ts` | Payments UI | `refundToWallet` + `creditWallet` | `ClientWalletAccount` | — | UA_PENDING | — |
| Policy fees (late cancel / no-show) | SQ | `policy-fees.ts` | — | on cancel/no-show | metadata + charges | `test-phases-3-17-wiring.ts` | UA_PENDING | Stripe |
| Payment transaction ledger | SQ | merchant payments | `/payments/transactions` | payments API | `AppointmentMerchantPayment` | — | UA_PENDING | — |
| SMS payment links | — | messaging payments | `/messaging/payments` | public payment links | — | — | UA_PENDING | Telnyx / Twilio |

---

## 9. Classes & group booking

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Class series admin | SB | `classes.ts` | `/appointments/classes` | `classes` API | `ClassSeries` | — | UA_PENDING | — |
| Class occurrences | SB | `classes.ts` | Classes admin | create occurrences | `ClassOccurrence` | — | UA_PENDING | — |
| Staff class enrollment | SB | classes admin | Classes admin | enroll action | `ClassEnrollment` | — | UA_PENDING | — |
| Public class enrollment | SB | classes client | `/book/[slug]/classes` | public `classes` API | `ClassEnrollment` | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Class check-in (QR) | SB | `class-check-in.ts` | — | `class-check-in` API | `ClassCheckIn` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Seat selection / maps | SB | `seat-selection.ts` | — | `seat-selection` API | `ClassSeatMap`, reservations | `test-phase2-wiring.ts` | UA_PENDING | — |
| Event admission tickets | SB | `event-tickets.ts` | — | ticket issue/redeem | `ClassAdmissionTicket` | — | UA_PENDING | — |
| Group capacity on types | SB | `groupBooking` | Public | `checkGroupCapacity` | config + appointments | `test-phase2-wiring.ts` | UA_PENDING | — |
| Remaining spaces display | SB | `class-capacity-display.ts` | Public classes | capacity labels | config | `test-clean-parity-gaps.ts` | UA_PENDING | — |
| Class waitlist (capacity-full join) | SQ, SB | `waitlist.ts` + `classes.ts` | Public classes | waitlist on full occurrence | `AppointmentWaitlistEntry` + `ClassOccurrence` | — | UA_PENDING | SMS (optional) |

---

## 10. Waitlist & recalls

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Waitlist admin queue | SQ | `waitlist.ts` | `/appointments/waitlist` | `GET/PATCH …/waitlist` | `AppointmentWaitlistEntry` | — | UA_PENDING | — |
| Public waitlist join | SQ | waitlist API | Public book | `…/waitlist` | `AppointmentWaitlistEntry` | — | UA_PENDING | SMS |
| Waitlist preferences (staff/date/time) | SQ | waitlist model | Public + admin | entry fields | waitlist columns | — | UA_PENDING | — |
| Waitlist slot notification | SQ | `waitlist.ts` | — | `appointment_waitlist_notify` job | — | — | UA_PENDING | SMS provider |
| Waitlist offer + atomic accept | SQ | `waitlist.ts` | `/waitlist/accept/[token]` | claim token | entry status | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| Waitlist auto-fill on cancel | SQ | `autoFillWaitlistSlot` | — | cancel hook | — | — | UA_PENDING | — |
| Waitlist party size (group / class) | SB | `groupBooking` + waitlist model | Public waitlist | `attendeeCount` on entry (when supported) | waitlist + type config | — | UA_PENDING | — |
| Waitlist priority rules | — | `waitlist-priority.ts` | Commerce admin | `waitlist-priority` API | `WaitlistPriorityRule` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Recalls hub | A | `recalls-hub.ts` | `/appointments/recalls` | `recalls/hub` API | — | — | UA_PENDING | — |
| Recall campaigns | A | `recall-campaigns.ts` | `/appointments/recall-campaigns` | `recall-campaigns` API | — | — | UA_PENDING | SMS |
| Appointment segments (recalls) | — | `appointment-segments.ts` | `/appointments/segments` | `appointment-segments` API | — | `test-phases-3-17-wiring.ts` | UA_PENDING | — |
| No-show recovery | All | `no-show-recovery.ts` | `/appointments/no-show-recovery` | `no-show-recovery` API | — | — | UA_PENDING | — |
| No-show scan job | All | — | — | `appointment_no_show_scan` | `VoiceAppointment` | — | UA_PENDING | — |

---

## 11. Reminders & notifications

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Reminder sequences | All | `reminder-engine.ts` | `/appointments/reminders` | platform `reminders` | platform JSON | `test-appointments-reminder-state.ts` | PASS | — |
| SMS reminders | All | `reminder-delivery.ts` | Reminders admin | send pipeline | metadata | — | UA_PENDING | Telnyx / Twilio |
| Email reminders | All | `reminder-engine.ts` | Reminders admin | email send | — | — | UA_PENDING | Email provider |
| ICS attachments | All | `ics-builder.ts` | — | reminder attach | — | — | UA_PENDING | — |
| Reminder test send | All | — | Reminders admin | `reminders/test` | — | — | UA_PENDING | SMS / email |
| Email open / click tracking | A | — | — | `reminders/track/*` | — | — | UA_PENDING | — |
| Per-appointment reminder timeline | All | — | Appointment detail | `reminder-timeline` | metadata | `test-appointments-reminder-state.ts` | UA_PENDING | — |
| Voice reminders | — | `appointment-voice-reminders/` | `/appointments/voice-reminders` | voice-reminders API | — | `test-appointment-voice-reminders.ts` | UA_PENDING | Telnyx voice |
| Voice reminder retry job | — | — | — | `appointment_voice_reminder_retry` | — | `test-appointment-voice-reminders.ts` | UA_PENDING | Telnyx |
| Platform reminder scan | All | — | — | `appointments_platform_reminder_scan` | — | — | UA_PENDING | — |
| SMS consent disclosure | All | `sms-consent-disclosure.ts` | Public Info | book POST | metadata | — | UA_PENDING | — |
| Automation templates | A | workflow templates | `/appointments/automations/templates` | templates lib | — | — | UA_PENDING | — |
| Automation activity log | A | — | `/appointments/automations/activity` | execution logs | `AppointmentWorkflowExecution` | — | UA_PENDING | — |

---

## 12. Workflows & automations

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Workflow list | A | `appointment-workflows/` | `/appointments/workflows` | `workflows` API | `AppointmentWorkflow` | `test-appointment-workflows-hardening.ts` | UA_PENDING | — |
| Create / edit workflow | A | engine + editor | `/appointments/workflows/new`, `[id]/edit` | PATCH workflow | `AppointmentWorkflow` | `test-appointment-workflows-hardening.ts` | UA_PENDING | — |
| Workflow from template | A | `templates.ts` | `/appointments/workflows/setup/[templateId]` | — | — | — | UA_PENDING | — |
| Workflow test run | A | — | — | `workflows/[id]/test` | `AppointmentWorkflowExecution` | `test-appointment-workflow-minutes.ts` | UA_PENDING | — |
| Workflow preview | A | `preview.ts` | — | `workflows/preview` | — | — | UA_PENDING | — |
| Execution logs | A | — | — | `workflows/logs` | `AppointmentWorkflowStepExecution` | — | UA_PENDING | — |
| Unknown SMS reply triage | — | — | — | `workflows/unknown-replies` | — | — | UA_PENDING | SMS |
| Time-based triggers | A | `workflow-scanners.ts` | — | scanner jobs | — | `test-appointment-workflow-minutes-scheduling.ts` | UA_PENDING | — |
| Before/after appointment triggers | A | triggers | — | `appointment_workflow_time_*` jobs | — | `test-appointment-workflows-scheduling.ts` | UA_PENDING | — |

---

## 13. AI booking & scheduling assistant

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| AI booking settings | — | ai-booking config | `/appointments/ai-booking` | `ai-booking` API | platform JSON | — | UA_PENDING | — |
| Staff-initiated AI book | — | `ai-booking` | AI booking admin | POST ai-booking | `VoiceAppointment` | `test-appointment-booking-agent-layer.ts` | UA_PENDING | LLM |
| AI channels (SMS, email) | — | channels API | — | `ai-booking/channels` | — | — | UA_PENDING | Telnyx / email |
| Public AI chat booking | — | `ai-scheduling/` | Public AI step | `…/ai` | — | `test-appointment-ai-hardening.ts` | UA_PENDING | LLM |
| Public email AI handler | — | — | — | `…/email-ai` | — | — | UA_PENDING | LLM + email |
| NL understand / execute | — | `understand.ts`, `execute.ts` | — | ai-scheduling lib | `AppointmentAiMutationRecord` | `test-appointment-ai-hardening.ts` | UA_PENDING | LLM |
| AI booking protection | A | `booking-protection.ts` | — | risk scoring | metadata | `test-booking-protection.ts` | PASS | — |
| Caller Amy / appointment assistant | — | voice agent vertical | `/solutions/…/appointment-assistant` | voice tools | `VoiceCall` | `test-appointment-receptionist-wiring.ts` | UA_PENDING | Telnyx voice |

---

## 14. Video meetings & AI notetaker

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Upcoming meetings list | A (Zoom/Meet) | transovo-video | `/video` | video service | meeting records | `test-voice-notetaker-wiring.ts` | UA_PENDING | Telnyx Video |
| Host video for appointment | A | transovo-video | `/appointments/[id]/video/host` | `…/video`, `…/join` | metadata | — | UA_PENDING | Telnyx Video |
| Public video join | A | transovo-video | `/video/[token]` | guest join | — | — | UA_PENDING | Telnyx Video |
| Meeting recaps / notetaker | — | meeting-assistant | `/meetings`, `/meetings/[id]` | notetaker service | session records | `test-voice-notetaker-wiring.ts` | UA_PENDING | Telnyx / AI |
| Public shared recap | — | — | `/recap/[token]` | share link | — | — | UA_PENDING | — |
| Transovo Video settings | — | — | `/settings/transovo-video` | settings | — | — | UA_PENDING | Telnyx |
| AI Notetaker settings | — | — | `/settings/ai-notetaker` | settings | — | — | UA_PENDING | — |
| Teams meeting auto-create | A | `calendar/teams-meeting.ts` | — | on book | metadata | — | UA_PENDING | Microsoft Graph |
| Calendar meeting indicators | — | meeting-indicators | Calendar | `meeting-indicators` API | — | `test-voice-notetaker-wiring.ts` | UA_PENDING | — |

---

## 15. Routing, team pages & meeting polls

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Routing forms builder | A | `routing-forms.ts` | `/appointments/routing-forms` | `routing-forms` API | platform `routingForms` | — | UA_PENDING | — |
| Routing rules (legacy) | A | routing page | `/appointments/routing` | — | `routingRules` JSON | — | UA_PENDING | — |
| Routing form presets | A | `routing-forms-presets.ts` | — | presets lib | — | — | UA_PENDING | — |
| Public routing form | A | — | `/routing/[slug]/[formSlug]` | `public/routing/[slug]` | — | — | UA_PENDING | — |
| Team booking pages | SB | `team-scheduling.ts` | `/appointments/team-pages` | `team-pages` API | `teamBookingPages` JSON | — | UA_PENDING | — |
| Public team booking page | SB | — | `/team/[slug]/[pageSlug]` | `public/team-book/…` | — | — | UA_PENDING | — |
| Meeting polls | A (Calendly-like) | `meeting-polls.ts` | `/appointments/polls` | `meeting-polls` API | `meetingPolls` JSON | — | UA_PENDING | — |

---

## 16. Analytics & reporting

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Analytics overview | All | `analytics.ts` | `/appointments/analytics` | `analytics` API | `VoiceAppointment` | — | UA_PENDING | — |
| Booking analytics | All | analytics | `/appointments/analytics/booking` | funnel metrics | — | — | UA_PENDING | — |
| Reminder analytics | All | analytics | `/appointments/analytics/reminders` | delivery stats | — | — | UA_PENDING | — |
| Automation analytics | A | analytics | `/appointments/analytics/automations` | workflow stats | — | — | UA_PENDING | — |
| Reports hub | All | `reporting.ts` | `/appointments/analytics/reports` | reports API | — | — | UA_PENDING | — |
| Service booking reports | SB | `reporting.ts` | `/appointments/reports/service-booking` | `reports` API | — | — | UA_PENDING | — |
| CSV / PDF export | A | — | — | `analytics/export` | — | — | UA_PENDING | — |
| Scheduled email reports | A | — | — | `appointments_scheduled_report` job | — | — | UA_PENDING | Email |

---

## 17. Integrations & distribution channels

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Google Calendar sync | All | calendar sync | `/integrations/calendars` | provider sync jobs | calendar connections | — | UA_PENDING | Google OAuth |
| Microsoft / Outlook sync | All | calendar sync | `/integrations/calendars` | provider sync jobs | calendar connections | — | UA_PENDING | Microsoft OAuth |
| iCloud / Apple Calendar sync | A | channel stub | Integrations | `booking-channels` API | platform JSON | — | PROVIDER_BLOCKED | Apple CalDAV |
| Calendly mapping (vertical) | A | realtor mapping | `/realtor/appointments/types` | — | — | — | N/A | Calendly API |
| Stripe Connect payments | All | merchant payments | `/integrations/payments` | Stripe Connect | `MerchantPaymentConnection` | — | UA_PENDING | Stripe |
| Square payments | SQ | merchant payments | `/integrations/payments` | Square adapter | connections | — | UA_PENDING | Square |
| Native appointments integration hub | — | — | `/integrations/native/appointments` | — | — | — | N/A | — |
| Integration status diagnostics | — | — | — | `integrations/status` | — | — | N/A | — |
| Reserve with Google / GBP | SB, A | `booking-channel-integrations.ts` | Theme / channels | `booking-channels` API | platform JSON | — | PROVIDER_BLOCKED | Google Reserve partner |
| Facebook Book Now action | SB | channel stub | channels config | `booking-channels` API | platform JSON | — | PROVIDER_BLOCKED | Meta Business |
| Instagram booking action | SB, SQ | channel stub | channels config | `booking-channels` API | platform JSON | — | PROVIDER_BLOCKED | Meta Business |

---

## 18. Organization, security & enterprise

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Granular appointment permissions | — | `org-permissions.ts` | Settings | permission checks | — | `test-appointments-tenant-isolation.ts` | PASS | — |
| Per-type access control | — | RBAC filters | — | API auth | — | `test-appointments-tenant-isolation.ts` | PASS | — |
| Org roles API | — | — | — | `GET/POST /api/appointments/org` | — | — | UA_PENDING | — |
| SAML SSO | — | org API | — | org endpoint | — | — | PROVIDER_BLOCKED | IdP |
| SCIM provisioning | — | org API | — | org endpoint | — | — | PROVIDER_BLOCKED | IdP |
| Enterprise scheduling (legacy) | — | — | `/appointments/enterprise` | — | — | — | N/A | — |
| Audit timeline on appointment | All | metadata `timeline[]` | Detail | append on events | `VoiceAppointment.metadata` | — | UA_PENDING | — |

---

## 19. Client data & CRM-adjacent

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Contacts (shared) | All | contacts product | `/contacts` | contacts API | `Contact` | — | UA_PENDING | — |
| Conversations / Inbox (shared) | All | inbox product | `/conversations` | inbox API | threads | — | UA_PENDING | — |
| Household / family accounts | SB | `household.ts` | Commerce admin | `households` API | `HouseholdAccount`, members | — | UA_PENDING | — |
| Contact merge | — | `contact-merge.ts` | Commerce admin | `contact-merge` API | `ContactMergeAudit` | — | UA_PENDING | — |
| Custom client fields | SB | `custom-fields.ts` | Commerce admin | `custom-fields` API | `CustomerFieldDefinition` | `test-phase2-wiring.ts` | UA_PENDING | — |
| Intake form templates | A, SB | `intake-forms.ts` | Commerce admin | `intake-forms` API | `IntakeForm` | `test-booking-intake.ts` | UA_PENDING | — |
| Treatment records (vertical-adjacent) | — | `treatment-records.ts` | Commerce admin | API | `AppointmentTreatmentRecord` | — | N/A | — |
| Import / export | SB | `import-export.ts` | Commerce admin | `import-export` API | `AppointmentImportBatch` | — | UA_PENDING | — |

---

## 20. Webhooks & developer

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Outbound webhook endpoints | A | `webhooks.ts` | Commerce admin | `webhooks` API | `AppointmentWebhookEndpoint` | — | UA_PENDING | — |
| Webhook signing (HMAC) | A | `webhook-delivery.ts` | — | sign payloads | — | — | UA_PENDING | — |
| Webhook delivery queue | A | delivery jobs | — | `appointment_webhook_*` | `AppointmentWebhookDelivery` | — | UA_PENDING | — |
| Slot diagnostics API | A | `slot-diagnostics.ts` | — | admin + public diagnostics | — | — | UA_PENDING | — |

---

## 21. Background jobs & scanners

| Feature | Competitor(s) | Transovo implementation | Route / UI | API / runtime | Database model | Automated test | UAT status | External dependency |
|---------|---------------|-------------------------|------------|---------------|----------------|--------------|----------------|---------------------|
| Workflow step execution | A | `appointment-workflows/engine.ts` | — | `appointment_workflow_step` | executions tables | `test-appointment-workflows-hardening.ts` | UA_PENDING | BullMQ / Redis |
| Webhook deliver / sweep | A | `webhook-delivery.ts` | — | webhook jobs | deliveries | — | UA_PENDING | — |
| Waitlist notify | SQ | `waitlist.ts` | — | `appointment_waitlist_notify` | waitlist entries | — | UA_PENDING | SMS |
| Voice reminder retry | — | voice reminders | — | `appointment_voice_reminder_retry` | — | `test-appointment-voice-reminders.ts` | UA_PENDING | Telnyx |
| Provider appointment sync/cancel/reschedule | All | sync jobs | — | `voice_appointment_provider_*` | external IDs | — | UA_PENDING | Google / Microsoft |
| Starting-soon / completed scans | A | integration triggers | — | `appointment_*_scan` jobs | — | — | UA_PENDING | — |
| Workflow time scans / triggers | A | `workflow-scanners.ts` | — | `appointment_workflow_time_*` | — | `test-appointment-workflow-minutes-scheduling.ts` | UA_PENDING | — |
| No-show scan | All | — | — | `appointment_no_show_scan` | appointments | — | UA_PENDING | — |
| Scheduled analytics report email | A | `analytics-reports.ts` | — | `appointments_scheduled_report` | — | — | UA_PENDING | Email |
| Platform reminder scan | All | `reminder-engine.ts` | — | `appointments_platform_reminder_scan` | — | `test-appointments-reminder-state.ts` | PASS | SMS / email |

---

## 22. Summary counts

| UAT status | Feature rows (approx.) |
|------------|------------------------|
| **PASS** | 21 |
| **UA_PENDING** | ~265 |
| **PARTIAL** | 0 |
| **PROVIDER_BLOCKED** | 6 |
| **N/A** | 7 |
| **Total** | **~307** |

### Provider-blocked track (separate from code gaps)

| Feature | External dependency |
|---------|---------------------|
| Reserve with Google / GBP | Google Reserve partner program |
| Facebook Book Now action | Meta Business OAuth |
| Instagram booking action | Meta Business OAuth |
| iCloud / Apple Calendar sync | Apple CalDAV credentials |
| SAML SSO | Customer IdP |
| SCIM provisioning | Customer IdP |

| External dependency (top) | Feature count |
|---------------------------|---------------|
| Stripe / Stripe Connect | ~25 |
| Telnyx / Twilio (SMS/voice) | ~20 |
| Google (Calendar + Reserve) | ~8 |
| Microsoft (Calendar + Teams) | ~5 |
| Square | ~8 |
| LLM providers | ~8 |
| Meta (Facebook / Instagram) | 2 |
| Apple iCloud | 1 |
| Email provider | ~10 |
| DNS / TLS (custom domain) | 1 |
| Object storage (file upload) | 1 |

---

## 23. Related documents

| Document | Purpose |
|----------|---------|
| `docs/TRANSOVO-APPOINTMENTS-FINAL-PAGE-MANIFEST-IA-DIRECTIVE.md` | **IA reorganization authority** — preservation rules, target nav, parity migration |
| `docs/APPOINTMENTS-PAGE-CLASSIFICATION-MANIFEST.md` | Per-route KEEP/EXTEND/SPLIT/MERGE classification (Batch 0) |
| `docs/appointments-page-blueprints/` | Required blueprints before non-KEEP page implementation |
| `docs/APPOINTMENTS-PLATFORM-FEATURE-INVENTORY.md` | Narrative feature inventory (routes & APIs) |
| `docs/APPOINTMENTS-FEATURE-SPLIT-ORIGINAL-VS-PARITY.md` | Original V1 vs parity feature split |
| `docs/GENERAL-APPOINTMENT-CLEAN-PARITY-GAPS.md` | Acuity / SB / SQ gap closure list |
| `docs/GENERAL-APPOINTMENT-PARITY-MATRIX.md` | Phase 1–18 implementation matrix |
| `docs/GENERAL-APPOINTMENT-GAP-CLOSURE-DIRECTIVE.md` | Build order & scope rules |
| `docs/V1-PRODUCTION-CERTIFICATION.md` | Production certification gate |

---

*End of master inventory. Update row UAT status as journey certification completes; add rows only for true omissions.*
