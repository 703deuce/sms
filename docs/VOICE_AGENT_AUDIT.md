# Voice Agent Quality Audit

**Last updated:** 2026-08-30  
**Scope:** Amy 866 production path + LiveKit hybrid path + advanced voice runtime engineering  
**Related:** `docs/amy-llm-tts-pipeline-audit.md`

---

## Executive summary

| Path | Runtime | Transovo TTS control |
|------|---------|----------------------|
| **Amy +18663464256 (production)** | TeXML Direct → Telnyx AI Assistant | **None** — vendor-internal LLM→TTS |
| **LiveKit hybrid (in-repo)** | OpenAI Realtime text + ElevenLabs TTS | **Full** — SpeechCompiler, generation isolation |

**Priority investigation for occasional bizarre TTS moments (user-reported):**

1. Partial text + `auto_mode` mismatch (LiveKit: **mitigated** — `autoMode: false`)
2. Lost ElevenLabs request continuity between segments (**gap** — `previous_text` / `previous_request_ids` not wired)
3. Voice stability/style variance (**audit** — tune via `resolveElevenLabsTuningFromVoiceConfig`)
4. Audio generated too far ahead of playback (**gap** — no `queued_audio_ms` instrumentation yet)

Do **not** change Haiku, Telnyx architecture, or OpenAI Realtime until the four items above are measured.

---

## Production path (Amy 866) — Telnyx-applicable architecture (v1)

Applied on the **live TeXML → Telnyx assistant** path (not LiveKit):

| Capability | Implementation |
|------------|----------------|
| Speech shaping (prompt) | `TELNYX_SPEECH_PROMPT_GUIDANCE` in `assistant-sync.ts` + `caller-constitution.ts` |
| Tool speak normalization | `formatTelnyxToolPayload()` on `/api/telnyx/voice/tools` egress |
| Voice consistency tuning | `applyAmyProductionVoiceTuning()` — stability 0.72, style 0, pronunciation dict |
| Config fingerprint | `voiceCall.metadata.voiceConfigFingerprint` on Telnyx call create |
| Pronunciation | `AMY_PRONUNCIATION_DICTIONARY` + instruction notes |
| Failure taxonomy / repair | Prompt rules in constitution + Telnyx speech guidance |
| Republish script | `scripts/amy-apply-telnyx-voice-architecture.ts` |

**Still Telnyx-internal (we cannot control):** generation IDs, TTS chunking, `previous_text` continuity, audio queue depth.

---

## Production path (Amy 866)

| Layer | Value |
|-------|-------|
| Agent ID | `cmshz2lc25c622c4i58303501` |
| Telnyx assistant | `assistant-197f496d-d98a-4995-ad0e-a10aca90951d` |
| Published version | v51 (no `runtime_turn`) |
| LLM | `anthropic/claude-haiku-4-5` (Telnyx-managed) |
| STT | `deepgram/nova-3` |

Transovo controls: tool webhooks, prompt content, pronunciation dictionary, interruption settings.  
Transovo does **not** control: token→TTS chunking, generation isolation, SpeechCompiler on this path.

---

## LiveKit hybrid path (in-repo)

```
LLM token stream
  → [optional] phraseBufferStream     VOICE_TTS_USE_PHRASE_BUFFER=1 (default OFF)
  → SpeechCompiler                    src/lib/voice/tts/speech-compiler.ts
  → generation isolation              src/lib/voice/tts/generation-context.ts
  → ElevenLabs plugin (SentenceTokenizer + chunkLengthSchedule)
  → LiveKit playback
```

ElevenLabs hybrid config (`voice-runtime/src/pipeline.ts`):

- `autoMode: false` — avoids low-buffer mode with partial LLM fragments
- `chunkLengthSchedule: [50, 80, 120, 150]`
- `SentenceTokenizer` min 10 chars, stream context 6
- LiveKit plugin uses **multi-stream WebSocket** with per-synthesis `contextId` (built-in)

---

## Section 23 — Production Voice Architecture Principles

