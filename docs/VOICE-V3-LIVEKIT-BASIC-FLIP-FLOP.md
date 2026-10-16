# Why LiveKit Basic kept coming back (and what we changed)

## Symptom

PSTN calls to wizard / AI Receptionist numbers sometimes sounded like **LiveKit Basic** (`gpt-realtime`, short template router) instead of **Voice V3** (`gpt-live-1` Amy + Astra). Calls could feel longer or “not Amy,” with no `voiceV3Forensics` and `agentTemplate: livekit_basic_voice` in call metadata.

## Root cause (three layers)

### 1. Two LiveKit workers on one cluster

| Worker name | Process | Runtime |
|-------------|---------|---------|
| `transovo-voice-runtime` | Legacy profile (`VOICE_WORKER_PROFILE=legacy`) | Template router; **default template `livekit_basic_voice`** |
| `transovo-voice-v3` | V3 profile (`VOICE_WORKER_PROFILE=v3`) | GPT-Live Amy + Astra via `resolve_voice_v3_livekit_session` |

Both workers can be registered at once (`start-transovo-voice-worker.sh`). **Whichever agent name the SIP dispatch rule targets wins.**

### 2. Provisioning always stamped the legacy worker

`syncDidDispatchRuleSnapshot` / shared trunk sync used `RoomAgentDispatch({ agentName: transovo-voice-runtime })` for every DID, including appointment-receptionist wizard publishes. Embedded job metadata used a Python bootstrap snapshot whose default template is `livekit_basic_voice` when no `livekitAgentTemplate` is set on the agent.

So even “Voice V3” products were often **dispatched to the legacy worker**, which then ran Basic.

### 3. Workspace-wide canonical agent override

`resolveAgentByCalledNumber` previously substituted the **cert** agent (`+15717491060`) for **every** DID in the workspace when a canonical Voice V3 agent existed. A call to wizard test `+15714073615` could therefore load the **cert** config while still running on the **legacy/Basic** stack — wrong voice and wrong prompts.

Phase 54 cutover for `+15717491060` pointed **one** shared dispatch rule at `transovo-voice-v3`, while wizard DIDs still used per-DID rules on `transovo-voice-runtime`. That produced **flip-flop** behavior depending on which rule LiveKit matched last.

## Fix (code)

1. **Appointment receptionist** publish/provision sets `livekitDispatchAgentName` to `transovo-voice-v3` and writes Voice V3 job metadata (no Basic bootstrap snapshot on the dispatch job).
2. **`resolveAgentByCalledNumber`** uses **per-DID** `resolveInboundAiAgent`; canonical override applies **only** when the called number is the cert E.164 (`VOICE_V3_CANONICAL_E164`, default `+15717491060`).

After deploy, re-publish or run dispatch sync for wizard DIDs so LiveKit rules update.

## Operational checklist

1. Confirm voice container runs **both** profiles (legacy + v3) or at least **v3** worker healthy.
2. For each AI Receptionist DID: `inspectLiveKitSipRouting` → dispatch `agentName` should be `transovo-voice-v3`.
3. Test call → call row should show Voice V3 bootstrap path and forensics, not `livekit_basic_voice`.

## What we are not doing

- Removing the legacy worker entirely (still used for lab templates / non-receptionist paths).
- Changing cert `+15717491060` behavior without explicit cutover — cert canonical rules remain on the cert DID only.
