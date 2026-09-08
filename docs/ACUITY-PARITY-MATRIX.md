# Acuity Parity Matrix

**Governing spec:** `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md`  
**Last audited:** 2026-09-08 (service-booking parity build — code complete, UA certification pending)  
**Rule:** PASS = runtime + routes shipped; full UA evidence tracked per `APT-*` IDs.

## Status legend

| Status | Meaning |
|--------|---------|
| PASS | End-to-end code path exists (API + UI + persistence) |
| FAIL | Missing or non-functional |
| PROVIDER_BLOCKED | Internal ready; external approval/credential required |
| NOT_APPLICABLE | Documented exclusion |

---

## A. Public booking / scheduler

| Acuity capability | Transovo equivalent | UI route | API / runtime | Domain object | UA test | Status |
|-------------------|---------------------|----------|---------------|---------------|---------|--------|
| Individual services | AppointmentType / BookingType | `/appointments/types` | `/api/appointments/types` | `AppointmentType` | APT-PUB-001 | PASS |
| Group classes | Class definition + occurrences | `/appointments/classes` | `/api/appointments/service-booking/classes` | `ClassSeries` | APT-PUB-002 | PASS |
| Appointment categories | BookingCategory | `/appointments/categories` | `/api/appointments/service-booking/categories` | `BookingCategory` | APT-PUB-003 | PASS |
| Collapsible categories | Category display config | `/appointments/categories` | `booking-category.ts` | `BookingCategory` | APT-PUB-004 | FAIL |
| Custom type/category order | Sort order fields | `/appointments/types` | type API | `AppointmentType` | APT-PUB-005 | FAIL |
| Public types | `visibility=public` | `/book/[slug]` | `/api/public/book/[slug]` | `BookingPage` | APT-PUB-006 | PASS |
| Unlisted/direct-link types | `visibility=unlisted` | `/book/[slug]/[serviceId]` | public book API | `AppointmentType` | APT-PUB-007 | PASS |
| Direct link to type | Per-type slug URL | `/book/[slug]/[serviceId]` | public book API | `AppointmentType` | APT-PUB-008 | PASS |
| Direct link to category | Category slug URL | `/book/[slug]` (filter TBD) | categories API | `BookingCategory` | APT-PUB-009 | FAIL |
| Direct link to provider | Staff/calendar scoped URL | `/book/[slug]` (staff param) | scheduling-domain | `Staff` | APT-PUB-010 | FAIL |
| Direct link to location | Location scoped URL | `/book/[slug]` (location param) | scheduling-domain | `Location` | APT-PUB-011 | FAIL |
| Package/store links | Package purchase URL | `/book/[slug]/store` | `/api/public/book/[slug]/store` | `PackageProduct` | APT-PUB-012 | PASS |
| Embedded scheduler | Embed widget | `/embed/book/[slug]` | embed routes | `BookingPage` | APT-PUB-013 | PASS |
| Full-page scheduler | Public booking page | `/book/[slug]` | public book API | `BookingPage` | APT-PUB-014 | PASS |
| Scheduler branding | Theme tokens | `/appointments/commerce` (theme tab) | `/api/appointments/service-booking/scheduler-theme` | `BookingPageTheme` | APT-PUB-015 | PASS |
| Business logo on scheduler | Logo asset | `/book/[slug]` | workspace branding | workspace | APT-PUB-016 | PASS |
| Type image | Cover image | type editor (partial) | type API | `AppointmentType` | APT-PUB-017 | FAIL |
| Type description | Description field | type editor | type API | `AppointmentType` | APT-PUB-018 | PASS |
| Duration display | Duration on book flow | `/book/**` | public book API | `AppointmentType` | APT-PUB-019 | PASS |
| Price display | Price on book flow | `/book/**` | checkout API | pricing config | APT-PUB-020 | PASS |
| Confirmation message | Post-book message | confirm page | book API | `BookingPage` | APT-PUB-021 | PASS |
| Timezone conversion | TZ on public book | `/book/**` | slot engine | timezone prefs | APT-PUB-022 | PASS |
| SEO indexing suppression | `noindex` per page | TBD | TBD | `BookingPage` | APT-PUB-023 | FAIL |

---

## B. Manage Appointment link (core)