### A. VERSION EVERY TURN

| | |
|---|---|
| **CURRENT STATE** | LiveKit hybrid: `generation-context.ts` assigns `call_id`, `turn_id`, `generation_id`. Hybrid `ttsNode` drops chunks when generation is cancelled. Latency instrumentation calls `cancelActiveGeneration` on caller barge-in and `advanceCallerTurn` on speech end. Telnyx 866: no Transovo generation IDs. |
| **EVIDENCE** | `src/lib/voice/tts/generation-context.ts`, `voice-runtime/src/hybrid-streaming-tts-node.ts`, `voice-runtime/src/latency-instrumentation.ts` |
| **CHANGE** | Wired in this PR. Telnyx path unchanged (vendor-internal). |
| **MEASURED RESULT** | Unit tests: `scripts/test-generation-context.ts` |
| **RISK** | Low on LiveKit — stale chunk drop is additive. |
| **ROLLBACK** | Remove generation checks from hybrid node; revert latency hooks. |

### B. SEPARATE COMPUTE FROM SPEECH COMMIT

| | |
|---|---|
| **CURRENT STATE** | LiveKit logs `preemptive_generation_observed` when STT finalizes while user still speaking. Speculative LLM allowed; speech commits via LiveKit/ElevenLabs only after turn handling permits. |
| **EVIDENCE** | `voice-runtime/src/latency-instrumentation.ts` — `preemptive_generation_observed` |
| **CHANGE** | Document only; no architecture change. |
| **MEASURED RESULT** | N/A — existing telemetry |
| **RISK** | N/A |
| **ROLLBACK** | N/A |

### C. SEPARATE REPRESENTATIONS

| | |
|---|---|
| **CURRENT STATE** | `speechTripleFromCanonical()` + `normalizeTtsText()` in SpeechCompiler. Tool/business data not mutated for TTS. |
| **EVIDENCE** | `src/lib/voice/tts/speech-compiler.ts`, `normalize-tts-text.ts` |
| **CHANGE** | SpeechCompiler created; wired into hybrid path. |
| **MEASURED RESULT** | `scripts/test-speech-compiler.ts` |
| **RISK** | Low |
| **ROLLBACK** | Revert to `maybeNormalizeForElevenLabsModel` only. |

### D. DETERMINISTIC CODE OWNS TRUTH

| | |
|---|---|
| **CURRENT STATE** | Booking guards, business hours, tool validation in domain-actions and workflow engine. Company FAQ in prompt (v50+). `runtime_turn` removed (v51). |
| **EVIDENCE** | `caller-constitution.ts`, `workflow-engine/guard.ts`, PR #302/#303 |
| **CHANGE** | Prior PRs; maintained. |
| **MEASURED RESULT** | `test-caller-amy-orchestration.ts` |
| **RISK** | N/A |
| **ROLLBACK** | N/A |

### E. SOFT CONVERSATION STATES

| | |
|---|---|
| **CURRENT STATE** | Workflow engine states gate tools per intent. Receptionist compiled intents activate field collection. Not a full IVR — internal only. |
| **EVIDENCE** | `src/lib/voice/workflow-engine/states.ts`, `workflow-intent-activation.ts` |
| **CHANGE** | Future: narrow active tools further per state. |
| **MEASURED RESULT** | Not yet benchmarked |
| **RISK** | Medium if over-constrained |
| **ROLLBACK** | Widen tool surface per state |

### F. CONFIGURATION VERSIONING

| | |
|---|---|
| **CURRENT STATE** | `buildVoiceConfigFingerprint()` persists SHA256 fingerprint on LiveKit `voiceCall.metadata` and logs in `pipeline_config`. Telnyx 866: `agentVersionId` on call row; full fingerprint not on Telnyx path yet. |
| **EVIDENCE** | `src/lib/voice/config-fingerprint.ts`, `runtime-provider/livekit.ts`, `inbound-session-pipeline.ts` |
| **CHANGE** | Fingerprint wired this PR. |
| **MEASURED RESULT** | Inspect `voiceCall.metadata.voiceConfigFingerprint` after LiveKit call |
| **RISK** | Low — metadata only |
| **ROLLBACK** | Remove metadata field |

