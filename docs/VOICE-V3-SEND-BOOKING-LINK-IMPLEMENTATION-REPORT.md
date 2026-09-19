# Voice V3 — SEND_BOOKING_LINK implementation report

**STOP:** Do not merge or deploy without explicit approval. Real PSTN/SMS certification remains manual.

## Git

| Field | Value |
|-------|--------|
| FROZEN_MICROSOFT_BASELINE_SHA | `4aaad9ce37b10ad79380f041aa9556cb59fde308` |
| BRANCH | `cursor/voice-v3-send-booking-link-2304` |

## Wizard trace

| Field | Value |
|-------|--------|
| WIZARD_SCHEDULING_STRATEGY_COMPONENT | `AppointmentsStep` — `src/components/solutions/appointment-receptionist/steps/appointments-step.tsx` |
| WIZARD_SCHEDULING_STRATEGY_FIELD | `bookingStrategy` (`SEND_LINK` label: "Send our booking link") |
| CURRENT_SEND_LINK_OPTION_EXISTS | **YES** |
| WIZARD_DRAFT_STORAGE | Appointment Receptionist wizard state (`appointmentReceptionistWizard` on agent draft) |
| WIZARD_PUBLISHED_STORAGE | Published `VoiceAgentVersion.config` → `compileVoiceV3AgentConfig` |
| V3_COMPILER | `compileVoiceV3AgentConfig` |
| V3_RUNTIME_CONFIG | Immutable `VoiceV3AgentConfig` on call runtime |
| CURRENT_SMS_CONFIG_FIELDS | `outboundSmsMode`, `outboundSmsPhoneNumberId`, `outboundSmsE164` → `telephony.*` |
| CURRENT_PHONE_NUMBER_CONFIG_FIELDS | `phoneNumberId`, `phoneNumberE164` (voice inbound) |
| CURRENT_BOOKING_LINK_FIELDS | `bookingLinkUrl`, `bookingLinkLabel`, `bookingLinkSmsConsentRequired` |

Repository strategy enum: **`SEND_LINK`** (not a duplicate `SEND_BOOKING_LINK` enum).

## Config

| Field | Value |
|-------|--------|
| SEND_LINK_STRATEGY_VALUE | `SEND_LINK` |
| PUBLISHED_URL | `bookingStrategyDetail.bookingLinkUrl` (wizard `bookingLinkUrl`) |
| PUBLISHED_SENDER | `telephony.outboundSmsPhoneNumberId` + `outboundSmsE164` |
| V3_COMPILER_MAPPING | `bookingStrategyDetailFromWizard` + `scheduling.bookingStrategy` |
| IMMUTABLE_CALL_CONFIG | Call runtime `VoiceV3CallRuntime.config` at session start |

## Telnyx (+15717491060) — read-only inspect (this run)

| Field | Value |
|-------|--------|
| VOICE_V3_NUMBER | +15717491060 |
| SMS_CAPABLE | Inspect script: `false` (feature name parsing — verify in Telnyx portal) |
| MESSAGING_PROFILE_ID | `4001a014-9a5c-4be4-8099-1a75ac4f875d` |
| PHONE_NUMBER_ASSIGNMENT_STATUS | `null` (no campaign row returned) |
| VOICE_CONNECTION_UNCHANGED | Not mutated this run |
| CAMPAIGN_ASSIGNMENT | **Not performed** — await approved `VOICE_V3_TARGET_10DLC_CAMPAIGN_ID` + human approval |

Script: `scripts/inspect-telnyx-voice-v3-sms-number.ts`

## Consent

| Field | Value |
|-------|--------|
| APPROVED_CAMPAIGN_OPT_IN_METHOD | Verbal (customer-care pattern; compile via `compileVoiceBookingLinkSpokenDisclosure`) |
| SPOKEN_DISCLOSURE_SOURCE | `VOICE_BOOKING_LINK_CUSTOMER_CARE_DEFAULT` or `VOICE_BOOKING_LINK_SPOKEN_DISCLOSURE` env |
| CONSENT_LEDGER | `smartRoutingSmsConsentEvent` scope `VOICE_BOOKING_LINK`, method `VERBAL` |
| NO_CONSENT_NO_SMS | Matrix **PASS** |
| DECLINE_NO_SMS | Matrix **PASS** |

