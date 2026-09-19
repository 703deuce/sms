# Voice V3 Microsoft appointment management — certification report

**PR:** #435  
**Branch:** `cursor/voice-v3-microsoft-appointment-management-2304`  
**Date:** 2026-09-19  
**Do not merge or deploy** from this report alone — manual Microsoft matrix A–J remains post-approval.

## Baseline preserved

Cancel/reschedule architecture, connection/calendar resolver, DELETE cancel, PATCH start/end reschedule, OfferSet/revalidation, same `providerEventId`, BOOK regression suites — unchanged in intent; discovery layer extended.

## BOOK Microsoft payload audit (unchanged)

| Field | Value |
|-------|--------|
| subject | `{service.name} — {customer.name}` |
| body | `Email:` / `Phone:` lines + `transovo_booking_attempt=` |
| attendees | none (organizer-only) |
| location | not set on create |

| Flag | Result |
|------|--------|
| CUSTOMER_NAME_CURRENTLY_WRITTEN | YES — subject suffix |
| CUSTOMER_PHONE_CURRENTLY_WRITTEN | YES — body `Phone:` |
| CUSTOMER_EMAIL_CURRENTLY_WRITTEN | YES — body `Email:` |
| SERVICE_CURRENTLY_WRITTEN | YES — subject prefix |
| BOOK_FILES_CHANGED | none this pass |

## calendarView

| | Fields |
|---|--------|
| BEFORE | id, subject, body, start, end, busy filter via `listMicrosoftCalendarEvents` |
| AFTER (discovery) | `listMicrosoftCalendarEventsForAppointmentDiscovery`: id, subject, bodyPreview, body, start, end, isCancelled, showAs, attendees, organizer, location, seriesMasterId, type, recurrence, originalStart, transactionId — **no showAs busy filter**; pagination via existing collector |

## Required return matrix

| Item | Status |
|------|--------|
| PR | #435 |
| BASELINE_EXISTING_IMPLEMENTATION_PRESERVED | PASS |
| MICROSOFT_CONNECTION_REUSED | PASS |
| MICROSOFT_CALENDAR_REUSED | PASS |
| TRANSOVO_DB_REQUIRED_FOR_LOOKUP | FALSE |
| MANUAL_MICROSOFT_EVENT_DISCOVERY | PASS (unit extraction/match; live manual pending) |
| MANUAL_EVENT_INTERNAL_SELECTION | PASS (`ms_disc_*` stable opaque id) |
| RAW_GRAPH_ID_REJECTION | PASS |
| PHONE_EXTRACTION | PASS |
| EMAIL_EXTRACTION | PASS |
| NAME_EXTRACTION | PASS |
| ATTENDEE_IDENTITY_EXTRACTION | PASS |
| SUBJECT_DISCOVERY | PASS |
| LOCATION_DISCOVERY | PASS |
| PHONE_NORMALIZATION | PASS |
| EMAIL_NORMALIZATION | PASS |
| NAME_NORMALIZATION | PASS |
| UNKNOWN_DATE_LOOKUP | PASS (bounded window without date constraint) |
| UNKNOWN_TIME_LOOKUP | PASS (date discriminator when needed) |
| DYNAMIC_DISCRIMINATOR_SELECTION | PASS |
| PHONE_DISCRIMINATOR | PASS |
| EMAIL_DISCRIMINATOR | PASS |
| DATE_TIME_DISCRIMINATOR | PASS |
| SERVICE_DISCRIMINATOR | PASS |
| LOCATION_DISCRIMINATOR | PASS |
| USELESS_QUESTION_AVOIDANCE | PASS |
| DUPLICATE_NAME_PROTECTION | PASS |
| MULTIPLE_APPOINTMENTS_SAME_CUSTOMER_PROTECTION | PASS |
| INSUFFICIENT_IDENTITY_NO_GUESS | PASS |
| FREE_EVENT_DISCOVERY | PASS |
| CALENDARVIEW_PAGINATION | PASS (collector; unit) |
| CANCEL_CONFIRMATION_GATE | PASS |
| MICROSOFT_CANCEL | PASS |
| CANCEL_OUTCOME_UNKNOWN_READBACK | PASS (GET reconcile on uncertain network) |
| RESCHEDULE_USES_EXISTING_SCHEDULING_NORMALIZER | PASS |
| RESCHEDULE_USES_EXISTING_FIND_AVAILABILITY | PASS |
| RESCHEDULE_USES_OFFER_SET | PASS |
| RESCHEDULE_USES_FREE_BUSY_OVERRIDE | PASS |
| RESCHEDULE_FRESH_REVALIDATION | PASS |
| MICROSOFT_RESCHEDULE_PATCH | PASS |
| SAME_PROVIDER_EVENT_ID_AFTER_RESCHEDULE | PASS |
| MANUAL_EVENT_FIELDS_PRESERVED | PASS (PATCH start/end only) |
| FAILED_RESCHEDULE_PRESERVES_ORIGINAL | PASS |
| RESCHEDULE_OUTCOME_UNKNOWN_READBACK | PASS (GET time compare) |
| CANCEL_IDEMPOTENCY | PASS |
| RESCHEDULE_IDEMPOTENCY | PASS |
| NEW_BOOKING_REGRESSION | PASS |
| BOOKING_CUSTOM_INTAKE_REGRESSION | PASS |
| BOOKING_MICROSOFT_CREATE_REGRESSION | PASS |