### G. FAILURE → REGRESSION TEST

| | |
|---|---|
| **CURRENT STATE** | `test-caller-amy-orchestration.ts`, `test-tts-phrase-pipeline.ts`, phrase buffer tests. No 500-scenario golden eval set yet. |
| **EVIDENCE** | `scripts/` test suite |
| **CHANGE** | Add sanitized failures to eval corpus over time. |
| **MEASURED RESULT** | N/A |
| **RISK** | N/A |
| **ROLLBACK** | N/A |

### H. ACTUAL PSTN QUALITY TESTING

| | |
|---|---|
| **CURRENT STATE** | Amy 866 certified via real calls. No automated PSTN canary yet. |
| **EVIDENCE** | Caller Amy five-gate docs |
| **CHANGE** | Future: synthetic canary calls (Section 24.T) |
| **MEASURED RESULT** | Manual cellphone testing required for voice selection |
| **RISK** | N/A |
| **ROLLBACK** | N/A |

### I. DO NOT OPTIMIZE FOR MINIMUM LATENCY

| | |
|---|---|
| **CURRENT STATE** | `autoMode: false` on hybrid ElevenLabs. Phrase buffer **default OFF** (`VOICE_TTS_USE_PHRASE_BUFFER` opt-in). Dual commit mode in SpeechCompiler (`fast` vs `contextual`). |
| **EVIDENCE** | `pipeline.ts`, `speech-compiler.ts` |
| **CHANGE** | Phrase buffer made opt-in this PR. |
| **MEASURED RESULT** | Benchmark before enabling phrase buffer or auto_mode |
| **RISK** | Enabling both phrase buffer + SentenceTokenizer = double buffering |
| **ROLLBACK** | `VOICE_TTS_USE_PHRASE_BUFFER=0` |

---

## Section 24 — Advanced Voice Runtime Engineering

### A. SPEECH COMPILER

| | |
|---|---|
| **CURRENT STATE** | `SpeechCompiler` implemented: semantic → speech text, commit mode, segment splits. Wired into hybrid `ttsNode`. |
| **EVIDENCE** | `src/lib/voice/tts/speech-compiler.ts` |
| **CHANGE** | Created and wired. |
| **MEASURED RESULT** | `scripts/test-speech-compiler.ts` PASS |
| **RISK** | Low |
| **ROLLBACK** | Direct `normalizeTtsText` in hybrid node |

### B. TTS CONTINUITY

| | |
|---|---|
| **CURRENT STATE** | LiveKit ElevenLabs plugin uses multi-stream WebSocket with `contextId` per synthesis. **`previous_text` / `previous_request_ids` not passed** from Transovo code. Independent segment prosody resets possible. |
| **EVIDENCE** | `node_modules/@livekit/agents-plugin-elevenlabs/src/tts.ts` — `multiStreamUrl`, `contextId` |
| **CHANGE** | **Not implemented** — requires plugin API extension or custom TTS wrapper. |
| **MEASURED RESULT** | N/A |
| **RISK** | Medium — wrong continuity params can worsen quality |
| **ROLLBACK** | N/A |

### C. ALIGNMENT-BASED DEBUGGING

| | |
|---|---|
| **CURRENT STATE** | ElevenLabs plugin has `syncAlignment: true` by default. Alignment not persisted to `voiceCall` / diagnostics DB. |
| **EVIDENCE** | Plugin `tts.ts` — `syncAlignment` |
| **CHANGE** | Future: persist `generation_id` → alignment map when `VOICE_TTS_PIPELINE_DEBUG=1` |
| **MEASURED RESULT** | N/A |
| **RISK** | Low (diagnostic only) |
| **ROLLBACK** | N/A |

### D. VOICE CONSISTENCY BENCHMARK

