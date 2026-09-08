# Transovo — General-Purpose Appointment Platform Audit

**Date:** 2026-09-08  
**Branch audited:** `cursor/appt-full-parity-build-709b`  
**Benchmarks:** Acuity Scheduling · SimplyBook.me · Square Appointments · preserved Cal.com/Calendly strengths  

**Scope:** This is NOT salon/spa/medical/fitness vertical software. Target = deepest **general-purpose** appointment/service scheduling platform.

---

## How to read this document

| Status | Meaning |
|--------|---------|
| **COMPLETE** | Route + API/runtime + model + plausible user path (not merely a type field) |
| **PARTIAL** | Backend or admin exists; public UX, policy enforcement, or certification incomplete |
| **EXISTS_BUT_NOT_WIRED** | Models/libs built; not on type editor, public book, or availability engine |
| **MISSING** | Not implemented or only schema/types |
| **PROVIDER_BLOCKED** | Code may exist; live OAuth/provider/native dependency |

**Certification note:** Most shipped work is matrix status `CODE` (runtime exists), not `PASS` (reload-verified UA journey).

**Related docs:**

- `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md` — governing spec
- `docs/ACUITY-PARITY-MATRIX.md` — section-level Acuity certification
- `docs/SERVICE-BOOKING-COMPETITIVE-PARITY-MATRIX.md` — Phase 1 + Phase 2 competitive rows
- `docs/GENERAL-APPOINTMENT-PARITY-MATRIX.md` — **MISSING** (requested in spec §BZ; not yet created)

---

## Executive summary

| Bucket | Approx. share | Meaning |
|--------|---------------|---------|
| **COMPLETE** | ~35–40% | Core booking, calendar, reminders, commerce backend, manage link basics |
| **PARTIAL** | ~30–35% | Backend or admin exists; public UX, policy enforcement, or certification incomplete |
| **EXISTS_BUT_NOT_WIRED** | ~10% | Models/libs built; not connected to editor, public book, or availability |
| **MISSING** | ~25–30% | Not implemented or types only |
| **PROVIDER_BLOCKED** | Small set | Apple/iCloud, live OAuth, native apps, some payment rails |

### Where Transovo is ahead of Acuity / SimplyBook / Square

- Reminder sequences + workflows
- SMS/voice infrastructure
- AI booking surface
- MCTB → booking loop
- Transovo Video + notetaker hooks

### Where Transovo is behind

- Wiring depth (multi-service checkout, add-ons/resources on public book, recurring self-service, multiple bookings per session)
- Operational polish (calendar slot-click create, QR/share hub, blackout/minimize-gaps UI)
- Policy money paths (late-cancel / no-show charges)
- Certification (almost nothing is reload-verified **PASS**)

---

## A. Booking type / service engine

| Capability | Status | Gap |
|------------|--------|-----|
| Service booking type (VoiceService + config) | **COMPLETE** | `/appointments/types`, `booking-platform.ts`, `VoiceService` |
| Meeting booking type (distinct archetype) | **MISSING** | No `archetype` / meeting vs service vs class on type |
| Class / group booking type (as type kind) | **PARTIAL** | Classes are separate `ClassSeries` product, not a booking-type archetype |
| Name, descriptions, duration, multiple durations | **COMPLETE** | Type editor + public flow |
| Image, category, ordering | **PARTIAL** | `imageUrl`/`categoryId` in config; **not saved from type editor**; public shows image if set |
| Active/inactive, public/unlisted/hidden | **COMPLETE** | `visibility` on type |
| Price modes (free, pay later, full, deposit %, PWYW, save card) | **PARTIAL** | Runtime supports extended modes in `payments-extended.ts`; **editor shows ~3 modes** |
| Locations (multi, virtual, phone, customer-specified) | **PARTIAL** | Platform locations + type `locationIds`; customer-specified location weak |
| Staff assignment (specific, customer chooses, any, auto, round robin) | **PARTIAL** | Round robin in `scheduling-domain.ts`; collective/multi-provider per booking **not full** |
| Custom questions | **COMPLETE** | `bookingQuestions` on type |
| Reusable intake forms per type | **EXISTS_BUT_NOT_WIRED** | `IntakeForm` model + admin; **not linked to types or public book** |
| Cancellation/reschedule policy on type | **PARTIAL** | Basic cutoff; **after-cutoff fee/approval/consume not enforced end-to-end** |
| Recurring eligibility on type | **PARTIAL** | Flag + public recurring book; series edit from customer **not exposed** |
| Group capacity on type | **PARTIAL** | Attendee count; not full group roster/pricing |
| Required resources | **EXISTS_BUT_NOT_WIRED** | `resourceIds` in config; **not in editor, not in availability engine for standard book** |
| Add-ons | **EXISTS_BUT_NOT_WIRED** | `BookingAddOn` + admin; **not on type editor or public checkout** |
| Booking approval mode | **PARTIAL** | `awaiting_confirmation` + approve API; staff queue UX uncertified |
| Reminders per type | **MISSING** | Reminders are **workspace-level** (`/appointments/reminders`), not per-type |
| Workflow association | **COMPLETE** | `AppointmentWorkflow` with type scope |

