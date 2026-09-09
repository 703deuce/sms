# Appointments Platform — Feature Split

**Original V1 platform vs Acuity / SimplyBook / Square parity additions**

**Generated:** 2026-09-09  
**Authority:** `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md`, `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md`, `docs/GENERAL-APPOINTMENT-CLEAN-PARITY-GAPS.md`, `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md`  
**Current `master`:** includes UI productization wave (availability rules UI, contracts, POS, invoices, portal depth)

---

## How to read this document

This is a **downloadable checklist** of appointment-product features, split into two buckets:

| Part | What it means |
|------|----------------|
| **Part A — Original Transovo V1** | Features that were already in scope **before** the Acuity / SimplyBook.me / Square Appointments parity program. Calendly/Cal.com-style scheduling + Transovo-native reminders, workflows, messaging, meetings, and core public booking. |
| **Part B — Parity additions** | Features added (or materially expanded) to match **Acuity-class service-business scheduling** — commerce, classes, multi-service, resources, portal, contracts, POS, and related depth. |

**Notes**

- “Original” does not mean “finished/certified.” Many V1 features are still `UA_PENDING` for browser certification.
- “Parity” includes backend + admin UI + public flows where they exist. Some parity features are API-first with thin admin UI.
- **Provider-blocked** items (Reserve with Google, Meta booking, iCloud sync, SAML/SCIM) are listed under Part B as scaffolds only.
- Shared products (**Contacts**, **Messages/Inbox**) are listed only where appointments use them.

**Related full ledger:** `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md` (~307 capability rows)

---

# Part A — Original Transovo V1 Appointments Platform

*Baseline scheduling product before the service-booking / Acuity parity build (Phases 1–18).*

## A1. Product shell & navigation

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A1.1 | Appointments Home (Overview) | `/appointments/overview` | Daily snapshot, KPIs, quick links |
| A1.2 | Primary sidebar nav | Appointments product shell | Home, Booking, Calendar, Availability, Reminders, Payments, Analytics, Integrations, Settings |
| A1.3 | Mobile bottom nav | Mobile shell | Home, Calendar, Booking (+ Messages/Contacts when enabled) |
| A1.4 | Platform setup wizard | `/appointments/setup` | First-time appointments onboarding |
| A1.5 | V1 launch nav gating | Shell (feature flags) | Hides mass SMS, MCTB, Grow, etc. from appointments nav |
| A1.6 | Page title resolver | Shell header | Route-aware titles via `getAppointmentsPageTitle()` |

## A2. Booking types & configuration (core)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A2.1 | Booking types list & editor | `/appointments/types` | Create/edit services customers can book |
| A2.2 | Name, description, duration | Type editor | Basic service definition |
| A2.3 | Multiple duration options | Type editor → duration options | Let customer pick length (e.g. 30 / 60 min) |
| A2.4 | Visibility (public / unlisted / secret) | Type editor | Control who can discover the type |
| A2.5 | Display order & bulk reorder | Type editor + bulk API | Reorder services on booking page |
| A2.6 | Custom booking questions | Type editor → questions | Collect info at booking (text, select, etc.) |
| A2.7 | Group booking / attendee count | Type editor + public flow | Capacity for group appointments |
| A2.8 | Recurring eligibility on type | Type editor → Advanced | Allow recurring series from public book |
| A2.9 | Staff assignment modes | Type editor → Advanced | Customer chooses, specific staff, round robin, collective |
| A2.10 | Location assignment (basic) | Type editor + `/appointments/locations` | Attach types to business locations |
| A2.11 | Payment modes (basic) | Type editor → Advanced | Free, deposit, full payment, pay later |
| A2.12 | Cancellation policy (basic) | Type editor → Advanced | Cutoff windows for customer cancel |
| A2.13 | Reschedule policy (basic) | Type editor → Advanced | Cutoff windows for customer reschedule |
| A2.14 | Booking approval required | Type editor | Hold bookings until staff approves |
| A2.15 | Confirmation page customization | Type editor | Custom message after successful book |
| A2.16 | Booking page settings | `/appointments/booking` | Workspace slug, enable/disable public booking, branding basics |
| A2.17 | Embed URL & iframe | `/embed/book/[slug]` | Embed booking on external site (API + embed route) |
| A2.18 | Single-use booking links | API (`booking-links`) | One-time links for campaigns |
| A2.19 | Booking approval queue | API | Approve/decline `awaiting_confirmation` bookings |
| A2.20 | Booking source / UTM attribution | Public book POST metadata | Track campaign source on appointments |

