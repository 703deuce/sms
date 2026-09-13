# After-Hours Voice Agent — V1 Capabilities

**Profile:** `after_hours` preset / `answerWhen: after_hours` / MCTB same-number voice mode  
**Workflow version:** `after-hours-v1` (`src/lib/voice/runtime/types.ts`)

## Product intent

The agent’s job is **not** “get the caller booked at all costs.” Booking is one supported outcome among several. The AI **never** touches the calendar on the call in V1.

## V1 capability set

| Capability | Behavior |
|------------|----------|
| **Answer** | Approved FAQs from compiled Business Context (hours, services, area, pricing where configured). |
| **Message capture** | Understand why they called; structured message + fields as policy requires. |
| **Urgency** | Identify emergencies; notify business per LR policy. |
| **Callback requests** | Collect callback number / time / reason; create callback request. |
| **Booking-link send** | When a booking URL is configured: verbal SMS consent → `send_resource` → confirm only after success. |
| **Business notification** | Email/SMS summaries to the business per policy (`SEND_EMAIL_SUMMARY`, `SEND_OWNER_SMS`). |

Optional when enabled in wizard: **human transfer** (runtime-resolved destination).

## Voice number vs SMS sender

Inbound **voice** (866 / 800 / forwarded DID) and outbound **texting** are separate in Telnyx:

| Role | Typical number | Notes |
|------|----------------|--------|
| Caller dials | Toll-free or local voice DID | TeXML / AI assistant answers here. |
| Booking link SMS **From** | A2P local (e.g. **571**) | Toll-free voice DIDs are **not** used as SMS senders unless explicitly configured and SMS-capable. |

Runtime: `resolveVoiceOutboundSmsFrom` in `src/lib/voice/sms/voice-outbound-sms-from.ts`  
Config: `messaging.outboundSms` on the voice agent (set from wizard in `build-agent-config.ts`).

Modes:

- **`workspace_preferred`** — default when voice is toll-free; picks HP-certified / approved sender (571).
- **`same_as_voice_line`** — when the voice DID is a local SMS-capable number.
- **`explicit_number`** — fixed `phoneNumberId` or E.164 on the agent.

Override env: `VOICE_OUTBOUND_SMS_FROM_E164` (must exist on the workspace).

## Booking-link flow (V1)

1. Caller expresses scheduling intent.
2. Agent gathers **minimum** fields the business requires (name, callback, address, service, etc.).
3. Runtime checks booking link configuration (`appointmentTypes` with `send_booking_link` + SMS resources).
4. If SMS consent is not already on the call record, agent asks:  
   *“I can text you the booking link so you can choose a time that works for you. Is it okay if I send that by text? Message and data rates may apply.”*
5. On **yes**: Telnyx workflow moves to **Send Resource** (only after verbal SMS agreement); then `send_resource` with `resource_type: booking` and `verbal_sms_consent: true`.
6. Agent confirms **only after** tool success.
7. **Call continues** — FAQs and message capture remain available.

**Explicitly out of scope for V1:** calendar lookup, slot selection, “Tuesday at 2 is available,” creating appointments, staying on the line to force conversion.

## Code map

| Layer | Location |
|-------|----------|
| Profile detection | `src/lib/voice/runtime/voice-profile.ts` |
| LR policy (link-only booking) | `deriveLeadRecoveryPolicyFromWizard` in `wizard-policy-bridge.ts` |
| Tool gating | `capability-resolver.ts` (no `AI_BOOK` on after-hours profile) |
| Prompt | `after-hours-v1.ts`, `base-voice-rules.ts`, `compile-voice-agent-prompt.ts` |
| SMS link + consent | `send-resource.ts`, `send_resource` in `catalog.ts` |
| Telnyx tool surface | `hangup`, `transfer`, `send_resource`, `search_business_details` |

## Wizard preset

`applyWizardPreset("after_hours")` enables: `answer_questions`, `take_messages`, `transfer_calls`, `book_appointments` (link-only via policy), `send_sms_confirmations`.

Full appointment receptionist / calendar booking remains a **different profile** (`appointment_receptionist`), not after-hours V1.
