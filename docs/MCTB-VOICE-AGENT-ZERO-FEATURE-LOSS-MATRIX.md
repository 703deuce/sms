# MCTB After-Hours Voice Agent — Zero-Feature-Loss Matrix

**Scope:** Migrate presentation of the existing 8-step appointment-receptionist wizard into `/mctb/voice-agent` without a second voice backend.

**Canonical route:** `/mctb/voice-agent` with `?step=` deep links (`goals`, `phone`, `information`, `booking`, `call-handling`, `voice`, `test`, `activate`).

**ACCIDENTALLY_REMOVED_FEATURES:** 0 (target)

| Step (MCTB label) | Current component | Control / capability | Backend | Persistence | Runtime effect | New UI location | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Purpose | `GoalsStep` | Capability toggles (8) | `buildWizardAgentConfig` | `POST /api/solutions/appointment-receptionist` | Telnyx tools / policy | `/mctb/voice-agent?step=goals` | PRESERVED |
| Purpose | `GoalsStep` | Answer-when / schedule modes | routing-mode + sync-routing | wizard state + setup | inbound routing mode | Same | PRESERVED |
| Purpose | `GoalsStep` | Agent / solution name | agent-service | VoiceAgent row | display name | Same | PRESERVED |
| Phone | `PhoneStep` | Number source (existing / buy / forward) | phone APIs | wizard state | DID assignment | `?step=phone` | PRESERVED |
| Phone | `PhoneStep` | Number list + assignment | `GET /api/phone/numbers` | phoneNumberId | inbound target | Same | PRESERVED |
| Phone | `PhoneStep` | Ring / answering behavior | sync-routing | ringBehavior | call flow | Same | PRESERVED |
| Phone | `PhoneStep` | Connection greeting | voice assets | connectionGreeting* | first audio | Same | PRESERVED |
| Phone | `PhoneStep` | Call recording | disclosure rules | callRecording | recording + disclosure | Same | PRESERVED |
| Business Knowledge | `InformationStep` | Website import + scan | knowledge sync hooks | websiteUrl, items | RAG / brain | `?step=information` | PRESERVED |
| Business Knowledge | `InformationStep` | Guided profile fields | company-brain sync | knowledgeItems | answers | Same | PRESERVED |
| Business Knowledge | `InformationStep` | Upload documents | knowledge APIs | items | retrieval | Same | PRESERVED |
| Business Knowledge | `InformationStep` | Connect existing KB | `GET /api/voice/knowledge` | linkedKnowledgeBaseId | retrieval | Same | PRESERVED |
| Booking | `AppointmentsStep` | Provider selection | integrations + calendars | calendarProvider | booking orchestrator | `?step=booking` | CONSOLIDATED |
| Booking | `AppointmentsStep` | Appointment types / targets | wizard state | appointmentTypes | scheduling specialist | Same | PRESERVED |
| Booking | `AppointmentsStep` | Duration, notice, buffers, hours | notice-utils | per-type config | availability | Same | PRESERVED |
| Booking | `AppointmentsStep` | OAuth for Google/Microsoft (legacy shell) | calendar oauth routes | connections | — | Hidden in MCTB (Integrations only) | INTENTIONALLY_HIDDEN_WITH_REASON |
| Booking | `AppointmentsStep` | Transovo Calendar card | internal calendar | — | — | Hidden in MCTB | INTENTIONALLY_HIDDEN_WITH_REASON |
| Call Handling | `CallHandlingStep` | Booking behavior toggles | bookingBehavior | state | dialog policy | `?step=call-handling` | PRESERVED |
| Call Handling | `CallHandlingStep` | Transfer triggers + destination | transfer-utils | state | Telnyx transfer | Same | PRESERVED |
| Call Handling | `CallHandlingStep` | Fallbacks + staff notify | state | state | post-call actions | Same | PRESERVED |
| Call Handling | `CallHandlingStep` | Long-term memory / CRM | advanced flags | state | memory tools | Same | PRESERVED |
| Call Handling | `CallHandlingStep` | Process preview copy | UI only | — | — | General voice flow (MCTB) | MOVED |
| Voice | `VoiceStep` | Identity, tone, greeting | buildWizardAgentConfig | state | spoken behavior | `?step=voice` | PRESERVED |
| Voice | `VoiceStep` | Voice list + preview | Telnyx voices API | voiceId | TTS voice | Same | PRESERVED |
| Voice | `VoiceStep` | Speaks-first mode | state | state | turn-taking | Same | PRESERVED |
| Test | `TestStep` | Scenarios + checklist | test runtime | lastTestPassed | QA gate | `?step=test` | PRESERVED |
| Test | `TestStep` | Browser / phone test modes | WebRTC + Telnyx | agent build | live test | Same | PRESERVED |
| Test | `TestStep` | Metrics (latency, tools) | test panel | session | display only | Same | PRESERVED |
| Activate | `ActivateStep` | Checklist + readiness grid | capability-checklist | — | activate gate | `?step=activate` | PRESERVED |
| Activate | `ActivateStep` | Activate / schedule / draft | `POST` activate | publishVoiceAgent | go-live | Same | PRESERVED |
| Activate | `ActivateStep` | Recording disclosure warnings | checklist | — | compliance | Same | PRESERVED |
| All | `AppointmentReceptionistWizard` | Save / continue / stepper | appointment-receptionist API | localStorage + DB | — | MCTB shell + blue stepper | MOVED |

## MCTB-only presentation rules

- **Framing:** After-Hours Voice Agent (not Appointment Receptionist product).
- **Shell:** Universal MCTB sidebar/header; no product switcher on `/mctb/voice-agent`.
- **Booking providers (MCTB):** Microsoft + Calendly status only; connect via `/integrations`.
- **Policy:** Business actions align with AI Lead Recovery; voice owns channel config (greeting, schedule, transfer timing, voice).

## Verification checklist

- [ ] Each interactive control: click → save → refresh → persistence
- [ ] Activation still blocked on real checklist failures
- [ ] Deep link `?step=` opens correct section for returning users
- [ ] Screenshot QA: MCTB chrome, blue accent, no purple switcher
