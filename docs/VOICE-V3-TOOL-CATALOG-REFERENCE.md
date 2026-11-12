# Voice V3 — Complete Tool Catalog Reference

**Source of truth in code:** `src/lib/voice-v3/tools/voice-tool-catalog.ts`  
**Model-facing descriptions:** `src/lib/voice-v3/tools/astra-tool-contracts.ts`  
**Execution:** `executeVoiceTool` → per-tool `execute()` in `src/lib/voice-v3/tools/*-tool.ts`

These are the **business tools Astra** (Responses backend) can call. On **LiveKit PSTN**, Python adapts them via `execute_voice_v3_livekit_tool`; business logic stays on the Transovo web runtime.

---

## How tools work (common pattern)

1. **Wizard** → `compileVoiceV3AgentConfig` → per-tool **OpenAI function schemas** (`build*OpenAiTool`).
2. **Astra** chooses a tool + arguments.
3. **`executeVoiceTool`** validates, authorizes, runs the tool’s `execute()`, updates **in-call runtime state** (`VoiceV3CallRuntime`), returns structured JSON (`ok`, `status`, `code`, `data`).
4. **Kinds:** `state_update` | `read` | `mutation` | `lifecycle` (`src/lib/voice-v3/tools/concurrency-policy.ts`).

---

## LiveKit PSTN certification subset (today)

Only **four** tools are exposed on the initial LiveKit PSTN path (`VOICE_V3_LIVEKIT_INITIAL_TOOL_NAMES` in `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts`):

- `update_intake`
- `set_scheduling_preference`
- `find_availability`
- `request_callback`

All **eleven** tools below remain in the catalog and are built when wizard/capability gates allow (full set for direct-Live and future LiveKit expansion).

---

## 1. `update_intake`

| Field | Value |
|-------|--------|
| **Kind** | `state_update` |
| **Always enabled?** | Yes |
| **Implementation** | `src/lib/voice-v3/tools/update-intake-tool.ts` |

**What it does:** Saves caller-provided **intake/custom fields** into authoritative per-call state (name, email, phone, service reason, wizard custom fields). Does **not** book, find slots, transfer, or end the call.

**Parameters:** Dynamic per agent — one nullable field per wizard `intakeFields` entry (`buildUpdateIntakeZodSchema` in `src/lib/voice-v3/intake-objective/build-intake-tool-schema.ts`). Common keys: `name`, `email`, `phone`, `service_reason`, plus custom keys. Custom fields may use **enums** from wizard. Null on a field = caller did not provide/correct that field this turn.

**Typical success:** `INTAKE_UPDATED` with `updated_fields`, `missing_required_fields`, `objective.status`, `state_version`.

**Typical errors:** `INVALID_ARGUMENTS`, `INVALID_INTAKE_FIELD`.

**Astra description (full):**

> Save one or more pieces of caller-provided information in the authoritative state for the current call. Use this whenever the caller clearly provides or corrects configured caller/intake information such as their name, email address, phone number, service reason, or another configured business field. Save every clearly provided configured field from the same caller statement in one call when possible. Fields may be provided in any order. If the caller clearly corrects an earlier value, save the newest clear value. Do not guess incomplete or uncertain information. This function updates caller/intake information only. It does not search availability, find an existing appointment, book, reschedule, cancel, transfer, or end the call. Do not use it merely because the caller mentions a scheduling date or time.

---

## 2. `set_scheduling_preference`

| Field | Value |
|-------|--------|
| **Kind** | `state_update` |
| **Enabled when** | Booking strategy is **Microsoft 365** (`MICROSOFT_365`) |
| **Implementation** | `src/lib/voice-v3/tools/set-scheduling-preference-tool.ts` |

**What it does:** Maps natural language (“Tuesday afternoon”, “tomorrow at 3”) to **structured scheduling meaning**, normalizes in Transovo (business timezone/date), updates **scheduling generation**, prepares for `find_availability`.

**Parameters:** `schedulingMeaningZodObject` (`src/lib/voice-v3/time/scheduling-meaning-schema.ts`):

- `date_relation`: `TODAY` | `TOMORROW` | `DAY_AFTER_TOMORROW` | `THIS_WEEKDAY` | `NEXT_WEEKDAY` | `EXPLICIT_DATE` | `UNSPECIFIED`
- `weekday`: `MONDAY` … `SUNDAY` (nullable)
- `explicit_date`: `YYYY-MM-DD` when `EXPLICIT_DATE` (nullable)
- `time_kind`: `EXACT` | `AFTER` | `BEFORE` | `BETWEEN` | `DAYPART` | `ANYTIME` | `UNSPECIFIED`
- `exact_time`, `start_time`, `end_time` (nullable)
- `daypart`: `MORNING` | `AFTERNOON` | `EVENING` (nullable)
- `date_expression`, `time_expression` — audit/display strings (nullable)

