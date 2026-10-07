# SMS AI booking agents — file map & AR reschedule design reference

Copy-friendly reference for where the multi-agent SMS booking code lives, how it flows, and how to reuse it for **Appointment Reminders** reschedule (without MCTB Lead Recovery intent routing).

**Last consolidated:** 2026-10-07

---

## 1. What you remember (two-agent SMS front + deterministic back)

Production design for **MCTB AI Booking** (also used inside Lead Recovery when `AI_BOOK` is armed):

| Layer | Role | OpenAI? | Calendar/provider? |
|-------|------|---------|-------------------|
| **1 — Intent Router** | Classify what the customer wants (scheduling vs FAQ vs human, etc.) | Yes | **No** |
| **2 — Scheduling Specialist** | Parse day/time, slot choice, confirmations into structured JSON | Yes | **No** |
| **3 — Deterministic orchestrator** | Load config, query availability, persist offered slots, create booking | **No** | **Yes** |

**Rule:** The LLM never invents availability. Slots come only from the orchestrator + provider adapters.

**Canonical architecture doc:** `docs/MCTB-AI-BOOKING-ARCHITECTURE.md`

---

## 2. MCTB AI Booking — file map (copy paths)

### Entry points (inbound SMS)

| Purpose | Path |
|---------|------|
| Main handler | `src/lib/mctb/ai-booking/conversation-runtime.ts` → `handleMctbAiBookingInboundSms()` |
| Alternate pipeline wrapper | `src/lib/mctb/ai-booking/sms-conversation-pipeline.ts` |
| Lead Recovery wires booking | `src/lib/mctb/lead-recovery/conversation-runtime.ts` (imports `handleMctbAiBookingInboundSms`) |
| HTTP API | `src/app/api/mctb/ai-booking/route.ts` |
| Config API | `src/app/api/mctb/ai-booking/config/route.ts` |

### Layer 1 — Intent Router

| Purpose | Path |
|---------|------|
| Router implementation | `src/lib/mctb/ai-booking/agents/router.ts` → `runIntentRouterAgent()`, `shouldRouteToScheduling()` |
| Router system prompt | `src/lib/mctb/ai-booking/agents/prompts.ts` → `INTENT_ROUTER_SYSTEM` |
| Router types / confidence threshold | `src/lib/mctb/ai-booking/agents/types.ts` |
| Router model env | `src/lib/mctb/ai-booking/agents/model-config.ts` → `AI_BOOKING_ROUTER_MODEL` |
| Test-only deterministic router | `deterministicIntentRouter()` in `router.ts` (not production authority) |

### Layer 2 — Scheduling Specialist

| Purpose | Path |
|---------|------|
| Specialist implementation | `src/lib/mctb/ai-booking/agents/scheduling-specialist.ts` → `runSchedulingSpecialistAgent()` |
| Specialist prompt | `src/lib/mctb/ai-booking/agents/scheduling-specialist-prompt.ts` |
| Specialist user payload builder | `src/lib/mctb/ai-booking/agents/scheduling-context.ts` |
| Map specialist JSON → orchestrator input | `src/lib/mctb/ai-booking/agents/map-to-orchestrator.ts` |
| Shared structured LLM helper | `src/lib/mctb/ai-booking/agents/json-llm.ts` |
| Response phrasing (facts from orchestrator only) | `src/lib/mctb/ai-booking/agents/response-phrasing.ts` |

### Layer 3 — Orchestrator & providers