## Astra / tools

| Field | Value |
|-------|--------|
| TOOL_NAME | `send_booking_link` |
| TOOL_FILE | `src/lib/voice-v3/tools/send-booking-link-tool.ts` |
| TOOL_REGISTERED | `VOICE_TOOL_CATALOG` (10th tool when `SEND_LINK`) |
| BUILD_OPENAI_TOOLS_FILE | `src/lib/voice-v3/tools/build-openai-tools.ts` |
| DISPATCH_FILE | `src/lib/voice-v3/tools/execute-voice-tool.ts` (unchanged pipeline) |
| EXECUTOR_FILE | `src/lib/voice-v3/booking-link/execute-send-booking-link.ts` |
| URL_LLM_SETTABLE | **NO** |
| SENDER_LLM_SETTABLE | **NO** |

## Runtime

| Field | Value |
|-------|--------|
| DEFAULT_DESTINATION_SOURCE | `telephony.inboundCallerE164` (ANI) |
| IDEMPOTENCY | Per-call attempt id: call + destination + config version + URL |
| TELNYX_SEND_ENDPOINT | Via `sendAppointmentSms` → Telnyx `POST /v2/messages` |
| PROVIDER_ACCEPTANCE_GATES_SUCCESS | **YES** (mock matrix + executor) |

## Isolation

| Field | Value |
|-------|--------|
| SEND_LINK_REQUIRES_BOOK_INTAKE | **NO** |
| SEND_LINK_USES_MICROSOFT_GRAPH | **NO** |
| MICROSOFT_DIRECT_PATH_CHANGED | **NO** (additive gating only) |
| MICROSOFT_BOOK_REGRESSION | `test-voice-v3-microsoft-appointment-management.ts` **PASS** |

## Tests

| Suite | Result |
|-------|--------|
| SEND_LINK_MATRIX | `scripts/test-voice-v3-send-booking-link-matrix.ts` — 14 checks **PASS** |
| MICROSOFT_FROZEN_REGRESSIONS | Appointment management script **PASS** |
| ASTRA_TOOL_CONTRACTS (Microsoft config) | **PASS** |
| REAL_ASTRA_SELECTION_CERT | **NOT RUN** (requires live gpt-6-astra) |
| REAL_SMS_PRECERT | **NOT_RUN_NO_DESTINATION** |
| READY_FOR_DEPLOY_AND_REAL_PSTN_SEND_LINK_CERT | **NO** |

## Changed files (why)

- `src/lib/voice-v3/booking-link/*` — SEND_LINK executor, SMS body, disclosure, consent ledger, config resolution
- `src/lib/voice-v3/tools/send-booking-link-tool.ts` — Astra tool registration + execution
- `src/lib/voice-v3/tools/voice-tool-catalog.ts` — catalog + strategy-aware gating
- `src/lib/voice-v3/tools/authorize-tool-for-config.ts` — strategy mismatch errors
- `src/lib/voice-v3/tools/astra-tool-contracts.ts` — tool description
- `src/lib/voice-v3/config/*`, `state/call-context.ts` — compile + call state
- `src/lib/voice-v3/prompts/astra-backend-instructions.ts` — SEND_LINK instructions
- `src/components/.../appointments-step.tsx` — sender selector, consent, preview
- `src/lib/solutions/appointment-receptionist/types.ts` — consent flag
- `scripts/test-voice-v3-send-booking-link-matrix.ts`, `scripts/inspect-telnyx-voice-v3-sms-number.ts`, `scripts/voice-v3-send-link-test-config.ts`

## Remaining limitations

- Telnyx 10DLC campaign assignment for +15717491060 not applied (needs target campaign id + assignment polling).
- Live Astra selection cert and real PSTN/SMS certification not executed in cloud agent.
- Consent ledger insert requires real `workspaceId` on production calls (FK).