## Astra tool surface

| Item | Value |
|------|--------|
| ASTRA_FIND_APPOINTMENT_TOOL_FILE | `src/lib/voice-v3/tools/find-appointment-tool.ts` |
| ASTRA_RESCHEDULE_APPOINTMENT_TOOL_FILE | `src/lib/voice-v3/tools/reschedule-appointment-tool.ts` |
| ASTRA_CANCEL_APPOINTMENT_TOOL_FILE | `src/lib/voice-v3/tools/cancel-appointment-tool.ts` |
| ASTRA_TOOL_REGISTRATION_FILE | `src/lib/voice-v3/tools/voice-tool-catalog.ts` |
| ASTRA_DELEGATION_CONFIG_FILE | `src/lib/voice-v3/tools/build-openai-tools.ts` |
| FIND_DISPATCH_FILE | `src/lib/voice-v3/calendar/appointment-management-dispatch.ts` |
| RESCHEDULE_DISPATCH_FILE | `src/lib/voice-v3/calendar/reschedule-dispatch.ts` |
| CANCEL_DISPATCH_FILE | `src/lib/voice-v3/calendar/cancel-dispatch.ts` |
| FIND_APPOINTMENT_TOOL_REGISTERED | PASS |
| RESCHEDULE_APPOINTMENT_TOOL_REGISTERED | PASS |
| CANCEL_APPOINTMENT_TOOL_REGISTERED | PASS |
| FIND_TOOL_DESCRIPTION_UPDATED | PASS |
| RESCHEDULE_TOOL_DESCRIPTION_UPDATED | PASS |
| CANCEL_TOOL_DESCRIPTION_UPDATED | PASS |
| FIND_ACCEPTS_PARTIAL_IDENTITY | PASS |
| FIND_DATE_NOT_REQUIRED | PASS |
| DYNAMIC_DISCRIMINATOR_RESULT_EXPOSED_TO_ASTRA | PASS (`useful_discriminators`) |
| PRIVATE_CANDIDATE_VALUES_HIDDEN_FROM_ASTRA | PASS (discriminators only, not peer PII) |
| RAW_MICROSOFT_EVENT_ID_NOT_LLM_SETTABLE | PASS |
| CANCEL_REQUIRES_TRUSTED_SELECTION | PASS |
| CANCEL_REQUIRES_EXPLICIT_CONFIRMATION | PASS |
| RESCHEDULE_REQUIRES_TRUSTED_SELECTION | PASS |
| RESCHEDULE_REQUIRES_OFFER_SET | PASS |
| RESCHEDULE_REQUIRES_SLOT_ID | PASS |
| PRODUCTION_FIND_EXECUTOR_WIRED | PASS |
| PRODUCTION_CANCEL_EXECUTOR_WIRED | PASS |
| PRODUCTION_RESCHEDULE_EXECUTOR_WIRED | PASS |
| FUNCTION_CALL_OUTPUT_WIRED | PASS (existing execute-voice-tool path) |
| LIVE_CONTINUATION_USES_EXISTING_BATCH_BARRIER | PASS |
| ASTRA_TOOL_SEQUENCE_CERTS | PASS (existing selection fixtures + audit) |

Effective LLM schemas: run `buildVoiceV3AstraFunctionTools(VOICE_V3_BOOKING_AGENT_CONFIG)` — `find_appointment` exposes nullable `name`, `phone`, `email`, `date_expression`, `service`, `location`, `appointment_selection_id`, `confirm_selection`.

## Tests

- `npx tsx scripts/test-voice-v3-appointment-discovery.ts`
- `npm run test:voice-v3-microsoft-appointment-management`
- `npx tsx scripts/test-voice-v3-astra-tool-contracts-audit.ts`
- `npm run test:voice-v3-booking`

## Files changed (this extension)

- `appointment-discovery-identity.ts`, `appointment-discovery-match.ts`, `microsoft-discovery-selection-id.ts`
- `microsoft-find-existing-appointments.ts`, `find-existing-appointment.ts`, `providers.ts` (discovery list)
- `find-appointment-tool.ts`, `astra-tool-contracts.ts`, `call-context.ts` (`lookupState`)
- `microsoft-reconcile-mutation-outcome.ts`, `cancel-dispatch.ts`, `reschedule-dispatch.ts`
- Tests + this report

## Remaining limitations

- Live Microsoft manual matrix A–J not run in Cloud Agent VM.
- Recurring series / occurrence mutation: V1 returns unsupported if series semantics cannot be proven safe (no silent series master mutation).
- ANI auto-match when telephony ANI is wired into call context (lookup supports `ani` constraint when provided).
- Durable cross-call appointment DB remains optional fast path only.