## A3. Availability & scheduling engine (core)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A3.1 | Weekly hours editor | `/appointments/availability` | Set open hours per day |
| A3.2 | Workspace timezone | Availability + Settings → Calendar | Canonical TZ for slots |
| A3.3 | Minimum booking notice | `/appointments/availability` | Block slots too soon (e.g. 4 hours) |
| A3.4 | Maximum booking horizon | `/appointments/availability` | How far ahead customers can book |
| A3.5 | Date overrides | `/appointments/availability` | Custom hours or closed on specific dates |
| A3.6 | Booking limits (daily/weekly/per-type) | `/appointments/availability` | Cap appointments per period |
| A3.7 | Native slot generation | Public DateTime step | Engine produces bookable times |
| A3.8 | Staff-aware slots | Public staff picker | Slots respect assigned staff calendars |
| A3.9 | External calendar busy blocking | `/integrations/calendars` | Google/Microsoft busy times block slots |
| A3.10 | Atomic slot booking (anti double-book) | Runtime | Advisory locks prevent two books on same slot |
| A3.11 | Slot validation before book | Runtime | Final check before appointment is created |
| A3.12 | Admin availability query | API | Staff tools query free slots |
| A3.13 | Round robin assignment | Type + runtime | Distribute bookings across staff |

## A4. Staff & locations (core)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A4.1 | Staff scheduling config | `/appointments/staff` | Staff list, per-staff hours |
| A4.2 | Locations (basic CRUD) | `/appointments/locations` | Business locations for in-person services |
| A4.3 | Scheduling groups | `/appointments/team-pages` | Team booking page groupings |
| A4.4 | Per-staff external calendar | `/integrations/calendars` | Connect staff Google/Outlook |

## A5. Public booking (core customer flow)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A5.1 | Public booking home | `/book/[slug]` | Customer-facing scheduler |
| A5.2 | Deep link to one type | `/book/[slug]/[serviceId]` or `?type=` | Direct link to one service |
| A5.3 | Service / type picker | Public flow | Choose what to book |
| A5.4 | Staff picker | Public DateTime / Info | Choose provider when enabled |
| A5.5 | Duration picker | Public flow | Pick duration option |
| A5.6 | Live availability slots | Public DateTime step | Pick date/time |
| A5.7 | Custom booking questions | Public Info step | Answer per-type questions |
| A5.8 | Recurring booking | Public Info step | Book repeating series |
| A5.9 | Group attendee count | Public Info step | Specify party size |
| A5.10 | Email OTP verification | Public flow | Optional email verification |
| A5.11 | Booking protection / bot checks | Public flow | Honeypot, abuse protection |
| A5.12 | Stripe checkout | Public payment redirect | Pay deposit or full amount |
| A5.13 | Public waitlist join | Public waitlist step | Join when no slots (service waitlist) |
| A5.14 | Public AI booking chat | Public AI step | Natural-language booking |
| A5.15 | Reminder diagnostics (support) | `/book/[slug]/reminders` | Internal/support diagnostics |

## A6. Appointments operations (staff)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A6.1 | Appointments list | `/appointments` | All appointments table |
| A6.2 | Create appointment (staff) | `/appointments/new` | Manual book on behalf of customer |
| A6.3 | Appointment detail | `/appointments/[id]` | Full record, status, actions |
| A6.4 | Calendar view | `/appointments/calendar` | Week/month operational calendar |
| A6.5 | Reschedule (staff) | Appointment detail | Change time from admin |
| A6.6 | Cancel (staff) | Appointment detail | Cancel from admin |
| A6.7 | Internal notes | Appointment detail | Staff-only notes on record |
| A6.8 | Reminder suppress / reset | Appointment detail | Control reminder sends for one appointment |
| A6.9 | Reminder timeline | Appointment detail | See reminder delivery history |
| A6.10 | Status workflow | Appointment detail | confirmed, completed, no-show, etc. |
| A6.11 | Provider calendar sync | Integrations + runtime jobs | Push/pull to Google/Microsoft |

