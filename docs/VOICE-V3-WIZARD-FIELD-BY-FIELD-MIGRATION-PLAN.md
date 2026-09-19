# VOICE V3 WIZARD FIELD-BY-FIELD MIGRATION PLAN

This plan is the authoritative worksheet for Appointment Receptionist Wizard → Voice V3 wiring.

**Machine-readable core:** `src/lib/voice-v3/config/wizard-v3-field-manifest.ts`  
**Compiler:** `compileVoiceV3AgentConfig(wizard, providerConnections)`  
**Production entry:** `resolveVoiceV3AgentConfigForAgent` (PSTN accept path)

## Column legend

| Column | Meaning |
|--------|---------|
| Step | Wizard step 1–8 |
| State path | `AppointmentReceptionistWizardState` path or UI-derived path |
| V3 config path | Target in `VoiceV3AgentConfig` |
| Destinations | LIVE / ASTRA / DETERMINISTIC / PROVIDER / RAG / CONTROL_PLANE |
| Status | WIRED \| PARTIAL \| NOT_WIRED \| FUTURE |
| Scope | YES_MICROSOFT_BOOKING \| YES_GENERAL \| FUTURE_* \| CONTROL_PLANE |

## Representative rows (full manifest in TS)

| Step | UI label | State path | V3 path | Amy | Astra | Runtime | Status | Scope |
|------|----------|------------|---------|-----|-------|---------|--------|-------|
| 1 | Capability toggles | `capabilities[]` | `capabilities.*` | delegation summary | tool gating | `deriveVoiceV3Capabilities` | WIRED | YES_GENERAL |
| 1 | Solution name | `solutionName` | `controlPlane.solutionName` | — | — | — | WIRED | CONTROL_PLANE |
| 1 | Answer when | `answerWhen` | telephony (partial) | — | — | PSTN routing | PARTIAL | YES_GENERAL |
| 2 | Phone number | `phoneNumberId` | `telephony.phoneNumberId` | — | — | provisioning | WIRED | PROVIDER |
| 2 | Call recording | `callRecording` | `telephony.callRecording` | — | — | Telnyx record | PARTIAL | PROVIDER |
| 3 | Business name | `businessName` | `businessName` | yes | yes | yes | WIRED | YES_GENERAL |
| 3 | Guided hours textarea | `knowledgeItems[hours].summary` | `business.hoursDisplay` | yes | — | `businessHours` | WIRED | YES_MICROSOFT_BOOKING |
| 3 | Weekly hours editor | `operatingMaturity.businessSchedule.weekly.*` | `businessHours` + Amy hours | yes | — | scheduling | WIRED | YES_MICROSOFT_BOOKING |
| 3 | Website URL | `websiteUrl` | `knowledge.retrieval.websiteUrl` | — | — | RAG config | WIRED | FUTURE_RAG_EXECUTION |
| 4 | Booking strategy | `bookingStrategy` | `scheduling.bookingStrategy` | — | yes | tool gating | WIRED | YES_MICROSOFT_BOOKING |
| 4 | Appointment type duration | `appointmentTypes[].durationMin` | `services[].durationMinutes` | yes | yes | FIND/BOOK | WIRED | YES_MICROSOFT_BOOKING |
| 4 | Collect field required | `collectFields[].required` | `intakeFields[].required` | — | yes | BOOK precondition | WIRED | YES_MICROSOFT_BOOKING |
| 4 | Custom collect field | `collectFields[].id` (custom_*) | `intakeFields[].key` | — | `update_intake` schema | dynamic | WIRED | YES_MICROSOFT_BOOKING |
| 5 | Transfer destination | `transferDestinations[]` | `transferDestinations[]` | names only | enum ids | executor | WIRED | YES_GENERAL |
| 6 | Agent name | `agentName` | `identity.agentName` | yes | — | — | WIRED | YES_GENERAL |
| 6 | Opening greeting | `openingGreeting` | `conversation.openingGreeting` | yes | — | sideband greeting | WIRED | YES_GENERAL |
| 6 | Voice | `voiceId` | `telephony.liveVoiceId` | — | — | Live accept | WIRED | YES_GENERAL |
| 6 | Speaking speed slider | `speakingSpeed` | — | — | — | — | PARTIAL | INTENTIONALLY_UNSUPPORTED |
| 7 | Test scenario | `testScenario` | `controlPlane.testScenario` | — | — | QA | WIRED | CONTROL_PLANE |
| 8 | Activation mode | `activationMode` | `controlPlane.activationMode` | — | — | publish | WIRED | CONTROL_PLANE |

## Proof requirements (current Microsoft milestone)

1. Republish changes `intakeFields` without code deploy — certified in `test-voice-v3-wizard-compiler.ts`.
2. Multiple enabled appointment types — `services[]` + `selectedAppointmentTypeId` primary + `resolveBookingServiceForRuntime` for caller-selected service.
3. Amy hot context includes hours/services from `knowledgeItems` and operating schedule.
4. Env vars (`VOICE_V3_AGENT_NAME`, etc.) used only when published wizard unavailable.

## Next tranches (not blocking compiler)

- Per-control expansion for call-handling recovery, CRM, qualification rules (manifest FUTURE rows).
- V3 test harness using same compiler as PSTN accept (wizard test step).
- RAG retrieval tool wired to `knowledge.retrieval` when pipeline ships.