---

## B. Public booking experience

| Capability | Status | Gap |
|------------|--------|-----|
| Hosted page, per-type link, embed | **COMPLETE** | `/book/[slug]`, `/book/[slug]/[serviceId]`, `/embed/book/[slug]` |
| Category / staff / location deep links | **PARTIAL** | `?category=`, `?staff=`, `?location=` wired in Kimi flow; **no share/QR generator UI** |
| Package/membership store | **COMPLETE** | `/book/[slug]/store` |
| Embed widget + popup script | **PARTIAL** | API + `booking-advanced-panel`; no polished share hub |
| **QR booking link** | **MISSING** | QR exists in Grow, not on appointments booking |
| Branding (logo, colors, theme) | **PARTIAL** | `scheduler-theme.ts`; editor under commerce admin |
| Custom domain | **MISSING** | Architecture not productized |
| Hide Transovo branding | **PARTIAL** | Theme flags exist; plan-gating unclear |
| SEO / noindex | **COMPLETE** | `generateMetadata` + `schedulerTheme.noIndex` |
| Timezone detection/display | **COMPLETE** | Workspace TZ + slot display |
| Confirmation + add-to-calendar | **PARTIAL** | Confirmation step; add-to-calendar not verified everywhere |
| Anonymous book, no forced account | **COMPLETE** | Phone/name book without login |
| PWA installable | **PARTIAL** | Manifest + SW added recently; not certified |

---

## C. Availability engine

| Capability | Status | Gap |
|------------|--------|-----|
| Weekly hours, overrides, breaks, staff/location/type hours | **COMPLETE** | `availability-engine.ts`, `/appointments/availability` |
| **Blackouts** | **EXISTS_BUT_NOT_WIRED** | Engine reads `blackoutDates`; **no admin UI** |
| Holidays | **PARTIAL** | Saved from availability UI; engine integration uneven |
| Min/max notice, horizon, buffers, limits | **COMPLETE** | Engine + validation |
| External calendar blocking | **PARTIAL** | Code in engine; **PROVIDER_BLOCKED** without live OAuth |
| Resource blocking in slot gen | **MISSING** (standard path) | Resources not in main `generateNativeSlots` path |
| Minimize-gaps / density | **EXISTS_BUT_NOT_WIRED** | `minimize-gaps.ts`; **no admin toggle** |
| **Custom start-time interval** | **MISSING** | Field in types only |
| **Fixed-time slots only** (SimplyBook) | **MISSING** | No fixed start-time list per type |
| **Why unavailable? diagnostics** | **PARTIAL** | `slot-diagnostics.ts` + admin API; **not in public picker** |
| Auto timezone conversion | **COMPLETE** | |

---

## D. Calendar

| Capability | Status | Gap |
|------------|--------|-----|
| Day / week / month / list | **COMPLETE** | `/appointments/calendar` |
| Filters (provider, location, type, status) | **PARTIAL** | Some filters; not full matrix |
| Click empty slot → create | **MISSING** | Navigates to `/appointments/new` without prefilled time |
| Click appointment → overlay | **MISSING** | Goes to full detail page |
| Drag/drop reschedule | **MISSING** | Explicitly deferred |
| Capacity / payment / confirmation on blocks | **PARTIAL** | Status styling; not full state matrix |
| Waitlist/opening indicators | **MISSING** | |

---

## E. External calendar sync