## A7. Customer self-service (core)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A7.1 | Manage appointment link | `/manage/[token]` | Customer reschedule/cancel via SMS/email link |
| A7.2 | Reschedule via manage link | Manage page | Pick new time |
| A7.3 | Cancel via manage link | Manage page | Cancel without calling |
| A7.4 | Recurring series cancel scopes | Manage page | This / future / all occurrences |
| A7.5 | Recurring series reschedule scopes | Manage page | This / future / all occurrences |
| A7.6 | ICS calendar download | Manage page | Add to personal calendar |
| A7.7 | Book again link | Manage page | Return to public booking |
| A7.8 | Legacy confirm/cancel/reschedule tokens | `/appointments/confirm|cancel|reschedule/[token]` | Older token routes (preserved) |
| A7.9 | Waitlist offer accept | `/waitlist/accept/[token]` | Accept opened slot from waitlist SMS |

## A8. Payments (core)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A8.1 | Deposits & full payment | Public book + Stripe | Charge at booking time |
| A8.2 | Payment transaction ledger | `/payments/transactions` | View appointment charges |
| A8.3 | Stripe Connect | `/integrations/payments` | Connect merchant account |
| A8.4 | Square payments (adapter) | `/integrations/payments` | Square merchant path |

## A9. Waitlist & recalls (core)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A9.1 | Waitlist admin queue | `/appointments/waitlist` | View/manage waitlist entries |
| A9.2 | Waitlist slot notification | Runtime job | SMS when slot opens |
| A9.3 | Waitlist offer + atomic accept | Token link | Customer claims slot |
| A9.4 | Waitlist auto-fill on cancel | Runtime | Offer slot when appointment cancels |
| A9.5 | Recalls hub | `/appointments/recalls` | Re-engage past customers |
| A9.6 | Recall campaigns | `/appointments/recall-campaigns` | SMS recall campaigns |
| A9.7 | No-show recovery | `/appointments/no-show-recovery` | Automated no-show follow-up |
| A9.8 | No-show scan job | Background | Mark no-shows on schedule |

## A10. Reminders & notifications

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A10.1 | Reminder sequences | `/appointments/reminders` | Configure when reminders fire |
| A10.2 | SMS reminders | Reminders + runtime | Text before appointment |
| A10.3 | Email reminders | Reminders + runtime | Email before appointment |
| A10.4 | ICS attachments | Reminder pipeline | Calendar file in email |
| A10.5 | Reminder test send | Reminders admin | Send test to yourself |
| A10.6 | Per-appointment reminder timeline | Appointment detail | Delivery audit per booking |
| A10.7 | Voice reminders | `/appointments/voice-reminders` | Phone call reminders |
| A10.8 | SMS consent disclosure | Public Info step | Compliance copy on book |
| A10.9 | Automation templates | `/appointments/automations/templates` | Reusable message templates |
| A10.10 | Automation activity log | `/appointments/automations/activity` | See automation runs |

## A11. Workflows & automations

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A11.1 | Workflow list | `/appointments/workflows` | Appointment-triggered automations |
| A11.2 | Create / edit workflow | `/appointments/workflows/new`, `[id]/edit` | Build multi-step flows |
| A11.3 | Workflow from template | `/appointments/workflows/setup/[templateId]` | Start from prebuilt template |
| A11.4 | Workflow test run | API | Dry-run workflow |
| A11.5 | Time-based triggers | Background scanners | Before/after appointment actions |
| A11.6 | Unknown SMS reply triage | API | Route ambiguous SMS replies |

## A12. AI booking

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A12.1 | AI booking settings | `/appointments/ai-booking` | Configure AI assistant |
| A12.2 | Staff-initiated AI book | AI booking admin | Book via natural language (staff) |
| A12.3 | Public AI chat booking | Public AI step | Customer books via chat |
| A12.4 | AI booking protection | Runtime | Risk scoring on AI books |

## A13. Video meetings & AI notetaker

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A13.1 | Upcoming meetings | `/video` | Video meetings list |
| A13.2 | Host video for appointment | `/appointments/[id]/video/host` | Start/host meeting |
| A13.3 | Public video join | `/video/[token]` | Guest join link |
| A13.4 | Meeting recaps / notetaker | `/meetings`, `/meetings/[id]` | AI meeting summaries |
| A13.5 | Transovo Video settings | `/settings/transovo-video` | Video product settings |
| A13.6 | AI Notetaker settings | `/settings/ai-notetaker` | Notetaker configuration |
| A13.7 | Teams meeting auto-create | Runtime (Microsoft) | Auto Teams link on book |