| Purpose | Path |
|---------|------|
| Orchestrator | `src/lib/mctb/ai-booking/orchestrator.ts` → `orchestrateMctbAiBooking()` |
| Handle orchestrator result → SMS reply | `src/lib/mctb/ai-booking/handle-orchestrator-result.ts` |
| Booking service (find times, create) | `src/lib/mctb/ai-booking/service.ts` |
| Session store (offered slots per conversation) | `src/lib/mctb/ai-booking/session-store.ts`, `session-store-prisma.ts` |
| Slot presentation / customer copy | `src/lib/mctb/ai-booking/slot-presentation.ts` |
| Book validated slot | `src/lib/mctb/ai-booking/book-offered-slot.ts` |
| Microsoft adapter | `src/lib/mctb/ai-booking/providers/microsoft.ts` |
| Calendly adapter | `src/lib/mctb/ai-booking/providers/calendly.ts` |
| Zoho (unsupported for booking) | `src/lib/mctb/ai-booking/providers/zoho.ts` |
| Readiness / fallback link | `src/lib/mctb/ai-booking/readiness.ts`, `fallback.ts`, `booking-link-sms.ts` |
| Workspace config | `src/lib/mctb/ai-booking/config.ts` (`customFieldsConfig.mctb.aiBooking`) |
| Entitlement | `src/lib/mctb/ai-booking/entitlement.ts` |
| Fulfillment mode (calendar vs link-only) | `src/lib/mctb/ai-booking/fulfillment-mode.ts` |

### Supporting MCTB context (conversation thread for router/specialist)

| Purpose | Path |
|---------|------|
| Semantic conversation context | `src/lib/mctb/semantic-conversation-context.ts` |
| Deterministic NL fallback | `src/lib/mctb/ai-booking/scheduling-interpreter.ts` |
| Observability | `src/lib/mctb/ai-booking/observability.ts` |

### Voice reuse of same orchestrator (not SMS)

| Purpose | Path |
|---------|------|
| Voice bridge to orchestrator | `src/lib/voice/ai-booking/canonical-tool-bridge.ts` |
| Voice native booking | `src/lib/voice/ai-booking/execute-voice-native-booking.ts` |

### Related docs

- `docs/MCTB-AI-BOOKING-ARCHITECTURE.md`
- `docs/MCTB-AI-BOOKING-PROVIDER-MATRIX.md`
- `docs/MCTB-AI-BOOKING-IMPLEMENTATION-STATUS.md`
- `docs/runtime-rules/AI-LEAD-RECOVERY-*.md` (product flow around policy + AI_BOOK)

### Config note (MCTB SMS today)

`src/lib/mctb/ai-booking/config.ts` notes that **legacy multi-agent pipeline** vs **simple-sms-agent** is a migration concern; the multi-agent code above is still what `handleMctbAiBookingInboundSms` runs when Lead Recovery arms scheduling.

---

## 3. Appointments AI scheduling — second stack (better fit for AR reschedule)

Separate from MCTB. Single “understanding” agent + deterministic resolver + execute (includes **RESCHEDULE**, **CANCEL**, **CONFIRM**).

| Purpose | Path |
|---------|------|
| **Main entry** | `src/lib/appointments/ai-scheduling/service.ts` → `handleAppointmentAIRequest()` |
| Understanding agent (layer 1 equivalent) | `src/lib/appointments/ai-scheduling/understand.ts` → `runUnderstandingAgent()` |
| Prompts | `src/lib/appointments/ai-scheduling/prompts.ts` |
| Schema / intents | `src/lib/appointments/ai-scheduling/schema.ts` |
| Resolver (availability, reschedule, cancel) | `src/lib/appointments/ai-scheduling/resolver.ts` |
| Execute writes | `src/lib/appointments/ai-scheduling/execute.ts` |
| Verifier before destructive writes | `src/lib/appointments/ai-scheduling/verify-action.ts` |
| Compose customer message | `src/lib/appointments/ai-scheduling/compose-response.ts` |
| Conversation state hints | `src/lib/appointments/ai-scheduling/conversation-state.ts`, `context.ts` |
| SMS/email wrapper | `src/lib/appointments/ai-booking-orchestrator.ts` → `handleUnifiedAiBooking()` |
| Channel adapters | `src/lib/appointments/ai-scheduling/channel-adapters.ts` |
| HTTP API | `src/app/api/appointments/ai-booking/route.ts` |