| Capability | Status | Gap |
|------------|--------|-----|
| Google / Microsoft OAuth | **PARTIAL** | Routes exist; **PROVIDER_BLOCKED** without creds |
| Apple/iCloud | **PROVIDER_BLOCKED** | |
| Inbound busy blocking | **PARTIAL** | Code path; needs live connection |
| Outbound create/update/cancel | **PARTIAL** | `external-sync.ts`; **not UA-certified** |
| Choose blocking vs destination calendars | **PARTIAL** | Settings exist; multi-calendar UX incomplete |
| Connection health / reconnect | **PARTIAL** | |
| **ICS/webcal feed** | **MISSING** | |

---

## F. Staff / providers

| Capability | Status | Gap |
|------------|--------|-----|
| Profile, photo, bio, active, eligible types/locations | **PARTIAL** | Staff in platform config + `/appointments/staff` |
| Provider-specific availability/overrides | **COMPLETE** | `staff-availability.ts` |
| Customer-selectable / Any provider / round robin | **PARTIAL** | Round robin coded; collective booking weak |
| Multiple providers required for one booking | **MISSING** | |
| Staff-created appointments (full pipeline) | **COMPLETE** | `booking-platform.ts` `source: admin` |
| **Provider RBAC separate from profile** | **MISSING** | Matrix AA = FAIL |

---

## G. Multi-service booking (Square-style)

| Capability | Status | Gap |
|------------|--------|-----|
| One visit, multiple services, sequential, different providers | **EXISTS_BUT_NOT_WIRED** | `multi-service.ts` + `AppointmentServiceLine`; **not in public book API or UI** |

---

## H. Service phases (processing time)

| Capability | Status | Gap |
|------------|--------|-----|
| Active/passive phases, provider/resource occupancy | **PARTIAL** | `ServicePhaseTemplate` + `service-phases.ts`; **not in slot engine or public book** |

---

## I. Recurring appointments

| Capability | Status | Gap |
|------------|--------|-----|
| Book recurring series (weekly/biweekly/monthly) | **PARTIAL** | Public book + `createRecurringAppointments`; limited frequency set |
| Daily, N-weeks, weekday patterns, monthly by weekday | **MISSING** | Not full RRULE-style matrix |
| Preview conflicts before save | **PARTIAL** | `editRecurringSeries` preview; **not customer-facing** |
| Edit this / future / entire series (customer) | **MISSING** | Library only; manage link is single-appointment |
| Skip occurrence | **MISSING** | |

---

## J. Multiple bookings in one session (SimplyBook)

| Capability | Status | Gap |
|------------|--------|-----|
| Pick several independent slots, one checkout | **MISSING** | No cart/session model |

---

## K. Group bookings

| Capability | Status | Gap |
|------------|--------|-----|
| Booker + N attendees, capacity, group pricing | **PARTIAL** | `attendeeCount` + `extraRecipients`; not full roster/forms/pricing |

---

## L. Classes / group sessions

| Capability | Status | Gap |
|------------|--------|-----|
| Series, capacity, instructor, enrollment, waitlist | **PARTIAL** | Admin + `classes.ts`; **no public `/book/**` class enrollment** |
| Remaining spaces display | **MISSING** on public book | |
| Pick-a-spot / seat maps | **EXISTS_BUT_NOT_WIRED** | Phase2 `seat-selection.ts`; not on public book |

---

## M. Booking approval

| Capability | Status | Gap |
|------------|--------|-----|
| Instant vs request; approve/decline; propose alternate | **PARTIAL** | Backend + status; alternate-time proposal **weak** |

---

## N. Customer self-service (manage link)

| Capability | Status | Gap |
|------------|--------|-----|
| View, reschedule, cancel, pay balance, intake, add to calendar | **PARTIAL** | Recently wired; **cert matrix still FAIL** on payment transfer, intake cutoff, recurring |
| Confirm action | **PARTIAL** | Status exists; dedicated confirm flow thin |
| After-cutoff fee / credit / approval behaviors | **MISSING** | Policy types exist; **charge/consume/approval queue not wired** |

---

## O. Client portal

| Capability | Status | Gap |
|------------|--------|-----|
| Passwordless portal, appointments, packages, gifts, memberships | **PARTIAL** | `/portal/[token]`; wallet added; **no in-portal reschedule/cancel** |
| Recurring series view | **MISSING** | |
| Invoices / payment history | **MISSING** | |
| Forms hub | **MISSING** | |

---

## P–R. CRM, custom fields, intake