## A14. Routing, team pages & polls

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A14.1 | Routing forms builder | `/appointments/routing-forms` | Qualify leads before booking |
| A14.2 | Routing rules (legacy) | `/appointments/routing` | Rule-based routing |
| A14.3 | Public routing form | `/routing/[slug]/[formSlug]` | Customer-facing qualifier |
| A14.4 | Team booking pages | `/appointments/team-pages` | Multi-staff landing pages |
| A14.5 | Public team booking page | `/team/[slug]/[pageSlug]` | Customer picks from team |
| A14.6 | Meeting polls | `/appointments/polls` | Group availability polling (Calendly-like) |

## A15. Analytics & reporting (core)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A15.1 | Analytics overview | `/appointments/analytics` | High-level metrics |
| A15.2 | Booking analytics | `/appointments/analytics/booking` | Funnel / conversion |
| A15.3 | Reminder analytics | `/appointments/analytics/reminders` | Delivery stats |
| A15.4 | Automation analytics | `/appointments/analytics/automations` | Workflow performance |
| A15.5 | Reports hub | `/appointments/analytics/reports` | Exportable reports |

## A16. Integrations (core)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A16.1 | Google Calendar sync | `/integrations/calendars` | Two-way or busy blocking |
| A16.2 | Microsoft / Outlook sync | `/integrations/calendars` | Calendar connection |

## A17. Organization & security

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A17.1 | Granular appointment permissions | Settings + API | Role-based access |
| A17.2 | Per-type access control | API auth | Restrict types by role |
| A17.3 | Tenant isolation | Runtime | Workspace-scoped data |

## A18. Shared Transovo surfaces (appointments context)

| # | Feature | Where in UI | How to use |
|---|---------|-------------|------------|
| A18.1 | Contacts | `/contacts` | Customer records linked to appointments |
| A18.2 | Messages / Inbox | `/conversations` | SMS threads with appointment context |
| A18.3 | Settings (business, team, messaging, calendar, billing) | `/settings/*` | Workspace configuration |
| A18.4 | Help / Getting started | `/getting-started` | Onboarding help |

### Part A summary

| Category | Approx. count |
|----------|----------------|
| Part A feature rows | **~120** |
| Nature | Calendly/Cal.com-style scheduling + Transovo reminders, workflows, AI, video, messaging |

---

# Part B — Added during Acuity / SimplyBook / Square parity build

*Service-business scheduling depth added in Phases 1–18, service-booking stack, clean parity gaps (Phase 18), and UI productization waves A–B.*

**Program start (repo):** `docs/GENERAL-APPOINTMENT-PARITY-AUDIT.md` (2026-09-08) → `efec1f52` service-booking parity stack → Phases 1–18 → zero-gap + browser UAT.

## B1. Booking type archetypes & editor expansion

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B1.1 | Archetypes MEETING / SERVICE / CLASS | All | `/appointments/types` → Booking type picker | Pick archetype at create; defaults disclosure |
| B1.2 | Categories on type | SB | Type editor → Categories | Group services on public page |
| B1.3 | Images on type | SB | Type editor | Service image on public picker |
| B1.4 | Required resources on type | SQ, SB | Type editor → Resources | Room/equipment required to book |
| B1.5 | Add-ons on type | All | Type editor → Add-ons | Optional upsells at book |
| B1.6 | Add-on duration & resource effects | All | Type + public Info | Add-on changes time/resources |
| B1.7 | Intake forms on type | A, SB | Type editor → Intake forms | Structured intake beyond quick questions |
| B1.8 | Intake file / image upload | SB | Public Info + upload API | Customer uploads documents |
| B1.9 | Service phases (multi-phase duration) | SQ | Type editor → Service phases | Active / passive / buffer phases |
| B1.10 | Provider-release processing time | SQ | Phase `staffRequired` toggle | Staff free during processing phase |
| B1.11 | Extended payment modes | SQ | Type editor → Advanced | PWYW, save card, extended deposit rules |
| B1.12 | Extended cancellation/reschedule policies | All | Type editor + `/appointments/policies` | Fees, approval after cutoff |
| B1.13 | Policy fees (late cancel / no-show) | SQ | Runtime on cancel/no-show | Charge per policy |
| B1.14 | Named availability schedules | SB | `/appointments/availability` | Reusable schedule templates per type |
| B1.15 | Categories admin (standalone) | SB | `/appointments/categories` or Commerce → Categories | Manage category catalog |
| B1.16 | Client restrictions | SB | `/appointments/restrictions` or Commerce | Block specific clients from booking |
| B1.17 | Audience segments | — | `/appointments/segments` | Marketing/ops segments from appointment data |
| B1.18 | Terms & conditions acceptance | SB, A | Booking Pages → SMS consent + public checkbox | Versioned legal acceptance on book |
| B1.19 | Formal contracts + e-signature | SQ | `/appointments/booking/contracts`, `/appointments/contracts` | Templates; issue from detail; sign at `/contracts/sign/[token]` |
| B1.20 | Calendar colors (staff/service) | SB, SQ | Platform config / calendar | Color-code calendar events |