| | |
|---|---|
| **CURRENT STATE** | Voice tuning via `resolveElevenLabsTuningFromVoiceConfig` (stability, similarity, style, speed, speaker_boost). No 100× regression corpus. |
| **EVIDENCE** | `voice-runtime/src/pipeline.ts`, `elevenlabs/receptionist-voice-catalog.ts` |
| **CHANGE** | Future: statistical TTS QA script |
| **MEASURED RESULT** | N/A |
| **RISK** | Raising stability reduces expressiveness |
| **ROLLBACK** | Revert voice settings |

### E. AUTO_MODE SAFETY

| | |
|---|---|
| **CURRENT STATE** | **`autoMode: false`** on hybrid path. SentenceTokenizer handles buffering. Phrase buffer opt-in only. |
| **EVIDENCE** | `pipeline.ts` lines 236–241 |
| **CHANGE** | None — correct per provider guidance |
| **MEASURED RESULT** | Code audit PASS |
| **RISK** | Enabling auto_mode with token fragments would **increase** artifacts |
| **ROLLBACK** | Keep `autoMode: false` |

### F. DUAL TTS COMMIT POLICY

| | |
|---|---|
| **CURRENT STATE** | `resolveTtsCommitMode()` returns `fast` for micro-phrases / short complete sentences, `contextual` otherwise. Logged when `VOICE_TTS_PIPELINE_DEBUG=1`. Not yet fed into ElevenLabs flush API. |
| **EVIDENCE** | `speech-compiler.ts`, hybrid node debug logs |
| **CHANGE** | Policy defined; ElevenLabs flush wiring future |
| **MEASURED RESULT** | Unit tests on commit mode resolution |
| **RISK** | Low until flush wired |
| **ROLLBACK** | N/A |

### G. CONTROLLED AUDIO HORIZON

| | |
|---|---|
| **CURRENT STATE** | **Not instrumented.** No `queued_audio_ms` / `generated_audio_ahead_ms` tracking. |
| **EVIDENCE** | Gap in telemetry |
| **CHANGE** | Future — measure on LiveKit playback path |
| **MEASURED RESULT** | N/A |
| **RISK** | Hard limits without measurement could cause underruns |
| **ROLLBACK** | N/A |

### H. AUDIO CODEC AUDIT

| | |
|---|---|
| **CURRENT STATE** | ElevenLabs default encoding PCM; LiveKit resamples for SIP. Full chain not documented in-repo. |
| **EVIDENCE** | Plugin `DEFAULT_ENCODING`, Telnyx SIP path |
| **CHANGE** | Document chain in future pass; prefer μ-law only at PSTN boundary |
| **MEASURED RESULT** | N/A |
| **RISK** | Codec changes need PSTN regression |
| **ROLLBACK** | N/A |

### I. ADAPTIVE PLAYBACK BUFFER

| | |
|---|---|
| **CURRENT STATE** | LiveKit/WebRTC handles jitter. No custom adaptive buffer in Transovo. |
| **EVIDENCE** | LiveKit agent defaults |
| **CHANGE** | None unless underrun metrics justify |
| **MEASURED RESULT** | N/A |
| **RISK** | N/A |
| **ROLLBACK** | N/A |

### J. SESSION PREWARMING

| | |
|---|---|
| **CURRENT STATE** | LiveKit bootstrap initializes DB session, call context. ElevenLabs WebSocket opened on first TTS. Python bootstrap snapshot reduces cold config load. |
| **EVIDENCE** | `bootstrap-inbound.ts`, `livekit.ts` |
| **CHANGE** | Future: explicit TTS WebSocket prewarm at call start |
| **MEASURED RESULT** | N/A |
| **RISK** | Low |
| **ROLLBACK** | N/A |

### K. CONNECTION HEALTH

| | |
|---|---|
| **CURRENT STATE** | Component latency in `latency-instrumentation.ts`. No separate DNS/TLS/pool metrics. |
| **EVIDENCE** | `turn_latency_breakdown` logs |
| **CHANGE** | Future instrumentation |
| **MEASURED RESULT** | N/A |
| **RISK** | N/A |
| **ROLLBACK** | N/A |

