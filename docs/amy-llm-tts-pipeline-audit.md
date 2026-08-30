# Amy LLM → TTS pipeline audit

**Date:** 2026-08-30  
**Scope:** Speech artifacts (malformed words, phrase-boundary glitches) without changing LLM or voice model.

## Production path (Amy +18663464256)

| Layer | Owner |
|-------|--------|
| Inbound | TeXML Direct → Telnyx AI Assistant |
| STT | Telnyx (`deepgram/nova-3`) |
| LLM | Telnyx (`anthropic/claude-haiku-4-5` on live assistant) |
| TTS | Telnyx-managed (Ultra / ElevenLabs when configured via publish) |
| Transovo | Tool webhooks only (`/api/telnyx/voice/tools`) |

**Finding:** On the Telnyx Assistant path, **Transovo does not control LLM token → TTS chunking**. Telnyx runs the full cascade internally. Phrase buffering and normalization in this repo apply to the **LiveKit half-cascade** path only.

### Telnyx path — what we can tune without architecture change

- Assistant `interruption_settings` (barge-in, `wait_seconds`, endpointing)
- Cleaner **text in prompts** (fewer awkward symbols for the model to speak)
- Telnyx **pronunciation dictionary** entries (e.g. Transovo, Harbor Drain Pros)
- **Tool surface** — remove `runtime_turn` so the model does not double-invoke tools on FAQ turns

### Telnyx path — what requires Conversation Relay or LiveKit

- Phrase-aware chunker before TTS
- Custom normalization pipeline
- Per-chunk TTS diagnostics
- Explicit cancel/flush of queued TTS text on barge-in

## LiveKit path (in-repo, not 866 production today)

Pipeline when `REALTIME_ELEVENLABS` output mode is active:

```
LLM token stream
  → phraseBufferStream()     [src/lib/voice/tts/phrase-text-buffer.ts]
  → normalizeTtsText()       [src/lib/voice/tts/normalize-tts-text.ts]
  → ElevenLabs TTS plugin    [voice-runtime/src/hybrid-streaming-tts-node.ts]
```

### Phrase chunker behavior

- Flushes on `. ? ! …` (min 12 chars), `, ; : —` (min 4 chars), or **max 10 words**
- Never flushes per token; never splits inside a word
- Remainder flushed at end of stream

### Normalization (pre-TTS)

- Phones, emails, URLs, currency, times, dates (basic), acronyms (FAQ, HVAC, SMS)
- Unicode punctuation cleanup

### Interruption

- LiveKit `ttsNode` stream uses default cancellation (`stream.close` on interrupt)
- Hybrid telemetry: `voice-runtime/src/hybrid-streaming-telemetry.ts`
- Diagnostics (opt-in): `VOICE_TTS_PIPELINE_DEBUG=1` → `src/lib/voice/tts/pipeline-diagnostics.ts`

## Tests

```bash
npx tsx scripts/test-generation-context.ts
npx tsx scripts/test-speech-compiler.ts
npx tsx scripts/test-phrase-text-buffer.ts
npx tsx scripts/test-tts-phrase-pipeline.ts
npx tsx scripts/test-caller-amy-orchestration.ts
```

See also: **`docs/VOICE_AGENT_AUDIT.md`** (sections 23–24 advanced architecture).

## Recommendations

1. **Keep current voice** on 866; do not switch architecture until chunker audit on LiveKit path is green.
2. **Removed `runtime_turn`** from Telnyx publish — direct tools (`continue_workflow`, `record_current_field`, etc.) per `audit-caller-amy-published-tools.mjs`.
3. When migrating 866 to LiveKit + ElevenLabs hybrid, the shared TTS modules above are already wired.
4. For Telnyx-only improvements before migration: add pronunciation aliases for brand terms; keep FAQ answers in prompt (no tool calls).

## Conversation Relay (future)

Telnyx Conversation Relay would let Transovo stream **phrase-sized text** over WebSocket while Telnyx handles media/STT/TTS — same abstraction as our LiveKit hybrid node without maintaining SIP/audio plumbing.