**Typical success:** `SCHEDULING_PREFERENCE_SET` — includes `generation`, `display_preference`, `ready_for_availability_search: true`.

**Typical errors:** `INVALID_ARGUMENTS`, `SCHEDULING_CLARIFICATION_REQUIRED`, unresolved scheduling.

**Astra description (full):**

> Set or correct the caller's scheduling preference for an appointment availability search. Use this when the caller provides or changes scheduling information such as a date, relative date, weekday, daypart, exact time, approximate time, before/after constraint, or time range. Translate the caller's natural scheduling language into the structured semantic scheduling fields defined by this function — for example "Tuesday afternoon" → THIS_WEEKDAY + TUESDAY + DAYPART + AFTERNOON; "tomorrow at 3" → TOMORROW + EXACT + exact_time; "next Wednesday morning" → NEXT_WEEKDAY + WEDNESDAY + DAYPART + MORNING; "Tuesday around four" → weekday + EXACT or approximate exact_time as supported; "after three" → AFTER + start_time; "between two and five" → BETWEEN + start_time and end_time; explicit calendar dates → EXPLICIT_DATE + explicit_date. Do not calculate calendar dates from weekdays or relative expressions when date_relation and weekday fields express the semantics. Do not calculate UTC timestamps, timezone offsets, DST, or Microsoft calendar identifiers — Transovo resolves meaning deterministically using the current business date, timezone, and scheduling configuration. When the caller clearly corrects a scheduling preference, call again with the newest clear preference. Do not call merely because a date or time is mentioned in unrelated conversation.

---

## 3. `find_availability`

| Field | Value |
|-------|--------|
| **Kind** | `read` (LiveKit: `ToolFlag.CANCELLABLE`) |
| **Enabled when** | `capabilities.checkAvailability` + **Microsoft 365** |
| **Implementation** | `src/lib/voice-v3/tools/find-availability-tool.ts` |

**What it does:** **READ** — queries Microsoft calendar for open times using stored normalized scheduling preference. Returns an **offer set** with `offer_set_id` and `slot_id`s.

**Parameters:**

- `service_id` (optional string, nullable) — override service; null = default configured service.

**Prerequisites:** Successful `set_scheduling_preference`; rules from `evaluateVoiceV3Rules` (e.g. scheduling preference present, no clarification required).

**Typical success:**

- `available` — `offer_set_id`, `scheduling_generation`, `slots[]` with `slot_id`, `local_start`, `display`
- `none_available`

**Typical errors:** `SCHEDULING_PREFERENCE_REQUIRED`, `SCHEDULING_CLARIFICATION_REQUIRED`, `FIND_FAILED`.

**Astra description (full):**

> Search the connected scheduling calendar for real appointment times using the authoritative normalized scheduling preference already stored for this call (via set_scheduling_preference). Call set_scheduling_preference first when the caller provides or changes date/time semantics, wait for a successful result, then call find_availability with no date/time arguments. Use this when the caller asks what times are open or wants to schedule and scheduling preference is already established. This is a read/search operation and does not create or modify an appointment. Do not pass natural-language date or time strings — use set_scheduling_preference for semantics. Do not use it to locate an existing appointment (use find_appointment). Do not use book_appointment to test availability.

---

## 4. `book_appointment`

| Field | Value |
|-------|--------|
| **Kind** | `mutation` |
| **Enabled when** | `capabilities.bookAppointments` + **Microsoft 365** |
| **Implementation** | `src/lib/voice-v3/tools/book-appointment-tool.ts` |

**What it does:** **WRITE** — creates appointment on Microsoft for a slot from the current offer set; uses dispatch/idempotency/reconciliation in `dispatchBookingIfRequired`.

**Parameters:**

- `offer_set_id` — from latest `find_availability`
- `slot_id` — chosen slot in that offer set

**Prerequisites:** Valid non-stale offer set; slot in set; required intake for `book_appointment`; `bookingReady` rules.

**Typical success:** `confirmed` — `provider_event_id`, `display_time`.

**Typical errors:** `STALE_OFFER_SET`, `INVALID_SLOT`, `MISSING_REQUIRED_INFORMATION`, `NOT_READY`, booking `failed`, or `outcome_unknown` (`BOOKING_OUTCOME_UNKNOWN`).

