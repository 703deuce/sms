# Architecture Directive v2 — GPT-Live delegation report

**Date:** 2026-10-24  
**Branch:** `cursor/voice-mctb-tool-contracts-9779` (merge to `master` for deploy)

## 1. Sept ~26 working setup (git evidence)

| Item | Finding | Verification |
|------|---------|--------------|
| Voice surface model | **`gpt-live-1`** via `GPTLiveModel` | `git show 15f8ca951` / `54bffeea3` (`2026-09-24`–`2026-09-28`) `voice-runtime-python/.../session.py` |
| Delegation mode | **`delegation="responses"`** (backend Responses API runs `@function_tool`) | Same commits; LiveKit docs: `client` delegation ignores framework tools |
| Backend model | **`gpt-6-luna`** default (`astraModel` from Node `resolve_voice_v3_livekit_session`) | `1691b3863` (2026-09-24) default Luna |
| Direct Amy tools | **No** — speaking model has no tool surface; tools on `AgentSession` feed **delegated Responses** only | LiveKit `GPTLiveModel` capabilities `mutable_tools=delegation=="responses"` |
| Legacy `gpt-realtime` PSTN | **Not** Voice V3 inbound path; `session_factory.py` / MCTB SIP answer sessions only | Git path split at `15f8ca951` “single canonical GPT-Live agent” |

**Conclusion:** Working Sept-era calls were **Option A (GPT-Live + Responses delegation)**, not gpt-realtime direct tools.

## 2. Tool registration: 8 vs 6

| Count | Source |
|-------|--------|
| **~8** | `VOICE_V3_PROMPT_FINGERPRINT.toolNames` — published editor fingerprint (includes names not sent to worker, e.g. `end_call`, disabled catalog entries) |
| **6** | Python `session_tools` = HTTP `toolSchemas` (typically **5**) + native **`end_call`** (+ optional **FileSearch**) |

**Not dropped:** `send_booking_link` and `collect_caller_intake` are in `schemaToolNames` when editor enables SEND_LINK + booking URL.  
**Logging bug fixed:** `amyToolNames` used `getattr(t,"name")` → empty; now uses `tool.info.name`.

**New logs:** `voice_v3_gpt_live_session_config`, `voice_v3_responses_validation_failed` (server events containing validation failure types).

## 3. v2 wiring changes

- **Amy (GPT-Live):** `gpt-live-amy-instructions.ts` — persona, backend capability policy (no tool names), `<|SpawnThinking|>` when / when-not, outcome guardrails.
- **Backend (Luna/Astra):** Full contracts in `astra-tool-contracts.ts`; tool descriptions unchanged in length requirement test.
- **Mid-call:** Removed planner `thinking` snapshot push after tools; **commentary-only** from `speech_line` / tool result. Delegation hydration no longer appends large thinking blocks.
- **send_booking_link:** Always full contract; success includes `speech_line` + `idempotency_key`.

## 4. Old vs new descriptions (excerpt)

### `send_booking_link`

**Old (Oct regression — inline stub when platform sender):**  
Short paragraph: “Default: ask if you should text the number they are calling from… Do not claim sent until…”

**New:** Full `WHAT / WHEN / WHEN NOT / WHILE / SUCCESS / FAILURE / ARGUMENTS` in `SEND_BOOKING_LINK_TOOL_DESCRIPTION` (see `astra-tool-contracts.ts`).

### `transfer_call`

**Old (Sept `3ab577131`):** Single paragraph authorized transfer; no sections.  
**New:** Full sectioned contract with caller phrasing examples and alternate-tool guidance.

## 5. LiveKit AgentSession tests (5×5)

| Scenario | Runs | Result |
|----------|------|--------|
| booking_link | 5 | **BLOCKED** — no `OPENAI_API_KEY` on build VM |
| booking→transfer→booking | 5 | **BLOCKED** |
| question→booking | 5 | **BLOCKED** |
| callback | 5 | **BLOCKED** |
| message | 5 | **BLOCKED** |

**Static PASS:** `npx tsx new-app/scripts/test-voice-v3-amy-live-tool-description-spec.ts`  
**Option B (gpt-realtime-2.1 direct tools):** Not prototyped — Option A live matrix blocked on credentials; do not deploy Option B without approval.

**Post-deploy manual (John):** One PSTN call — book → agree to text this number → confirm `voiceToolExecution` / `send_booking_link` + worker `schemaToolNames` includes both link + intake tools.

## 6. Deploy

Filled after push + Coolify (web auto on `master`; voice app `transovo-voice` manual).
