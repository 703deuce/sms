# MCTB AI Booking architecture

## Product split

| Feature | What it is | Technical layer |
|---------|------------|-----------------|
| **Booking Link** | Send external scheduler URL | `MctbBookingLink` + messaging (`send_booking_link`) |
| **AI Booking** | Conversational schedule using **live provider availability** | `src/lib/mctb/ai-booking/*` orchestration service |

The LLM **does not know availability**. It interprets customer intent, calls the booking service, and explains **provider-returned** slots only.

## Strict rule

```
Customer NL → normalized time WINDOW (not slots)
           → provider.findAvailableTimes(window)
           → offer 2–3 returned slots OR answer specific-time check
           → customer chooses a returned slot
           → provider.createBooking(slot)
           → confirm only after provider success
ANY failure → configured booking link (never dead-end)
```

Never infer openness from business hours copy, cached descriptions, or defaults.

## Service API (tools call these — not Graph/Calendly directly)

| Function | Purpose |
|----------|---------|
| `getBookingProviders()` | Connected providers + capability audit |
| `getBookingContext()` | Calendar/event type, duration, timezone, fallback URL |
| `findAvailableTimes()` | Query provider for slots in a window; updates session offered slots |
| `createBooking()` | Book **only** a slot from the last provider response |
| `getBookingStatus()` | Provider event / appointment status |

HTTP: `GET/POST /api/mctb/ai-booking` (`action`: `orchestrate`, `find_available_times`, `create_booking`, `booking_status`).

## Provider adapter operations

Each adapter implements the same four operations:

1. **Get booking/calendar configuration** — `getBookingContext`
2. **Check availability** — `findAvailableTimes`
3. **Create booking/event** — `createBooking`
4. **Return confirmed result** — `getBookingStatus`

Implementations:

- `providers/microsoft.ts` — reuses `getAvailability` / `bookAppointment` (`voice/calendar/booking.ts`)
- `providers/calendly.ts` — `listEventTypeAvailableTimes` / `bookEventInvitee` (`calendly-actions.ts`)
- `providers/zoho.ts` — explicit unsupported (CRM only today)

Capability audit: `capabilities.ts` — **AI Booking supported** only when read + availability + create are all verified for that workspace.

## Stateful conversations

`session-store.ts` keeps **offered slots** per `conversationId`. `createBooking` rejects slot IDs that were not in the last provider query.

`orchestrator.ts` implements:

- Broad day → offer 2–3 slots
- Specific time → available / alternatives from same query
- Choice utterance → resolve against offered set → book

## Configuration

Workspace `customFieldsConfig.mctb.aiBooking`:

- `enabled`, `upgradeRequired`, `provider`, `serviceName`, `eventTypeUri`, `fallbackBookingLinkId`, `timezone`

## Related docs

- `docs/MCTB-AI-BOOKING-PROVIDER-MATRIX.md`
- `docs/MCTB-BOOKING-SIMPLIFICATION-AUDIT.md`

## Production status (mechanical)

| Flag | Expected |
|------|----------|
| `AI_BOOKING_SETUP_UI` | CONNECTED_AND_WORKING |
| `AI_BOOKING_CONFIG_PERSISTENCE` | `customFieldsConfig.mctb.aiBooking` via `/api/mctb/ai-booking/config` |
| `NL_SCHEDULING_INTERPRETER` | `scheduling-interpreter.ts` (deterministic) |
| `CONVERSATION_INTENT_ROUTING` | `conversation-runtime.ts` → `handleJohnCustomerSmsReply` |
| `DURABLE_BOOKING_SESSION` | `mctb_ai_booking_sessions` (Prisma) |
| `BOOKING_CONFIRMED_ACTIVITY` | `mctb_conversation_booking_activities` + `direction=event` message |
| `FALLBACK_BOOKING_LINK` | configured `fallbackBookingLinkId` |
| `IN_MEMORY_PRODUCTION_SESSION_STORE` | **NO** (default `prismaMctbAiBookingSessionStore`) |
| `INVENTED_AVAILABILITY` | **0** (provider-only slots) |

**Entitlement:** `hasMctbAiBookingEntitlement()` — set `mctb.aiBooking.entitled: true` or `workspaceLimits.limits.mctbAiBookingEntitled: true` (paid workspaces default unless explicitly false).
