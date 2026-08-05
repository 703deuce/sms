# Deep bug audit — agent workflow / Maya runtime (Aug 2026)

## Bugs found and fixed

### P0 — Runner never entered Call Outcome (`wait_for_call_result`)
After `run_voice_agent` (attachInbound), the runner advanced `currentNodeId` to Call Outcome then **returned** because `wait_for_call_result` was not in the continue list. Executions stayed `RUNNING` without `waitingForCallResult`, so resume never completed the branch.

**Fix:** Continue the runner loop when the next node is `wait_for_call_result` (same as other wait/condition blocks). Also wake `RUNNING` executions that already have a matching `pendingCallId` when call results arrive.

### P0 — TeXML apps never notified Transovo of call progress
`routePhoneToTexmlAssistant` set `ai_assistant_id` / `voice_url` but not TeXML `status_callback`. Live audio worked; VoiceCall / enrollment / post-call often never ran.

**Fix:** Every TeXML create/PATCH sets `status_callback` → `/api/telnyx/voice/texml-status` (form or JSON). Handler creates/updates VoiceCall, enrolls TriggerDeployments, and enqueues `voice_post_call` on terminal statuses.

### P0 — `publishVoiceAgent` could leave ACTIVE without live Telnyx route
Agent was set ACTIVE + DID claimed before Telnyx/TeXML proof; TeXML failures were warnings only. Activate treated non-throwing publish as success.

**Fix:** Fail-closed: rollback agent off ACTIVE if assistant sync fails, assistant id missing, or TeXML `matched !== true`. `activateFlowTriggers` also rejects non-matched TeXML / sync errors before marking TriggerDeployment live.

### P0 — Call outcome race (short calls never resume)
`resumeWaitForCallResult` only woke `WAITING` executions with `waitingForCallResult=true`. If Telnyx completed the call while the execution was still on Run Voice Agent (RUNNING), the result was dropped and Call Outcome timed out.

**Fix:** Stash `callResult` on matching RUNNING/WAITING executions by `pendingCallId`. `wait_for_call_result` also hydrates from an already-ended `VoiceCall`. Resume looks up by `pendingCallId` even when `contactId` is missing; post-call always emits completion events for resume.

### P0 — TeXML path may never create VoiceCall / Execution
Live audio uses TeXML direct (no Call Control `ai_assistant_start`). If `call.initiated` never arrives, `handleInboundCallEvent` never runs → no execution.

**Fix:** `ensureVoiceCallForTelnyxEvent` on conversation/answered events creates VoiceCall + enrolls TriggerDeployments. `conversation.ended` also enqueues `voice_post_call`. TeXML `status_callback` is now the primary early path.

### P0 — Activate could mark workflow live without Telnyx publish
`activateFlowTriggers` could upsert inbound TriggerDeployment as `live` with `telnyxPublished: false` when Run Voice Agent was missing. AR Activate then set flow ACTIVE and setup published anyway.

**Fix:** Live inbound requires Run Voice Agent + successful `publishVoiceAgent` + assistant id (+ TeXML match when applicable), or throw. AR + Publish APIs refuse ACTIVE unless `telnyxPublished`.

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
| TeXML form signature | Status callbacks are often unsigned form POSTs — accepted when Content-Type is form |
| Pause voicemail/reject/backup | Only human+number fallback is solid |
| `advancedCustomized` AR graphs | Reconcile still patches managed nodes by design |
| Double post_call | Idempotency key `voice-post-call:{callId}` should dedupe hangup + conversation.ended + texml completed |

## Integration proof still required
Stages 4–6 in `docs/appointment-booking-integration-checklist.md` — real PSTN call.