**Astra description (full):**

> Create a new appointment using a specific currently valid appointment slot returned by find_availability. Use this when the caller has selected or clearly accepted an offered slot and wants that new appointment reserved. This function changes the external calendar. Do not use it to check whether a time is available. Do not invent an offer_set_id or slot_id. Use only identifiers from current authoritative availability state. Calling this function does not prove the appointment was booked; treat the appointment as confirmed only when the function returns a verified successful result.

---

## 5. `find_appointment`

| Field | Value |
|-------|--------|
| **Kind** | `read` |
| **Enabled when** | `capabilities.findAppointments` + **Microsoft 365** |
| **Implementation** | `src/lib/voice-v3/tools/find-appointment-tool.ts` |

**What it does:** Locates **existing** appointments (cancel, reschedule, “when is my appointment?”). Merges intake; uses scheduling-meaning fields to narrow appointment **when**; supports candidates and `confirm_selection`. Inbound ANI applied by Transovo — do not pass ANI as `phone` unless caller stated it for the appointment.

**Parameters:**

**Identity (all nullable, merge with intake):**

- `name`, `phone`, `email`, `service`, `location`

**Selection:**

- `appointment_selection_id` — opaque id from prior result (never Microsoft Graph event id)
- `confirm_selection` — true only after caller clearly confirms one appointment

**Scheduling meaning** (same family as `set_scheduling_preference`, for *when the existing appointment is*):

- `date_expression`, `date_relation`, `weekday`, `explicit_date`
- `time_expression`, `time_kind`, `exact_time`, `start_time`, `end_time`, `daypart`

**Not for:** Open-slot search (`find_availability`).

**Astra description (full):**

> Locate and select an existing appointment on the business calendar. Use when the caller asks when their appointment is, wants to cancel or reschedule but the exact appointment is not yet selected, provides identifying information (name, stated phone, email, when the appointment is, service, or address), chooses among appointments you previously presented, or confirms which appointment they mean. Call with whatever the caller has already said — do not invent missing fields and do not require name+phone+email+date together. For when the appointment is scheduled, use the same semantic date/time fields as set_scheduling_preference (date_relation, weekday, explicit_date, time_kind, exact_time, daypart, time_expression, etc.) — these narrow an existing appointment, they do not book a new slot. Inbound caller ID is applied automatically by Transovo; do not pass ANI. If the result is needs_more_information, ask only for a useful_discriminator the tool returned (for example phone, email, appointment_date, appointment_time, service, or location) and call find_appointment again with the new detail. If multiple candidates are returned, ask which appointment they mean using the safe display summaries and pass the matching appointment_selection_id. When the caller clearly confirms one appointment, call again with confirm_selection true and that appointment_selection_id. Never pass a raw Microsoft Graph event id. This tool does not search open times (use find_availability), does not cancel, and does not reschedule.

---

## 6. `reschedule_appointment`

| Field | Value |
|-------|--------|
| **Kind** | `mutation` |
| **Enabled when** | `capabilities.rescheduleAppointments` + **Microsoft 365** |
| **Implementation** | `src/lib/voice-v3/tools/reschedule-appointment-tool.ts` |

**What it does:** Moves a **verified** existing appointment to a replacement slot from a current offer set (`dispatchRescheduleIfRequired`).

**Parameters:**

- `appointment_selection_id` (nullable if verified appointment already in call state)
- `offer_set_id` — current availability offer with replacement slot
- `slot_id` — replacement slot caller accepted

**Prerequisites:** `find_appointment` with `confirm_selection` → `set_scheduling_preference` → `find_availability` → slot choice.

**Astra description (full):**

> Move an existing appointment to a replacement slot that was already offered by find_availability and selected by the caller. Use only after find_appointment has confirmed the exact appointment (confirm_selection), the caller stated a new scheduling preference (set_scheduling_preference), find_availability returned slots, and the caller selected a slot. Provide the authoritative offer_set_id and slot_id from current availability state — never invent timestamps or provider ids. Do not use this to locate the existing appointment or to search availability. Treat reschedule as complete only when this function returns verified success.

---

## 7. `cancel_appointment`

| Field | Value |
|-------|--------|
| **Kind** | `mutation` |
| **Enabled when** | `capabilities.cancelAppointments` + **Microsoft 365** |
| **Implementation** | `src/lib/voice-v3/tools/cancel-appointment-tool.ts` |

**What it does:** Cancels verified appointment on Microsoft after explicit cancel consent (`dispatchCancellationIfRequired`).

