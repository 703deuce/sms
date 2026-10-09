# AR Calendar — Microsoft 365 native actions & sync

## Product rules

- **Transovo Calendar is read-only** — no create, edit, delete, or drag-and-drop in Transovo.
- **Create / edit** — customer uses Outlook on the web (or Google Calendar when connected).
- **SMS reschedule** — existing Appointment Reminders Graph workflow (unchanged).

## Calendar mirror vs SMS reminders (separate)

| Concern | Behavior |
|---------|----------|
| **Calendar page** | Mirror **all** events from selected import calendars in the sync window (personal, no guests, all-day, busy/free). |
| **SMS reminders** | `isEventEligibleForReminderImport` — external attendee, title rules, etc. Stored as `reminderSmsEligible` on imported rows; scanner skips when false. |

Do not use reminder eligibility to hide events on the Calendar page.

## Native Outlook buttons (Calendar page)

| Action | URL |
|--------|-----|
| Add appointment | `https://outlook.office.com/calendar/deeplink/compose` |
| Open Outlook | `https://outlook.office.com/calendar/` |
| Add calendar (header) | Same as manage — Outlook calendar UI |
| Manage calendars (callout link) | `https://outlook.office.com/calendar/view/month` |

Deep links are convenience URLs, not a guaranteed Graph contract. Fallback: open Outlook Calendar home.

API: `GET /api/appointment-reminders/calendar/native-actions` (workspace-scoped, existing connections only).

## Background sync (existing — do not duplicate)

| Concern | Implementation |
|---------|----------------|
| Change notifications | `src/lib/calendar/webhooks.ts` — Graph subscriptions `created,updated,deleted`, renewal, lifecycle |
| Webhook ingress | `/api/integrations/calendars/webhooks/microsoft` |
| Delta / recovery | `src/lib/calendar/microsoft-delta-sync.ts`, `import-sync.ts` |
| AR stale backstop | `maybe-sync-stale-calendars.ts` |
| UI refresh | Calendar page refetches on window focus + **Sync now** |

Subscriptions target the **signed-in user’s mailbox events** (`OUTLOOK_EVENTS_SUBSCRIPTION_RESOURCE` in `graph-helpers.ts`). Shared/delegated mailboxes need separate permission review before expansion.

New calendars created in Outlook must be **selected for import** under Calendar connections — creation in Outlook does not auto-import every calendar in the account.

## References

- [Microsoft Graph change notifications](https://learn.microsoft.com/en-us/graph/change-notifications-overview)
- [Create subscription](https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions)
- [Delta query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Create calendars in Outlook](https://support.microsoft.com/office/create-a-calendar-in-outlook-on-the-web)
