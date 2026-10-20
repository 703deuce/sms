Generated: 2026-10-20T08:43:00.838Z
Commit: run export script after code changes.

Runtime models (new-app publish → voice worker):
- Spoken layer: OpenAI GPT-Live-1 (LiveKit GPTLiveModel), voice = liveVoiceId from publish
- Delegation backend: astraModel on published bundle (default gpt-6-luna unless VOICE_V3_ASTRA_MODEL)
- NOT the legacy single-session gpt-4o-realtime API

Source code roots:
- Amy assembly: new-app/lib/server/voice-v3/prompts/live-frontend-instructions.ts
- Astra assembly: new-app/lib/server/voice-v3/prompts/astra-backend-instructions.ts
- Compile: new-app/lib/server/receptionist/compile-runtime.ts → runtime.amyInstructions / astraInstructions
