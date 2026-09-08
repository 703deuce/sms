# Service-Booking Competitive Parity Matrix (Full Envelope)

**Governing spec:** `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md`  
**Benchmarks:** Mangomint · Jane · Acuity · Boulevard · Fresha · Square · SimplyBook · Vagaro · GlossGenius · Booksy · Mindbody · Zenoti · Cal.com (UX only)  
**Last updated:** 2026-09-08

## Status legend

| Status | Meaning |
|--------|---------|
| PASS | Real UA journey certified (reload-verified) |
| CODE | Runtime/API/UI shipped; UA certification pending |
| FAIL | Not implemented |
| PROVIDER_BLOCKED | Requires external platform (native app, Apple/iCloud, BNPL provider, etc.) |
| NOT_APPLICABLE | Out of product scope with documented reason |

**Rule:** No `UNKNOWN`. `CODE` is not launch-complete.

---

## Phase 1 — Acuity / service-booking foundation (current PR scope)

| Feature | Transovo | UI route | API / runtime | Domain model | UA test | Status |
|---------|----------|----------|---------------|--------------|---------|--------|
| Public booking | Booking page | `/book/[slug]` | `/api/public/book/[slug]` | `VoiceAppointment` | APT-PUB-014 | CODE |
| Public store checkout | Packages & memberships store | `/book/[slug]/store` | `/api/public/book/[slug]/store*` | `PackageProduct` | APT-PKG-STORE | CODE |
| Manage appointment link | Self-service hub | `/manage/[token]` | `/api/public/manage/[token]` | `ManageAppointmentToken` | APT-MGT-001 | CODE |
| Client portal | Passwordless account | `/portal/[token]` | `/api/public/portal/[token]` | `ClientPortalSession` | APT-PRT-001 | CODE |
| Package ledger | Identity-first credits | `/appointments/commerce` | `packages.ts` | `PackageBalance` | APT-PKG-001 | CODE |
| Gift certificates | Purchase + redeem | `/book/[slug]/store` | `gift-certificates.ts` | `GiftCertificateBalance` | APT-GFT-001 | CODE |
| Memberships | Subscription products | `/appointments/commerce` | `memberships.ts` | `ServiceMembershipSubscription` | APT-MEM-001 | CODE |
| Outbound webhooks | Signed delivery worker | `/appointments/commerce` (webhooks tab) | `webhook-delivery.ts` | `AppointmentWebhookDelivery` | APT-DEV-WH | CODE |
| Saved card (SetupIntent) | Portal payment methods | `/portal/[token]` | `/api/public/portal/[token]/payment-methods` | `Contact.customFields.payment` | APT-CARD-001 | CODE |
| Booking categories | Grouping + order | `/appointments/categories` (in commerce hub) | `booking-category.ts` | `BookingCategory` | APT-CAT-001 | CODE |
| Resources | Quantity engine | `/appointments/resources` (availability) | `resources.ts` | `SchedulingResource` | APT-RES-001 | CODE |
| Classes | Series + enrollment | `/appointments/classes` (commerce hub) | `classes.ts` | `ClassSeries` | APT-CLS-001 | CODE |
| Client restrictions | Ban/restrict | `/appointments/commerce` (restrictions tab) | `client-restrictions.ts` | `ClientBookingRestriction` | APT-BAN-001 | CODE |
| Multi-service checkout | Chained services | `/book/[slug]` | `multi-service.ts` | `AppointmentServiceLine` | APT-MSA-001 | CODE |
| Processing phases | Buffer/cleanup time | commerce hub | `service-phases.ts` | `ServicePhaseTemplate` | APT-PRX-001 | CODE |
| Household accounts | Booker vs attendee | commerce hub | `household.ts` | `HouseholdAccount` | APT-FAM-001 | CODE |
| Apple/iCloud calendar sync | External calendar | `/integrations/calendars` | calendar adapters | — | APT-SYN-APPLE | PROVIDER_BLOCKED |
| Native iOS/Android app | Installable client | — | — | — | APT-MOB-NATIVE | PROVIDER_BLOCKED |

---

## Phase 2 — Cross-competitor expansion (runtime shipped; UA certification pending)

