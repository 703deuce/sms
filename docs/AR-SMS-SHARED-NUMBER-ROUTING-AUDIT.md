# Appointment Reminders — Shared-Platform-Number SMS Routing & Tenant-Isolation Audit

**Date:** 2026-10-08  
**Scope:** Runtime trace from reminder outbound → inbound webhook → conversation resolution → two-agent processing → calendar writes → outcomes. No architecture redesign.

**Launch bar:** No cross-workspace conversation exposure, no cross-customer appointment changes, no ambiguous calendar writes.

---

## Summary

| Result | Count |
|--------|------:|
| PASS | 9 |
| GAP (fixed in this pass) | 2 |
| GAP (documented, not fixed) | 1 |
| NOT VERIFIED (needs live/staging DB) | 2 |

**Fixes in this pass**

1. **Same-workspace, multi-appointment ambiguity** — inbound routing no longer picks the most recent `AWAITING_REPLY` session when two appointments tie at the same lifecycle priority (`resolveArInboundPrimarySession` + hold in `dispatchSharedPlatformSmsInbound`).
2. **Reminder context resolver** — `resolveReminderBoundAppointment` no longer selects the latest reminder when multiple recent reminder contexts exist; returns `ambiguous` (letter / fallback paths already ask for date).

---

## Boundary checklist

### 1. Outbound reminders persist authoritative associations

| | |
|---|---|
| **Enforcement** | `sendArReminderSmsWithSession` (`outbound-reminder.ts`) → `selectArOutboundPlatformSender`, `ensureArConversation`, `claimArReplySessionForOutbound`, `attachOutboundProofToArReplySession`; session rows store `workspaceId`, `contactId`, `appointmentId`, `platformPhoneNumberId`, calendar provider refs (`reply-session.ts`). |
| **Test** | Code trace + `outbound-reminder.ts` / `claimArReplySessionForOutbound` read-through. |
| **Result** | **PASS** |

### 2. Inbound SMS resolves workspace + appointment before agent context

| | |
|---|---|
| **Enforcement** | `dispatchSharedPlatformSmsInbound` → `resolveArInboundFromOutboundInitiatedConversation` → `acceptArInboundSmsIngress` (binds `replySessionId` + `appointmentId` on job). `handleAppointmentRemindersInboundBody` passes routed `appointmentId`. `runArV3RescheduleSmsTurn` calls `verifyArReplySessionForInboundTurn` before Luna/context agents (`run-turn.ts`). |
| **Test** | Trace; vitest routing (`ar-sms-shared-number-routing.test.ts`). |
| **Result** | **PASS** (after appointment-ambiguity hold) |

### 3. Two workspaces, same platform sender + customer — no cross-tenant access

| | |
|---|---|
| **Enforcement** | `groupArSessionsByWorkspace` + `ambiguous_workspace` in `resolve-initiated-ar-inbound.ts`; `dispatchSharedPlatformSmsInbound` holds via `persistArInboundHeldMessage` (`platform-inbound-held.ts`), does not call `acceptArInboundSmsIngress`. |
| **Test** | Contract script `scripts/test-ar-platform-inbound-session-resolve.ts`; unit test workspace grouping. |
| **Result** | **PASS** |

### 4. Multiple appointments for same customer (one workspace) — safe resolution

| | |
|---|---|
| **Enforcement** | Inbound: `resolveArInboundPrimarySession` — ambiguous when multiple appointments share top lifecycle priority. Letter path: `resolveReminderBoundAppointment` → clarification copy (`inbound-replies.ts`). Routed path uses session `appointmentId` when unambiguous. |
| **Test** | `ar-sms-shared-number-routing.test.ts` (two `AWAITING_REPLY` → `ambiguous_appointment`). |
| **Result** | **PASS** (was **GAP** — recency pick on tie) |

### 5. Reply days after reminder — correct conversation association

| | |
|---|---|
| **Enforcement** | `AR_INBOUND_ROUTABLE_LIFECYCLE_STATES` includes `COMPLETED` + `NEEDS_CLARIFICATION`; `replyEligibleUntil` on sessions (`reply-session.ts`); `listArInboundRoutableSessions` requires outbound proof. |
| **Test** | NOT VERIFIED — needs time-shifted DB fixture or staging replay. |
| **Result** | **NOT VERIFIED** |

### 6. Newer reminder does not silently hijack in-flight operation

| | |
|---|---|
| **Enforcement** | `pickPrimaryArReplySessionForInbound` / `resolveArInboundPrimarySession` prioritize `RESCHEDULING` and cancel-confirm states over `AWAITING_REPLY` (vitest). |
| **Gap** | `expireSupersededArReplySessionsOnSender` exists in `reply-session.ts` but is **not** called from `outbound-reminder.ts`; multiple `AWAITING_REPLY` sessions can coexist until inbound hold fires. |
| **Test** | Vitest RESCHEDULING vs AWAITING priority. |
| **Result** | **PASS** for in-flight priority; **GAP (documented)** for outbound supersede not wired |

### 7. Ambiguous cross-workspace / cross-appointment replies fail closed

