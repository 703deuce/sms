# Appointment Reminders — conversation thread data path

## Product requirement

The Responses / Overview thread must show **both sides** of the SMS exchange: Transovo outbound (reminders and automated replies) and customer inbound. A thread that only shows customer replies is misleading.

## Canonical thread store

**Authoritative UI source:** `conversationMessage` rows on the appointment’s `arSmsReplySession.conversationId`.

Loaders: `loadArConversationThread` in `src/lib/appointment-reminders/load-ar-conversation-inbox.ts`.

## Where outbound rows are written (runtime)

| Outbound kind | Code path | Persisted to `conversationMessage`? |
|---------------|-----------|--------------------------------------|
| Reminder / confirmation SMS (platform sender) | `reminder-delivery.ts` → `sendArReminderSmsWithSession` → `appendArConversationOutboundMessage` | **Yes**, after provider accept |
| AI / policy automated reply | `executeArSendCustomerSmsJob` | **Yes**, after send (idempotent replay also backfills) |
| Customer inbound | `inbound-sms-ingress.ts` | **Yes** (`direction: inbound`) |
| Legacy non-platform SMS | `sendInternationalAppointmentSms` in `reminder-delivery.ts` | **No** — no AR conversation session; not shown in AR thread |

Appointment metadata **reminder timeline** (`appendTimeline` on `voiceAppointment.metadata`) records delivery milestones for scheduling/UI; it does **not** replace `conversationMessage` and is **not** merged blindly into the thread.

## Proof of send (for repair / hydration)

Proven outbound SMS is represented in the **`Message`** ledger with:

- `idempotencyKey` prefix `ar:reminder:{workspaceId}:{appointmentId}:` for reminders, or `ar:reply:` for automated replies tied to a reply session
- `status` not `failed`
- `providerId` set to a real provider SID (not `idem:` / `pending:` placeholders)

`repairMissingArConversationOutboundFromLedger` copies any ledger-proven rows missing from `conversationMessage` (deduped by `providerMessageId` unique constraint).

On thread load (first page, no cursor), the loader runs repair, then merges any remaining ledger-only rows for display ordering.

## What we intentionally do not show

- Timeline labels without a matching proven `Message` / `conversationMessage`
- Failed or never-accepted sends (`status: failed`, `providerId` still `idem:` / `pending:`)
- Email-only reminder steps (SMS thread is SMS-only)

## Plan gating

Thread API: `GET /api/appointment-reminders/conversations/:appointmentId` returns **403** on Free when `workspaceAllowsSmsCustomerResponses` is false (Starter+ for SMS reply visibility).

## Verification

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-conversation-thread-hydration.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-overview-conversations.ts
```