| Capability | Status | Gap |
|------------|--------|-----|
| Contact CRM (search, history, merge) | **COMPLETE** | Contacts product + import/export |
| Custom client fields (reusable) | **PARTIAL** | Phase2 `custom-fields.ts` + API; **not full Contacts UI parity** |
| Intake forms (all field types, conditional, cutoff) | **PARTIAL** | Model + admin; conditional/cutoff **incomplete**; not on public book |
| Tags / segments for appointments | **PARTIAL** | Mass texting segments exist; not appointment-native |

---

## S. Agreements / terms / waivers

| Capability | Status | Gap |
|------------|--------|-----|
| Terms acceptance with version snapshot | **PARTIAL** | `terms` question type in booking questions; **no standalone agreement engine** |

---

## T. Resources

| Capability | Status | Gap |
|------------|--------|-----|
| Resource CRUD, quantity, eligibility | **PARTIAL** | Admin + `resources.ts`; **not blocking public slots** |

---

## U. Waitlist

| Capability | Status | Gap |
|------------|--------|-----|
| Join with preferences, notify, atomic claim | **PARTIAL** | `waitlist.ts` + public waitlist step; better than SimplyBook day-level but slot-preference UX incomplete |
| Class waitlist | **PARTIAL** | Backend; public weak |
| Customizable waitlist templates | **MISSING** | |
| Cancellation → waitlist recovery automation | **PARTIAL** | Notify job exists; full AM section not certified |

---

## V–Z. Packages, memberships, programs, gifts, coupons

| Capability | Status | Gap |
|------------|--------|-----|
| Packages + entitlement ledger | **PARTIAL** | Strong backend; identity-first redeem on public book recently added; mixed service/class/add-on limits partial |
| Memberships + Stripe subs + scheduling entitlements | **PARTIAL** | Store + subscription webhook; pause/fail/grace/limit-on-future-bookings incomplete |
| **Programs** (onboarding ×6 + review ×1) | **MISSING** | No generic Program object; `standingSlotPolicy` on package is schema-only |
| Gift certificates | **PARTIAL** | Purchase + redeem; delivery presentation partial |
| Coupons | **PARTIAL** | Admin + validation; not all checkout paths |

---

## AA. Payments

| Capability | Status | Gap |
|------------|--------|-----|
| Free, pay later, full, deposit %, PWYW, balance, checkout | **PARTIAL** | Stripe path; Square partial |
| Saved card, refunds, payment history on appointment | **PARTIAL** | Saved card wired; **staff charge balance / late fees MISSING** |
| Idempotency / webhooks | **PARTIAL** | Stripe webhooks; appointment payment idempotency partial |

---

## AB. Card on file / no-show protection

| Capability | Status | Gap |
|------------|--------|-----|
| Save card via Stripe SetupIntent | **PARTIAL** | Portal + book |
| **Cancellation / no-show fee charge** | **MISSING** | Policy snapshot types exist; **no automated charge execution** |

---

## AC. Cancellation / no-show policy engine

| Capability | Status | Gap |
|------------|--------|-----|
| Cutoffs + after-cutoff behaviors | **PARTIAL** | Evaluator returns `behavior`; **only block vs allow enforced** |

---

## AD–AE. Tips, invoices

| Capability | Status | Gap |
|------------|--------|-----|
| Tips | **PARTIAL** | `TippingConfig` in types; checkout wiring uneven |
| Invoices (draft, send, pay link, void) | **MISSING** | No appointments invoice product |

---

## AF–AH. Confirmations, reminders, two-way actions

| Capability | Status | Gap |
|------------|--------|-----|
| Confirmation request + unconfirmed state | **PARTIAL** | Workflows/templates; not Square-level auto-resend certified |
| Reminder sequences (SMS/email/voice) | **COMPLETE** (strength) | `/appointments/reminders`, workflows |
| **Two-way Confirm/Reschedule/Cancel from SMS** | **MISSING** | Templates say "reply YES"; **no inbound handler updating appointment** |

---

## AI–AK. Workflows, email, SMS

| Capability | Status | Gap |
|------------|--------|-----|
| Workflow triggers/actions | **COMPLETE** (strength) | `/appointments/workflows` |
| Full event coverage (AC matrix) | **MISSING** | Many commerce/class/payment events lack guaranteed templates |
| SMS metering / credit packs | **PARTIAL** | Usage exists; SimplyBook-style credit UX not productized |

