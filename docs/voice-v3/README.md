# Voice V3 documentation

| Doc | Purpose |
|-----|---------|
| [OPENAI-NATIVE-FIRST-ARCHITECTURE.md](./OPENAI-NATIVE-FIRST-ARCHITECTURE.md) | **Read before any V3 feature work** — OpenAI-native vs app-owned split |
| [NEW_NUMBER_PROVISIONING.md](./NEW_NUMBER_PROVISIONING.md) | Provisioning lifecycle + known-good Telnyx reference |

Runtime entry: `src/lib/voice-v3-basic/` (webhooks, SIP, accept) + `src/lib/voice-v3/` (prompts, telemetry, call context, intake pipeline).

**Intake:** `VOICE_V3_BOOKING_AGENT_CONFIG` + `VoiceV3CallRuntime` + Astra `emit_caller_meaning` / `voice_v3_caller_meaning`. Tests: `npm run test:voice-v3-intake`. Odd-field harness: `scripts/fixtures/` only (not in `src/`).
