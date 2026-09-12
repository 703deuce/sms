# Appointments Messages — SMS platform reuse audit

**Scope:** Appointments product → **Messages → Inbox / Campaigns** only. No second messaging stack.

**Date:** 2026-09-12

## Canonical SMS surfaces (source of truth)

| Capability | Canonical location | Appointments exposure |
|------------|-------------------|------------------------|
| Inbox UI | `src/app/(app)/conversations/page.tsx` → `KimiConversationsConnected` | **REUSE** — route `/conversations`, label **Inbox** in nav |
| Conversation list API | `GET /api/inbox` | **REUSE** |
| Thread API | `GET/PATCH /api/inbox/[id]` | **REUSE** |
| Send / compose | `ConversationsComposer` + messaging runtime | **REUSE** |
| Models | Prisma `Conversation`, `ConversationMessage`, `Contact` | **REUSE** — no `AppointmentConversation` |
| MMS / attachments | Existing composer + message `mediaUrls` | **REUSE** |
| Delivery status | Outbound message status fields + provider webhooks | **REUSE** |
| Opt-out / STOP | Contact status + suppression runtime | **REUSE** — composer blocked when opted out |
| Unread state | `Conversation.unread` | **REUSE** — sidebar badge via `loadInboxUnreadConversationCount` |
| Assignment / team | Inbox assignee + permissions (`loadInboxPermissions`) | **REUSE** |
| Search / filters | `inboxFiltersFromUrlParams`, `InboxProductFilters` | **REUSE** — appointments chips when V1 primary |
| Campaign list UI | `src/app/(app)/campaigns/*` → `KimiCampaignsConnected` | **REUSE** — nav **Campaigns** → `/campaigns` |
| Campaign APIs | `/api/mass-texting/campaigns/*` | **REUSE** |
| Lists / Segments audience | `/api/contacts/lists`, `/api/contacts/segments` | **REUSE** — not duplicated under Messages |
| Campaign ↔ Inbox replies | Inbound on contact phone lands in canonical thread | **ALREADY_CONNECTED** |
| Tenant scoping | `workspaceId` on conversation/campaign queries | **REUSE** — existing guards |
| Permissions | `inbox-access`, workspace roles | **REUSE** |

## Appointment-aware behavior

| Item | Status | Notes |
|------|--------|-------|
| Upcoming appointment on list rows | **ALREADY_CONNECTED** | `GET /api/inbox` attaches `appointmentContext` via `loadUpcomingAppointmentsByContactIds` |
| Thread header context | **ADAPT** | `AppointmentsInboxContextBanner` + existing ThreadView chips |
| Client detail → Message | **ADAPT** | `ContactBookingActions` → `/conversations?contactId=` |
| Appointment detail → Message client | **ADAPT** | `AppointmentDetail` → `/conversations?contactId=` |
| Appointment-only campaign filters | **MISSING** (by design until segment data exists) | Must use canonical segments/lists; do not fake filters |

## Explicitly NOT brought into Appointments Messages nav

| SMS product area | Status |
|------------------|--------|
| SMS Dashboard | **NOT_APPLICABLE** |
| SMS Analytics | **NOT_APPLICABLE** |
| Playbooks / Automations (marketing) | **NOT_APPLICABLE** — Reminders own automation |
| Numbers / Compliance | **NOT_APPLICABLE** — settings/platform |
| Templates under Messages | **NOT_APPLICABLE** — under **Reminders → Templates** |
| Activity under Messages | **NOT_APPLICABLE** — under **Reminders → Activity** |
| Contacts / Lists / Segments nav under Messages | **NOT_APPLICABLE** — canonical `/contacts` |

## Messages badge definition

**Metric:** Count of `Conversation` rows where `workspaceId` = active workspace, `unread = true`, `status = OPEN`.

**Not used for Messages badge:** `inAppNotification` (still used for header notification bell).

## Boundaries

- **Campaign** = business-chosen audience broadcast (`/campaigns`).
- **Reminder** = appointment lifecycle automation (`/appointments/reminders`).
- **Recall** = per-client return campaigns (`/appointments/recalls`, recall hub) — not rebuilt inside Campaigns.
- **Inbox** = two-way threads (`/conversations`).