| Feature | Competitor signal | Target route | UA test | Status |
|---------|-------------------|--------------|---------|--------|
| Pick-a-Spot / seat selection | Mindbody, Vagaro | `/book/[slug]` | CMP-PAS-001 | CODE |
| Client/class self check-in | Mindbody, Zenoti | `/portal/[token]` | CMP-CHK-001 | CODE |
| Intelligent / member-priority waitlist | Mindbody, Vagaro | `/appointments/waitlist` | CMP-WLT-001 | CODE |
| Scheduled booking-release / member early access | Mindbody | `/appointments/availability` | CMP-REL-001 | FAIL |
| Dynamic / off-peak pricing | Vagaro, Zenoti | type editor | CMP-DYN-001 | CODE |
| Client wallet | Vagaro, Fresha | `/portal/[token]` | CMP-WAL-001 | CODE |
| Loyalty program + ledger | Vagaro, Booksy | `/contacts` | CMP-LOY-001 | CODE |
| Referral program | GlossGenius, Fresha | settings | CMP-REF-001 | FAIL |
| Customer tags / dynamic segments | Mangomint | `/contacts/segments` | CMP-TAG-001 | FAIL |
| Custom customer fields | All incumbents | `/contacts` | CMP-CFL-001 | CODE |
| Global search | Mangomint, Boulevard | app shell | CMP-SCH-001 | CODE |
| SOAP notes / treatment records | Jane, Mangomint | appointment detail | CMP-SOAP-001 | CODE |
| Body charts / image annotation | Jane | appointment detail | CMP-BCH-001 | FAIL |
| Patch-test requirements | Fresha, Vagaro | type editor | CMP-PCH-001 | FAIL |
| File / document uploads | Jane, Mindbody | contact / appointment | CMP-FIL-001 | FAIL |
| Retail products + inventory | Vagaro, Mindbody | new commerce surface | CMP-RTL-001 | FAIL |
| Product/add-on recommendation rules | Zenoti | checkout | CMP-REC-001 | FAIL |
| Unified POS / cart | Square, Vagaro | `/payments` POS | CMP-POS-001 | CODE |
| Customer self-checkout | Square | `/book/[slug]/store` | CMP-SCO-001 | FAIL |
| Split tender | Square, Mindbody | checkout | CMP-SPL-001 | FAIL |
| Tip splitting | Vagaro | checkout | CMP-TIP-SPLIT | FAIL |
| Commissions | Vagaro, Mindbody | staff reports | CMP-COM-001 | FAIL |
| Shifts / timesheets | Mindbody, Zenoti | staff ops | CMP-SHF-001 | FAIL |
| Pay-run calculations | Zenoti | payroll export | CMP-PAY-001 | FAIL |
| Staff-performance reporting | All incumbents | `/appointments/analytics` | CMP-STF-001 | FAIL |
| Invoices / estimates | Jane, Boulevard | `/payments` | CMP-INV-001 | FAIL |
| Taxes / service charges | Square, Mindbody | checkout | CMP-TAX-001 | FAIL |
| Online product store (retail) | Vagaro | `/book/[slug]/store` | CMP-OST-001 | FAIL |
| Marketing campaigns | Mindbody, Vagaro | mass texting (hidden) | CMP-MKT-001 | FAIL |
| Campaign analytics | Mindbody | analytics | CMP-MKA-001 | FAIL |
| Reactivation journeys | GlossGenius | workflows | CMP-REA-001 | FAIL |
| Review-request integration | Booksy, Fresha | workflows | CMP-REV-001 | FAIL |
| Broader two-way messaging | All | `/conversations` | CMP-MSG-001 | CODE |
| WhatsApp adapter | Fresha, Booksy | integrations | CMP-WA-001 | FAIL |
| Ticket / QR entry | Mindbody classes | class check-in | CMP-TKT-001 | FAIL |
| Remaining-spaces display | Mindbody | `/book/[slug]` | CMP-RSP-001 | FAIL |
| Show fewer slots presentation | Cal.com UX | `/book/[slug]` | CMP-SLS-001 | FAIL |
| Book-soon / opening notifications | Cal.com | notifications | CMP-OPN-001 | FAIL |
| Deep multi-location overrides | Mindbody, Zenoti | locations | CMP-MLC-001 | FAIL |
| Independent-provider payment routing | Boulevard | payments | CMP-IPR-001 | FAIL |
| Installable PWA | Fresha mobile web | public routes | CMP-PWA-001 | CODE |
| Push notifications | Native incumbents | — | CMP-PUSH-001 | PROVIDER_BLOCKED |
| Public discovery directory | Fresha marketplace | marketing site | CMP-DIR-001 | FAIL |
| External booking-channel adapters | Zenoti | integrations | CMP-CHN-001 | FAIL |
| Verified customer reviews | Booksy | reviews product | CMP-VREV-001 | NOT_APPLICABLE |
| Lead pipeline | Boulevard | CRM | CMP-LED-001 | FAIL |
| Business goals | Mangomint | analytics | CMP-GOL-001 | FAIL |
| Virtual / hybrid classes | Mindbody | classes | CMP-VCL-001 | FAIL |
| VOD entitlement | Mindbody | memberships | CMP-VOD-001 | FAIL |
| Staff-specific price/duration | Vagaro | type editor | CMP-SPD-001 | FAIL |
| Any-provider assignment strategies | Acuity, Square | scheduling | CMP-ANY-001 | CODE |
| Customer preferences | Mangomint | contact profile | CMP-PRF-001 | FAIL |
| Digital wallets (Apple/Google Pay) | Square | checkout | CMP-DW-001 | PROVIDER_BLOCKED |
| BNPL adapter | Square | checkout | CMP-BNPL-001 | PROVIDER_BLOCKED |
| Personal calendar blocks | Cal.com | availability | CMP-BLK-001 | FAIL |
| Resource-only bookings | Mindbody | calendar | CMP-ROB-001 | FAIL |
| Resource-utilization reporting | Zenoti | analytics | CMP-RUR-001 | FAIL |
| Deals / promotions (beyond coupons) | Vagaro | commerce | CMP-DEAL-001 | FAIL |
| Custom receipts | Square | payments | CMP-RCP-001 | FAIL |
| Hosted public business booking site | Acuity, SimplyBook | `/book/[slug]` | CMP-SITE-001 | CODE |
| Stronger audit log | Enterprise incumbents | settings | CMP-AUD-001 | FAIL |
| Settings search | Mangomint | settings | CMP-SET-001 | FAIL |

---

## Certification gate (launch)

1. Every Phase 1 row must reach **PASS** (not `CODE`) via reload-verified UA journeys.
2. Phase 2 rows must be **FAIL**, **PROVIDER_BLOCKED**, or **NOT_APPLICABLE** with explanation — never `UNKNOWN`.
3. Package certification example (required before PASS):

```
customer buys 5-pack → payment succeeds → balance shows 5 → customer books → balance 4 → reload → still 4 → qualifying cancel → credit restored per policy
```

4. Native mobile, Apple/iCloud, push, BNPL, and wallet tap-to-pay may remain **PROVIDER_BLOCKED** with platform deliverable documented.
