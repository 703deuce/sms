# Appointments Messages — component connection matrix

| Track | UI entry | Adapter / page | API / runtime | Data |
|-------|----------|----------------|---------------|------|
| **MESSAGES_NAV** | `buildAppointmentsV1Nav` | `appointments-nav.ts` | — | Inbox + Campaigns children only |
| **INBOX** | Sidebar → Inbox | `conversations/page.tsx` | `GET /api/inbox`, `PATCH /api/inbox/[id]` | `Conversation`, `Contact` |
| **CAMPAIGNS** | Sidebar → Campaigns | `campaigns/page.tsx` | `/api/mass-texting/campaigns/*` | Broadcast campaigns |
| **CANONICAL_SMS_RUNTIME_REUSE** | Kimi surfaces | `kimi-conversations-connected`, `kimi-campaigns-connected` | Messaging send + mass-texting processor | Shared Prisma |
| **CANONICAL_CONVERSATION_REUSE** | Thread + list | `lib/inbox/*`, `lib/mappers` | Twilio/Telnyx via existing send paths | No appointment-specific tables |
| **CANONICAL_CAMPAIGN_REUSE** | Campaign composer | `lib/campaigns/*`, `lib/mass-texting/broadcast/*` | Launch + throttle + credits | Lists/segments from contacts API |
| **CONTACT_INTEGRATION** | Contact header Message | `ContactBookingActions` | Opens `/conversations?contactId=` | Canonical contact |
| **APPOINTMENT_INTEGRATION** | Detail Message client | `AppointmentDetail` | Same inbox deep link | `contactId` on appointment |
| **LISTS_INTEGRATION** | Campaign audience picker | `AudiencePicker` / adapter | `/api/contacts/lists` | Workspace lists |
| **SEGMENTS_INTEGRATION** | Campaign audience picker | adapter | `/api/contacts/segments` | Workspace segments |
| **OPT_OUT** | Composer disabled | `kimi-conversations-connected` | Contact `BLOCKED` / `Unsubscribed` | Suppression runtime |
| **SUPPRESSION** | Campaign launch | launch-review + send pipeline | Existing exclusion rules | **REUSE** |
| **DELIVERY_STATUS** | Thread bubbles | ThreadView | Provider status on messages | **REUSE** |
| **UNREAD_BADGE** | Messages parent badge | `loadInboxUnreadConversationCount` | `conversation.count` | OPEN + unread |
| **CAMPAIGN_REPLY_TO_INBOX** | Inbound webhook | Existing SMS inbound | Thread by phone/contact | **REUSE** |
| **TENANT_SECURITY** | All routes | `requireSession` / workspaceId filters | Prisma where clauses | **REUSE** |
| **PERMISSIONS** | Inbox gates | `loadInboxPermissions`, `assertInboxEnabled` | Role flags | **REUSE** |
| **RESPONSIVE** | Inbox mobile list/thread | Existing Kimi CSS classes | — | **ALREADY_CONNECTED** |
| **ACCESSIBILITY** | Kimi components | aria on drawers/dialogs | — | Baseline inherited |
| **CONSOLE_NETWORK** | — | UAT on harbor-home | Verify `/api/inbox` + mass-texting from appointments shell | Pending UAT |

## Shell / routing

| Concern | Implementation |
|---------|----------------|
| Stay in Appointments chrome on `/campaigns` | `isExplicitAppointmentsShellPath` + `isAppointmentsProductPath` when `APPOINTMENTS_V1_PRIMARY` |
| API access from appointments context | `APPOINTMENTS_API_ROUTE_PREFIXES` includes `/api/mass-texting`, `/api/campaigns` |
