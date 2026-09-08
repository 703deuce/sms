# Transovo Appointments — Service-Booking Parity + Beyond (Governing Requirement)

**Status:** Active — **supersedes narrower “Acuity-like” or Calendly-only framing**  
**Audience:** Cursor, Kimi Mode 4, product engineering, certification  
**Prerequisites:** `docs/TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md`, `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md`, Meeting / Service / Class architecture (prior build spec)

---

## Governing requirement

The existing build specification is the **architectural foundation**, but the final Transovo Appointments product must satisfy this stronger requirement:

**Do not ship behind Acuity Scheduling on customer-operable scheduling functionality.**

Implement:

1. Every applicable Acuity scheduling/service-business capability in sections A–AZ below;
2. The previously specified **Meeting / Service / Class** architecture;
3. Improvements identified from real Acuity/Calendly user complaints and forum pain points;
4. **Simple progressive-disclosure UX** so depth does not complicate basic booking.

**Do not remove** existing Transovo functionality that exceeds Acuity (reminders, workflows, two-way SMS, AI booking, notetaker, MCTB cross-product integration).

---

## Competitive definition (updated)

We are **not** building “Acuity-like.” **Acuity parity is the floor, not the ceiling.**

### UX benchmark — Cal.com / Calendly

Ask: *Is doing the basic thing as easy or easier?*

- Create booking type
- Availability
- Booking page
- Reschedule
- Share
- Calendar sync

### Capability benchmark — service-business schedulers

Ask: *Can this business run its recurring-service model without another scheduler?*

| Platform | Why it matters |
|----------|----------------|
| **Acuity** | Packages, subscriptions, gifts, recurring service appointments, intake |
| **SimplyBook.me** | Multi-service packages, memberships with service/class restrictions |
| **Square Appointments** | Packages, classes, waitlists, resources, processing time, multi-staff visits |
| **Vagaro** | Rich memberships (credits, discounts, sharing, multi-location) |
| **Fresha** | Recurring appointments, series management |
| **Mindbody** | Classes/memberships/studio ops (heavier reference) |

**Product definition:**

> Simple scheduling for people who only need Calendly-style booking, **plus** a complete service-business operating model for businesses that need Acuity-class functionality.

Cal.com remains a **scheduling-infrastructure** competitor. Transovo’s lane is the next layer:

- What has this customer purchased?
- What are they entitled to?
- Which recurring relationship are they in?
- Who serves them, which room/equipment is needed?
- What do they still owe?
- What happens if they cancel?
- What should happen automatically next?

---

## Progressive disclosure (AX) — non-negotiable

Depth must **not** appear during ordinary setup.

| Archetype | Initial create flow |
|-----------|---------------------|
| **Meeting** | Name → Duration → Location → Availability → Create |
| **Service** | Name → Duration → Price → Location → Availability → Create |
| **Class** | Name → Duration → Instructor → Capacity → Schedule → Create |

Everything else is progressively disclosed **after** creation.

No Acuity-parity feature may make Meeting setup harder for users who do not need it.

---

## A. Public booking / scheduler parity

Support all of:

- Individual booking types/services
- Group classes
- Appointment categories
- Collapsible categories
- Custom ordering of booking types/categories
- Public booking types
- Unlisted/direct-link booking types
- Private/secret booking where applicable
- Direct link to a booking type
- Direct link to a category
- Direct link to a calendar/provider
- Direct link to a location
- Direct package/membership/store links
- Embedded scheduler
- Full-page scheduler
- Configurable scheduler colors/fonts/branding
- Business logo
- Booking-type image
- Booking-type description
- Duration
- Price display
- Confirmation-page message
- Timezone conversion
- Optional search-engine indexing suppression

Preserve Acuity’s functional level (categories, collapsed categories, scoped direct links, embeds) with Transovo’s cleaner design.

---

## B. Customer Manage Appointment link — **required (core)**

Every appointment gets a **secure Manage Appointment URL**.

Include where appropriate in: confirmation email, confirmation SMS, reminders, calendar invitation, client portal.

Without full account sign-in, the valid secure link exposes allowed actions:

- View appointment
- Confirm
- Reschedule
- Cancel
- Pay outstanding balance
- Complete/edit permitted intake forms
- Access location/video information

### Business controls

| Control | Options |
|---------|---------|
| Allow customer rescheduling | on/off |
| Rescheduling cutoff | anytime · X minutes · X hours · X days before |
| Allow customer cancellation | on/off |
| Cancellation cutoff | independently configurable |

### After cutoff — configurable behavior

- Block and show Contact Business
- Require staff approval
- Permit with late-change fee
- Permit but consume entitlement/package credit

### Payment on reschedule

**Do not** refund and recharge merely because the time changed.

Transactionally preserve and transfer to the rescheduled appointment:

