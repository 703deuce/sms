# Unified Appointments — frontend migration matrix

**Doctrine:** Full New UI2 Opus frontend replacement. Legacy Scheduling/Kimi visuals must not render in unified nav destinations. Backends, hooks, and API clients may be reused.

Regenerate: `npx tsx scripts/generate-unified-frontend-migration-matrix.ts`

| Nav section | Label | Route | Migration status | Legacy frontend | Opus replacement | Notes |
|---|---|---|---|---|---|---|
| Calendar | Calendar | `/appointment-reminders` | Opus partial | calendar-connected.tsx + kimi reference.css | ar-calendar-workspace-page.tsx (Opus calendar; native sheets migrated) | Imported events use AppointmentDetailDrawer; native uses ArNativeAppointmentSheet |
| Appointments | Appointments | `/appointment-reminders/appointments` | Opus partial | appointments list + kimi detail | appointments-page.tsx + appointment-detail-drawer.tsx | Booking tab uses ArAppointmentSchedulingPanel; quick create Opus |
| Appointments | Scheduled list | `/appointments/scheduled` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Appointments | New appointment | `/appointments/new` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Booking | `/appointment-reminders/booking` | Opus partial | booking-settings-client + link hub | booking-page-opus.tsx | Meetings/services Opus; other admin routes still legacy |
| Booking | Services | `/appointment-reminders/booking/services` | Opus partial | services workspace kimi | AR booking services Opus routes |  |
| Booking | Meetings | `/appointment-reminders/booking/meetings` | Opus complete | MeetingsWorkspaceConnected | ar-meetings-workspace-opus.tsx |  |
| Booking | Classes | `/appointments/classes` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Workshops | `/appointments/workshops` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Booking pages admin | `/appointments/booking` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Share & embed | `/appointments/booking/share` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Branding | `/appointments/booking/branding` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Forms | `/appointments/booking/forms` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Contracts | `/appointments/booking/contracts` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Team booking | `/appointments/team-booking` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Team pages | `/appointments/team-pages` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Routing forms | `/appointments/routing-forms` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Meeting polls | `/appointments/meeting-polls` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | AI booking | `/appointments/ai-booking` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Availability | Availability | `/appointments/availability` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Availability | Staff | `/appointments/staff` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Availability | Locations | `/appointments/locations` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Availability | Resources | `/appointments/resources` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Availability | Routing rules | `/appointments/routing` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Availability | Restrictions | `/appointments/restrictions` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Availability | Client restrictions | `/appointments/client-restrictions` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Clients | Clients | `/appointments/clients` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Clients | Segments | `/appointments/segments` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Clients | Contact merge | `/appointments/commerce/contact-merge` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Messages & Responses | Messages & Responses | `/conversations` | Shared platform (Opus migration TBD) | kimi-inbox | kimi-conversations-connected (Mass Texting shell — migrate to Opus inbox) |  |
| Messages & Responses | Appointment replies | `/appointment-reminders/responses` | Opus complete | — | ar-responses-opus.tsx |  |
| Reminders | Reminders | `/appointment-reminders/reminders` | Opus complete | — | reminders-page.tsx |  |
| Reminders | Sequences | `/appointment-reminders/reminders/sequences` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Reminders | Templates | `/appointment-reminders/reminders/templates` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Workflows & Automation | Workflows & Automation | `/appointments/workflows` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Workflows & Automation | Automation activity | `/appointments/automations/activity` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Workflows & Automation | Automation templates | `/appointments/automations/templates` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Workflows & Automation | Voice reminders | `/appointments/voice-reminders` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| AI Rescheduler | AI Rescheduler | `/appointment-reminders/ai-rescheduler` | Opus complete | — | ar-ai-rescheduler-opus.tsx |  |
| Commerce | Commerce | `/appointments/commerce` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Packages | `/appointments/packages` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Memberships | `/appointments/memberships` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Pricing & payments | `/appointments/pricing-payments` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Categories | `/appointments/categories` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Coupons | `/appointments/coupons` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Point of sale | `/appointments/point-of-sale` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Payment requests | `/payments` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Transactions | `/payments/transactions` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Invoices | `/payments/invoices` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Waitlist | `/appointments/waitlist` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Recalls | `/appointments/recalls` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Recall campaigns | `/appointments/recall-campaigns` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | No-show recovery | `/appointments/no-show-recovery` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Analytics & Reports | Analytics & Reports | `/appointment-reminders/analytics` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Analytics & Reports | Scheduling overview | `/appointments/analytics` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Analytics & Reports | Booking | `/appointments/analytics/booking` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Analytics & Reports | Reminder analytics | `/appointments/analytics/reminders` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Analytics & Reports | Automations | `/appointments/analytics/automations` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Analytics & Reports | Reports | `/appointments/analytics/reports` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Analytics & Reports | Service booking | `/appointments/reports/service-booking` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Integrations | Integrations | `/appointment-reminders/settings?tab=integrations` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Integrations | Integrations directory | `/integrations?provider=calendar` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Integrations | Calendars hub | `/integrations/calendars` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Integrations | Payments hub | `/integrations?provider=stripe` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Settings | `/appointment-reminders/settings?tab=scheduling` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Business profile | `/appointment-reminders/settings?tab=business` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Notifications & responses | `/appointment-reminders/settings?tab=notifications` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Plan & billing | `/appointment-reminders/settings?tab=billing` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Global business | `/settings/business` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Team | `/settings/users` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Messaging | `/settings/messaging` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Calendar settings | `/settings/calendar` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Security | `/settings/security` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Get started | `/appointments/setup` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Policies | `/appointments/policies` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Forms & documents | `/appointments/forms-documents` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Enterprise | `/appointments/enterprise` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Settings | Service booking admin | `/appointments/service-booking` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Help | Help | `/getting-started` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |

## Calendar Opus components (unified mode)

| Capability | Legacy component | Opus component | Status |
|---|---|---|---|
| Quick create | CalendarQuickCreateSheet + reference.css | ArCalendarQuickCreateSheet | Done |
| Native detail / manage | CalendarEventDrawer | ArNativeAppointmentSheet | Done (core actions) |
| Reschedule | CalendarRescheduleSheet | ArCalendarRescheduleSheet | Done |
| Waitlist match | CalendarWaitlistMatchDrawer | ArCalendarWaitlistSheet | Done |
| Recurring scope | CalendarRecurringScopeDialog | ArCalendarRecurringScopeDialog | Done |
| Filters | CalendarFilterBar | ArCalendarFilterBar | Done |
| Imported detail | — | AppointmentDetailDrawer / ArCalendarEventSheet | Partial |

## Release gate (PR #653)

- [ ] Every row `legacy_kimi` → `opus_complete` or intentional redirect
- [ ] No `kimi-ui` / `cal-drawer` imports under `newui-transplant` unified paths
- [ ] `npm run build` green on CI
- [ ] Browser pass on all 13 nav sections