## B2. Availability engine (Acuity/SB/SQ depth)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B2.1 | Blackout dates | All | `/appointments/availability` | Fully closed dates |
| B2.2 | Holiday calendar | SB | `/appointments/availability` | Predefined holiday closures |
| B2.3 | Fixed appointment start times | SB | Availability → Scheduling rules | Only offer specific start times (e.g. :00 and :30) |
| B2.4 | Custom start interval | A | Availability → Scheduling rules | Slot grid step (10/15/30/45/60 min) |
| B2.5 | Make Me Look Busy (hide slots) | SB | Availability → Scheduling rules | Show only % of real availability |
| B2.6 | Minimize gaps / compact scheduling | SQ | Availability → Scheduling rules | Prefer slots that reduce gaps |
| B2.7 | Group / collective scheduling | SB | Runtime | Multiple staff required simultaneously |
| B2.8 | Resource-constrained slots | SQ, SB | Runtime | Slots respect room/equipment capacity |
| B2.9 | Slot diagnostics (“why unavailable”) | A | Availability → Slot diagnostics panel | Explain why a time is blocked |
| B2.10 | Dynamic pricing by slot | — | Commerce admin → Dynamic pricing | Surge/discount rules by time |
| B2.11 | Class capacity display mode | SB | Public classes config | Show “3 spots left” on class list |

## B3. Staff, locations & resources (depth)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B3.1 | Location-specific hours | SQ | `/appointments/locations` | Different hours per location |
| B3.2 | Location-specific timezone | SQ | Location editor | TZ per site |
| B3.3 | Location-specific staff assignment | SQ | Location editor | Which staff work where |
| B3.4 | Location-specific resource assignment | SQ | Location + Resources | Equipment per site |
| B3.5 | Resources (rooms, equipment) | SQ, SB | `/appointments/resources` or Commerce → Resources | Manage bookable assets |
| B3.6 | Resource quantity / capacity | SB | Resources admin | Multiple units (e.g. 3 massage rooms) |
| B3.7 | Resource pools (any-one-in-group) | SB | API (`resource-groups`) | Group substitutes (Room A OR Room B) |
| B3.8 | Resource persist on book | SQ | Runtime | Store which resource was booked |
| B3.9 | Staff round-robin state | SQ | Runtime | Fair distribution tracking |

## B4. Public booking (parity expansions)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B4.1 | Location picker | SQ | Public flow | Customer picks location |
| B4.2 | Multi-service chain | SQ | Public DateTime / cart | Book Service A + B in one checkout |
| B4.3 | Multi-staff per service line | SQ | Public DateTime | Different provider per service line |
| B4.4 | Multi-booking session (cart) | SB | Public session API | Several appointments one session |
| B4.5 | Custom client fields | SB | Public Info | Extended CRM fields at checkout |
| B4.6 | Add-on selection | All | Public Info | Toggle upsells |
| B4.7 | Package / membership entitlements | All | Public Info | Redeem credits at checkout |
| B4.8 | Wallet balance at checkout | — | Public Info | Apply store credit |
| B4.9 | Saved card on file | SQ | Public Info / Portal | Reuse Stripe card |
| B4.10 | Recurring date preview | All | Public Info | Preview series dates before confirm |
| B4.11 | Returning invitee cookie | A | Runtime | Recognize repeat bookers |
| B4.12 | Square in-page payment | SQ | Public payment step | Square checkout path |
| B4.13 | Public store (packages/products) | SB | `/book/[slug]/store` | Buy packages without booking a slot |
| B4.14 | Public class enrollment | SB | `/book/[slug]/classes` | Enroll in class occurrences |
| B4.15 | Class seat map picker | SB | Public classes flow | Pick seat on map |
| B4.16 | Coupon code at checkout | All | Public Info | Apply discount code |
| B4.17 | Loyalty earn/redeem at book | — | Public Info + Commerce | Points program |
| B4.18 | PWA registration | — | Public shell | Add-to-home-screen (supporting) |

