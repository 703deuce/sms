# Golden-era Voice V3 receptionist vs new-app — front to back

**Golden anchor:** commit `a4a63466c` (2026-09-24), PSTN LiveKit on cert DIDs, Amy (GPT-Live) + Astra/Luna (delegated Responses), reliable M365 SET→FIND→BOOK when Amy delegated.

**“Ours” today:** AI Receptionist in **new-app** (`new-app/lib/server/voice-v3/**`), same Python LiveKit worker (`voice-runtime-python/transovo_voice/voice_v3/**`), internal API `new-app/app/api/internal/voice-runtime/route.ts`.

This doc is the **full stack** comparison (prompts, wrappers, runtime), not only prompt text.

---

## End-to-end call flow (same mental model as Sept)

```
Caller (PSTN)
  → Telnyx SIP → LiveKit room
  → Python worker: GPTLiveModel(gpt-live-1, delegation="responses")
       Amy instructions = published amyInstructions
       responses_options.instructions = published astraInstructions
       AgentSession tools = toolSchemas from session resolve (FunctionTools → Node)
  → On delegate: OpenAI Responses (Luna/Sol) picks tools
  → LiveKit function_tool → HTTP execute_voice_v3_livekit_tool
  → new-app executeVoiceTool → calendar / intake / transfer / …
  → liveContextEvents → Python apply_live_context → Amy thinking/commentary
```

Golden era and new-app **share this shape**. What changed is **which Node app compiles prompts**, **product mode gates**, and **a few prompt deltas** after the booking incident.

---

## Layer 1 — Publish / compile (wizard → frozen bundle)

| | Golden monolith | new-app AI Receptionist |
|---|-----------------|-------------------------|
| Editor | Voice V3 / receptionist wizard in monolith | `new-app` receptionist editor (`AgentConfig`) |
| Config object | `VoiceV3AgentConfig` via `compile-voice-v3-agent-config` / published agent | `editorToVoiceV3AgentConfig()` + `compilePublishedBundle()` |
| Prompt compile | `buildVoiceV3Prompts()` | Same builder under `new-app/lib/server/voice-v3/build-voice-v3-prompts.ts` |
| Tool name list | Wizard capability parity / catalog | `enabledVoiceToolNamesFromEditor()` in `compile-runtime.ts` |
| **New in new-app** | — | `runtimeProfile`: `conversational_ivr` vs `full_receptionist`; IVR injects extra guardrails in `editor-to-voice-v3-config.ts` and **strips booking tools** in `voice-tool-catalog.ts` |

**Takeaway:** Golden PSTN cert lines were always **full receptionist + live calendar**. new-app can publish **Conversational IVR**, which removes `book_appointment` / `find_availability` / `set_scheduling_preference` from Luna’s surface even though Amy’s voice can still sound like a receptionist.

---

## Layer 2 — Amy (front / GPT-Live) prompts

Built by `buildLiveFrontendInstructions()`:

