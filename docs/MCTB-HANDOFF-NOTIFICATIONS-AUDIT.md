# MCTB Lead Handoff & Notifications — Implementation Audit

## Reused runtime (Audit → Preserve → Extend)

| Area | Reused |
|------|--------|
| MCTB inbound SMS | `handleJohnCustomerSmsReply` → now calls `processMctbInboundReply` first |
| John AI loop | `runJohnCustomerLlmLoop` for `ai_conversation` mode only |
| SMS eligibility | `sendQuickSms` + existing gates (unchanged) |
| In-app notifications | `notifyWorkspace` (callback-requests pattern) |
| Email notifications | `notifyWorkspaceByEmail` + Brevo transactional |
| Recovery conversation | `Conversation.productSource = MCTB`, `missedCallEventId` |
| Callback pattern | `src/lib/callback-requests/service.ts` as notify template |

## New schema (`prisma/migrations/20260907210000_mctb_handoff_notifications`)

- `MctbHandoffConfig` — response mode, emergency, fields, routing, quiet hours
- `MctbNotificationRecipient` — team recipients
- `MctbConversationAutomationState` — automation/human/follow-up state
- `MctbLeadSnapshot` — immutable handoff snapshots
- `MctbUrgencyAssessment` — derived urgency classifications
- `MctbHandoffEvent` — idempotent trigger events
- `MctbNotificationDelivery` — per-channel delivery audit

## New lib (`src/lib/mctb/handoff/`)

- `process-inbound-reply.ts` — orchestrator for four response modes
- `notifications.ts` — idempotent SMS/email/in-app delivery
- `guided-collection.ts`, `urgency.ts`, `snapshot.ts`, `config.ts`

## APIs

- `GET/POST /api/mctb/handoff` — config + recipients + test notification
- `POST /api/mctb/handoff/actions` — take over, resume automation, follow-up status
- `GET /api/mctb/handoff/context` — conversation handoff panel data

## UI

- `/mctb/setup/notifications` — premium setup page (choice cards, emergency, recipients, preview, test)
- `MctbHandoffContextPanel` — conversation side panel (take over, call, follow-up)

## Integrations (initial)

- Inbound reply pipeline wired for all four modes
- AI escalation (`ESCALATE_HUMAN`) emits `human_required` handoff event
- Setup local nav entry

## Pending / live verification required

- Live SMS team notification delivery (provider + 10DLC path)
- Twilio inbound parity for John + handoff (Telnyx path wired)
- Missed Call Detail Handoff & Outcome section (API data available; UI section follow-up)
- Home Needs Attention cards for urgent/callback (event types persisted; overview wiring follow-up)
- Analytics event counters (handoff events queryable; analytics UI follow-up)
- Calendar appointment attribution from MCTB thread (`bookingBehavior` config stored; booking hook follow-up)

## Tests

- `npx tsx scripts/test-mctb-handoff.ts` — urgency, guided collection, templates, mode distinctness
