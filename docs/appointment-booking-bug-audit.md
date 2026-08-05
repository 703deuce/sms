# Deep bug audit — agent workflow / Maya runtime (Aug 2026)

## Bugs found and fixed

### P0 — Call outcome race (short calls never resume)
`resumeWaitForCallResult` only woke `WAITING` executions with `waitingForCallResult=true`. If Telnyx completed the call while the execution was still on Run Voice Agent (RUNNING), the result was dropped and Call Outcome timed out.

**Fix:** Stash `callResult` on matching RUNNING/WAITING executions by `pendingCallId`. `wait_for_call_result` also hydrates from an already-ended `VoiceCall`.

### P0 — TeXML path may never create VoiceCall / Execution
Live audio uses TeXML direct (no Call Control `ai_assistant_start`). If `call.initiated` never arrives, `handleInboundCallEvent` never runs → no execution.

**Fix:** `ensureVoiceCallForTelnyxEvent` on conversation/answered events creates VoiceCall + enrolls TriggerDeployments. `conversation.ended` also enqueues `voice_post_call` (previously hangup-only).

### P0 — Activate could mark workflow live without Telnyx publish
`activateFlowTriggers` could upsert inbound TriggerDeployment as `live` with `telnyxPublished: false` when Run Voice Agent was missing. AR Activate then set flow ACTIVE and setup published anyway.

**Fix:** Live inbound requires Run Voice Agent + successful `publishVoiceAgent` + assistant id, or throw. AR + Publish APIs refuse ACTIVE unless `telnyxPublished`.

### P1 — Concurrent unknown callers race on Contact create
Two simultaneous first-time callers with the same number could hit unique `(workspaceId, phone)`.

**Fix:** Catch create conflict and re-read.

### P1 — Legacy template key `trigger` vs `inbound_call`
Older AR graphs stamped `templateNodeKey: "trigger"`. Reconcile only looked for `inbound_call`, risking duplicate trigger nodes on resave.

**Fix:** Map legacy `trigger` → `inbound_call` when reconciling.

### P2 — Wait node recorded as `completed` while still waiting
Execution path UI showed Call Outcome as completed as soon as wait started.

**Fix:** Record `waiting` status for `wait_for_call_result`.

## Still watch in live testing

| Risk | Why |
|------|-----|
| TeXML webhook payload shape | `from`/`to`/`assistant_id` field names vary — ensure-call is best-effort |
| Pause voicemail/reject/backup | Only human+number fallback is solid |
| `advancedCustomized` AR graphs | Reconcile still patches managed nodes by design |
| Double post_call | Idempotency key `voice-post-call:{callId}` should dedupe hangup + conversation.ended |

## Integration proof still required
Stages 4–6 in `docs/appointment-booking-integration-checklist.md` — real PSTN call.
