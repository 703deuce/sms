# Voice V3 PSTN booking — runtime path (top to bottom)

This is the **only** path used when a call hits Voice V3 Basic + booking. It does **not** use Voice V2 booking tools, Agent John, or the scripts-only odd-intake harness (`mothers_name`, etc.).

## 1. Telnyx → OpenAI SIP

- PSTN webhook / transfer → `live.transport.incoming`
- Handler: `src/lib/voice-v3-basic/openai-live-webhook.ts`

## 2. Session accept (before audio)

- `createVoiceV3CallRuntime({ liveSessionId })`  
  - Config: **`resolveVoiceV3AgentConfig()` → `VOICE_V3_BOOKING_AGENT_CONFIG` only** (`booking-agent-config.ts`)  
  - Intake keys: **name, email, phone**  
  - Log: `VOICE_V3_BOOKING_PIPELINE_ACTIVE`
- `buildBasicLiveSessionAcceptParams()`  
  - Live instructions + **Astra delegation** with `emit_caller_meaning` tool schema built from the **same booking config** (not a separate test config)

## 3. Sideband (parallel)

- `attachVoiceV3LiveSideband` → greeting → caller speech
- On delegated Astra `response.event` completions → `handleDelegatedAstraResponseEvent`

## 4. Meaning → state (deterministic)

- `extractCallerMeaningFromAstraResponseEvent` → Zod `voice_v3_caller_meaning`
- `runtime.applyEvent(CALLER_MEANING_APPLIED)` → scheduling normalize, slot selection, rules
- Log: `RULES_EVALUATED` (`required_action`, `missing_required_fields`)

## 5. Calendar actions (async, ordered)

1. `dispatchFindAvailabilityIfRequired` — Microsoft busy → OfferSet → `session.thinking.append` → **`response.create`**
2. `dispatchBookingIfRequired` — revalidate → `insertMicrosoftEvent` → confirm → speak
3. `dispatchAppointmentManagementIfRequired` — reschedule/cancel when goal requires

## Required production env

- `VOICE_V3_MICROSOFT_CONNECTION_ID` — connected `voiceCalendarConnection` row
- `VOICE_V3_CALENDAR_ID` (optional, default `primary`)
- `VOICE_V3_INTAKE_ENABLED` not `0`
- Do **not** set legacy test env vars expecting them to switch runtime (removed)

## What went wrong before

Early Voice V3 work added **`TEST_AGENT_CONFIG`** in `src/` to prove dynamic intake (mother’s name, dinosaur). **`resolveVoiceV3AgentConfig()` defaulted to that object**, so Live accept, Astra’s tool schema, and `BOOKING_READY` all behaved like the unit-test harness — **the new FIND/BOOK code ran, but against the wrong config**, so production calls looked “stuck” or asked for nonsense fields.

**Fix:** Production `src/` has a single config module (`booking-agent-config.ts`). Odd-field tests live under `scripts/fixtures/` only.

## Shared non-booking code

- `microsoft-time-adapter.ts` imports Graph timezone helpers from `voice-v2/.../graph-datetime-timezone.ts` — **datetime only**, not Voice V2 booking executors or Live tool runtime.
