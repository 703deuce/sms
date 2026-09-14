# Voice Agent — canonical AI booking

Voice uses the **same** MCTB AI Booking orchestrator as SMS Lead Recovery.

## Channel adapter

| Layer | SMS | Voice |
|-------|-----|-------|
| Conversation | SMS thread | `voice:{callId}` session id |
| Semantic | DeepSeek scheduling specialist | `voice_ai_booking_turn` or Telnyx tools |
| Booking | `orchestrateMctbAiBooking` | **same** |
| Provider | Microsoft / Calendly adapters | **same** |
| Timezone | `resolveCanonicalBookingTimezone` | **same** |

## Modes

- **AI_BOOK** — live availability + calendar create (no SMS consent required for calendar write).
- **SEND_BOOKING_LINK** — `send_resource` with existing SMS consent gates.
- **COLLECT_ONLY** — callback / handoff.

Resolved via `resolveVoiceBookingMode()` (wizard + MCTB AI Booking readiness).

## Tools

- `calendar_availability` / `book_appointment` — routed through canonical bridge when AI_BOOK active.
- `voice_ai_booking_turn` — natural-language scheduling turn (specialist → orchestrator).
- `send_resource` — unchanged; booking link SMS still requires consent.

## Durable booking write

`voice_mctb_booking_create` job on `voice-calls` queue for recovery when tool callback cannot wait (optional enqueue from future timeout path). Primary path completes in-tool via orchestrator + idempotency.

## Invariants

- Book only `offered_slot_id` from last availability (no regex slot parsing in runtime).
- No booking success speech before provider `booked` result.
- No long DB transactions across Microsoft/LLM.
