# Unified Appointments — frontend migration matrix

**Doctrine:** Full New UI2 Opus frontend replacement. Legacy Scheduling/Kimi visuals must not render in unified nav destinations. Backends, hooks, and API clients may be reused.

Regenerate: `npx tsx scripts/generate-unified-frontend-migration-matrix.ts`

| Nav section | Label | Route | Migration status | Legacy frontend | Opus replacement | Notes |
|---|---|---|---|---|---|---|
| Calendar | Calendar | `/appointment-reminders` | Opus partial | calendar-connected.tsx + kimi reference.css | ar-calendar-workspace-page.tsx (Opus calendar; native sheets migrated) | Imported events use AppointmentDetailDrawer; native uses ArNativeAppointmentSheet |
| Appointments | Appointments | `/appointment-reminders/appointments` | Opus partial | appointments list + kimi detail | appointments-page.tsx + appointment-detail-drawer.tsx | Booking tab uses ArAppointmentSchedulingPanel; quick create Opus |
| Appointments | Scheduled list | `/appointments/scheduled` | Opus complete | Scheduling/Kimi list | appointments-scheduled-list-opus.tsx |  |
| Appointments | New appointment | `/appointments/new` | Opus complete | Kimi create | ar-appointment-create-opus.tsx |  |
| Booking | Booking | `/appointment-reminders/booking` | Opus partial | booking-settings-client + link hub | booking-page-opus.tsx | Meetings/services Opus; other admin routes still legacy |
| Booking | Services | `/appointment-reminders/booking/services` | Opus partial | services workspace kimi | AR booking services Opus routes |  |
| Booking | Meetings | `/appointment-reminders/booking/meetings` | Opus complete | MeetingsWorkspaceConnected | ar-meetings-workspace-opus.tsx |  |
| Booking | Classes | `/appointments/classes` | Opus complete | ClassesWorkspaceConnected | ar-classes-workspace-opus.tsx |  |
| Booking | Workshops | `/appointments/workshops` | Opus complete | WorkshopsWorkspaceConnected | ar-workshops-workspace-opus.tsx |  |
| Booking | Booking pages admin | `/appointments/booking` | Opus partial | AppointmentBookingSettingsClient | BookingSettingsGate |  |
| Booking | Share & embed | `/appointments/booking/share` | Opus partial | BookingShareHubClient | BookingShareOpus |  |
| Booking | Branding | `/appointments/booking/branding` | Opus partial | ServiceBookingAdminClient | ServiceBookingAdminOpus |  |
| Booking | Forms | `/appointments/booking/forms` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Contracts | `/appointments/booking/contracts` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Team booking | `/appointments/team-booking` | Opus complete | TeamBookingWorkspaceConnected | team-booking-opus.tsx |  |
| Booking | Team pages | `/appointments/team-pages` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Routing forms | `/appointments/routing-forms` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Booking | Meeting polls | `/appointments/meeting-polls` | Opus partial | MeetingPollsLibraryConnected | MeetingPollsOpus |  |
| Booking | AI booking | `/appointments/ai-booking` | Opus partial | AiBookingAdminClient | AiBookingOpus |  |
| Availability | Availability | `/appointments/availability` | Opus partial | AvailabilityConnected | availability-workspace-opus.tsx |  |
| Availability | Staff | `/appointments/staff` | Opus complete | StaffConnected | staff-directory-opus.tsx |  |
| Availability | Locations | `/appointments/locations` | Opus complete | LocationsConnected | locations-directory-opus.tsx |  |
| Availability | Resources | `/appointments/resources` | Opus complete | ResourcesConnected | resources-directory-opus.tsx |  |
| Availability | Routing rules | `/appointments/routing` | Opus partial | RoutingConnected | routing-workspace-opus.tsx |  |
| Availability | Restrictions | `/appointments/restrictions` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Availability | Client restrictions | `/appointments/client-restrictions` | Opus partial | ServiceBookingAdminClient | ServiceBookingAdminOpus |  |
| Clients | Clients | `/appointments/clients` | Opus complete | ClientsConnected | clients-directory-opus.tsx |  |
| Clients | Segments | `/appointments/segments` | Opus partial | AppointmentSegmentsClient | SegmentsOpus + SchedulingOpusBody |  |
| Clients | Contact merge | `/appointments/commerce/contact-merge` | Opus partial | inline page | contact-merge-opus.tsx |  |
| Messages & Responses | Messages & Responses | `/conversations` | Shared platform (Opus migration TBD) | kimi-inbox | kimi-conversations-connected (Mass Texting shell — migrate to Opus inbox) |  |
| Messages & Responses | Appointment replies | `/appointment-reminders/responses` | Opus complete | — | ar-responses-opus.tsx |  |
| Reminders | Reminders | `/appointment-reminders/reminders` | Opus complete | — | reminders-page.tsx |  |
| Reminders | Sequences | `/appointment-reminders/reminders/sequences` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Reminders | Templates | `/appointment-reminders/reminders/templates` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Workflows & Automation | Workflows & Automation | `/appointments/workflows` | Opus complete | WorkflowsListClient | workflows-list-opus.tsx |  |
| Workflows & Automation | Automation activity | `/appointments/automations/activity` | Opus partial | AutomationsActivityClient | AutomationsActivityOpus |  |
| Workflows & Automation | Automation templates | `/appointments/automations/templates` | Opus partial | AutomationsTemplatesClient | AutomationsTemplatesOpus |  |
| Workflows & Automation | Voice reminders | `/appointments/voice-reminders` | Opus partial | VoiceRemindersClient | VoiceRemindersOpus |  |
| AI Rescheduler | AI Rescheduler | `/appointment-reminders/ai-rescheduler` | Opus complete | — | ar-ai-rescheduler-opus.tsx |  |
| Commerce | Commerce | `/appointments/commerce` | Opus partial | redirect only | ServiceBookingHubGate / CommerceHubOpus |  |
| Commerce | Packages | `/appointments/packages` | Opus partial | PackagesCatalogConnected | packages-catalog-opus.tsx |  |
| Commerce | Memberships | `/appointments/memberships` | Opus partial | MembershipsCatalogConnected | memberships-catalog-opus.tsx |  |
| Commerce | Pricing & payments | `/appointments/pricing-payments` | Opus partial | PricingPaymentsClient | PricingPaymentsOpus |  |
| Commerce | Categories | `/appointments/categories` | Opus partial | ServiceBookingAdminClient | ServiceBookingAdminOpus |  |
| Commerce | Coupons | `/appointments/coupons` | Opus partial | ServiceBookingAdminClient | ServiceBookingAdminOpus |  |
| Commerce | Point of sale | `/appointments/point-of-sale` | Opus partial | PointOfSaleConnected | PointOfSaleOpus |  |
| Commerce | Payment requests | `/payments` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Transactions | `/payments/transactions` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Invoices | `/payments/invoices` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Commerce | Waitlist | `/appointments/waitlist` | Opus complete | WaitlistAdminClient | waitlist-admin-opus.tsx |  |
| Commerce | Recalls | `/appointments/recalls` | Opus partial | RecallsHubClient | RecallsOpus |  |
| Commerce | Recall campaigns | `/appointments/recall-campaigns` | Opus partial | RecallCampaignsClient | RecallCampaignsOpus |  |
| Commerce | No-show recovery | `/appointments/no-show-recovery` | Opus partial | NoShowRecoveryClient | NoShowRecoveryOpus |  |
| Analytics & Reports | Analytics & Reports | `/appointment-reminders/analytics` | Legacy Kimi (must replace) | Scheduling/Kimi connected shell | — (not started) |  |
| Analytics & Reports | Scheduling overview | `/appointments/analytics` | Opus partial | AppointmentsAnalyticsShell | appointments-analytics-opus-shell.tsx |  |
| Analytics & Reports | Booking | `/appointments/analytics/booking` | Opus partial | AppointmentsAnalyticsShell | appointments-analytics-opus-shell.tsx |  |
| Analytics & Reports | Reminder analytics | `/appointments/analytics/reminders` | Opus partial | AppointmentsAnalyticsShell | appointments-analytics-opus-shell.tsx |  |
| Analytics & Reports | Automations | `/appointments/analytics/automations` | Opus partial | AppointmentsAnalyticsShell | appointments-analytics-opus-shell.tsx |  |
| Analytics & Reports | Reports | `/appointments/analytics/reports` | Opus partial | AppointmentsAnalyticsShell | appointments-analytics-opus-shell.tsx |  |
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
| Settings | Get started | `/appointments/setup` | Opus partial | AppointmentsSetupClient | SetupOpus |  |
| Settings | Policies | `/appointments/policies` | Opus partial | AppointmentsPoliciesClient | PoliciesOpus |  |
| Settings | Forms & documents | `/appointments/forms-documents` | Opus partial | FormsDocumentsClient | FormsDocumentsOpus |  |
| Settings | Enterprise | `/appointments/enterprise` | Opus partial | EnterpriseSchedulingClient | EnterpriseOpus |  |
| Settings | Service booking admin | `/appointments/service-booking` | Opus partial | ServiceBookingAdminClient | CommerceHubOpus / ServiceBookingAdminOpus |  |
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