| | |
|---|---|
| **Enforcement** | Cross-workspace: hold `ambiguous_ar_workspace_on_platform_sender`. Same-workspace multi-appt tie: hold `ambiguous_ar_appointment_on_platform_sender` (`platform-sms-inbound-dispatch.ts`). |
| **Test** | Unit tests + dispatch trace. |
| **Result** | **PASS** (appointment path fixed this pass) |

### 8. Agents receive only authorized workspace/customer context

| | |
|---|---|
| **Enforcement** | `verifyArReplySessionForInboundTurn`; `loadArCustomerAppointmentsSummaryForLuna` scoped by `workspaceId` + `contactId`; context agent runs after verify in `run-turn.ts`. |
| **Test** | Trace only. |
| **Result** | **PASS** (assuming inbound never routes wrong session — guarded by §7) |

### 9. Calendar tools validate workspace ownership and provider binding

| | |
|---|---|
| **Enforcement** | `provider-mutations.ts` — `voiceAppointment` lookup `id` + `workspaceId`; `loadConnection(workspaceId, connectionId)`. `commit-reschedule.ts` / cancel paths repeat workspace-scoped loads; policy gate `gateArSmsCalendarWriteByPolicy` on metadata. |
| **Test** | Trace; existing `ar-sms-policy-ack.test.ts`. |
| **Result** | **PASS** |

### 10. Duplicate webhooks / retries / concurrent inbound — no double writes

| | |
|---|---|
| **Enforcement** | `recordArPlatformSmsInboundReceipt` unique `providerMessageId`; `acceptArInboundSmsIngress` idempotency `ar-process-inbound:{workspaceId}:{providerMessageId}`; conversation message `P2002` handling; job payload tied to first accept. |
| **Test** | Trace; NOT VERIFIED under concurrent load. |
| **Result** | **PASS** (design); **NOT VERIFIED** (concurrency stress) |

### 11. Policy acceptance bound to exact operation / appointment

| | |
|---|---|
| **Enforcement** | `ArSmsPolicyAckRecord` stores `workspaceId`, `contactId`, `appointmentId`, `policyFingerprint`; `gateArSmsCalendarWriteByPolicy` / `hasValidAcceptedPolicyAck`; inbound policy handler scoped to routed `appointmentId` (`handle-inbound-body.ts`). |
| **Test** | `ar-sms-policy-ack.test.ts`. |
| **Result** | **PASS** |

### 12. Customer outcomes and SMS evidence — correct appointment/workspace

| | |
|---|---|
| **Enforcement** | `recordArSmsCustomerOutcome` call sites pass explicit `workspaceId` + `appointmentId` from verified inbound context; timeline merge on appointment metadata (`ar-sms-customer-outcome.ts`, `ar-sms-outcome-detail.ts`). |
| **Test** | `ar-sms-integration-boundaries.test.ts`, `ar-sms-outcome-detail.test.ts`. |
| **Result** | **PASS** (wrong routing would still mis-attribute — depends on §2/§7) |

---

## Collision scenarios

| Scenario | Expected | Mechanism | Automated test |
|----------|----------|-----------|----------------|
| WS-A + WS-B, same sender, same customer, both reminded | Hold, no agent | `ambiguous_workspace` | Grouping unit test; E2E **NOT VERIFIED** |
| Same WS, two appointments, both `AWAITING_REPLY` | Hold | `ambiguous_appointment` | **PASS** vitest |
| Same WS, reschedule in flight on appt A, new reminder on appt B | Route to A | Lifecycle priority | **PASS** vitest |
| Duplicate Telnyx `providerMessageId` | Single job / message | Ingress idempotency | **NOT VERIFIED** |
| Customer replies `R` with explicit routed session | Correct appt | `explicitAppointmentId` in `handle-inbound-body.ts` | Trace **PASS** |
| Single WS, single active session | Normal path | `route_matched` | **NOT VERIFIED** E2E |

---

## Files (routing spine)

```
outbound-reminder.ts
  → reply-session.ts (claim, proof, conversation)
  → platform SMS send

platform-sms-inbound-dispatch.ts
  → resolve-initiated-ar-inbound.ts
  → inbound-sms-ingress.ts (idempotent accept)
  → job → handle-inbound-body.ts → run-turn.ts (verify + agents)
  → provider-mutations.ts / commit-reschedule.ts (calendar)
```

---

## Durable sender assignment (2026-10-08)

Cross-workspace routing now prefers **`ar_sms_consumer_platform_sender_assignments`**: `(customer, platform sender) → workspace` before session listing. See `docs/AR-SMS-DYNAMIC-SENDER-ASSIGNMENT.md`.

## Recommended before freemium scale

1. Staging collision drill: two workspaces, one platform sender, one customer phone — confirm held inbox UI (`held-inbound` API).
2. Wire or consciously reject `expireSupersededArReplySessionsOnSender` on outbound (product decision: “latest reminder wins” vs hold).
3. Live Microsoft + Telnyx paths per `docs/AR-SMS-PR-621-622-VERIFICATION-REPORT.md`.

---

## Test commands

```bash
npx vitest run src/lib/appointment-reminders/messaging/ar-sms-shared-number-routing.test.ts
npx vitest run src/lib/appointment-reminders/ai-rescheduler/ar-sms-policy-ack.test.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-platform-inbound-session-resolve.ts
```
