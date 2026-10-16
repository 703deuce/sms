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

1. **Single worker** — `TRANSOVO_LIVEKIT_AGENT_NAME` is always `transovo-voice-v3`; the voice container runs **V3 only** (no dual legacy+V3 processes).
2. **Dispatch** — all SIP rules target Voice V3 job metadata (`voice_v3_gpt_live`); no `pythonRuntimeBootstrapSnapshot` / `livekit_basic_voice` on jobs.
3. **`livekit_basic_voice`** — removed from active template defaults; Python router raises if something requests it.
4. **`resolveAgentByCalledNumber`** — per-DID inbound owners; canonical cert agent only on cert E.164.

After deploy, re-publish or run dispatch sync for wizard DIDs so LiveKit rules update.

## Operational checklist

1. Confirm voice container runs **both** profiles (legacy + v3) or at least **v3** worker healthy.
2. For each AI Receptionist DID: `inspectLiveKitSipRouting` → dispatch `agentName` should be `transovo-voice-v3`.
3. Test call → call row should show Voice V3 bootstrap path and forensics, not `livekit_basic_voice`.

## What we are not doing

- Changing cert `+15717491060` product config without explicit cutover — cert canonical rules remain on the cert DID only.

Legacy LiveKit lab templates remain in the repo for reference but **cannot** answer PSTN calls; misconfiguration should **fail loudly** instead of falling back to Basic.