**Reschedule logic:** `resolver.ts` — intent `RESCHEDULE` → offer slots → `proposedWrite: { kind: "RESCHEDULE", appointmentId, startsAt }` → verifier → `execute.ts`.

---

## 4. Reminders: confirm / cancel / reschedule (not the SMS agent yet)

### SMS reminders (tokens & templates)

| Purpose | Path |
|---------|------|
| Send reminder SMS, merge vars, tokens | `src/lib/appointments/reminder-delivery.ts` |
| Tokens in appointment metadata | `src/lib/appointments/types.ts` (`confirmToken`, `cancelToken`, `rescheduleToken`) |
| Stop reminders on reply | `src/lib/appointments/reminder-engine.ts` → `stopRemindersAfterCustomerReply()` |
| Public manage / action URLs | `src/lib/appointment-workflows/engine.ts`, `src/app/api/public/manage/[token]/route.ts` |

### Voice reminders (press 1 / 2 / 3 — DTMF, not SMS agents)

| Purpose | Path |
|---------|------|
| Default script (press 1 confirm, 2 reschedule, 3 cancel) | `src/lib/appointment-voice-reminders/types.ts` |
| Actions after keypad | `src/lib/appointment-voice-reminders/actions.ts` |
| Runtime / gather | `src/lib/appointment-voice-reminders/runtime.ts` |

SMS “Reply C / R” is **product copy** you can add; voice already uses digits. Wire deterministic SMS handlers before any LLM.

---

## 5. End-to-end flow (MCTB multi-agent SMS)

```
Inbound SMS
  → handleMctbAiBookingInboundSms (conversation-runtime.ts)
  → [optional] forceSchedulingRoute: skip router, treat as SCHEDULING
  → else runIntentRouterAgent (router.ts)
  → if shouldRouteToScheduling → runSchedulingSpecialistAgent (scheduling-specialist.ts)
  → mapSpecialistToOrchestratorInput (map-to-orchestrator.ts)
  → orchestrateMctbAiBooking (orchestrator.ts)
      → findAvailableTimes / book via provider adapter
      → session store: offered slots per conversationId
  → handleMctbAiBookingOrchestratorResult → SMS reply
```

**Session shortcut:** If `sessionStage === "AWAITING_SLOT_SELECTION"`, router returns `BOOK_SLOT` without broad classification (`router.ts`).

**Skip router in code today:** `forceSchedulingRoute: true` in `handleMctbAiBookingInboundSms` input (`conversation-runtime.ts`).

---

## 6. Proposed AR design (your C / R / cancel menu)

**Do not** use MCTB Lead Recovery or Intent Router for reminder replies.

### Deterministic first message (no LLM)

Example customer experience:

- Reminder: “Appointment Monday 5 AM. Reply **C** to confirm, **R** to reschedule, **X** to cancel.”
- **C** → confirm appointment in DB/calendar (no agent).
- **Cancel** → cancel (policy + calendar), no agent.
- **R** → start **reschedule session** only; then conversational scheduling.

### Reschedule conversation (agent / orchestrator only here)

**Option A — Appointments AI scheduling (recommended for AR)**

1. Inbound handler sets `conversationId`, pins `appointmentId` from reminder metadata.
2. Call `handleAppointmentAIRequest()` with:
   - `channel: "sms"` or `"conversation"`
   - `message`: customer free text after **R**
   - Context assembled so target appointment is known (`assembleAppointmentAiContext` in `context.ts`).
3. Optionally **skip understanding** for intent: use `applyStateHintsToUnderstanding()` so intent is always `RESCHEDULE` (see `service.ts`).
4. Resolver offers slots; verifier confirms; `execute.ts` performs reschedule.

**Option B — MCTB specialist + orchestrator (shared with MCTB calendar adapters)**

