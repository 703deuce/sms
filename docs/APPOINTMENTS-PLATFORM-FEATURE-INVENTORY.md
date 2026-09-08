# Transovo Appointments Platform — Complete Feature Inventory

**Generated:** 2026-09-08  
**Branch:** `cursor/appt-full-parity-build-709b`  
**Scope:** Appointments / scheduling / service-booking product only  
**Excludes:** Missed Call Text Back (`/mctb/*`, `/voice/*` MCTB runtime), Mass SMS campaigns, Smart Routing, Fax, generic CRM (Contacts/Inbox are shared surfaces but listed where appointments use them)

This document lists **every feature surface** present in the repository: admin UI routes, public customer routes, APIs, background jobs, and major runtime libraries. Use it as a take-away checklist of what exists in code.

---

## Table of contents

1. [Product shell & navigation](#1-product-shell--navigation)
2. [Booking types & configuration](#2-booking-types--configuration)
3. [Availability & scheduling engine](#3-availability--scheduling-engine)
4. [Staff, locations & resources](#4-staff-locations--resources)
5. [Public booking (customer-facing)](#5-public-booking-customer-facing)
6. [Appointments operations (staff-facing)](#6-appointments-operations-staff-facing)
7. [Customer self-service & portal](#7-customer-self-service--portal)
8. [Payments & commerce](#8-payments--commerce)
9. [Classes & group booking](#9-classes--group-booking)
10. [Waitlist & recalls](#10-waitlist--recalls)
11. [Reminders & notifications](#11-reminders--notifications)
12. [Workflows & automations](#12-workflows--automations)
13. [AI booking & scheduling assistant](#13-ai-booking--scheduling-assistant)
14. [Video meetings & AI notetaker](#14-video-meetings--ai-notetaker)
15. [Routing, team pages & meeting polls](#15-routing-team-pages--meeting-polls)
16. [Analytics & reporting](#16-analytics--reporting)
17. [Integrations](#17-integrations)
18. [Organization, security & enterprise](#18-organization-security--enterprise)
19. [Client data & CRM-adjacent](#19-client-data--crm-adjacent)
20. [Webhooks & developer](#20-webhooks--developer)
21. [Background jobs & scanners](#21-background-jobs--scanners)
22. [Legacy, vertical & dev-only surfaces](#22-legacy-vertical--dev-only-surfaces)
23. [Appendix A — All admin & public routes](#appendix-a--all-admin--public-routes)
24. [Appendix B — All API routes](#appendix-b--all-api-routes)

---

## 1. Product shell & navigation

| Feature | Route / entry | Notes |
|---------|---------------|-------|
| Appointments Home (Overview) | `/appointments/overview` | KPIs, needs attention, recent activity, global search |
| Appointments primary nav | `buildAppointmentsV1Nav()` | Booking, Calendar, Availability, Contacts*, Messages*, Reminders, Workflows*, Meetings*, Payments*, Analytics*, Integrations*, Settings |
| Mobile bottom nav | `buildAppointmentsMobileNav()` | Home, Calendar, Booking (+ Messages/Contacts when enabled) |
| Progressive disclosure modules | `scheduling-modules.ts` | Flags: workflows, meetings, payments, analytics, integrations, classes, commerce, globalSearch |
| Platform setup wizard | `/appointments/setup` | First-time appointments onboarding |
| Page title resolver | `getAppointmentsPageTitle()` | Shell header titles per route |
| V1 launch nav gating | `v1-launch-nav.ts` | Contacts, Conversations, Analytics visibility |

\*Shared Transovo products reachable from appointments shell.

---

## 2. Booking types & configuration

| Feature | Admin route | API / runtime |
|---------|-------------|---------------|
| Booking types list & editor | `/appointments/types` | `GET/POST /api/appointments/types`, `PATCH /api/appointments/types/[id]` |
| Booking type archetypes (MEETING / SERVICE / CLASS) | Type editor | `bookingTypeKind` on `AppointmentTypeConfig` |
| Multiple duration options per type | Type editor | `durationOptions` on config |
| Visibility (public / unlisted / secret) | Type editor | `visibility` |
| Display order | Type editor | `displayOrder`, bulk reorder |
| Bulk type update | — | `POST /api/appointments/types/bulk` |
| Custom booking questions | Type editor | `bookingQuestions` |
| Group booking / attendee count | Type editor + public | `groupBooking` config |
| Recurring eligibility on type | Type editor | `recurring.enabled`, frequencies, max occurrences |
| Staff assignment modes | Type editor | customer chooses, specific staff, round robin, collective (scheduling-domain) |
| Location assignment | Type editor | `locationIds`, platform locations |
| Payment modes on type | Type editor | free, deposit, full, pay later, PWYW, save card (`payments-extended`) |
| Cancellation policy | Type editor | basic + extended (`extendedCancellationPolicy`) |
| Reschedule policy | Type editor | basic + extended (`extendedReschedulePolicy`) |
| Booking approval required | Type editor | `bookingApproval` → `awaiting_confirmation` |
| Categories on type | Type editor | `categoryId` |
| Images on type | Type editor | `imageUrl` |
| Required resources on type | Type editor | `resourceIds` |
| Add-ons on type | Type editor | `addOnIds` |
| Intake forms on type | Type editor | linked intake form IDs |
| Service phases (multi-phase duration) | Type editor + commerce admin | `service-phases` API |
| Confirmation page customization | Type editor | `confirmationPage` |
| Reminder template overrides | Type-level hooks | workspace reminders primary |
| Booking page settings | `/appointments/booking` | slug, branding, enable/disable public book |
| Share & embed hub | `/appointments/booking/share` | public links, iframe embed code, classes link |
| Single-use booking links | — | `booking-links` API |
| Embed URL & popup script | — | `embedBookingUrl()`, popup script generation |
| Booking approval queue | — | `POST /api/appointments/booking/approval` |
| Scheduler theme / branding | Commerce admin → theme | `scheduler-theme` API |
| Direct booking links per type | — | scheduler-theme `directLinks` |
| Booking source / UTM attribution | Public book | `booking-source.ts`, UTM on book POST |
| Named availability schedules | `/appointments/availability` | assignable schedule templates per type |
| Categories admin (standalone) | `/appointments/categories` | `categories` API |
| Client restrictions | `/appointments/client-restrictions` | block clients from booking |
| Audience segments | `/appointments/segments` | appointment-derived segment presets |

---

## 3. Availability & scheduling engine

| Feature | Admin route | API / runtime |
|---------|-------------|---------------|
| Weekly hours editor | `/appointments/availability` | `weeklyHours` on platform config |
| Timezone | `/appointments/availability`, `/settings/calendar` | workspace timezone |
| Minimum booking notice | `/appointments/availability` | `minimumBookingNoticeMinutes` |
| Maximum booking horizon | `/appointments/availability` | `maximumBookingDaysAhead` |
| Date overrides (custom hours / closed) | `/appointments/availability` | `dateOverrides` |
| Blackout dates | `/appointments/availability` | `blackoutDates` |
| Holiday calendar | `/appointments/availability` | `holidays` |
| Booking limits (per day/week/per type) | `/appointments/availability` | `bookingLimits` |
| Native slot generation | — | `availability-engine.ts` |
| Staff-aware slots | — | `staff-availability.ts` |
| Group / collective scheduling | — | `scheduling-domain.ts` |
| Resource-constrained slots | — | `resource-availability.ts` |
| External calendar busy blocking | — | Google/Microsoft sync |
| Atomic slot booking (anti double-book) | — | `slot-booking.ts` advisory locks |
| Slot validation before book | — | `slot-validation.ts` |
| Slot diagnostics (“why unavailable”) | — | `diagnostics/slots` API, public diagnostics |
| Minimize gaps (compact scheduling) | — | `minimize-gaps.ts` |
| Dynamic pricing by slot | Commerce admin | `dynamic-pricing` API |
| Admin availability query | — | `GET /api/appointments/availability` |

---

## 4. Staff, locations & resources

| Feature | Admin route | API / runtime |
|---------|-------------|---------------|
| Staff scheduling config | `/appointments/staff` | staff records + availability |
| Locations | `/appointments/locations` | platform `locations[]` |
| Resources (rooms, equipment) | `/appointments/resources` | `service-booking/resources` |
| Resource persistence on appointment | — | `persistAppointmentResources` |
| Resource labels on manage link | — | `resourceLabels` in metadata |
| Staff round-robin assignment | — | `scheduling-domain.ts` |
| Scheduling groups | Team pages | `team-scheduling.ts` |
| Per-staff external calendar | Integrations | calendar connections |

---

## 5. Public booking (customer-facing)

| Feature | Public route | API |
|---------|--------------|-----|
| Public booking home | `/book/[slug]` | `GET/POST /api/public/book/[slug]` |
| Deep link to one type | `/book/[slug]/[serviceId]` | `?type=` or serviceId path |
| Embeddable widget | `/embed/book/[slug]` | same API |
| Service / type picker | Public flow | types, categories, images |
| Staff picker (when enabled) | Public flow | eligible staff list |
| Location picker | Public flow | eligible locations |
| Duration picker | Public flow | `durationOptions` |
| Live availability slots | DateTime step | `action: availability` |
| Add another service (multi-service chain) | DateTime step | `multiServiceLines` on book |
| Add to cart (multi-booking session) | DateTime step | `POST .../session` |
| Custom booking questions | Info step | `bookingAnswers` |
| Custom client fields | Info step | `customFieldValues` |
| Intake forms | Info step | `intakeResponses` |
| Add-on selection | Info step | `addOnSelections` |
| Package / gift / membership entitlements | Info step | entitlements lookup + auto-suggest |
| Saved card on file | Info step | `useSavedCard` |
| Wallet balance display | Info step | `walletBalanceCents` on entitlements |
| Wallet apply at checkout | Info step | `walletApplyCents` on book |
| SMS consent disclosure | Info step | `smsConsent` |
| Recurring booking | Info step | `recurring` + preview API |
| Recurring date preview | Info step | `action: preview_recurring` |
| Group attendee count | Info step | `attendeeCount` |
| Email OTP verification | Email verification step | `.../otp` |
| Booking protection / bot checks | Public flow | honeypot, human verification, `booking-protection` |
| Honeypot field | Public flow | `website` field |
| Returning invitee cookie | Public flow | `booking-links` cookie |
| Single-use token links | `?singleUse=` | `singleUseToken` on book |
| Stripe checkout | Payment step | `.../checkout` |
| Square in-page payment | Payment step | `.../payment` |
| Payment success / cancel pages | `/book/payment/success`, `/book/payment/canceled` | — |
| Public waitlist join | Waitlist step | `POST .../waitlist` |
| Public AI booking chat | AI step | `POST .../ai` |
| Public email AI booking | — | `POST .../email-ai` |
| Public store (packages) | `/book/[slug]/store` | `.../store`, checkout, fulfill |
| Public class catalog | `/book/[slug]/classes` | `GET/POST .../classes` |
| PWA registration | Public shell | `public-booking-pwa-register` |
| Reminder diagnostics (support) | `/book/[slug]/reminders` | `.../reminder-diagnostics` |
| Slot diagnostics (support) | — | `.../diagnostics` |

---

## 6. Appointments operations (staff-facing)

| Feature | Admin route | API |
|---------|-------------|-----|
| Appointments list | `/appointments` | `GET /api/appointments` |
| Create appointment (staff) | `/appointments/new` | `POST /api/appointments` |
| Appointment detail | `/appointments/[id]` | `GET/PATCH /api/appointments/[id]` |
| Calendar view | `/appointments/calendar` | `GET /api/calendar/events` |
| Calendar slot-click create | Calendar | → `/appointments/new?startsAt=` |
| Meeting indicators on calendar | Calendar | `meeting-indicators` API |
| Reschedule (staff) | Detail | PATCH `startsAt` |
| Cancel (staff) | Detail | PATCH `status: canceled` |
| Internal notes | Detail | `internal-notes.ts` |
| Reminder suppress / reset | Detail | reminder-state |
| Reminder timeline | Detail | `.../reminder-timeline` |
| Status workflow | Detail | awaiting_confirmation, scheduled, completed, no_show, etc. |
| Multi-service lines on appointment | Detail | `multi-service.ts` |
| Policy snapshot on record | — | `policySnapshot` in metadata |
| Provider sync jobs | — | Google/Outlook calendar sync jobs |

---

## 7. Customer self-service & portal

| Feature | Public route | API |
|---------|--------------|-----|
| Manage appointment link | `/manage/[token]` | `GET/POST /api/public/manage/[token]` |
| Reschedule via manage link | Manage page | `action: reschedule` |
| Cancel via manage link | Manage page | `action: cancel` |
| Recurring series cancel scopes | Manage page | this / future / all |
| Recurring series reschedule scopes | Manage page | this / future / all |
| Pay balance via manage link | Manage page | `action: pay_balance` |
| Edit intake via manage link | Manage page | `action: save_intake` |
| ICS calendar download | Manage page | client-generated `.ics` |
| Book again link | Manage page | → `/book/[slug]` |
| Legacy confirm link | `/appointments/confirm/[token]` | `confirm/[token]` API |
| Legacy cancel link | `/appointments/cancel/[token]` | `cancel/[token]` API |
| Legacy reschedule link | `/appointments/reschedule/[token]` | `reschedule/[token]` API |
| Client portal | `/portal/[token]` | `portal/[token]` API |
| Portal wallet view | Portal | `portal/.../wallet` |
| Portal saved payment methods | Portal | `portal/.../payment-methods` |
| Waitlist offer accept | `/waitlist/accept/[token]` | `waitlist/accept/[token]` |

---

## 8. Payments & commerce

| Feature | Admin route | API |
|---------|-------------|-----|
| Packages & memberships hub | `/appointments/commerce` | packages, memberships, gifts, coupons, programs, payment plans, add-ons, etc. |
| Package products | Commerce admin | `packages` API |
| Package purchase for contact | Commerce admin | purchase action |
| Package balances / credits | — | `PackageBalance`, entitlements at book |
| Membership products | Commerce admin | `memberships` API |
| Membership subscriptions | — | `ServiceMembershipSubscription` |
| Gift certificates | Commerce admin | `gift-certificates` API |
| Coupons / discounts | Commerce admin | `coupons` API |
| Add-ons catalog | Commerce admin | `add-ons` API |
| Programs (multi-visit bundles) | Commerce admin | `programs` API |
| Payment plans (installments) | Commerce admin | `payment-plans` API |
| Client wallet (stored value) | Commerce admin | `client-wallet` API |
| Loyalty programs | Commerce admin | `loyalty` API |
| POS cart | Commerce admin | `pos-cart` API |
| Pay-what-you-want / tipping | Type config | `payments-extended.ts` |
| Stripe Connect checkout | Integrations | `merchant-payments/stripe-connect` |
| Square payment completion | Public book | `.../payment` |
| Saved cards (Stripe) | Entitlements / portal | `merchant-payments/saved-cards` |
| Payment transaction ledger | `/payments/transactions` | merchant payment records |
| Payment settings | `/settings/payments` | merchant connection setup |
| Policy fees (late cancel / no-show) | — | `policy-fees.ts` |
| SMS payment links (shared) | `/messaging/payments` | public payment links |

---

## 9. Classes & group booking

| Feature | Admin route | API |
|---------|-------------|-----|
| Class series admin | `/appointments/classes` | `classes` API |
| Class occurrences scheduling | Classes admin | create occurrences |
| Class enrollment (staff) | Classes admin | enroll action |
| Public class enrollment | `/book/[slug]/classes` | public `classes` API |
| Class check-in | — | `class-check-in` API (QR, token) |
| Seat selection / maps | — | `seat-selection` API |
| Group capacity on standard types | Type + public | `groupBooking`, `checkGroupCapacity` |
| Attendee count on book | Public Info step | `attendeeCount` |

---

## 10. Waitlist & recalls

| Feature | Admin route | API |
|---------|-------------|-----|
| Waitlist admin queue | `/appointments/waitlist` | `GET/PATCH /api/appointments/waitlist` |
| Public waitlist join | Public book | `.../waitlist` |
| Waitlist slot notification | — | `appointment_waitlist_notify` job |
| Waitlist offer + accept | `/waitlist/accept/[token]` | atomic claim in `waitlist.ts` |
| Waitlist auto-fill on cancel | — | `autoFillWaitlistSlot` |
| Waitlist priority rules | Commerce admin | `waitlist-priority` API |
| Recalls hub | `/appointments/recalls` | `recalls/hub` API |
| Recall campaigns | `/appointments/recall-campaigns` | `recall-campaigns` API |
| Appointment segments for recalls | `/appointments/segments` | `appointment-segments` API |
| No-show recovery | `/appointments/no-show-recovery` | `no-show-recovery` API |
| No-show scan job | — | `appointment_no_show_scan` |

---

## 11. Reminders & notifications

| Feature | Admin route | API |
|---------|-------------|-----|
| Reminder sequences | `/appointments/reminders` | workspace reminder templates |
| SMS reminders | Reminders admin | `reminder-delivery.ts`, Telnyx/Twilio |
| Email reminders | Reminders admin | `reminder-engine.ts` |
| ICS attachments | — | `ics-builder.ts` |
| Reminder test send | Reminders admin | `reminders/test` API |
| Email open tracking | — | `reminders/track/open` |
| Email click tracking | — | `reminders/track/click` |
| Per-appointment reminder timeline | Appointment detail | `reminder-timeline` API |
| Voice reminders | `/appointments/voice-reminders` | `voice-reminders` API |
| Voice reminder caller ID | Voice reminders | `voice-reminders/caller-id` |
| Voice reminder retry job | — | `appointment_voice_reminder_retry` |
| Platform reminder scan job | — | `appointments_platform_reminder_scan` |
| SMS consent disclosure text | Public book | `sms-consent-disclosure.ts` |
| Automation templates | `/appointments/automations/templates` | template library |
| Automation activity log | `/appointments/automations/activity` | run history |

---

## 12. Workflows & automations

| Feature | Admin route | API |
|---------|-------------|-----|
| Workflow list | `/appointments/workflows` | `workflows` API |
| Create workflow | `/appointments/workflows/new` | POST workflows |
| Edit workflow | `/appointments/workflows/[id]/edit` | PATCH workflow |
| Workflow from template | `/appointments/workflows/setup/[templateId]` | prebuilt templates |
| Workflow test run | — | `workflows/[id]/test` |
| Workflow preview | — | `workflows/preview` |
| Workflow execution logs | — | `workflows/logs` |
| Unknown SMS reply triage | — | `workflows/unknown-replies` |
| Time-based workflow triggers | — | `workflow-scanners.ts` |
| Before/after appointment triggers | — | `appointment_workflow_time_scan` job |
| Workflow step execution | — | `appointment-workflows/engine.ts` |
| Prebuilt workflow templates | — | `appointment-workflows/templates.ts` |

---

## 13. AI booking & scheduling assistant

| Feature | Admin route | API |
|---------|-------------|-----|
| AI booking settings | `/appointments/ai-booking` | channels config |
| Staff-initiated AI book | AI booking admin | `POST /api/appointments/ai-booking` |
| AI channels (SMS, email) | — | `ai-booking/channels` |
| Public AI chat booking | Public book AI step | `.../ai` |
| Public email AI handler | — | `.../email-ai` |
| Natural language understand | — | `ai-scheduling/understand.ts` |
| Intent parsing + verification | — | intent-parser, verify-action |
| Multi-turn conversation state | — | `conversation-state.ts` |
| Book / reschedule / cancel via AI | — | `execute.ts` |
| AI booking protection (risk) | — | `booking-protection.ts` |
| AI observability / logging | — | `observability.ts` |
| Caller Amy / appointment assistant setup | `/solutions/.../appointment-assistant/setup` | voice agent vertical |
| Hire Amy entry | `/hire/amy` | redirects to setup |

---

## 14. Video meetings & AI notetaker

| Feature | Admin route | API |
|---------|-------------|-----|
| Upcoming meetings | `/video` | video rooms list |
| Host video for appointment | `/appointments/[id]/video/host` | `.../video`, `.../video/join` |
| Standalone video room host | `/video/rooms/[id]/host` | — |
| Public video join | `/video/[token]` | guest join |
| Meeting recaps list | `/meetings` | notetaker sessions |
| Meeting recap detail | `/meetings/[id]` | recap content |
| Public shared recap | `/recap/[token]` | share link |
| Transovo Video settings | `/settings/transovo-video` | video product config |
| AI Notetaker settings | `/settings/ai-notetaker` | notetaker config |
| Teams meeting auto-create | — | `calendar/teams-meeting.ts` on book |
| Meeting indicators on calendar | Calendar | video + notetaker badges |

---

## 15. Routing, team pages & meeting polls

| Feature | Admin route | API |
|---------|-------------|-----|
| Routing forms builder | `/appointments/routing-forms` | `routing-forms` API |
| Routing rules editor (legacy) | `/appointments/routing` | Kimi-connected |
| Routing form presets | — | `routing-forms-presets.ts` |
| Public routing form | `/routing/[slug]/[formSlug]` | `public/routing/[slug]` |
| Team booking pages | `/appointments/team-pages` | `team-pages` API |
| Public team booking page | `/team/[slug]/[pageSlug]` | `public/team-book/...` |
| Meeting polls | `/appointments/polls` | `meeting-polls` API |
| Poll voting & option selection | — | poll vote actions |

---

## 16. Analytics & reporting

| Feature | Admin route | API |
|---------|-------------|-----|
| Analytics overview | `/appointments/analytics` | `analytics` API |
| Booking analytics | `/appointments/analytics/booking` | funnel metrics |
| Reminder analytics | `/appointments/analytics/reminders` | delivery stats |
| Automation analytics | `/appointments/analytics/automations` | workflow stats |
| Reports hub | `/appointments/analytics/reports` | custom reports |
| Service booking reports | `/appointments/reports/service-booking` | Acuity-style reports |
| CSV / PDF export | — | `analytics/export` |
| Scheduled email reports | — | `appointments_scheduled_report` job |
| Global search (overview) | Overview header | `service-booking/global-search` |
| Overview dashboard data | `/appointments/overview` | `overview` API |

---

## 17. Integrations

| Feature | Admin route | API |
|---------|-------------|-----|
| Calendar integrations (Google, Microsoft, Calendly) | `/integrations/calendars` | calendar connection models |
| Payment integrations (Stripe, Square) | `/integrations/payments` | merchant connections |
| Native appointments integration hub | `/integrations/native/appointments` | — |
| Integration status diagnostics | — | `integrations/status` API |
| External calendar busy time | — | sync + busy blocking |
| Provider appointment sync | — | `voice_appointment_provider_sync` job |
| Calendly event mapping (realtor) | `/realtor/appointments/types` | vertical mapping |

---

## 18. Organization, security & enterprise

| Feature | Admin route | API |
|---------|-------------|-----|
| Granular appointment permissions | Settings / org | `org-permissions.ts` |
| Per-type access control | — | event-type RBAC filters |
| Org roles API | — | `GET/POST /api/appointments/org` |
| SAML SSO | — | org API |
| SCIM provisioning | — | org API |
| Enterprise scheduling (legacy) | `/appointments/enterprise` | hidden surface |
| Audit / timeline on appointment | Detail | metadata `timeline[]` |

---

## 19. Client data & CRM-adjacent

| Feature | Admin route | API |
|---------|-------------|-----|
| Contacts (shared) | `/contacts` | used for appointment customers |
| Conversations / Inbox (shared) | `/conversations` | SMS threads from bookings |
| Household / family accounts | Commerce admin | `households` API |
| Contact merge | Commerce admin | `contact-merge` API |
| Custom client fields | Commerce admin | `custom-fields` API |
| Intake form templates | Commerce admin | `intake-forms` API |
| Intake responses on appointment | — | stored per appointment/contact |
| Treatment records | Commerce admin | `treatment-records` API (vertical-adjacent) |
| Import / export clients & appointments | Commerce admin | `import-export` API |
| CSV rollback | — | import rollback action |

---

## 20. Webhooks & developer

| Feature | Admin route | API |
|---------|-------------|-----|
| Outbound webhook endpoints | Commerce admin | `webhooks` API |
| Webhook signing | — | HMAC signatures |
| Webhook delivery queue | — | `webhook-delivery.ts`, jobs |
| Webhook delivery sweep | — | `appointment_webhook_sweep` job |
| Slot diagnostics API | — | admin + public |
| Reminder diagnostics API | — | public support |

---

## 21. Background jobs & scanners

| Job type | Purpose |
|----------|---------|
| `appointment_workflow_step` | Execute workflow step actions |
| `appointment_webhook_deliver` | Deliver outbound webhook |
| `appointment_webhook_sweep` | Retry failed webhooks |
| `appointment_waitlist_notify` | SMS waitlist slot available |
| `appointment_voice_reminder_retry` | Retry failed voice reminder |
| `voice_appointment_provider_sync` | Sync appointment to external calendar |
| `voice_appointment_provider_cancel` | Cancel on external calendar |
| `voice_appointment_provider_reschedule` | Reschedule on external calendar |
| `appointment_starting_soon_scan` | Integration reminder triggers |
| `appointment_completed_scan` | Post-appointment integration triggers |
| `appointment_workflow_time_scan` | Time-based workflow scanner |
| `appointment_workflow_time_trigger` | Fire before/after appointment workflow |
| `appointment_no_show_scan` | Detect no-shows |
| `appointments_scheduled_report` | Email scheduled analytics report |
| `appointments_platform_reminder_scan` | Scan and send due reminders |

---

## 22. Legacy, vertical & dev-only surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Realtor appointments list | `/realtor/appointments` | Vertical voiceAppointment view |
| Realtor Calendly type mapping | `/realtor/appointments/types` | Amy / Calendly |
| Realtor onboarding | `/realtor/onboarding` | includes appointment mapping |
| Appointment assistant marketing | `/solutions/ai-call-handling/appointment-assistant` | solution page |
| Legacy routing page | `/appointments/routing` | parallel to routing-forms |
| Legacy voice reminders nav | `/appointments/voice-reminders` | hidden from primary nav |
| Enterprise page | `/appointments/enterprise` | hidden |
| Integrations redirect | `/appointments/integrations` | → `/integrations/calendars` |
| Dev appointment wizard | `/dev/appointment-wizard` | dev only |
| Mock payment page | `/messaging/payments/mock/[linkId]` | dev/demo |

---

## Appendix A — All admin & public routes

### Authenticated `/appointments/*` (44)

`/appointments/overview` · `/appointments/calendar` · `/appointments` · `/appointments/new` · `/appointments/[id]` · `/appointments/[id]/video/host` · `/appointments/types` · `/appointments/booking` · `/appointments/booking/share` · `/appointments/segments` · `/appointments/routing-forms` · `/appointments/routing` · `/appointments/team-pages` · `/appointments/polls` · `/appointments/ai-booking` · `/appointments/availability` · `/appointments/resources` · `/appointments/locations` · `/appointments/staff` · `/appointments/waitlist` · `/appointments/recalls` · `/appointments/recall-campaigns` · `/appointments/no-show-recovery` · `/appointments/commerce` · `/appointments/classes` · `/appointments/categories` · `/appointments/client-restrictions` · `/appointments/reports/service-booking` · `/appointments/reminders` · `/appointments/voice-reminders` · `/appointments/automations/templates` · `/appointments/automations/activity` · `/appointments/workflows` · `/appointments/workflows/new` · `/appointments/workflows/[id]/edit` · `/appointments/workflows/setup/[templateId]` · `/appointments/analytics` · `/appointments/analytics/booking` · `/appointments/analytics/reminders` · `/appointments/analytics/automations` · `/appointments/analytics/reports` · `/appointments/setup` · `/appointments/enterprise` · `/appointments/integrations` (redirect)

### Public booking (8)

`/book/[slug]` · `/book/[slug]/[serviceId]` · `/book/[slug]/classes` · `/book/[slug]/store` · `/book/[slug]/reminders` · `/book/payment/success` · `/book/payment/canceled` · `/embed/book/[slug]`

### Public self-service (6)

`/manage/[token]` · `/portal/[token]` · `/appointments/confirm/[token]` · `/appointments/cancel/[token]` · `/appointments/reschedule/[token]` · `/waitlist/accept/[token]`

### Public routing & team (2)

`/routing/[slug]/[formSlug]` · `/team/[slug]/[pageSlug]`

### Video & meetings (6)

`/video` · `/video/rooms/[id]/host` · `/video/[token]` · `/meetings` · `/meetings/[id]` · `/recap/[token]`

### Settings & integrations (9)

`/settings/calendar` · `/settings/payments` · `/settings/ai-notetaker` · `/settings/transovo-video` · `/integrations/calendars` · `/integrations/payments` · `/integrations/native/appointments` · `/payments` (redirect) · `/payments/transactions`

### Onboarding & solutions (5)

`/appointments/setup` · `/solutions/ai-call-handling/appointment-assistant` · `/solutions/ai-call-handling/appointment-assistant/setup` · `/hire/amy` · `/realtor/onboarding`

### Vertical & dev (5)

`/realtor/appointments` · `/realtor/appointments/types` · `/dev/appointment-wizard` · `/messaging/payments` · `/messaging/payments/mock/[linkId]`

---

## Appendix B — All API routes

### `/api/appointments/*` (70)

`/api/appointments` · `/api/appointments/[id]` · `/api/appointments/overview` · `/api/appointments/settings` · `/api/appointments/availability` · `/api/appointments/types` · `/api/appointments/types/[id]` · `/api/appointments/types/bulk` · `/api/appointments/analytics` · `/api/appointments/analytics/export` · `/api/appointments/reminders/test` · `/api/appointments/reminders/track/open` · `/api/appointments/reminders/track/click` · `/api/appointments/[id]/reminder-timeline` · `/api/appointments/voice-reminders` · `/api/appointments/voice-reminders/caller-id` · `/api/appointments/booking-links` · `/api/appointments/booking/approval` · `/api/appointments/waitlist` · `/api/appointments/routing-forms` · `/api/appointments/team-pages` · `/api/appointments/meeting-polls` · `/api/appointments/recalls/hub` · `/api/appointments/recall-campaigns` · `/api/appointments/no-show-recovery` · `/api/appointments/ai-booking` · `/api/appointments/ai-booking/channels` · `/api/appointments/workflows` · `/api/appointments/workflows/[id]` · `/api/appointments/workflows/[id]/test` · `/api/appointments/workflows/preview` · `/api/appointments/workflows/logs` · `/api/appointments/workflows/unknown-replies` · `/api/appointments/[id]/meetings` · `/api/appointments/[id]/video` · `/api/appointments/[id]/video/join` · `/api/appointments/meeting-indicators` · `/api/appointments/org` · `/api/appointments/diagnostics/slots` · `/api/appointments/integrations/status`

### `/api/appointments/service-booking/*` (30)

`add-ons` · `appointment-segments` · `categories` · `classes` · `class-check-in` · `client-restrictions` · `client-wallet` · `contact-merge` · `coupons` · `custom-fields` · `dynamic-pricing` · `gift-certificates` · `global-search` · `households` · `import-export` · `intake-forms` · `loyalty` · `memberships` · `packages` · `payment-plans` · `pos-cart` · `programs` · `reports` · `resources` · `scheduler-theme` · `seat-selection` · `service-phases` · `treatment-records` · `waitlist-priority` · `webhooks`

### `/api/calendar/*`

`/api/calendar/events`

### `/api/public/*` (appointment-related)

`/api/public/book/[slug]` · `/api/public/book/[slug]/session` · `/api/public/book/[slug]/classes` · `/api/public/book/[slug]/checkout` · `/api/public/book/[slug]/payment` · `/api/public/book/[slug]/waitlist` · `/api/public/book/[slug]/otp` · `/api/public/book/[slug]/ai` · `/api/public/book/[slug]/email-ai` · `/api/public/book/[slug]/diagnostics` · `/api/public/book/[slug]/reminder-diagnostics` · `/api/public/book/[slug]/store` · `/api/public/book/[slug]/store/checkout` · `/api/public/book/[slug]/store/fulfill` · `/api/public/appointments/confirm/[token]` · `/api/public/appointments/cancel/[token]` · `/api/public/appointments/reschedule/[token]` · `/api/public/manage/[token]` · `/api/public/appointment-payment/status` · `/api/public/waitlist/accept/[token]` · `/api/public/portal/[token]` · `/api/public/portal/[token]/wallet` · `/api/public/portal/[token]/payment-methods` · `/api/public/routing/[slug]` · `/api/public/team-book/[workspaceSlug]/[pageSlug]` · `/api/public/payments/[linkId]` · `/api/public/payments/[linkId]/pay` · `/api/public/forms/[slug]`

---

## Related documents

| Document | Purpose |
|----------|---------|
| `docs/GENERAL-APPOINTMENT-PARITY-AUDIT.md` | Competitive gap audit (COMPLETE/PARTIAL/MISSING) |
| `docs/GENERAL-APPOINTMENT-PARITY-MATRIX.md` | Phase 1–17 implementation status |
| `docs/GENERAL-APPOINTMENT-GAP-CLOSURE-DIRECTIVE.md` | Build order and scope rules |
| `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md` | Service-booking governing spec |

---

*End of inventory. This list reflects repository contents as of the generation date; hidden or module-gated features still exist in code even when not shown in default nav.*
