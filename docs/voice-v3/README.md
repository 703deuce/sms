# Voice V3 documentation

| Doc | Purpose |
|-----|---------|
| [OPENAI-NATIVE-FIRST-ARCHITECTURE.md](./OPENAI-NATIVE-FIRST-ARCHITECTURE.md) | **Read before any V3 feature work** — OpenAI-native vs app-owned split |
| [NEW_NUMBER_PROVISIONING.md](./NEW_NUMBER_PROVISIONING.md) | Provisioning lifecycle + known-good Telnyx reference |

Runtime entry: `src/lib/voice-v3-basic/` (webhooks, SIP, accept) + `src/lib/voice-v3/` (shared prompts, telemetry, call context).