1. After **R**, call `handleMctbAiBookingInboundSms({ forceSchedulingRoute: true, ... })` **or** call `runSchedulingSpecialistAgent` + `orchestrateMctbAiBooking` directly.
2. **Caveat:** MCTB orchestrator is optimized for **new** bookings (offered slots + `createBooking`). Reschedule may need an adapter that calls **update/move** on the existing appointment, not only create.

### What to reuse vs not

| Piece | AR confirm/cancel | AR reschedule (after R) |
|-------|-------------------|-------------------------|
| MCTB Intent Router | **No** | **No** |
| MCTB Scheduling Specialist | **No** | Optional (if Option B) |
| MCTB orchestrator | **No** | Optional (if Option B + reschedule adapter) |
| Appointments `runUnderstandingAgent` | **No** | Optional (can force RESCHEDULE via state) |
| Appointments `resolver` + `execute` | **No** | **Yes** (Option A) |
| Voice DTMF actions | Reference only | Reference only |

---

## 7. Key functions (grep anchors)

```text
handleMctbAiBookingInboundSms     → src/lib/mctb/ai-booking/conversation-runtime.ts
runIntentRouterAgent              → src/lib/mctb/ai-booking/agents/router.ts
runSchedulingSpecialistAgent      → src/lib/mctb/ai-booking/agents/scheduling-specialist.ts
orchestrateMctbAiBooking          → src/lib/mctb/ai-booking/orchestrator.ts
mapSpecialistToOrchestratorInput  → src/lib/mctb/ai-booking/agents/map-to-orchestrator.ts

handleAppointmentAIRequest        → src/lib/appointments/ai-scheduling/service.ts
runUnderstandingAgent             → src/lib/appointments/ai-scheduling/understand.ts
resolveAppointmentIntent          → src/lib/appointments/ai-scheduling/resolver.ts
applyVerifiedWrite                → src/lib/appointments/ai-scheduling/execute.ts
handleUnifiedAiBooking            → src/lib/appointments/ai-booking-orchestrator.ts
```

---

## 8. Environment / models (MCTB AI Booking)

From `docs/MCTB-AI-BOOKING-ARCHITECTURE.md`:

- Shared OpenAI client: `@/lib/ai/openai` (`OPENAI_API_KEY`, default model)
- Optional: `AI_BOOKING_ROUTER_MODEL`, `AI_BOOKING_SCHEDULER_MODEL`
- Without OpenAI: fallbacks in `scheduling-interpreter.ts` / router UNKNOWN path

---

## 9. Decision checklist (before implementation)

1. **Calendar source for reschedule:** Microsoft / Calendly (MCTB adapters) vs Transovo appointment record only?
2. **Inbound pipe:** Extend existing Twilio/conversations inbound vs dedicated AR reminder reply handler?
3. **Session store:** Reuse `mctb_ai_booking_sessions` vs appointments `conversation-state`?
4. **Confirm/cancel:** Token links only, SMS letters only, or both?
5. **Entitlement:** AR product flag only — do not route through MCTB Lead Recovery.

---

## 10. One-paragraph summary

The **two-agent SMS system** lives under **`src/lib/mctb/ai-booking/`**: **Intent Router** (`agents/router.ts`) → **Scheduling Specialist** (`agents/scheduling-specialist.ts`) → **deterministic orchestrator** (`orchestrator.ts`), entered by **`handleMctbAiBookingInboundSms`** in **`conversation-runtime.ts`**, documented in **`docs/MCTB-AI-BOOKING-ARCHITECTURE.md`**. For **Appointment Reminders**, handle **C / cancel / R** without the router; for **R-only** scheduling conversation, prefer **`src/lib/appointments/ai-scheduling/`** (`handleAppointmentAIRequest` + `RESCHEDULE` in `resolver.ts`) unless you explicitly want MCTB’s provider orchestrator with a new reschedule write path.