**Parameters:**

- `appointment_selection_id` (nullable if verified in state)
- `confirmed` — **true** only after caller explicitly confirms cancellation (do not send false)

**Astra description (full):**

> Cancel the exact appointment already identified through find_appointment (confirm_selection). Use only after the caller explicitly confirms they want that appointment cancelled — identity confirmation alone is not cancellation authorization. Do not use this to search for appointments. Do not pass Microsoft Graph event ids. Provide appointment_selection_id when required and confirmed true only after explicit cancel consent. Treat cancellation as complete only when this function returns verified success.

---

## 8. `transfer_call`

| Field | Value |
|-------|--------|
| **Kind** | `lifecycle` |
| **Enabled when** | `capabilities.transferCalls` + at least one enabled `transferDestinations` |
| **Implementation** | `src/lib/voice-v3/tools/transfer-call-tool.ts` |

**What it does:** Authorizes transfer to a **configured destination**; returns `transfer_requested` with resolved E.164/destination. Actual PSTN transfer depends on transport (Telnyx legacy vs LiveKit `TransferSIPParticipant` — not fully wired on all paths).

**Parameters:**

- `destination` — wizard destination **id** (enum when destinations configured), nullable if single destination
- `reason` — brief internal reason (nullable)

**Typical errors:** `INVALID_DESTINATION`, `TRANSFER_NOT_CONFIGURED`.

**Astra description (full):**

> Transfer the current live telephone call to an authorized configured human, team, department, or destination. Use this when the caller asks to speak with a person or appropriate department, when configured escalation policy requires a human transfer, or when the caller accepts a transfer that has been offered. This performs a real telephony action. Do not use it merely to tell the caller that transfer is possible. Only configured destinations may be used.

---

## 9. `end_call`

| Field | Value |
|-------|--------|
| **Kind** | `lifecycle` |
| **Always enabled?** | Yes |
| **Implementation** | `src/lib/voice-v3/tools/end-call-tool.ts` |

**What it does:** Records `end_requested` — semantic signal that the call may end; Amy should still close naturally; hangup is session/transport responsibility.

**Parameters:**

- `reason` (nullable)

**Typical success:** `end_requested` with note that live layer owns goodbye/hangup timing.

**Astra description (full):**

> End the current live telephone call when the conversation is genuinely complete and the caller has no remaining request, or when an applicable business policy requires the call to terminate. This performs a real call-ending action. Do not use it simply because one task has completed if the caller may still be interacting. Do not use it as a substitute for a natural conversational goodbye.

---

## 10. `send_booking_link`

| Field | Value |
|-------|--------|
| **Kind** | `mutation` |
| **Enabled when** | SEND_LINK booking strategy + `isSendBookingLinkAuthorized(config)` |
| **Implementation** | `src/lib/voice-v3/tools/send-booking-link-tool.ts` → `executeSendBookingLink` |

**What it does:** Sends configured **self-service booking link** by SMS (consent, sender, URL from wizard).

**Parameters:**

- `confirmed` — true only after explicit SMS consent/disclosure
- `destination_phone` (optional/nullable) — only if caller wants link at a different number; omit for inbound ANI

**Astra description (full):**

> Send the business's configured self-service booking link by SMS after the caller has explicitly agreed to receive the text. Use when the published booking strategy is Send booking link and the caller asks to receive the link by text (for example "text me the link" or "send me the booking link") and SMS consent has been obtained. Do not use for Microsoft direct booking. Do not call find_availability or book_appointment first. Do not invent or supply a booking URL or sender number. Do not claim the text was sent until this tool returns a verified sent or already_sent result. For inbound calls, omit destination_phone to use the trusted inbound caller number; provide destination_phone only when the caller explicitly requested a different mobile number.

---

## 11. `request_callback`

| Field | Value |
|-------|--------|
| **Kind** | `mutation` |
| **Enabled when** | `isRequestCallbackAuthorized(config)` (wizard callback settings) |
| **Implementation** | `src/lib/voice-v3/tools/request-callback-tool.ts` → `executeRequestCallback` |

**What it does:** **Persists** human callback request in Transovo. Success = authoritative `callback_requested` (or equivalent from executor) — not conversation, not `update_intake` alone.

**Parameters:**

- `callback_phone` (nullable) — E.164 or speakable; null when ANI/intake satisfies policy
- `reason` (nullable) — why they want a callback
- `preferred_time` (nullable) — natural language preference, not an appointment
- `notes` (nullable) — optional staff notes

