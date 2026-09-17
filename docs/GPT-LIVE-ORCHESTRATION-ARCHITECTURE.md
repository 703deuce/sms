# GPT-Live orchestration architecture (Voice V2)

## Authority order

1. Certified tool results (FIND / BOOK / Graph)
2. Durable `VoiceV2CallContext` (L1 + L2), including `dialog` and `bookingWorkflow`
3. Configured business context
4. Model inference from transcript (facts only — not workflow commands)

## Layers

| Layer | Responsibility |
|--------|----------------|
| GPT-Live | Speech, interruptions, caller UX |
| Caller intent interpreter | Caller meaning, entities, digressions |
| Dialog manager | Durable `dialog.activeGoal` on `VoiceV2CallContext` |
| Control plane | `deriveVoiceV2NextStage`, allowed actions, tool filter |
| Certified executors | SAVE, FIND, BOOK, callback, transfer |

## Durable dialog state

`VoiceV2CallContext.dialog` holds `activeGoal`, confidence, explicit flag, caller evidence, scheduling hints, and `workflowCycleId`. Updates go through `setVoiceV2CallContext` → `updateVoiceV2CallContextL1Payload` → `hydrateL1` so `call:` and `cc:` aliases stay aligned.

Live per-turn sync: `syncLiveCallerUtteranceIntent` → `applyCallerIntentToCallContext` → `persistCallContext`.

## Legacy `workflow_signal`

`prefer_callback` / `cancel_booking` on SAVE are logged as `VOICE_LEGACY_WORKFLOW_SIGNAL_IGNORED` and do not change workflow. Cancellations require `cancel_booking_requested` plus caller `intent_evidence`. Callback requires explicit caller-grounded facts.

## Stage derivation

`workflowFromContextWithDialog` promotes `bookingIntentActive` when `dialog.activeGoal` is `BOOK_APPOINTMENT` or `CHANGE_APPOINTMENT`. Stage and tools come from `workflowPayloadForContext` + `filterAllowedActionsForDialog`.

## Live API

**Models (separate roles):** `OPENAI_LIVE_MODEL` → `gpt-live-1` (speech/UX). `OPENAI_LIVE_BACKEND_MODEL` → `gpt-6-astra` (delegated Responses tools/reasoning). Log line: `LIVE_MODEL_CONFIG`.

`response.item.create` for delegation context does **not** include `delegation_id` (correlation lives on inbound `response.event`). Delegation tool lists update via `session.update` when the control plane changes.

## Regression scripts

- `npm run test:gpt-live-booking-intent-precedence`
- `npm run test:gpt-live-caller-intent-turns`
- `npx tsx scripts/test-dialog-goal-l1-persistence.ts`

## Remaining / follow-up

- Full workflow-cycle increment after `BOOKING_CONFIRMED` and post-book reschedule
- Typed builders for every Live outbound event (schema tests)
- `voiceToolExecution` parity audit for all Live tools
- Context push accept/error telemetry (`CONTEXT_ITEM_ACCEPTED`)