| Section | Golden / monolith `master` | new-app |
|---------|---------------------------|---------|
| ROLE, capabilities, BUSINESS FACTS, PERSONA | Same pattern | Same; **+ optional FAQ block** from `business.faqFacts` |
| Delegation policy | `live-delegation-policy.ts` (#682 golden restore on monolith) | Same file family; **+ `bookingCompletion` block** (do not quote times / “reserved” until backend books; delegate on “did you book?”) |
| Telephony behavior (turn-taking, barge-in, noise, truth) | **Inline** in `live-frontend-instructions.ts` (~15k file) | **Extracted** to `prompt-canon-export.ts` as `AMY_LIVE_TELEPHONY_STATIC_CANON` (~7.8k + canon) — **same canonical text**, different file layout |
| Greeting / speaks-first | Same | Same |
| Post-#682 “wizard intake walls” (`CONFIGURED CALLER INFORMATION`, etc.) | **Not** in current monolith `master` live-frontend (reverted with #682) | **Not** in new-app either |

**vs Sept `a4a63466c`:** See `reports/voice-v3-golden-era-vs-recent-prompt-diff.md` — the **broken Oct prompts** were the *pre-#682* master experiment (extra intake surfacing, verbose stale-delegation essay). **Current monolith and new-app align with golden Amy/Astra modules**, except new-app’s **booking delegation guard** and **FAQ facts**.

**Critical front-layer behavior (unchanged since golden):** Amy has **no tool schemas**. She only speaks and triggers **delegation**. If she narrates “Tuesday at 10” without delegating, **no tool will fire** — that is not Luna “ignoring” tools.

---

## Layer 3 — Delegation wrapper (GPT-Live ↔ Responses)

| Piece | Golden | new-app |
|-------|--------|---------|
| Worker entry | `voice-runtime-python/.../voice_v3/session.py` | **Same worker** |
| `delegation` | `"responses"` hardcoded | Same |
| `responses_options` | `model`, `instructions` (Astra), `reasoning`, `text.verbosity` | Same; **tools are not duplicated inside `responses_options`** (LiveKit registers tools on `AgentSession`) |
| Luna model default | `gpt-5.6-sol` in git at golden; Luna via env in prod | `gpt-6-luna` default in `delegation-config.ts` (env `VOICE_V3_ASTRA_MODEL` still overrides) |
| Transport | `function_tool` (default) | Same; `VOICE_V3_INTAKE_TRANSPORT=output_text` is legacy test-only |
| Delegation config builder | `buildVoiceV3AstraDelegationResponses()` | Ported; attaches **full** `buildVoiceV3AstraFunctionTools()` when intake pipeline on |

**Hydration on each delegation** (so Luna sees intake/scheduling state):

- Monolith: `pushDelegatedRuntimeContextToLive` → thinking + commentary
- new-app: **Ported** (`push-delegated-runtime-context.ts`, `resolveDelegatedRuntimeContext` on internal API)
- Python: `tool_client.resolve_delegated_runtime_context` + after each tool `live_context_hydration.apply_live_context_from_tool_result`

---

## Layer 4 — Astra / Luna (back) prompts

Assembled by `buildAstraBackendInstructions()`:

| Module | Monolith vs new-app |
|--------|---------------------|
| `astra-backend-core-instructions.ts` | **Identical** |
| `astra-intake-instructions.ts` | **Identical** |
| `astra-callback-instructions.ts` | Trivial diff |
| `astra-cross-tool-instructions.ts` | new-app **+ rules 6b/6c** (no “booked” without `book_appointment`; on “did you book?” use `find_appointment`, not only `update_intake`) |
| `astra-tool-contracts.ts` | **Identical** (PR #682 golden tool **descriptions** Luna reads) |
| Strategy append (REQUEST_ONLY / SEND_LINK) | Same in `astra-backend-instructions.ts` |

**vs golden Sept:** Cross-tool on monolith `master` is the **#682 restored flat discipline list**. The large “sections 1–8 + effective-prompt-capabilities” rewrite was **pre-#682** and is **not** what new-app ships.

---

## Layer 5 — Tool surface Luna actually gets

| | Golden monolith `voice-v3-livekit.ts` | new-app `resolve-livekit-session.ts` |
|---|--------------------------------------|--------------------------------------|
| OpenAI tools | `buildVoiceV3AstraFunctionToolsFromCatalog(config)` | **Same** |
| Per-field intake tools | `buildLiveKitIntakeFunctionTools` merged | **Restored** (was missing; parity fix on branch `cursor/golden-era-v3-parity-9779`) |
| `intakeFields` metadata for Python | `buildLiveKitIntakeFieldMetadata` | **Restored** |
| Filter | Published capability list + catalog gating | `rt.toolNames` from publish + catalog; **IVR allowlist** only on new-app |

Executors live in `new-app/lib/server/voice-v3/tools/*` — port of monolith `src/lib/voice-v3/tools/*` (SET/FIND/BOOK, M365 adapters, intake, callback, transfer).

---

## Layer 6 — HTTP bridge (wrappers)

| Action | Purpose |
|--------|---------|
| `resolve_voice_v3_livekit_session` | Compile prompts + tool schemas + create call runtime |
| `execute_voice_v3_livekit_tool` | Run Luna tool on Node |
| `resolve_voice_v3_delegated_runtime_context` | Push authoritative snapshot into delegation |
| `commit_voice_v3_livekit_caller_utterance` | Transcript / revision (not delegation) |
| `append_voice_v3_forensic_events` / `flush_voice_v3_forensics` | Call forensics |

Golden monolith used the same action names on monolith `src/app/api/internal/voice-runtime`. Production receptionist numbers today should hit **new-app** route with the same JSON contract (Python `TransovoBackend.call`).

---

## What actually differs from “golden era tools always fired”

1. **Front (Amy):** Booking language without delegation → **zero calendar tools** (your Oct 21 call: only `update_intake` after “did you book?”). Golden era **also** required delegation; the difference is **compliance**, not missing `astra-tool-contracts`. new-app now tightens Amy + Astra copy for that case.

2. **Product mode (new-app only):** Conversational IVR publish → Luna **never** gets booking tools.

3. **Model default:** `gpt-6-luna` vs era of `gpt-5.6-sol` — prompts were designed to be model-agnostic; use env to A/B.

4. **Stale audit doc:** `VOICE-V3-GOLDEN-ERA-NEW-APP-PARITY-AUDIT.md` originally claimed stub tools on new-app — **false on current code**; catalog + contracts are ported.

5. **Not a golden-era regression:** Python `responses_options` without explicit `tools` array — same as Sept LiveKit path; tools come from session bootstrap `toolSchemas`.

---

## Quick reference — file homes

| Concern | Golden monolith | new-app |
|---------|-----------------|---------|
| Amy prompt | `src/lib/voice-v3/prompts/live-frontend-instructions.ts` | `new-app/lib/server/voice-v3/prompts/live-frontend-instructions.ts` + `prompt-canon-export.ts` |
| Delegation policy | `live-delegation-policy.ts` | same (under new-app prompts) |
| Astra stack | `astra-backend-instructions.ts` + modules | same paths under `new-app/lib/server/voice-v3/prompts/` |
| Tool descriptions | `tools/astra-tool-contracts.ts` | ported |
| Session bootstrap | `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` | `resolve-livekit-session.ts` |
| Worker | `voice-runtime-python/transovo_voice/voice_v3/session.py` | shared |
| Internal API | monolith route | `new-app/app/api/internal/voice-runtime/route.ts` |

---

## Verification commands

```bash
# Prompt export sample (new-app)
cd new-app && npx tsx scripts/export-voice-v3-prompt-canonical.mjs

# Config / tool gating smoke (no DB)
cd new-app && NODE_OPTIONS='--import ../scripts/preload-server-only.mjs' npx tsx scripts/test-receptionist-config-source.ts

# Golden-era prompt diff narrative
cat reports/voice-v3-golden-era-vs-recent-prompt-diff.md
```

---

*For booking failures: check forensics for delegation + `set_scheduling_preference` / `find_availability` / `book_appointment` **before** trusting spoken confirmation. Prompt parity with Sept is largely restored; the gap is usually **when Amy delegates**, not missing backend tool definitions.*
