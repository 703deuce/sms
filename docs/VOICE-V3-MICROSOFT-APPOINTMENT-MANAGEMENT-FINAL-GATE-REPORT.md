# Voice V3 Microsoft appointment management — final gate report

**PR:** #435 | **Branch:** `cursor/voice-v3-microsoft-appointment-management-2304`  
**Do not merge / do not deploy** until manual Microsoft A–J approval.

## DATE_TIME_CONTRACT

| Field | Value |
|-------|--------|
| FIND_DATE_EXPRESSION_TYPE | `SchedulingMeaning` fields merged into `find_appointment` (same as `set_scheduling_preference`) |
| FIND_DATE_EXPRESSION_SUPPORTS_TIME | **YES** — `time_expression`, `time_kind`, `exact_time`, `daypart`, etc. |
| TIME_ONLY_LOOKUP | **PASS** — `buildAppointmentWhenFromSchedulingMeaning` → `localTimeHm` |
| DATE_ONLY_LOOKUP | **PASS** — `normalizeSchedulingMeaning` via existing normalizer |
| DATE_AND_TIME_LOOKUP | **PASS** — combined semantic fields → normalized window + match |
| APPROXIMATE_TIME_LOOKUP | **PASS** — `DAYPART` / ranges via normalizer |
| EXISTING_NORMALIZER_REUSED | **YES** — `normalizeSchedulingMeaning` unchanged |

Examples:

- “Monday” → `date_relation` + `weekday`
- “10 in the morning” without day → `time_kind=EXACT`, `exact_time=10:00`
- “Monday at 10” → date + `EXACT` time via normalizer
- “Monday afternoon” → `DAYPART` + weekday
- “2:30 appointment” → `EXACT` + `exact_time=14:30` (time-only if no date)

## ANI

| Field | Value |
|-------|--------|
| PRODUCTION_ANI_SOURCE | Telnyx `call.initiated` payload `from` → `noteTelnyxPstnReceived` → `RecentPstnLegContext.fromE164` → `createVoiceV3CallRuntime({ inboundCallerE164 })` |
| PRODUCTION_ANI_CALL_CONTEXT_FIELD | `telephony.inboundCallerE164` |
| ANI_WIRED_TO_APPOINTMENT_LOOKUP | **YES** — `find_appointment` + `appointment-management-dispatch` pass `ani` (not LLM-settable) |
| ANI_UNIQUE_PHONE_MATCH | **PASS** (unit) |
| ANI_MULTIPLE_MATCH_PROTECTION | **PASS** (unit) |
| ANI_NO_MATCH_FALLBACK | **PASS** |
| ANI_NOT_LLM_SETTABLE | **PASS** (no `ani` in tool schema) |
| ANI_AVOIDS_REDUNDANT_PHONE_QUESTION | **PASS** (discriminator logic when ANI applied) |

## ASTRA

| Field | Value |
|-------|--------|
| STATIC_TOOL_CONTRACT_AUDIT | **PASS** |
| REAL_ASTRA_TOOL_SELECTION_CERT | **PASS** (`scripts/test-voice-v3-astra-appointment-management-selection.ts`) |
| REAL_ASTRA_MODEL | `gpt-6-astra` |
| FINAL_PRODUCTION_TOOL_DESCRIPTIONS_USED | **YES** |
| FINAL_PRODUCTION_TOOL_SCHEMAS_USED | **YES** (`buildVoiceV3AstraFunctionTools`) |
| ASTRA_FIND_UNKNOWN_APPOINTMENT | **PASS** |
| ASTRA_PHONE_DISCRIMINATOR_LOOP | **PASS** (no premature cancel; conversational ask) |
| ASTRA_EMAIL_DISCRIMINATOR_LOOP | **PASS** |
| ASTRA_IDENTITY_CONFIRM_NOT_CANCEL_CONFIRM | **PASS** |
| ASTRA_EXPLICIT_CANCEL | **PASS** |
| ASTRA_RESCHEDULE_SEQUENCE | **PASS** |
| ASTRA_LOOKUP_ONLY | **PASS** |
| ASTRA_MULTIPLE_APPOINTMENT_CLARIFICATION | **PASS** |
| ASTRA_TIME_ONLY_CLUE | **PASS** |

## REGRESSIONS

| Suite | Status |
|-------|--------|
| APPOINTMENT_DISCOVERY_SUITE | **PASS** |
| MICROSOFT_APPOINTMENT_MANAGEMENT_SUITE | **PASS** |
| ASTRA_TOOL_CONTRACT_AUDIT | **PASS** |
| VOICE_V3_BOOKING_SUITE | **PASS** |

## READY_FOR_MANUAL_MICROSOFT_A_J

**YES** — pending your explicit deploy approval; automated final gate complete.