## B5. Share, embed & distribution

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B5.1 | Share & embed hub (expanded) | All | `/appointments/booking/share` | Links, embed, QR, class link |
| B5.2 | Booking QR code generator | SQ | Share hub | Download/print QR for front desk |
| B5.3 | Scheduler theme / branding hub | All | `/appointments/booking/branding` or Commerce → Theme | Logo, colors, language |
| B5.4 | Custom booking domain | SB | Theme config | CNAME custom domain (DNS required) |
| B5.5 | Advanced custom CSS | A, SB | Theme config | Inject custom CSS on public book |
| B5.6 | Custom terminology / locale | SB | Theme config | Rename “Appointment” → “Session”, etc. |
| B5.7 | Direct booking links per type | All | Share hub | Per-service deep links |
| B5.8 | Reserve with Google / GBP | SB, A | Integrations (stub) | **PROVIDER_BLOCKED** |
| B5.9 | Facebook Book Now | SB | Channels stub | **PROVIDER_BLOCKED** |
| B5.10 | Instagram booking | SB, SQ | Channels stub | **PROVIDER_BLOCKED** |

## B6. Customer portal & self-service (unified account)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B6.1 | Client portal (unified account) | A | `/portal/[token]` | Customer account home |
| B6.2 | Portal: upcoming / past appointments | A | Portal UI | History |
| B6.3 | Portal: packages & credits | A | Portal UI | Remaining session credits |
| B6.4 | Portal: memberships | A | Portal UI | Active membership status |
| B6.5 | Portal: gift balances | A | Portal UI | Gift card balance |
| B6.6 | Portal: package usage history | A | Portal UI | Ledger of credit use |
| B6.7 | Portal: purchase & payment history | A, SQ | Portal UI | Receipts and charges |
| B6.8 | Portal wallet | — | Portal UI | Store credit balance |
| B6.9 | Portal saved payment methods | SQ | Portal UI | Manage cards |
| B6.10 | Portal login (magic link) | — | `/api/public/portal/login/[slug]` | OTP/email portal access |
| B6.11 | Pay balance via manage link | SQ | `/manage/[token]` | Pay remaining balance |
| B6.12 | Edit intake via manage link | A | Manage page | Update intake after book |