---

## AL. Marketing (general only)

| Capability | Status | Gap |
|------------|--------|-----|
| Rebooking / recall / birthday / inactive | **PARTIAL** | `/appointments/no-show-recovery`, workflows; not certified |
| Mass SMS campaigns | **EXISTS_BUT_NOT_WIRED** | Hidden from launch nav; reuse possible |

---

## AM–AW. Waitlist recovery, recall, single-use, routing, team, polls, locations, limits, fixed time, book-soon, display density

| Capability | Status | Gap |
|------------|--------|-----|
| Single-use links | **PARTIAL** | API + `?singleUse=`; consume path needs hardening |
| Routing forms → type/staff/location | **PARTIAL** | `routingRules` on platform config |
| Round robin / collective | **PARTIAL** | Round robin yes; collective weak |
| **Meeting polls** | **PARTIAL** | `meeting-polls.ts` in platform config; limited UI |
| Multi-location | **PARTIAL** | Locations in settings |
| Booking limits (customer/day, provider/day, etc.) | **COMPLETE** | `checkBookingLimits` |
| **Book-soon / opening notification** | **MISSING** | |
| **Availability display density** ("spread slots") | **MISSING** | |
| Booking status matrix (requested, checked-in, etc.) | **PARTIAL** | Basic statuses; checked-in weak |

---

## AX–BA. Add-ons, restrictions, staff/API parity

| Capability | Status | Gap |
|------------|--------|-----|
| Add-ons | **EXISTS_BUT_NOT_WIRED** | See section A |
| Client restrictions | **COMPLETE** | `assertClientNotRestricted` on public book |
| Staff + API + AI booking same pipeline | **PARTIAL** | Central `booking-platform`; AI/MCTB paths need parity audits |

---

## BC–BN. Attribution, reporting, audit, import, integrations, API, webhooks, video, AI, MCTB, reviews

| Capability | Status | Gap |
|------------|--------|-----|
| UTM / source attribution | **PARTIAL** | UTM captured on public book |
| Reporting + CSV | **PARTIAL** | `reporting.ts`; not full BD matrix |
| **Audit / activity log** | **MISSING** | No unified appointment audit trail UI |
| Import/export | **PARTIAL** | Client CSV; appointment import partial |
| Integrations catalog | **PARTIAL** | Calendar + Stripe; embed/social booking adapters weak |
| Outbound webhooks | **PARTIAL** | `webhook-delivery.ts` + worker; UA pending |
| Video / Transovo Video | **COMPLETE** | Per-type video settings |
| AI booking | **PARTIAL** | Public AI step; must not override engine (by design) |
| MCTB → booking | **PARTIAL** | Separate product; link handoff exists |
| Review requests | **PARTIAL** | Reuse reviews module; not appointment-native trigger certified |

---

## BO–BV. Global search, settings search, progressive disclosure, mobile, security, slot holds, conflicts, staff notifications, business profile, rebook

| Capability | Status | Gap |
|------------|--------|-----|
| Global search | **EXISTS_BUT_NOT_WIRED** | Phase2 API; **no app-shell search UI** |
| **Settings search** | **MISSING** | |
| **Progressive disclosure** (Meeting/Service/Class simple create) | **MISSING** | Everything visible in commerce hub |
| Mobile responsive | **PARTIAL** | Kimi flows responsive; not certified AM |
| Tenant isolation / RBAC / atomic book | **PARTIAL** | Slot locks exist; team RBAC FAIL |
| Slot holds during checkout | **PARTIAL** | `withAtomicSlotBooking`; hold TTL on abandoned checkout unclear |
| Explainable conflicts | **PARTIAL** | Admin diagnostics only |
| Staff notifications (new book, cancel, etc.) | **PARTIAL** | Via workflows, not exhaustive |
| Business profile / branding | **PARTIAL** | Settings + scheduler theme |
| Customer rebook | **PARTIAL** | Portal "book again"; not rich prefill |

---

## BZ. Deliverable requested in spec

| Item | Status |
|------|--------|
| `docs/GENERAL-APPOINTMENT-PARITY-MATRIX.md` | **MISSING** — needs to be created with columns: Capability, Acuity, SimplyBook, Square, Transovo implementation, route, API/runtime, DB model, UA test, status (PASS/FAIL/PROVIDER_BLOCKED/NOT_APPLICABLE) |

