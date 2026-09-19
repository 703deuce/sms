# VOICE V3 WIZARD FIELD-BY-FIELD MIGRATION PLAN

**Machine-readable manifest:** `src/lib/voice-v3/config/wizard-v3-field-manifest.ts` (generated from `wizard-v3-manifest-builder.ts`)  
**Compiler:** `compileVoiceV3AgentConfig(wizard, providerConnections, { source })`  
**Production entry:** `resolveVoiceV3AgentConfigForAgent`  
**Invariant:** `assertWizardManifestComplete()` — **UNMAPPED = 0**

## Manifest columns

Each row includes: `step`, `uiLabel`, `statePath`, `valueType`, `v3ConfigPath`, `destinations`, `executionStatus`, `scope`, `compilerFunction`, `runtimeConsumer`, `republishBehavior`, `testCoverage`.

## Totals (current branch)

| | Count |
|--|------:|
| Controls discovered | 146 |
| WIRED V3 config | 146 |
| ACTIVE_EXECUTION | 65 |
| CONFIGURED_NOT_IMPLEMENTED | 61 |
| CONTROL_PLANE_ONLY | 17 |
| UNSUPPORTED_BY_CURRENT_LIVE_API | 3 |
| **UNMAPPED** | **0** |

## Business hours (locked semantics)

| Source | Amy (`hoursDisplay`) | FIND/BOOK (`businessHours`) |
|--------|----------------------|-----------------------------|
| `operatingMaturity.businessSchedule.weekly` | yes (formatted) | **authoritative** |
| `knowledgeItems[hours].summary` (prose) | fallback only if no structured schedule | **never** |

Conflict flag: `business.hoursStructuredMeta.hoursProseConflictsWithStructured`.

## Hours row correction (vs earlier draft)

| Step | UI | State path | V3 path | Runtime |
|------|-----|------------|---------|---------|
| 3 | Weekly hours editor | `operatingMaturity.businessSchedule.weekly` | `businessHours` + Amy `hoursDisplay` | FIND/BOOK |
| 3 | Guided hours textarea | `knowledgeItems[].summary` (id=hours) | hot context only | not scheduling |

## OpenAI Live sliders

| Wizard | V3 | Live accept |
|--------|-----|-------------|
| `voiceId` | `telephony.liveVoiceId` | `audio.output.voice` |
| `speakingSpeed`, `responsiveness`, `interruptionSensitivity` | `telephony.liveAudioControls.*` | stored; `UNSUPPORTED_BY_CURRENT_LIVE_API` |

Evidence: `docs/VOICE-V3-OPENAI-LIVE-AUDIO-CONTROLS-EVIDENCE.md`.

## Proof scripts

| Scenario | Script |
|----------|--------|
| Manifest complete | `test-voice-v3-wizard-manifest-coverage.ts` |
| Hours prose ≠ scheduling | `test-voice-v3-business-hours-invariant.ts` |
| Microsoft A vs B | `test-voice-v3-microsoft-connection-resolve.ts` |
| Republish intake A/B/C | `test-voice-v3-wizard-republish-intake.ts` |
| Full matrix | `test-voice-v3-wizard-cert-matrix.ts` |
| Custom required field + tools | `test-voice-v3-wizard-compiler.ts` |
| No V2 intake in resolver | `test-voice-v3-wizard-architecture-invariants.ts` |

## Configuration vs execution

All wizard controls map to typed V3 configuration. Execution for non-Microsoft strategies, RAG retrieval, qualification, CRM, and recovery remains **CONFIGURED_NOT_IMPLEMENTED** until dedicated executors attach to existing config sections.
