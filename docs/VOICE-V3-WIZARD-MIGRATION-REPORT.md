# VOICE V3 WIZARD MIGRATION REPORT (completion pass — pre-merge review)

**Branch:** `cursor/voice-v3-wizard-compiler-2304` · **PR:** #433  
**Status:** Not merged · Not deployed

## Manifest totals

| Metric | Count |
|--------|------:|
| Wizard controls discovered (manifest rows) | **146** |
| WIRED V3 config | **146** |
| ACTIVE_EXECUTION | **65** |
| CONFIGURED_NOT_IMPLEMENTED | **61** |
| CONTROL_PLANE_ONLY | **17** |
| UNSUPPORTED_BY_CURRENT_LIVE_API | **3** |
| **UNMAPPED** | **0** |

Source: `buildWizardV3FieldManifest()` in `src/lib/voice-v3/config/wizard-v3-manifest-builder.ts`, verified by `scripts/test-voice-v3-wizard-manifest-coverage.ts` + `assertWizardManifestComplete()`.

## Architecture (unchanged, confirmed)

```
Published wizard snapshot (advanced.appointmentReceptionistWizard)
  → compileVoiceV3AgentConfig(...)
  → VoiceV3AgentConfig (canonical)
  → Amy (Live instructions) / Astra (delegation) / tools / runtime / providers
```

Production V3 does **not** call `compileVoiceV2IntakeSchema`. V2 `buildWizardAgentConfig` remains for legacy/Telnyx surfaces only.

## Files changed (this pass)

### Compiler & config

- `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts` — full Step 1–8 sections; structured hours authority
- `src/lib/voice-v3/config/agent-config.ts` — `callHandling`, `qualification`, `recovery`, `integrations`, `bookingStrategyDetail`, `liveAudioControls`
- `src/lib/voice-v3/config/wizard-v3-manifest-builder.ts` — exhaustive manifest generator
- `src/lib/voice-v3/config/wizard-v3-field-manifest.ts` — exported manifest + summary
- `src/lib/voice-v3/config/wizard-manifest-invariant.ts` — top-level wizard key coverage
- `src/lib/voice-v3/config/business-hours-display.ts` — prose vs structured hours invariant
- `src/lib/voice-v3/config/resolve-microsoft-connection.ts` — deterministic calendar pick
- `src/lib/voice-v3/config/wizard-test-compilation.ts` — draft test probe (same compiler)
- `src/lib/voice-v3/config/from-published-agent.ts` — uses connection resolver
- `src/lib/voice-v3/config/default-nested-config.ts` — defaults for new sections

### Runtime authorization

- `src/lib/voice-v3/tools/authorize-tool-for-config.ts`
- `book-appointment-tool.ts`, `find-availability-tool.ts`, `cancel-appointment-tool.ts`, `reschedule-appointment-tool.ts`, `transfer-call-tool.ts` — executor rejects when capability off

### Wizard test

- `src/lib/voice/agent-service.ts` — `build_for_test` attaches `voiceV3WizardTestCompilation` via `compileVoiceV3AgentConfig({ source: wizard_draft_test })`

### Docs

- `docs/VOICE-V3-OPENAI-LIVE-AUDIO-CONTROLS-EVIDENCE.md`
- `docs/VOICE-V3-WIZARD-FIELD-BY-FIELD-MIGRATION-PLAN.md` (updated)
- This report

### Tests

- `scripts/test-voice-v3-wizard-manifest-coverage.ts`
- `scripts/test-voice-v3-business-hours-invariant.ts`
- `scripts/test-voice-v3-microsoft-connection-resolve.ts`
- `scripts/test-voice-v3-wizard-republish-intake.ts`
- `scripts/test-voice-v3-wizard-cert-matrix.ts`
- (existing) `test-voice-v3-wizard-compiler.ts`, `test-voice-v3-wizard-architecture-invariants.ts`

## Business hours rule (implemented)

- **FIND/BOOK:** `operatingMaturity.businessSchedule.weekly` → `businessHours` only (`businessHoursWindowFromWeeklySchedule`).
- **Amy hot context:** `hoursDisplay` generated from structured schedule when present; free-form `knowledgeItems[hours].summary` never overrides scheduling.
- **Conflict:** `business.hoursStructuredMeta.hoursProseConflictsWithStructured` when prose differs from structured display.

## OpenAI Live audio controls

Evidence: `docs/VOICE-V3-OPENAI-LIVE-AUDIO-CONTROLS-EVIDENCE.md` (`SessionAcceptParams.Session.audio.output.voice` only at startup). Wizard sliders stored under `telephony.liveAudioControls` with `UNSUPPORTED_BY_CURRENT_LIVE_API`.

## Certification matrix (20 items)

| # | Requirement | Test |
|---|-------------|------|
| 1–20 | See `scripts/test-voice-v3-wizard-cert-matrix.ts` + republish/hours/microsoft scripts | PASS |

## Tests run (exact)

```bash
npx tsx scripts/test-voice-v3-wizard-manifest-coverage.ts
npx tsx scripts/test-voice-v3-business-hours-invariant.ts
npx tsx scripts/test-voice-v3-microsoft-connection-resolve.ts
npx tsx scripts/test-voice-v3-wizard-republish-intake.ts
npx tsx scripts/test-voice-v3-wizard-compiler.ts
npx tsx scripts/test-voice-v3-wizard-architecture-invariants.ts
npx tsx scripts/test-voice-v3-wizard-cert-matrix.ts
```

All exited **0** with `PASS` on 2026-09-19.

## Production path proof

`/api/openai/live/incoming` → `resolveVoiceV3AgentConfigForAgent` → `compileVoiceV3AgentConfig` → `createVoiceV3CallRuntime({ config })` → `buildBasicLiveSessionAcceptParams(config)` → `sessions.accept`.

Telemetry: `configVersion` on compiled config; active call retains `VoiceV3CallRuntime.config` snapshot at creation (republish intake test).

## Draft / test / publish

| Mode | Compiler source |
|------|-----------------|
| Production PSTN | Published wizard via `resolveVoiceV3AgentConfigForAgent` |
| Wizard Test `build_for_test` | Draft wizard → `compileVoiceV3AgentConfig({ source: wizard_draft_test })` probe on version config |
| Env fallback | `VOICE_V3_BOOKING_AGENT_CONFIG` when wizard missing |

## Future execution (configuration already compiled)

- Calendly, SEND_LINK, REQUEST_ONLY (`bookingStrategyDetail`)
- RAG retrieval (`knowledge.retrieval`)
- Qualification rules executor (`qualification`)
- CRM / long-term memory (`integrations`)
- AI call recovery SMS (`recovery`)
- Waterfall transfer plans (`callHandling.transferPlanSteps`)
- Live audio sliders (pending OpenAI API fields)

## Certified V3 booking architecture

No changes to OfferSets, scheduling generations, Microsoft adapters, idempotent BOOK, or nine-tool delegation model — configuration compiler migration only.
