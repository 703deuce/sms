# Voice V2 PSTN booking — flow architecture (answer → Microsoft 365 booked)

Copy-friendly overview of how the pieces fit together for **one-Amy** after-hours PSTN when the wizard uses **book directly** on **Microsoft 365**.  
**Out of scope here:** the isolated **GPT-Live-1** test bridge (`openai_live`) — no FIND/BOOK/tools.

**Related authority:** `docs/VOICE-V2-CLOUD-AGENT-HANDOFF.md`, `docs/VOICE-V2-CERTIFIED-BOOKING-BOUNDARY.md`, `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md`

---

## End-to-end story (caller’s experience)

1. Caller dials the business number (PSTN).
2. Telnyx receives the call; Transovo answers and may play a short **recording disclosure** (TTS).
3. **Amy** starts speaking (greeting from wizard + contact name when known): e.g. *“How can I help you?”*
4. Caller talks; audio streams continuously. Amy listens and replies in one continuous conversation (**no** handoff to a second “booking agent”).
5. Caller says they want an appointment → Amy collects **only missing** intake fields (name, reason, phone, etc. per wizard).
6. Amy confirms **which day** (scheduling preference) when intake is ready.
7. Amy calls **FIND** → backend reads Microsoft calendar busy times, computes open slots, stores a canonical **offer set**.
8. Amy speaks a small set of offered times; caller picks one.
9. Amy calls **BOOK** with that offer set + slot id → backend creates the **Microsoft Graph** calendar event.
10. Only after BOOK returns success, Amy says they are **booked/confirmed**.
11. Call ends; post-call jobs (transcript, reconciliation, analytics) run **after** the live conversation.

**Hard rules:** Amy must not say “you’re booked” before BOOK succeeds. FIND must run before offering real calendar times. Latest caller correction wins on intake/date.

---

## Smallest → largest building blocks

### 1. PSTN audio frame

- Narrowband **PCMU (μ-law) @ 8 kHz** on the phone network.
- Telnyx decodes/encodes between PSTN and the app’s media stream.

### 2. Telnyx Call Control + webhooks

- **Call Control ID** identifies the live leg.
- Webhooks (`call.initiated`, `call.answered`, `call.hangup`, transcription, etc.) update `voiceCall` + `voiceCallEvent` in the DB.
- **Entry:** `src/lib/voice/telnyx/webhook-handlers.ts`, `src/lib/voice/inbound.ts`.

### 3. Routing rule (why Amy answers)

- Workspace **call flow** picks an action (e.g. `ai_after_hours` → Voice agent).
- **Entry:** `src/lib/voice/flow/compile.ts`, inbound routing in `inbound.ts`.

### 4. Voice agent + wizard config

- **VoiceAgent** row + published **runtime config** (greeting, tone, after-hours, booking strategy).
- Wizard sets **`bookingStrategy`** (e.g. `MICROSOFT_365`), calendar connection, appointment type, intake fields.
- **Entry:** `src/lib/voice/load-agent-config.ts`, `src/lib/voice-v2/booking-strategy.ts`, wizard under `advanced.appointmentReceptionistWizard`.

### 5. AI start (two production shapes — same Amy intent)

| Path | What runs | Typical for Voice V2 PSTN |
|------|-----------|---------------------------|
| **OpenAI Realtime media bridge** | Telnyx **bidirectional media WebSocket** ↔ your **bridge listener** ↔ **OpenAI Realtime** WebSocket; tools run in-process | **Yes** when `shouldUseOpenAiRealtimeMediaBridge(config)` |
| **Telnyx AI Assistant** | Telnyx hosts the model; tools hit **HTTP webhooks** on your app | Legacy / alternate |

- Bridge start: `startOpenAiRealtimeMediaBridgeOnCall` → `src/lib/voice/telnyx/openai-realtime-bridge/start-on-call.ts`
- Listener: `scripts/realtime-bridge-listener.ts` (port **3108**), `ws-server.ts`
- Per-call bridge: `call-bridge.ts` (one OpenAI session for the whole call)

### 6. Prompt stack (what “Amy” is told)

Layers are concatenated at session start — **one Amy**, not separate booking bot:

| Layer | Role | Where |
|-------|------|--------|
| **A — Static core** | One conversation, memory, booking as capability, tool discipline | `src/lib/voice-v2/one-amy/amy-core-static-prompt.ts` |
| **B — Business / wizard** | Greeting, services, intake instructions, knowledge/qualification/after-hours | `loadOpenAiRealtimeSessionInstructions` → `instructions.ts`, `live-intake-instructions.ts`, etc. |
| **C — Runtime / session** | Call id, caller id, warmup, capabilities snapshot | Realtime session init, warmup |
| **D — Tools** | JSON schemas the model may invoke | `realtime-tools.ts` / Telnyx-published tool URLs |

Greeting text: `resolveAiGreeting` + wizard `callHandling.greeting` (spoken or injected per transport).

### 7. Continuous conversation loop (live call)

```
Caller audio → Telnyx media WS → bridge → OpenAI input_audio_buffer
OpenAI generates speech → bridge → Telnyx → PSTN → caller hears Amy
```

- Optional: Telnyx **call.transcription** webhooks for ops/debug (not the authority for BOOK).

### 8. Model tool call (function invocation)

When Amy needs structured action, the Realtime model emits a **tool call** (e.g. `voice_v2_save_intake_fields`).

- **Bridge path:** `call-bridge.ts` → `dispatchOpenAiRealtimeVoiceV2Tool` in `realtime-tools.ts`
- **Telnyx Assistant path:** `POST /api/telnyx/voice/tools` or dedicated `POST /api/telnyx/voice-v2/*` routes

### 9. `voice_v2_save_intake_fields` (memory + stage)

- Validates fields against wizard intake schema; updates **CallContext** (in-memory L1/L2 per call).
- Phone may prefill from caller ID; corrections overwrite older values.
- Runs **booking workflow** transition: missing fields → scheduling date → ready for FIND.
- Returns JSON the model reads (`voice_v2_next_stage`, `missingBeforeBooking`, etc.).
- **Entry:** `src/lib/voice-v2/intake/save-intake-fields.ts`, `booking-workflow.ts`, `session/call-context-store.ts`

### 10. Booking workflow (deterministic stage machine)

Stages (simplified for **MICROSOFT_365** live book):

`COLLECT_REQUIRED_INTAKE` → `COLLECT_SCHEDULING_PREFERENCE` → `FIND_AVAILABILITY` → `OFFER_SLOTS` → `BOOK_SELECTED_SLOT` → `BOOKING_CONFIRMED`

- **Entry:** `src/lib/voice-v2/booking-workflow.ts` (`deriveVoiceV2NextStage`, `allowedNextActionsForStage`)
- Tells the model which tool is allowed next; blocks “callback only” escapes while booking continue is required.

### 11. `voice_v2_find_availability` (FIND)

**Microsoft certified box only** on the hot path:

1. Resolve workspace Microsoft connection + OAuth token.
2. **Graph** `calendarView` (busy) + local ledger adjustments.
3. Compute free slots in business timezone/hours.
4. Assign stable **`slot_id`** per slot; persist **`offer_set_id`** + slots (offer set store).
5. Return spoken labels + `certified_booking_handoff` payload forcing BOOK as next action.

- **Entry (sealed):** `src/lib/voice-v2/pipelines/microsoft-365-certified/find-availability.ts`
- **HTTP (Telnyx tools):** `src/app/api/telnyx/voice-v2/find-availability/route.ts`
- **Bridge:** `realtime-tools.ts` calls the same `executeMicrosoft365CertifiedFindAvailability` function.

### 12. Offer set (canonical slot list)

- Short-lived persisted record tying **offer_set_id** → list of `{ slot_id, start, end, label }`.
- BOOK must use ids from this set — no invented times.
- **Entry:** `offer-set-store` (under certified pipeline `internal/`).

### 13. `voice_v2_book_offered_slot` (BOOK)

1. Load offer set by id; resolve **selected_slot_id**.
2. Revalidate slot still free (busy check).
3. **Graph POST** create calendar event (frozen serializer/timezone rules).
4. Return **`BOOKING_CONFIRMED`** (or explicit failure) — Amy may confirm only on success.