---

## Vertical work to de-emphasize

Built from earlier Fresha/Mindbody/Vagaro sweep — **keep backend if useful, hide from core nav, do not chase checkbox parity:**

| Feature | Repo state | Action |
|---------|------------|--------|
| SOAP / treatment records | Phase2 API (`treatment-records.ts`) | **De-emphasize** — not core general scheduling |
| Body charts | Not built | Skip |
| Patch tests | Not built | Skip |
| POS retail inventory | Not built | Skip |
| Commissions / payroll / shifts | Not built | Skip |
| Client wallet / loyalty (phase2) | API exists | **Generalize** as wallet/loyalty if kept; not launch-critical |
| Class check-in / pick-a-spot | Phase2 API | **Generalize** as optional ops add-ons |
| PWA | Recently added | Keep as general mobile-web |

**Keep and generalize:** resources, service phases, household/attendee, group bookings, packages, structured (non-clinical) notes.

**Do NOT add to core product (per spec):**

- SOAP notes, body charts, patch tests, treatment diagrams, medical charting
- Salon-specific formulas, stylist commission/payroll, booth-rental
- Salon inventory/product consumption, medspa treatment plans
- Gym equipment-layout UI, studio-specific check-in as core nav

---

## "Inspect hardest" differentiators — scorecard

| Differentiator | Status |
|----------------|--------|
| Recurring + packages + memberships auto-linked | **PARTIAL** — entitlements on book improving; recurring series customer edit **MISSING** |
| Multiple bookings per session (SimplyBook) | **MISSING** |
| Multi-service one visit (Square) | **EXISTS_BUT_NOT_WIRED** |
| Flexible mixed packages (SimplyBook) | **PARTIAL** — credit rules exist; mix limits incomplete |
| Membership limits on future bookings | **MISSING** |
| Waitlist (beat SimplyBook/Square) | **PARTIAL** — engine better than day-level; not fully productized |
| Service phases + multi-service (Square) | **PARTIAL** — backend only |
| Client self-service (manage + portal) | **PARTIAL** — recent wiring; not PASS-certified |
| Communication (reminders/workflows/SMS) | **COMPLETE** as platform strength; two-way SMS actions **MISSING** |

---

## Recommended gap-closure order

1. **Wire existing backends to public book:** add-ons, resources, multi-service cart, category/image on type editor
2. **SimplyBook gap:** multiple bookings per session
3. **Square gap:** multi-service checkout + service phases in availability
4. **Self-service depth:** recurring series on manage link; after-cutoff policy money paths
5. **Availability UX:** blackouts UI, minimize-gaps, fixed start times, public "why unavailable?"
6. **Calendar ops:** slot-click create, compact overlay
7. **Share/QR hub** on `/appointments/booking`
8. **Create `docs/GENERAL-APPOINTMENT-PARITY-MATRIX.md`** and certify PASS rows with real browser journeys
9. **Progressive disclosure** + settings search so depth does not overwhelm basic users

---

## Key file map (implementation evidence)

```
Storage:     prisma/schema.prisma (VoiceService, BookingCategory, PackageProduct, ClassSeries, etc.)
Types lib:   src/lib/appointments/types.ts, booking-platform.ts, scheduling-capabilities.ts
Service:     src/lib/appointments/service-booking/*
Public:      src/app/api/public/book/[slug]/route.ts
             src/features/appointments/kimi/public/use-public-booking-flow.ts
Manage:      src/app/api/public/manage/[token]/route.ts
             src/components/appointments/manage-appointment-public-client.tsx
Portal:      src/app/api/public/portal/[token]/**
Availability: src/lib/appointments/availability-engine.ts
Calendar:    src/features/appointments/kimi/calendar/calendar-connected.tsx
Workflows:   src/lib/appointment-workflows/
Reminders:   src/lib/appointments/reminder-engine.ts
Matrices:    docs/ACUITY-PARITY-MATRIX.md
             docs/SERVICE-BOOKING-COMPETITIVE-PARITY-MATRIX.md
```

---

## Product definition (from spec)

Transovo Appointments should be:

> Calendly/Cal.com-simple for basic scheduling, but deeper than Acuity, SimplyBook.me and Square Appointments when the business needs advanced appointment operations.

The user should not perceive the complexity until they ask for it.
