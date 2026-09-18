# Voice V3 — production deploy checklist (PSTN booking)

Use this before certifying a build with a real phone call. **Only the Voice V3 pipeline** should handle appointment receptionist PSTN.

## Telnyx routing (must be Call Control, not TeXML)

| Check | Expected |
|-------|----------|
| DID `connection_id` | Transovo **Call Control** app (`TELNYX_CONNECTION_ID` or workspace voice connection) |
| **Not** TeXML → Telnyx Amy | Appointment receptionist publish routes **Call Control** (`VOICE_V3_RECEPTIONIST_PHONE_ROUTED_CALL_CONTROL` in publish logs) |
| Inbound mode in agent config | `callHandling.inboundRoutingMode` = `call_control` for `capabilityPack: appointment_receptionist` |

Dedicated test line (`+15717491060`) may use `/api/telnyx/voice/v3-basic` → same OpenAI SIP accept path.

## OpenAI

| Env | Required |
|-----|----------|
| `OPENAI_API_KEY` | Yes |
| `OPENAI_PROJECT_ID` | `proj_…` (SIP URI + Live) |
| `OPENAI_WEBHOOK_SECRET` | Yes in production (incoming verify) |
| Webhook subscription | `live.transport.incoming` → `{APP_URL}/api/openai/live/incoming` |

## Voice V3 runtime

| Env | Default / note |
|-----|----------------|
| `VOICE_V3_INTAKE_ENABLED` | On unless `0` / `false` |
| `VOICE_V3_INTAKE_TRANSPORT` | `function_tool` (do not use `output_text` in prod unless debugging) |
| `VOICE_V3_MICROSOFT_CONNECTION_ID` | Connected Microsoft calendar row id — **required for FIND/BOOK** |
| `VOICE_V3_CALENDAR_ID` | Optional (`primary`) |
| `VOICE_V3_BUSINESS_TIMEZONE` | IANA, e.g. `America/New_York` |

## One call — expected log sequence

1. `VOICE_V3_BASIC_INBOUND_SIP_FORWARD` or `VOICE_V3_BASIC_TELNYX_TRANSFERRED`
2. `OPENAI_LIVE_INCOMING` → `VOICE_V3_LIVE_ACCEPTED`
3. `VOICE_V3_BOOKING_PIPELINE_ACTIVE`
4. `VOICE_V3_SIDEBAND_CONNECTED` → `LIVE_GREETING_*`
5. `ASTRA_MEANING_*` → `CALLER_MEANING_APPLIED` → `RULES_EVALUATED`
6. Booking: `FIND_AVAILABILITY_*` → `AVAILABILITY_OFFER_SET_CREATED` → `BOOKING_*` → `MICROSOFT_EVENT_CREATED`

## Must not appear on receptionist calls

- `startAiAssistantOnCall` / `ai_assistant_start`
- Voice V2 Telnyx tool webhooks handling booking
- `texml_direct_inbound` skip without subsequent V3 SIP forward

## After deploy

1. Republish appointment receptionist agent (or run phone resync) so DID is on Call Control.
2. Place one PSTN call; confirm greet-first and intake.
3. Complete booking phrase → verify Microsoft calendar event.
