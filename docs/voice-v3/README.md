# Voice V3 documentation

| Doc | Purpose |
|-----|---------|
| [OPENAI-NATIVE-FIRST-ARCHITECTURE.md](./OPENAI-NATIVE-FIRST-ARCHITECTURE.md) | **Read before any V3 feature work** — OpenAI-native vs app-owned split |
| [NEW_NUMBER_PROVISIONING.md](./NEW_NUMBER_PROVISIONING.md) | Provisioning lifecycle + known-good Telnyx reference |

Runtime entry: `src/lib/voice-v3-basic/` (webhooks, SIP, accept) + `src/lib/voice-v3/` (prompts, telemetry, call context, intake pipeline).

**Intake:** `VOICE_V3_BOOKING_AGENT_CONFIG` + `VoiceV3CallRuntime` + Astra `emit_caller_meaning` / `voice_v3_caller_meaning`. Tests: `npm run test:voice-v3-intake`. Odd-field harness: `scripts/fixtures/` only (not in `src/`).

## Production pipeline logging

All stages emit **`VOICE_V3_PIPELINE`** JSON (grep Coolify logs). Default **`VOICE_V3_PIPELINE_LOG=normal`** (on unless set to `off`). Set **`verbose`** to log every Astra nested event including argument deltas. Phone numbers and emails are redacted in log strings.

Call end summary **`VOICE_V3_CALL_SUMMARY`** includes `pipeline` counters (`meaning_received`, `meaning_failed`, `astra_nested_events`, …).