**Validator-driven:** Call when intent is clear; if result is `needs_information`, use `missingFields` and call again.

**Astra description (full):**

> request_callback — authoritative trusted-backend action to RECORD a human callback request.
>
> WHAT THIS TOOL DOES: Creates persistent business state: the caller wants someone from the business to contact them later by phone. Only a successful result from this function (callback_requested) means the callback request was recorded.
>
> WHEN YOU MUST USE THIS TOOL: Caller clearly wants the business to call them back; including switching from booking/link flows to callback.
>
> WHEN NOT TO USE: Ordinary Q&A; keep talking to Amy; direct book continues; SEND_LINK workflow; immediate transfer (use transfer_call); phone number without callback intent.
>
> CONFIGURED REQUIREMENTS: Callback-required fields are tenant-specific in runtime instructions — not universal name+phone+reason.
>
> VALIDATOR-DRIVEN LIFECYCLE: Invoke when intent is clear; backend returns needs_information + missingFields until satisfied.
>
> SUCCESS BOUNDARY: Only tell caller callback was recorded after authoritative callback_requested.
>
> ARGUMENTS: callback_phone, reason, preferred_time, notes per parameter descriptions.

(Full text also in `astra-tool-contracts.ts`.)

---

## Typical flows

### New booking (Microsoft 365)

```
update_intake (as needed)
  → set_scheduling_preference
  → find_availability
  → book_appointment(offer_set_id, slot_id)
```

### Cancel

```
find_appointment → confirm_selection
  → cancel_appointment(confirmed: true)
```

### Reschedule

```
find_appointment → confirm_selection
  → set_scheduling_preference
  → find_availability
  → reschedule_appointment(offer_set_id, slot_id)
```

### Callback (can switch mid-booking)

```
update_intake (reuse shared facts)
  → request_callback (repeat until success or hard error)
```

### Send link (SEND_LINK strategy)

```
SMS consent
  → send_booking_link(confirmed: true)
```

---

## Wizard / capability gating

| Tool | Enabled when |
|------|----------------|
| `update_intake` | Always |
| `end_call` | Always |
| `set_scheduling_preference` | `scheduling.bookingStrategy === MICROSOFT_365` |
| `find_availability` | `capabilities.checkAvailability` + Microsoft 365 |
| `book_appointment` | `capabilities.bookAppointments` + Microsoft 365 |
| `find_appointment` | `capabilities.findAppointments` + Microsoft 365 |
| `reschedule_appointment` | `capabilities.rescheduleAppointments` + Microsoft 365 |
| `cancel_appointment` | `capabilities.cancelAppointments` + Microsoft 365 |
| `send_booking_link` | `isSendBookingLinkAuthorized(config)` |
| `request_callback` | `isRequestCallbackAuthorized(config)` |
| `transfer_call` | `capabilities.transferCalls` + enabled `transferDestinations` |

**APIs:**

- `buildVoiceV3AstraFunctionToolsFromCatalog(config)` — schemas for enabled tools
- `listVoiceV3AstraToolNamesForConfig(config)` — enabled tool names

---

## Result contract (all tools)

Tools return structured objects consumed by Astra, e.g.:

```ts
{ ok: true, status: "...", data?: { ... } }
{ ok: false, status: "...", code: "...", message: "...", retryable?: boolean }
```

Do not collapse to vague strings like “done” or “failed” in executor implementations.

---

## File index

| Tool | Schema builder | Executor |
|------|----------------|----------|
| update_intake | `buildUpdateIntakeOpenAiTool` | `updateIntakeTool` |
| set_scheduling_preference | `buildSetSchedulingPreferenceOpenAiTool` | `setSchedulingPreferenceTool` |
| find_availability | `buildFindAvailabilityOpenAiTool` | `findAvailabilityTool` |
| book_appointment | `buildBookAppointmentOpenAiTool` | `bookAppointmentTool` |
| find_appointment | `buildFindAppointmentOpenAiTool` | `findAppointmentTool` |
| reschedule_appointment | `buildRescheduleAppointmentOpenAiTool` | `rescheduleAppointmentTool` |
| cancel_appointment | `buildCancelAppointmentOpenAiTool` | `cancelAppointmentTool` |
| transfer_call | `buildTransferCallOpenAiTool` | `transferCallTool` |
| end_call | `buildEndCallOpenAiTool` | `endCallTool` |
| send_booking_link | `buildSendBookingLinkOpenAiTool` | `sendBookingLinkTool` |
| request_callback | `buildRequestCallbackOpenAiTool` | `requestCallbackTool` |
