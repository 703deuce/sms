# Voice V3 documentation

| Doc | Purpose |
|-----|---------|
| [OPENAI-NATIVE-FIRST-ARCHITECTURE.md](./OPENAI-NATIVE-FIRST-ARCHITECTURE.md) | **Read before any V3 feature work** — OpenAI-native vs app-owned split |
| [NEW_NUMBER_PROVISIONING.md](./NEW_NUMBER_PROVISIONING.md) | Provisioning lifecycle + known-good Telnyx reference |

Runtime entry: `src/lib/voice-v3-basic/` (webhooks, SIP, accept) + `src/lib/voice-v3/` (prompts, telemetry, call context, intake pipeline).

**Intake:** `TEST_AGENT_CONFIG` + `VoiceV3CallRuntime` + Astra `voice_v3_caller_meaning` Structured Output. Tests: `npm run test:voice-v3-intake`.

**Scheduling (no Graph yet):** authoritative IANA call clock → semantic `scheduling` in Structured Output → `normalizeSchedulingMeaning` → `NormalizedSchedulingPreference` + `toMicrosoftGraphScheduleWindow` adapter only. Tests: `npm run test:voice-v3-datetime`.