## B7. Payments & commerce (Acuity-class)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B7.1 | Packages & memberships hub | All | `/appointments/commerce` | Central commerce admin |
| B7.2 | Package products | All | Commerce → Packages | Sell session bundles |
| B7.3 | Package purchase & assignment | All | Commerce + runtime | Sell/assign to contact |
| B7.4 | Package credits & ledger | All | Portal + book | Track redemption |
| B7.5 | Package lifecycle (restore on cancel) | SB | Runtime | Return credit on eligible cancel |
| B7.6 | Package forfeiture (late cancel / no-show) | SB | Runtime | Forfeit credit per policy |
| B7.7 | Mixed-content package entitlements | SB | Commerce config | Credits usable on types + classes |
| B7.8 | Membership products | All | Commerce → Memberships | Recurring membership SKUs |
| B7.9 | Membership subscriptions | All | Commerce + Stripe Billing | Subscribe customer |
| B7.10 | Membership lifecycle (pause/cancel/past_due) | SB, A | Runtime + webhooks | Subscription state machine |
| B7.11 | Failed-payment suspension | SB, A | Runtime | Pause benefits on failed charge |
| B7.12 | Payment recovery / entitlement restore | SB, A | Runtime | Restore after successful retry |
| B7.13 | Membership-only booking types | A, SB | Type editor + public gate | Members-only services |
| B7.14 | Recurring membership credit replenishment | SB | Subscription renewal | Monthly credits refresh |
| B7.15 | Gift certificates | All | Commerce → Gifts | Sell/redeem gift cards |
| B7.16 | Gift redemption history | A | Portal / ledger | Audit gift use |
| B7.17 | Coupons / discounts | All | `/appointments/coupons` or Commerce | Promo codes |
| B7.18 | Programs (multi-visit bundles) | — | Commerce → Programs | Structured programs |
| B7.19 | Payment plans (installments) | A | `/appointments/payments` or Commerce | Split payments over time |
| B7.20 | Client wallet | — | Commerce + Portal | Internal store credit |
| B7.21 | Loyalty programs | — | Commerce → Loyalty | Points earn/redeem rules |
| B7.22 | POS cart | SB | `/appointments/pos` | In-person mixed checkout |
| B7.23 | POS mixed checkout (service+package+product+tip) | SB, SQ | POS admin | One cart, many line kinds |
| B7.24 | Products for sale | SB | Commerce + `/book/[slug]/store` | Retail product catalog |
| B7.25 | Pay-what-you-want / tipping | SQ | Type + public | Variable price |
| B7.26 | Invoices | A, SQ | `/payments/invoices` | Formal invoices; pay at `/pay/invoice/[token]` |
| B7.27 | Refunds (full / partial / wallet) | SQ | Payments UI | Refund to card or wallet |
| B7.28 | Refund to original payment method | SQ | Payments UI | Default refund path |
| B7.29 | Refund to client wallet | SQ | Payments UI | Store credit instead of card |
| B7.30 | Service booking reports | SB | `/appointments/reports/service-booking` | Commerce/ops CSV reports |
| B7.31 | Import / export (clients, appointments) | SB | Commerce → Import/export | CSV export links |

## B8. Classes & group booking (studio ops)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B8.1 | Class series admin | SB | `/appointments/classes` | Define recurring class |
| B8.2 | Class occurrences | SB | Classes admin | Schedule instances |
| B8.3 | Staff class enrollment | SB | Classes admin | Manual enroll |
| B8.4 | Public class enrollment | SB | `/book/[slug]/classes` | Customer self-enroll |
| B8.5 | Class check-in (QR) | SB | API + staff tools | Admit at door |
| B8.6 | Seat selection / maps | SB | Commerce admin + public | Assigned seating |
| B8.7 | Event admission tickets | SB | Runtime | QR ticket per enrollment |
| B8.8 | Remaining spaces display | SB | Public classes | Capacity labels |
| B8.9 | Class waitlist (capacity-full) | SQ, SB | Public classes | Wait when class full |
| B8.10 | Waitlist party size | SB | Waitlist entry | Group waitlist |

## B9. Waitlist & recalls (parity depth)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B9.1 | Waitlist preferences (staff/date/time) | SQ | Public + admin | Preferred alternatives |
| B9.2 | Waitlist priority rules | — | Commerce admin | Rank queue |

## B10. Appointments operations (parity depth)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B10.1 | Calendar slot-click create | SQ | `/appointments/calendar` | Click slot → `/appointments/new?startsAt=` |
| B10.2 | Multi-service lines on record | SQ | `/appointments/[id]` detail | See each service line + staff |
| B10.3 | Policy snapshot on record | All | Appointment detail metadata | What policy applied at book time |
| B10.4 | Meeting indicators on calendar | — | Calendar | Video/meeting badges |
| B10.5 | Scheduled / treatment history | — | `/appointments/scheduled` | Service history view |
| B10.6 | Global search | A, SB | Overview header search | Cross-search appointments/contacts |
| B10.7 | Issue contract from detail | SQ | Appointment detail action | Send contract for signature |
| B10.8 | Audit timeline on appointment | All | Detail metadata | Event timeline |

## B11. Client data & CRM-adjacent (parity)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B11.1 | Household / family accounts | SB | Commerce → Households | Link family members |
| B11.2 | Contact merge | — | `/appointments/commerce/contact-merge` | Dedupe contacts |
| B11.3 | Custom client fields (admin) | SB | Commerce → Custom fields | Define extra fields |
| B11.4 | Intake form templates (admin) | A, SB | Commerce → Intake forms | Reusable forms |
| B11.5 | Treatment / service history records | — | Commerce API | Clinical/service notes (vertical-adjacent) |

