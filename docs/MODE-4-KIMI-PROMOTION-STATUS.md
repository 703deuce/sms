# Mode 4 Kimi UI Promotion Status

**Updated:** 2026-09-07  
**Branch:** `cursor/workflows-kimi-promotion-416b`

All 58 manifest surfaces are classified below. Production routes use Kimi UI shells with existing backend wiring preserved via `*-connected.tsx` adapters.

## Summary

| Status | Count |
|--------|-------|
| KIMI_PROMOTED | 50 |
| ALREADY_KIMI | 8 |
| BLOCKED | 0 |

## KIMI_PROMOTED (50)

| ID | Route | Production entry |
|----|-------|------------------|
| `home` | `/appointments/overview` | `overview-client.tsx` → `OverviewConnected` |
| `appointments-calendar` | `/appointments/calendar` | `calendar-client.tsx` → `CalendarConnected` |
| `appointments-list` | `/appointments` | `list-client.tsx` → `ListConnected` |
| `appointment-detail` | `/appointments/[id]` | `detail-client.tsx` → Kimi `AppointmentDetail` |
| `appointments-waitlist` | `/appointments/waitlist` | `waitlist-admin-client.tsx` |
| `appointments-recalls` | `/appointments/recalls` | `recalls-hub-client.tsx` → `RecallsHubConnected` + `GET /api/appointments/recalls/hub` |
| `appointments-recall-campaigns` | `/appointments/recall-campaigns` | `recall-campaigns-client.tsx` |
| `appointments-no-show-recovery` | `/appointments/no-show-recovery` | `no-show-recovery-client.tsx` |
| `appointments-new` | `/appointments/new` | `form-client.tsx` |
| `appointments-setup` | `/appointments/setup` | `setup-client.tsx` |
| `booking-types` | `/appointments/types` | `types-client.tsx` |
| `booking-pages` | `/appointments/booking` | `booking-settings-client.tsx` |
| `availability` | `/appointments/availability` | `availability-client.tsx` |
| `ai-booking` | `/appointments/ai-booking` | `ai-booking-admin-client.tsx` |
| `routing-forms` | `/appointments/routing-forms` | `routing-forms-client.tsx` |
| `meeting-polls` | `/appointments/polls` | `meeting-polls-client.tsx` |
| `team-pages` | `/appointments/team-pages` | `team-pages-client.tsx` |
| `reminder-sequences` | `/appointments/reminders` | `reminders-client.tsx` |
| `workflow-builder` | `/appointments/workflows` | `workflows-list-client.tsx` |
| `workflow-new` | `/appointments/workflows/new` | `workflows-client.tsx` → `AppointmentWorkflowEditor` |
| `workflow-edit` | `/appointments/workflows/[id]/edit` | `workflows-client.tsx` |
| `workflow-setup` | `/appointments/workflows/setup/[templateId]` | `workflows-client.tsx` → `SetupWizard` |
| `automation-templates` | `/appointments/automations/templates` | `automations-templates-client.tsx` |
| `automation-activity` | `/appointments/automations/activity` | `automations-activity-client.tsx` |
| `contact-detail` | `/contacts/[id]` | `ContactDetailConnected` on page |
| `messages-saved-replies` | `/conversations/saved-replies` | `saved-replies-connected` on page |
| `meetings-upcoming` | `/video` | `notetaker-home-client.tsx` |
| `meetings-recaps` | `/meetings` | `meetings-list-client.tsx` |
| `meeting-detail` | `/meetings/[id]` | `meeting-detail-client.tsx` |
| `payments-transactions` | `/payments/transactions` | `transactions-client.tsx` |
| `analytics-overview` | `/appointments/analytics` | `analytics-shell.tsx` |
| `analytics-booking` | `/appointments/analytics/booking` | `analytics-shell.tsx` |
| `analytics-reminders` | `/appointments/analytics/reminders` | `analytics-shell.tsx` |
| `analytics-automations` | `/appointments/analytics/automations` | `analytics-shell.tsx` |
| `analytics-reports` | `/appointments/analytics/reports` | `analytics-shell.tsx` |
| `integrations-calendars` | `/integrations/calendars` | `calendars-connected` on page |
| `integrations-payments` | `/integrations/payments` | `payments-connected` on page |
| `settings-business` | `/settings/business` | `BusinessSettingsConnected` on page |
| `settings-users` | `/settings/users` | `users-connected` on page |
| `settings-messaging` | `/settings/messaging` | `messaging-connected` on page |
| `settings-calendar` | `/settings/calendar` | `calendar-connected` on page |
| `settings-meetings` | `/settings/ai-notetaker` | `ai-notetaker-connected` on page |
| `settings-security` | `/settings/security` | `security-connected` on page |
| `settings-billing` | `/settings/billing` | `billing-connected` on page |
| `help-getting-started` | `/getting-started` | `GettingStartedConnected` on page |
| `public-booking` | `/book/[slug]` | `PublicBookingConnected` on page |
| `public-booking-service` | `/book/[slug]/[serviceId]` | `PublicBookingServiceConnected` |
| `public-embed-booking` | `/embed/book/[slug]` | `PublicEmbedBookingConnected` |
| `public-confirm` | `/appointments/confirm/[token]` | `PublicConfirmConnected` |
| `public-cancel` | `/appointments/cancel/[token]` | `PublicCancelConnected` |
| `public-reschedule` | `/appointments/reschedule/[token]` | `PublicRescheduleConnected` |
| `public-waitlist-accept` | `/waitlist/accept/[token]` | `PublicWaitlistAcceptConnected` |

## ALREADY_KIMI (8)

| ID | Route | Notes |
|----|-------|-------|
| `foundation-shell` | Shared shell | `TransovoSidebar` / `app-shell.tsx` |
| `contacts` | `/contacts` | `KimiContactsConnected` |
| `contacts-lists` | `/contacts/lists` | `KimiListsConnected` |
| `contacts-segments` | `/contacts/segments` | `KimiSegmentsConnected` |
| `contacts-fields` | `/contacts/fields` | `KimiFieldsConnected` |
| `contacts-imports` | `/contacts/imports` | `KimiContactsConnected` import view |
| `messages-inbox` | `/conversations` | `KimiConversationsConnected` |

## BLOCKED (0)

None. Recalls Hub “Recent recall activity” is backed by `GET /api/appointments/recalls/hub`, aggregating workflow step executions (no-show recovery / re-engagement templates) and recall campaign run metadata.

## Backend additions (minimal, required by Kimi UI)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/appointments/recalls/hub` | Recall hub stats + recent activity feed |

## Recalls Hub data mapping

1. **Stats** — eligible segment count, no-show stats, active campaigns (from existing recall-campaigns + no-show-recovery libs)
2. **Recent activity** — `appointmentWorkflowStepExecution` rows for recovery/recall workflows + campaign `lastRunAt` events
3. No mock data in production path

## Notes

- Legacy shadcn clients remain in repo for reference; production entrypoints re-export Kimi connected shells.
- No builds/browsers run during this pass per instructions.
- Cursor-only completion passes for the final 10 Kimi drafts were completed separately in `src/kimi-drafts/`.