### L–X. (Future work)

Items L through X (fast/reasoning path routing, structured state, conversation repair, promise ledger, failure taxonomy, provider degradation, circuit breakers, tail SLOs, canary calls, statistical TTS QA, semantic commit gate, conversation governor, caller correction metrics) are **documented as targets** — not implemented in this PR. See user architecture brief for full specifications.

---

## Section 25 — Minimum-Side-Effect Voice Architecture (Amy 866 production)

**Goal:** The live voice agent does the minimum external work necessary for a good phone conversation.

| Class | During call | Examples |
|-------|-------------|----------|
| **A — Local knowledge** | Prompt only | Hours, services, service area, FAQs |
| **B — Required live action** | Narrow tool surface | `send_sms` (template link), `escalate_human`, `lookup_customer` |
| **C — Deferred** | Post-call worker | CRM sync, tags, notes, lead scoring, analytics |

### Production configuration (866)

- **Model:** `openai/gpt-5.4-mini` (Telnyx BYOK)
- **STT:** `deepgram/flux` with `flux_b_fast` latency profile
- **Published tools:** `send_sms`, `record_call_fact`, `take_structured_message`, `lookup_customer`, `escalate_human`, native `hangup`
- **Retired on this line:** `continue_workflow`, `record_current_field`, `get_runtime_context`, live calendar booking

### Key modules

| Module | Path |
|--------|------|
| Config | `src/lib/voice/telnyx/amy-minimum-side-effect.ts` |
| CallFactStore | `src/lib/voice/call-fact-store.ts` |
| SMS templates | `src/lib/voice/sms/voice-sms-templates.ts` |
| Tool publish gate | `src/lib/voice/workflow-engine/tool-publish.ts` |
| Republish script | `scripts/amy-minimum-side-effect-republish.ts` |

### Reliability rules

1. Answer locally when possible — no tool for FAQ.
2. Capture facts with `record_call_fact` — local DB, not CRM.
3. Text-first completion — `send_sms({ template_id: "booking_link" })` instead of live calendar booking.
4. Confirm SMS only after provider acknowledgment.
5. Target 0–2 live external tool calls per ordinary call.
6. Post-call merges CallFactStore + transcript for structured extraction.

### Tests

```bash
npx tsx scripts/test-caller-amy-orchestration.ts
npx tsx scripts/test-call-fact-store.ts
npx tsx scripts/test-voice-sms-templates.ts
npx tsx scripts/amy-minimum-side-effect-republish.ts   # requires DB + Telnyx
node scripts/audit-caller-amy-published-tools.mjs      # live catalog gate
```

---

## Tests

```bash
npx tsx scripts/test-generation-context.ts
npx tsx scripts/test-speech-compiler.ts
npx tsx scripts/test-tts-phrase-pipeline.ts
npx tsx scripts/test-phrase-text-buffer.ts
npx tsx scripts/test-caller-amy-orchestration.ts
```

## Environment flags

| Flag | Default | Purpose |
|------|---------|---------|
| `VOICE_TTS_USE_PHRASE_BUFFER` | `0` | Opt-in phrase chunker before ElevenLabs (avoid double buffering) |
| `VOICE_TTS_PIPELINE_DEBUG` | `0` | Log generation_id, commit mode, chunk previews |

## Recommended next steps (priority order)

1. **Measure** hybrid path with `VOICE_TTS_PIPELINE_DEBUG=1` on a test call — confirm generation cancel on barge-in
2. **Investigate** ElevenLabs `previous_text` continuity for multi-segment responses
3. **Instrument** `queued_audio_ms` on LiveKit playback
4. **Run** voice consistency benchmark (200 sentences × 20 generations) before tuning stability
5. **Do not** change Haiku or migrate 866 to OpenAI Realtime until items 1–3 show a clear bottleneck