## B12. Webhooks & developer

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B12.1 | Outbound webhook endpoints | A | Commerce → Webhooks | Register callback URLs |
| B12.2 | Webhook signing (HMAC) | A | Runtime | Verify payload authenticity |
| B12.3 | Webhook delivery queue | A | Background jobs | Retries and delivery log |
| B12.4 | Slot diagnostics API | A | API | Programmatic slot explain |

## B13. Integrations (parity / blocked)

| # | Feature | Competitor ref | Where in UI | How to use |
|---|---------|----------------|-------------|------------|
| B13.1 | iCloud / Apple Calendar sync | A | Integrations stub | **PROVIDER_BLOCKED** |
| B13.2 | SAML SSO | — | Org API | **PROVIDER_BLOCKED** |
| B13.3 | SCIM provisioning | — | Org API | **PROVIDER_BLOCKED** |

## B14. UI productization wave (admin discoverability)

*Shipped on `master` after parity backend — makes parity features findable in UI.*

| # | Feature | Where in UI |
|---|---------|-------------|
| B14.1 | Scheduling rules panel (fixed times, interval, density, gaps) | `/appointments/availability` |
| B14.2 | Slot diagnostics panel | `/appointments/availability` |
| B14.3 | Rich location editor | `/appointments/locations` |
| B14.4 | Expanded commerce admin (loyalty, pricing, webhooks, seats, etc.) | `/appointments/commerce` |
| B14.5 | POS checkout admin | `/appointments/pos` |
| B14.6 | Invoices admin | `/payments/invoices` |
| B14.7 | Contracts admin | `/appointments/contracts`, `/appointments/booking/contracts` |
| B14.8 | Policies admin | `/appointments/policies` |
| B14.9 | Restrictions admin | `/appointments/restrictions` |
| B14.10 | Coupons admin | `/appointments/coupons` |
| B14.11 | Payment plans admin | `/appointments/payments` |
| B14.12 | Booking hub cross-links card | `/appointments/booking` |
| B14.13 | Settings search (appointments) | Appointments settings surfaces |
| B14.14 | Contact merge page | `/appointments/commerce/contact-merge` |
| B14.15 | Service booking hub route | `/appointments/service-booking` |

### Part B summary

| Category | Approx. count |
|----------|----------------|
| Part B feature rows | **~115** |
| Nature | Acuity / SimplyBook / Square service-business scheduling depth |
| Provider-blocked scaffolds | 6 (Google Reserve, Meta×2, iCloud, SAML, SCIM) |

---

# Combined totals

| Bucket | Features | UI routes (admin) | Public routes |
|--------|----------|-------------------|---------------|
| **Part A — Original V1** | ~120 | ~45 | ~12 |
| **Part B — Parity additions** | ~115 | ~25 new/expanded | ~8 new |
| **Overlap note** | Some Part A features were *extended* in Part B (e.g. locations, public book, payments) — listed in B only when materially new |

---

# Certification status (both parts)

| Status | Meaning | Approx. rows |
|--------|---------|--------------|
| PASS / FUNCTIONAL_PASS | Automated or browser evidence | ~70 |
| UA_PENDING / UAT_PENDING | Built; browser certification in progress | ~230 |
| PROVIDER_BLOCKED | Needs external partner OAuth | 6 |

**Browser UAT results:** `docs/certification/APPOINTMENTS-MASTER-BROWSER-UAT-RESULTS.md` (229 journeys; 156 pass, 52 fail at last run)

**Zero-gap ledger:** `docs/APPOINTMENTS-ZERO-GAP-COMPLETION-LEDGER.md`

**UI productization tracker:** `docs/APPOINTMENTS-UI-PRODUCTIZATION-TRACKER.md`

---

# Download

This file lives at:

**`docs/APPOINTMENTS-FEATURE-SPLIT-ORIGINAL-VS-PARITY.md`**

Export options:

- Open in GitHub and use **Raw** → Save As
- Clone repo and open locally in any Markdown viewer
- Print to PDF from browser (Chrome: Print → Save as PDF)

---

*End of split inventory. Update when new parity rows land or V1 baseline scope changes.*