- **Entry (sealed):** `src/lib/voice-v2/pipelines/microsoft-365-certified/book-offered-slot.ts`
- **HTTP:** `src/app/api/telnyx/voice-v2/book-offered-slot/route.ts`
- **Bridge:** `realtime-tools.ts` → `executeVoiceV2BookOfferedSlot` / certified wrapper.

### 14. Tool result → Amy speech

- Tool output is fed back into the **same** OpenAI Realtime session.
- Model generates the next utterance (offer times, confirm booking, or recover from error).

### 15. Call record + observers (not on the booking critical path)

- **`voiceCall`** + **`voiceCallEvent`** — lifecycle, AI start metadata, transcriptions.
- **`voiceToolExecution`** — tool audit (when wired).
- **Warmup** (`call-warmup`) — preloads CallContext L2 while caller hears greeting.
- **Post-call:** Nova transcript, DeepSeek extraction, reconciliation — **must not** block FIND/BOOK.

---

## One diagram (logical modules)

```
[PSTN Caller]
     │
     ▼
[Telnyx SIP / Call Control] ──webhooks──► [Transovo Next.js inbound]
     │                                          │
     │ media WS                                 ├─► voiceCall / events (DB)
     ▼                                          │
[Realtime bridge listener :3108]                │
     │                                          │
     ├─► [OpenAI Realtime session] ◄──prompt───┤ Layer A–D instructions
     │         │  ▲                             │
     │         │  └── audio ◄──────────────────┘
     │         │
     │         └── tool calls ──► [realtime-tools dispatch]
     │                                    │
     │                    ┌───────────────┼───────────────┐
     │                    ▼               ▼               ▼
     │              [save_intake]    [FIND certified]  [BOOK certified]
     │                    │               │               │
     │                    ▼               ▼               ▼
     │              [CallContext +    [Microsoft Graph   [Graph CREATE
     │               workflow stage]   busy + slots]     calendar event]
     │                    │               │               │
     │                    └───────────────┴───────────────┘
     │                                    │
     └──────────── tool JSON result ──────┘
```

---

## The three tools that matter for Microsoft live book

| Tool | Purpose | Backend truth |
|------|---------|----------------|
| `voice_v2_save_intake_fields` | Remember caller facts; advance workflow | CallContext + readiness |
| `voice_v2_find_availability` | Slots for a requested date | Graph busy + offer set |
| `voice_v2_book_offered_slot` | Create appointment | Graph 201 + `BOOKING_CONFIRMED` |

Other tools (knowledge search, transfer, send link, request-only finalize, Calendly routes) are **parallel capabilities** — not on the frozen Microsoft FIND/BOOK spine.

---

## Microsoft 365 specifically

- **Connection:** workspace Microsoft OAuth (`resolveMctbMicrosoftConnectionId`, tokens via `getValidAccessToken`).
- **Calendar config:** booking hours, timezone, service duration from wizard / MCTB AI booking config loaders inside the **certified** package.
- **Do not refactor** shared Graph code into the certified tree from other strategies — see `pipelines/microsoft-365-certified/internal/FROZEN.md`.

---

## What to read in the repo (quick map)

| Concern | Path |
|---------|------|
| Call answered → AI started | `src/lib/voice/inbound.ts` |
| Media bridge | `src/lib/voice/telnyx/openai-realtime-bridge/*` |
| Session instructions | `src/lib/voice/telnyx/openai-realtime-bridge/instructions.ts` |
| Tool dispatch (bridge) | `src/lib/voice/telnyx/openai-realtime-bridge/realtime-tools.ts` |
| Intake + context | `src/lib/voice-v2/intake/*` |
| Workflow stages | `src/lib/voice-v2/booking-workflow.ts` |
| Microsoft FIND/BOOK | `src/lib/voice-v2/pipelines/microsoft-365-certified/` |
| Telnyx tool HTTP | `src/app/api/telnyx/voice-v2/*` |

---

## Certified invariant (one sentence)

**Caller intent → intake in CallContext → FIND builds offer set → caller picks canonical slot_id → BOOK creates Microsoft event → Amy confirms only after BOOKING_CONFIRMED.**