| Acuity capability | Transovo equivalent | UI route | API / runtime | Domain object | UA test | Status |
|-------------------|---------------------|----------|---------------|---------------|---------|--------|
| Secure manage URL per appointment | ManageAppointmentToken | `/manage/[token]` | `/api/public/manage/[token]` | `ManageAppointmentToken` | APT-MGT-001 | PASS |
| URL in confirmation email | `{{manage_link}}` | reminders/templates | `reminder-delivery.ts` | template | APT-MGT-002 | PASS |
| URL in confirmation SMS | `{{manage_link}}` | messaging | `booking-platform.ts` | template | APT-MGT-003 | PASS |
| URL in reminders | `{{manage_link}}` | reminders | `reminder-delivery.ts` | template | APT-MGT-004 | PASS |
| URL in calendar invite | ICS `URL` + description | email reminders | `ics-builder.ts` | appointment | APT-MGT-005 | PASS |
| View / confirm / reschedule / cancel | Self-service actions | `/manage/[token]` | manage API | `Appointment` | APT-MGT-006 | PASS |
| Pay outstanding balance | Payment on manage link | manage page | Stripe | `PaymentTransaction` | APT-MGT-007 | FAIL |
| Intake edit on manage link | Form edit w/ cutoff | manage page | intake API | form response | APT-MGT-008 | FAIL |
| Reschedule enable + cutoff | Policy engine | setup / type | `scheduling-limits.ts` | scheduling policy | APT-MGT-009 | PASS |
| Cancel enable + cutoff | Policy engine | setup / type | `scheduling-limits.ts` | scheduling policy | APT-MGT-010 | PASS |
| After-cutoff behaviors | Policy outcomes | manage page | policy API | policy | APT-MGT-011 | PASS |
| Reschedule preserves payment/deposit | Transactional transfer | manage API | `entitlements.ts` | payment ledger | APT-MGT-012 | FAIL |
| Reschedule preserves package/membership | Entitlement transfer | manage API | `entitlements.ts` | entitlement | APT-MGT-013 | PASS |

---

## C–J. Scheduling engine (summary rows)

| Section | Key capability | UA test prefix | Status |
|---------|----------------|----------------|--------|
| C | Recurring self-service one/future/all | APT-REC- | PASS |
| D | Full scheduling limits matrix | APT-LIM- | PASS |
| E | Minimize gaps ranking | APT-GAP- | PASS |
| F | Complete booking type fields | APT-TYP- | FAIL |
| G | BookingCategory model | APT-CAT- | PASS |
| H | Group class series enrollment | APT-CLS- | PASS |
| I | Recurring series engine | APT-SER- | PASS |
| J | Resource quantity engine | APT-RES- | PASS |

---

## K–R. Commerce

| Section | Key capability | UA test prefix | Status |
|---------|----------------|----------------|--------|
| K | Full payment modes (deposit, saved card, etc.) | APT-PAY- | PASS |
| L | Pay-what-you-want | APT-PWY- | PASS |
| M | Tipping | APT-TIP- | PASS |
| N | Saved card (Stripe PM) | APT-CARD- | FAIL |
| O | Packages + ledger | APT-PKG- | PASS |
| P | Gift certificates | APT-GFT- | PASS |
| Q | Memberships/subscriptions | APT-MEM- | PASS |
| R | Unified coupons | APT-CPN- | PASS |

---

## S–X. Operations

| Section | Key capability | UA test prefix | Status |
|---------|----------------|----------------|--------|
| S | Add-ons atomic checkout | APT-ADD- | PASS |
| T | Intake forms (full types) | APT-INT- | PASS |
| U | Staff-only notes/forms | APT-NOT- | FAIL |
| V | Client CRM + import/export | APT-CLI- | PASS |
| W | Client ban/restrict | APT-BAN- | PASS |
| X | Client portal (full) | APT-PRT- | PASS |

---

## Y–AM. Platform

| Section | Key capability | UA test prefix | Status |
|---------|----------------|----------------|--------|
| Y | Staff-created = canonical pipeline | APT-STF- | PASS |
| Z | Calendar sync + deterministic update | APT-SYN- | FAIL |
| AA | Scoped team permissions | APT-RBAC- | FAIL |
| AB | Waitlist templates + atomic claim | APT-WLT- | PASS |
| AC | Full notification event coverage | APT-NOT- | FAIL |
| AD | Reminder editor coverage | APT-RMD- | PASS |
| AE | Workflow builder (advanced) | APT-WFL- | PASS |
| AF | Reporting parity + CSV | APT-RPT- | PASS |
| AG | Import/export with preview | APT-IMP- | PASS |
| AH | Booking source tracking | APT-SRC- | PASS |
| AI | Embed/share link generator | APT-EMB- | FAIL |
| AJ | Integrations catalog | APT-INT- | FAIL |
| AK | API + webhooks | APT-DEV- | PASS |
| AL | Brand customization | APT-BRD- | PASS |
| AM | Responsive mobile (web) | APT-MOB- | FAIL |

---

## BA–BE. Service-booking competitive (see also SERVICE-BOOKING-COMPETITIVE-PARITY-MATRIX.md)

| Capability | UA test | Status |
|------------|---------|--------|
| Multi-service appointments (one checkout) | APT-MSA-001 | PASS |
| Processing-time phases | APT-PRX-001 | PASS |
| Mixed-entitlement packages | APT-MEP-001 | PASS |
| Membership benefits beyond credits | APT-MBF-001 | PASS |
| Family / dependent accounts | APT-FAM-001 | PASS |

---

## Certification gate

Appointments product **must not** be declared production-complete until:

1. Every row in this matrix has a non-UNKNOWN status.
2. All rows required for target launch tier are PASS or documented PROVIDER_BLOCKED / NOT_APPLICABLE.
3. `docs/ACUITY-USER-COMPLAINT-GAP-MATRIX.md` beyond-Acuity rows are certified.
4. UA test execution evidence is recorded for each PASS row.

**Next audit:** Re-run against Acuity 2026 help center before each major release.
