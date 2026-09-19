# VOICE V3 WIZARD MIGRATION REPORT (draft — pre-production review)

## 1. Files changed (core)

- `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts` — canonical wizard → `VoiceV3AgentConfig`
- `src/lib/voice-v3/config/from-published-agent.ts` — loads published wizard, calls compiler (no V2 intake)
- `src/lib/voice-v3/config/agent-config.ts` — nested sections (identity, capabilities, conversation, business, scheduling, knowledge, telephony, controlPlane)
- `src/lib/voice-v3/config/wizard-collect-fields-v3.ts` — dynamic `collectFields` → `intakeFields`
- `src/lib/voice-v3/config/wizard-v3-field-manifest.ts` — testable field worksheet
- `src/lib/voice-v3/prompts/live-frontend-instructions.ts` — static foundation + compiled Amy context
- `src/lib/voice-v3/prompts/build-voice-v3-prompts.ts` — config-driven Amy/Astra assembly
- `src/lib/voice-v3/tools/voice-tool-catalog.ts` — capability-driven tool surface
- `src/lib/voice-v3-basic/live-session-config.ts` — wizard voice + compiled prompts on accept
- `scripts/test-voice-v3-wizard-compiler.ts` — certification fixture
- `scripts/test-voice-v3-wizard-architecture-invariants.ts` — no V2 intake in resolver

## 2. New V3 config structure

Published wizard compiles to `VoiceV3AgentConfig` with typed sections plus legacy top-level fields (`businessName`, `timezone`, `intakeFields`, `service`, `services[]`, `businessHours`, `calendar`, `transferDestinations`) for runtime compatibility.

## 3. Field → destination table

See `src/lib/voice-v3/config/wizard-v3-field-manifest.ts` and `docs/VOICE-V3-WIZARD-FIELD-BY-FIELD-MIGRATION-PLAN.md`.

## 4. V2 dependencies removed from production V3 path

- `resolveVoiceV3AgentConfigForAgent` no longer calls `compileVoiceV2IntakeSchema`.

## 5. V2 dependencies intentionally retained

- `buildWizardAgentConfig` still writes `voiceV2Intake`, Telnyx workflow, etc. for legacy/V2 surfaces and provisioning.
- Wizard snapshot still stored under `advanced.appointmentReceptionistWizard`.

## 6–8. Amy / Astra / deterministic

- **Amy:** identity, persona, business facts (hours, services, knowledge items), capabilities summary, delegation policy filtered by capabilities, custom greeting.
- **Astra:** business, timezone, local time, intake catalog, service catalog, booking strategy — not tone/voice/greeting prose.
- **Runtime:** `intakeFields`, `operationRequirements.book_appointment`, `businessHours`, `services[]`, `resolveBookingServiceForRuntime`, capability gates in `deriveVoiceV3Capabilities`.

## 9. Provider mappings

- Microsoft: `providerConnections.microsoftConnectionId` from workspace calendar rows (prefer `calendarEmail` match).
- Telnyx PSTN: `telephony.phoneNumberId`, `callRecording`, `liveVoiceId` on Live accept.

## 10. RAG configuration mappings

- `knowledge.retrieval.{enabled, knowledgeBaseIds, websiteUrl}` — plumbing only; retrieval tool not added in this pass.

## 11. Unsupported / partial wizard features

- `speakingSpeed`, `responsiveness`, `interruptionSensitivity` — no OpenAI Live equivalent mapped (manifest: PARTIAL).
- `answerWhen` / ring behavior — represented in wizard; V3 PSTN routing mapping partial.
- Calendly / SEND_LINK / REQUEST_ONLY — compiled in `scheduling.bookingStrategy`; Microsoft tools gated off when not `MICROSOFT_365`.

## 12. Tests added

- `scripts/test-voice-v3-wizard-compiler.ts`
- `scripts/test-voice-v3-wizard-architecture-invariants.ts`

## 13. Test results

```
VOICE_V3_WIZARD_COMPILER_CERT: PASS
VOICE_V3_WIZARD_ARCHITECTURE_INVARIANTS: PASS
```

## 14. Typecheck

Project-wide `tsc` has pre-existing errors outside this work; voice-v3 compiler files pass targeted check after duplicate-key fix.

## 15. Production path proof

`/api/openai/live/incoming` → `resolveVoiceV3AgentConfigForAgent` → `compileVoiceV3AgentConfig` → `createVoiceV3CallRuntime({ config })` → `buildBasicLiveSessionAcceptParams(config)` → `sessions.accept`.

## 16. Env fallback

`VOICE_V3_BOOKING_AGENT_CONFIG` when wizard missing or resolve throws; telemetry `VOICE_V3_CONFIG_FALLBACK_USED`.

## 17. Remaining unwired UI fields

See migration plan for per-control rows marked PARTIAL/FUTURE (phone ring seconds, sliders, full call-handling recovery matrix).

**Do not deploy to production until this report and field plan are reviewed.**
