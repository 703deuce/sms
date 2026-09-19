# Voice V3 LiveKit — Phase 53 pre-PSTN report

**Status:** STOP — awaiting explicit approval before Telnyx cutover for `+15717491060` or production merge that affects cert routing.  
**Authoritative spec:** `docs/VOICE-V3-LIVEKIT-IMPLEMENTATION-DIRECTIVE.md`  
**Rollback boundary:** `docs/VOICE-V3-LIVEKIT-CUTOVER-STATE.md`

---

## Git SHAs

| Item | Value |
|------|--------|
| Implementation branch | `cursor/voice-v3-livekit-implementation-2304` |
| Branch HEAD (record at report) | `e8cd539f52514d2756dfe85f2517b760e3916ea5` |
| Master at Phase 0 record | `1aef0e0fd5d4b9b7de3f39a34341c542718e4ab0` |
| Freshness-certified direct path | `3d3d14eeabdee819329559b1016a1c5a43aad783` |

---

## Python dependency (GPT-Live)

| Package | Declared | Verified |
|---------|----------|----------|
| `livekit-agents[openai]` | `~=1.8` in `voice-runtime-python/pyproject.toml` | **1.8.2** (`GPTLiveModel` import OK in dev install) |

Worker profile: `VOICE_V3_LIVEKIT_AGENT_NAME` default **`transovo-voice-v3`** (second `@server.rtc_session` alongside existing `transovo-voice`).

---

## LiveKit reuse (no new project)

- Existing LiveKit Cloud project (`sms-6w01zoya` per verify script).
- Existing Python `transovo-voice` worker package; V3 profile added under `voice-runtime-python/transovo_voice/voice_v3/`.
- Authenticated worker → Transovo via existing `/api/internal/voice-runtime` pattern.

**Not done yet (expected before PSTN):** inbound trunk listing `+15717491060`, dispatch rule to `transovo-voice-v3`, worker running in target env with `MEDIA_BACKEND_MODE=livekit_cloud`, align `LIVEKIT_URL` with `LIVEKIT_SIP_URI` project (verify script flagged mismatch in cloud agent VM).

---

## GPT-Live configuration (implemented)

- `GPTLiveModel` with `delegation="responses"`.
- **Amy:** `Agent` instructions from compiled live prompt (`amyInstructions`).
- **Astra:** `responses_options` — model `VOICE_V3_ASTRA_MODEL`, instructions, cert tool schemas, `parallel_tool_calls: false`, `max_tool_steps: 5`.
- Caller utterances: `user_input_transcribed` (final) → `commit_voice_v3_livekit_caller_utterance` on Transovo backend.

---

## Transovo reuse (unchanged business layer)

- Wizard-published agent config resolution (`resolveVoiceV3AgentConfigForAgent`).
- Prompt compile (`buildVoiceV3Prompts`).
- Call runtime (`createVoiceV3CallRuntime` / `getVoiceV3CallRuntime`).
- Tool execution: **`executeVoiceTool`** directly from LiveKit bridge (no delegation coordinator).
- Executors: intake, scheduling preference, find dispatch, Microsoft lane, callback persistence, scheduling generations, OfferSets, idempotency, async stale reconciliation.

**Cert tool surface (Phase 40):** `update_intake`, `set_scheduling_preference`, `find_availability`, `request_callback`.

---

## Bypassed on LiveKit path (not deleted)

| Component | Role on direct OpenAI path |
|-----------|----------------------------|
| `live-sideband-session.ts` / OpenAI SIP ingress | Realtime WebSocket to OpenAI |
| Delegation coordinator / `handle-delegated-voice-tools` | Overlapping delegation protocol |
| Manual `response.item.create` / `response.create` for tool continuation | Sideband orchestration |

Direct-OpenAI Voice V3 remains on master for rollback until Phase 54 PSTN cert passes.

---

## Backend certification tests (no PSTN)

Run in repo with `DATABASE_URL` / cert workspace (`ws_1`, `PHONE_E164=+15717491060`):

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-livekit-bridge.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-livekit-concurrency-cert.ts
```

| Test | Result | Notes |
|------|--------|--------|
| Bridge smoke (`BRIDGE_SMOKE_PASS`) | PASS | Resolve session + 4 tools + `update_intake` |
| B2C: callback while FIND in flight | PASS | Callback goal / needs_information; FIND does not block callback |
| MON→TUE: correction during FIND | PASS | `scheduling_generation` ≥ 2; `ASYNC_ACTION_STALE` / `AVAILABILITY_RESULT_STALE` on gen 1; Tuesday FIND attempted (Microsoft token unavailable in VM → `FIND_FAILED`, acceptable for backend cert) |

**Not run in this phase:** LiveKit worker e2e SIP, GPT-Live audio, full directive torture matrix, PSTN calls A–J.

---

## +15717491060 routing (read-only at report time)

**DO NOT CHANGE until approval.**

| Check | State |
|-------|--------|
| Telnyx connection | **Transovo Voice V3 Basic OpenAI SIP** (`3051313082853754271`) — direct OpenAI, not LiveKit FQDN |
| LiveKit trunk owns DID | **No** |
| Intended cutover (after approval) | Telnyx → **Transovo LiveKit Inbound** FQDN → existing Cloud SIP → dispatch **`transovo-voice-v3`** → room → `GPTLiveModel` session |

Re-verify:

```bash
PHONE_E164=+15717491060 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/verify-571-livekit-callable.ts
```

---

## Approval gate

Before Phase 54:

1. Explicit approval to change Telnyx routing for `+15717491060`.
2. LiveKit trunk + dispatch + worker deploy green on verify script.
3. Optional: deploy implementation branch to staging worker + web internal API.

**After approval only:** route DID, run PSTN certification calls per directive Phase 54.

---

*End of Phase 53 report.*