- Original payment
- Deposit
- Package redemption
- Membership entitlement

---

## C. Self-service beyond Acuity — recurring

For recurring appointments, authorized customer self-service supports (subject to policy):

- This appointment only
- This and future appointments
- Entire series

Before changing future occurrences:

- Calculate availability
- Show conflicts
- Show changed dates
- Require confirmation

**Never silently move a series.**

---

## D. Complete availability / scheduling-limit parity

Business defaults with per-calendar / per-booking-type overrides:

- Minimum booking notice
- Maximum days ahead
- Minimum cancellation notice
- Minimum reschedule notice
- Client reschedule enable/disable
- Client cancel enable/disable
- Client intake-edit enable/disable
- Intake edit cutoff
- Custom start-time interval
- Appointment-derived start intervals
- Minimize-gaps behavior (see E)
- Appointments allowed simultaneously
- Maximum appointments per day
- Maximum appointments per week
- Booking limits
- Padding/buffers before and after
- Blackout periods
- Availability overrides
- Separate availability by booking type
- Separate availability by staff/calendar

---

## E. “Minimize gaps” / schedule density

Deterministic availability **ranking** (not AI).

| Mode | Behavior |
|------|----------|
| Off | Neutral slot order |
| Prefer compact schedule | Bias toward adjacent bookings |

Must **never** present an actually unavailable slot.

---

## F. Appointment type / service parity

Every appropriate Booking Type supports:

- Name, description, duration, multiple duration options (where supported)
- Price, category, image, location
- Staff/provider/calendar, resources
- Intake forms, add-ons, availability group
- Scheduling limits, visibility, direct link
- Reminders, payment policy, cancellation policy

---

## G. Categories

Implement reusable **BookingCategory**:

- Name, display order, active
- Booking types assigned
- Collapsible/public display option
- Direct public URL

Support **separate** organizational grouping for Booking Types vs Packages/Memberships — do not force one taxonomy.

---

## H. Complete group class parity

Existing Class/Group spec remains required.

**Acuity parity:**

- Reusable group class definition
- Individual occurrences
- Recurring occurrence generation
- Capacity, calendar/provider assignment
- Register for one occurrence
- Optionally require registration for all occurrences in a series

**Exceed Acuity:**

- One checkout for entire series
- Clear complete date list before purchase
- Package/membership-aware series enrollment
- Roster, attendance, makeup credits, series-level customer management

---

## I. Recurring appointments

Preserve full recurring-series engine from prior specification.

Customer booking:

- Repeating appointments
- Multiple individually selected slots in one flow

Do not mix incompatible booking types in one series unless explicitly supported.

**Exceed Acuity:** parent series, conflict preview, one/future/all editing, holiday handling, transactional series modifications.

---

## J. Rooms / equipment / resources

Scheduling Resource engine:

- Internal resource, quantity
- Eligible booking types
- Multiple required resources
- Availability across calendars

All required resources must be available before presenting a slot.

---

## K. Payments — full Acuity parity (Stripe Connect first)

- No payment required
- Optional payment in advance
- Full payment required
- Fixed deposit · percentage deposit
- Customer may choose deposit or full when allowed
- Collect/save card without immediate full charge
- Saved payment method · charge balance later
- Tips · pay-what-you-want
- Package · subscription/membership · gift certificate purchase
- Refunds · cancellation/no-show charges with valid authorization

Also: installment/payment plans, entitlement automation, failed-payment recovery (prior spec).

---

## L. Pay-what-you-want

Pricing mode: customer chooses amount.

- Minimum amount (server-enforced)
- Suggested amount
- Optional preset suggestions

Do not combine tips and pay-what-you-want in ambiguous checkout.

---

## M. Tipping

- Tips enabled/disabled
- Suggested percentages/amounts
- Custom tip

Store tip separately from base service price for reporting.

---

## N. Saved card

Stripe Customer + PaymentMethod / SetupIntent. **Never** store card data.

- Book with saved method
- Staff charge authorized balance
- Authorized late cancel/no-show charge
- Package/membership purchase
- Customer update payment method securely

---

## O. Packages

Preserve Package + ledger design.

Match/exceed Acuity: prepaid multi-appointment, eligible types/classes, expiration, categories, purchase page, direct link, customer/staff purchase, redemption, order history.

**Improve:** entitlement follows canonical customer — not redemption-code-primary UX.

---

## P. Gift certificates — required

First-class **GiftCertificateProduct** and **GiftCertificateBalance/Ledger**:

- Fixed/custom denominations
- Service-specific certificates where desired
- Purchaser, recipient, email, gift message, scheduled delivery
- Balance, partial redemption, history
- Expiration where legally permitted
- Direct purchase URL, printable/shareable presentation

---

## Q. Memberships / subscriptions

Full Stripe Connect subscription + entitlement spec:

- Billing frequency, price, included entitlement
- Rollover, max balance, cancel, pause/resume
- Failed payment, renewal, direct purchase
- Client portal, business admin, renewal notice

---

## R. Coupons / discounts

Unified **Coupon** promotion engine:

- Code, percentage/fixed discount
- Start, expiration, usage cap, one-per-customer
- Eligibility: booking types, packages, gifts, memberships
- One-time and recurring subscription duration
- Active/inactive, redemption tracking

---

## S. Add-ons / upsells

- Price delta, duration delta, quantity
- Resource requirement, eligibility by booking type
- Optional/required

Checkout recalculates price, duration, availability **atomically**.

---

## T. Intake forms

Field types: text, long text, phone/email, dropdown, radio, checkbox, multi-select, date, informational, agreement, signature/waiver.

- Required/optional/conditional
- Booking-type assignment, profile prefill, version snapshot, client edit cutoff
- Package/membership purchase forms at checkout

---

## U. Internal forms / staff notes

Private staff-only: appointment notes, client notes, treatment/progress notes, staff custom fields. Never exposed in client portal by default.

---

## V. Client management

Search, filter, profile, account state, appointments, forms, packages, gifts, memberships, private notes.

Import/export CSV, appointment import where safe, duplicate detection, safe merge, bulk selection, inactive filtering.

---

## W. Ban / restrict customer

**Block online booking** (server-side):

- Block public booking
- Block package/membership purchase
- Block self-reschedule/cancel
- Custom message

Staff may still book if authorized. Use canonical client identity, not email string only.

---

## X. Client portal / client account

Upcoming/past appointments, recurring series, classes, waitlist, packages, gift balances, memberships, saved Stripe methods, balances, receipts, intake, reschedule/cancel, book again.

Passwordless access. Autofill name, phone, email, prior intake.

---

## Y. Staff-created bookings — full parity

All origins (public, staff admin, portal, API, AI) enter the **same canonical pipeline** with reminders, confirmation, payment, package/membership, intake, workflows.

External calendar events must not be “blocked time only” when convertible — see AR.

---

## Z. Calendar sync

Google, Microsoft/Outlook, Apple/iCloud where architecture permits, one-way feed for other clients.

- Transovo appointment → external calendar
- External busy → block availability

Reschedule/cancel must propagate deterministically (no stale events).

---

## AA. Team permissions — improve Acuity

| Role | Scope |
|------|--------|
| Staff | Own appointments/calendar |
| Manager | Assigned people/locations |
| Owner/Admin | Entire tenant |

Per-calendar/per-staff visibility and edit rights. Staff sync must not require cross-team calendar edit access.

---

## AB. Waitlist — match and beat Acuity

Admin notification on join, client confirmation, **editable templates**, SMS/email channels, management page, customer preferences, automatic offer, offer expiration, atomic seat claim.

---

## AC. Notifications — full event coverage

Customer: confirmation, cancel, reschedule, reminder, follow-up, class enroll/cancel, waitlist join/opening, package/gift/membership purchase and renewal, payment failure/recovery, intake request, balance due.

Internal: new appointment, cancel, reschedule, request, waitlist, payment failure, package/membership sale, intake completion.

Customizable templates; booking-type overrides.

---

## AD. Reminders

Simple Reminder editor for most customers. Confirmation, multiple before-appointment, confirmation requested, unconfirmed follow-up, same-day, post-appointment, no-show/rebooking. SMS/email + Transovo voice where enabled.

---

## AE. Workflows

Advanced only. Trigger → Action → + with progressive reveal of delay, condition, branch. Templates only during workflow creation.

---

## AF. Reporting — Acuity parity plus Transovo

Minimum: Appointments, Revenue, Users/booking source, Intake, Add-ons, Tips — with filters and CSV export.

Preserve Transovo richer: reminder analytics, membership churn, failed-payment recovery, package utilization, class occupancy, waitlist conversion.

---

## AG. Import / export

Clients CSV import/export, appointments import/export where safe, intake export, validation preview, batch undo when safe.

---

## AH. Booking source / referral tracking

Public page, direct link, embed, staff-created, portal, MCTB, AI, campaign/referral UTMs. Conversion funnel analytics where consent allows.

---

## AI. Embedding / share

Shareable booking link, direct type/category/provider/location links, package/membership links, embed snippet with preview.

---

## AJ. Integrations parity

External calendars, video, accounting, email marketing, CRM, embeds, social/discovery, API/webhooks.

Third-party credential gaps → **PROVIDER_BLOCKED**, not fake “implemented.”

---

## AK. Developer / automation

API, outbound webhooks, secure signing, event subscription.

Minimum events: `appointment.created|rescheduled|canceled|updated`, `package.purchased`, `membership.started|updated|canceled`, `class.enrolled`, `waitlist.promoted`.

---

## AL. Brand customization

