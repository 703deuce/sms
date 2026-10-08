# AR shared sender allocation — verification report

**Scope:** Three production-readiness boundaries on top of `docs/AR-SMS-DYNAMIC-SENDER-ASSIGNMENT.md`.  
**Architecture:** Approved — no redesign.

| # | Boundary | Result | Evidence |
|---|----------|--------|----------|
| 1 | Concurrent allocation retries next sender | **PASS** | `allocateArPlatformSenderForReminder` loops all candidates; on `P2002` or tx `null` (pair owned elsewhere) adds sender to `occupiedByOthers` and `continue`. Policy tests: `ar-consumer-sender-allocation-policy.test.ts`. |
| 2 | Legacy sessions reserve pairs before new allocation | **PASS** | `materializeLegacyArSenderAssignmentsForConsumer` runs at start of every allocation; `collectConsumerSenderPairs` unions assignments + legacy outbound-proof sessions for occupied set. Inbound: `resolveArWorkspaceIdFromConsumerPlatformSender` falls back to legacy session owner. Batch: `scripts/backfill-ar-consumer-sender-assignments.ts --apply`. |
| 3 | Retired/unauthorized sender — no silent rotation | **PASS** | Existing `(consumer, workspace)` assignment with failed `isPhoneAuthorizedForOutboundSms` returns `ar_assigned_sender_unavailable` (hold outbound); assignment row kept for inbound routing. |
| — | Workspace ≠ appointment | **PASS** | Unchanged: assignment → workspace filter; `resolveArInboundPrimarySession` / holds for multi-appointment. No `expireSupersededArReplySessionsOnSender` on outbound. |
| — | Real Microsoft + Telnyx E2E | **NOT VERIFIED** | Owner/staging per `docs/AR-SMS-PR-621-622-VERIFICATION-REPORT.md`. |
| — | DB migration on production | **NOT VERIFIED** | Migration `20261008220000_ar_consumer_platform_sender_assignment` — run `npm run db:deploy` + backfill before multi-tenant free launch. |

## Scenario matrix

| Scenario | Expected | Mechanism | Automated |
|----------|----------|-----------|-----------|
| Two workspaces, different customers, same sender | Both send | Independent assignments per customer | Policy N/A |
| Two workspaces, same customer, different senders | Trainer A / Salon B | Occupied set + allocation loop | Policy unit tests |
| Simultaneous first reminder (race on sender 1) | B gets sender 2 | Unique `(consumer, sender)` + retry loop | Policy unit tests; DB race **NOT VERIFIED** |
| Reuse workspace/customer sender | Same number | `consumerE164_workspaceId` unique | Code trace **PASS** |
| Multi-appointment one workspace | Clarify or lifecycle priority | `ambiguous_appointment` hold | `ar-sms-shared-number-routing.test.ts` |
| Reply after completed appointment | Routable session states | `AR_INBOUND_ROUTABLE_LIFECYCLE_STATES` | **NOT VERIFIED** time-shift |
| Pool exhausted | No send | `ar_sender_pool_exhausted` | Code trace **PASS** |
| Duplicate webhook | Single job | `ar-process-inbound:{workspace}:{providerMessageId}` | Audit doc §10 |
| Legacy session, no assignment row yet | Reserve on allocate | `materializeLegacyArSenderAssignmentsForConsumer` | Code trace **PASS** |

## Commands

```bash
npx vitest run src/lib/appointment-reminders/messaging/ar-consumer-sender-allocation-policy.test.ts
npx vitest run src/lib/appointment-reminders/messaging/ar-sms-shared-number-routing.test.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-platform-inbound-session-resolve.ts
```