Logo, business name, background, primary/button color, accessible text, scheduler/confirmation messaging, optional Transovo branding by plan.

Custom CSS only if safely sandboxed.

---

## AM. Mobile

All admin and customer operations responsive on mobile.

Native app: extend if repo contains one; otherwise record native parity as separate deliverable — do not pretend.

---

## AN–AW. Beyond Acuity (summary)

| ID | Requirement |
|----|-------------|
| **AN** | Package/membership/gift identity auto-resolves at booking — no code memorization |
| **AO** | Series admin: one / future / all + holiday batch resolution |
| **AP** | Multi-service programs (typed credits across booking types) |
| **AQ** | Package + standing recurring slot |
| **AR** | Staff/API/calendar-event → canonical appointment conversion |
| **AS** | Better waitlist: preferences, auto/manual offer, withdraw |
| **AT** | Purchase + enroll for class series (one transaction) |
| **AU** | Purchase-time onboarding/intake |
| **AV** | Failed payment ops: home attention, client update link, workflows |
| **AW** | Controlled client duplicate merge with audit |

---

## BA–BE. Competitive gaps beyond Acuity-only spec

These are required for **service-booking parity** with SimplyBook.me, Square, Vagaro, Fresha — not optional future work.

### BA. Multi-service appointments

One customer visit, multiple services in one booking/checkout:

- Each service: duration, staff, resource, price, add-ons
- Availability engine solves the **chain** before offering the slot

*Reference: Square multi-staff appointment booking.*

### BB. Processing-time scheduling

Service phases with independent staff/resource occupancy:

- Example: apply (staff) → processing (resource, staff optional) → finish (staff)
- Availability engine releases/retains staff and resources per phase

*Reference: Square processing time.*

### BC. Mixed-entitlement packages

Package grants **typed** credits across different services/classes/add-ons — not only “N credits anywhere.”

*Reference: SimplyBook.me combined packages.*

### BD. Membership benefits beyond credits

Membership may include: included services, credits, % discount, member pricing, member-only types/classes, early access, multi-location, optional household sharing.

*Reference: Vagaro, SimplyBook.me membership restrictions.*

### BE. Family / dependent accounts

Booker ≠ attendee (tutors, music lessons, children’s classes, pet training, family wellness).

- Household payer
- Multiple dependents under one account
- Policy-controlled shared entitlements/payment methods

---

## AY. Complete parity audit before claiming done

Produce and maintain:

| Document | Purpose |
|----------|---------|
| `docs/ACUITY-PARITY-MATRIX.md` | Every Acuity capability → Transovo route/runtime/DB/test/status |
| `docs/ACUITY-USER-COMPLAINT-GAP-MATRIX.md` | Beyond-Acuity improvements with UA tests |
| `docs/SERVICE-BOOKING-COMPETITIVE-PARITY-MATRIX.md` | SimplyBook / Square / Vagaro / Fresha / Cal.com benchmarks |

### Status values (no UNKNOWN)

| Status | Meaning |
|--------|---------|
| **PASS** | Real customer/admin action works through persistence and reload |
| **FAIL** | Not implemented or broken |
| **PROVIDER_BLOCKED** | Internal ready; external credential/approval missing |
| **NOT_APPLICABLE** | Explained exclusion |

A feature does **not** PASS because a component renders.

---

## AZ. Beyond-Acuity audit minimum rows

Certify at minimum (each with real UA test): easier default setup; package/membership auto-tied to customer; no mandatory redemption-code UX; series one/future/all; holiday impact handling; Manage Appointment link; enforceable reschedule/cancel cutoffs; package-aware rescheduling; recurring self-service; staff-created parity; calendar-event conversion; customizable waitlist messages; cleaner staff permissions; package + standing slot; package + full class-series enrollment; purchase-time intake; failed-payment recovery; client duplicate merge; multi-service appointments; processing-time phases; mixed-entitlement packages; rich membership benefits; family/dependent accounts.

---

## Final definition

Do **not** describe the finished system as “Acuity-like.”

**Acuity parity is the floor. Service-booking competitive parity is the bar. Cal.com simplicity is the UX benchmark.**

Preserve Transovo advantages: reminders, workflows, two-way communication, AI booking, native/video/notetaker, MCTB integration.

---

## Related documents

| Doc | Role |
|-----|------|
| `docs/ACUITY-PARITY-MATRIX.md` | Acuity capability certification matrix |
| `docs/ACUITY-USER-COMPLAINT-GAP-MATRIX.md` | Beyond-Acuity / complaint-driven gaps |
| `docs/SERVICE-BOOKING-COMPETITIVE-PARITY-MATRIX.md` | Multi-platform competitive matrix |
| `docs/appointments-core-parity.md` | Implementation status snapshot (legacy) |
| `docs/TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md` | Domain objects and routes |
