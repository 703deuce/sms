# Voice V3 — code & wiring gaps (implementation only)

**Scope:** Appointment receptionist (`advanced.capabilityPack === "appointment_receptionist"`) on the production PSTN stack: Telnyx → LiveKit worker → GPT-Live (Amy) + delegated backend (Astra) → OpenAI FunctionTools → Node `src/lib/voice-v3/**` → calendar providers (Microsoft today).

**Out of scope for this doc:** PSTN certification checklists, manual test runbooks, deploy procedures, V1/V2 Telnyx Amy, generic `/voice/agents` compile pipeline, MCTB.

This is a **copy-paste register** of incomplete, partial, or missing **code** — not “needs another phone call.”

---

## 1. Wizard → published config → runtime

| Gap | Status | Where / notes |
|-----|--------|----------------|
| Transfer destinations not fully compiled into runtime | **Partial** | Wizard has destinations + routing UI; `VoiceV3AgentConfig.transferDestinations` often empty or phone-only at runtime. `from-published-agent.ts` does not fully map wizard transfer → authorized `transfer_call` destinations. See `docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md`. |
| Warm transfer / waterfall / per-destination DIRECT vs WARM | **Not done** | Wizard stores `transferPlanSteps`, `warmTransfer`, modes; compiled config lacks per-destination mode, semantic routes, availability flags. Only cold `transfer_sip_participant` path in Python bridge. See `docs/VOICE-V3-TRANSFER-PREFLIGHT-AUDIT.md`, `docs/VOICE-V3-TRANSFER-SYSTEM-IMPLEMENTATION-DIRECTIVE.md`. |
| Capabilities, booking behavior, recovery, urgency knobs | **Partial** | Many wizard fields still dual-labeled V2 vs V3 in audit; not all write one authoritative V3 snapshot consumed by LiveKit + delegation. |
| Persona, tone, speaking style | **Partial** | Large Amy Live surface from **frozen** `live-frontend-instructions.ts`, not published wizard `instructions.*` / `voiceLanguage`. `agentName` on PSTN often env-driven (`resolveVoiceV3DefaultPromptInput`), not wizard name. |
| Wizard `instructions.system` | **Not wired to V3** | Saved on publish via `compileVoiceAgentPromptFromWizard`; **not** loaded into V3 `sessions.accept` (V2/Telnyx path only). |
| Scheduling strategy switch (Microsoft vs send-link vs request-only vs Calendly vs Google) | **Partial** | Microsoft direct FIND/BOOK/RESCHEDULE/CANCEL is the live path. Other strategies have modules or catalog gates but wizard manifest marks many fields as **future** executors (see §9). |

---

## 2. Booking outcome persistence (Graph succeeds, product DB does not)

| Gap | Status | Where / notes |
|-----|--------|----------------|
| `VoiceCall.appointmentBooked` not set on successful book | **Not wired** | `markVoiceCallBooked()` exists in `src/lib/voice/runtime-provider/livekit-call-telemetry.ts` and is used from legacy/python Calendly paths — **no** call from `src/lib/voice-v3/calendar/book-dispatch.ts` or book tool completion. |
| `voice_appointments` row not created for V3 Microsoft book | **Not done** | No `voiceAppointment.create` under `src/lib/voice-v3/**`. Verification helpers expect a DB row; PSTN books can succeed in Graph with zero rows. |
| `registerDurableBooking()` | **In-memory only** | `src/lib/voice-v3/calendar/durable-booking-store.ts` — process-local `Map`; not Postgres; lost on restart; not tied to `VoiceCall`. |
| CRM / contact linkage on V3 book | **Not wired** | `syncFrontDeskBookingToCrm` and similar hooks used on Front Desk / python commit paths — **not** on V3 Microsoft book-dispatch success path. |
| Post-book staff notifications | **Partial** | `notifyVoiceV3AppointmentBooked` is invoked from `markVoiceCallBooked`; if that helper is never called, notifications do not run. |
| `VoiceToolExecution` rows for V3 tools | **Missing / not wired** | Often zero rows per call; DB audit trail does not mirror FunctionTool execution on the hot path. |
| Forensics tool completion payload | **Partial** | `NODE_TOOL_EXECUTION_COMPLETED` tends to store summary (`ok`, `status`, `elapsed_ms`) without `providerEventId`, `bookingAttemptId`, slot identity, or calendar id. |
| Provider event id on call record | **Not done** | `VoiceCall.metadata` / forensics do not retain Microsoft Graph event id after successful book (must be inferred from logs or external Graph search). |

---

## 3. Transfer (V3 tool + LiveKit)

| Gap | Status | Where / notes |
|-----|--------|----------------|
| Wizard → `transfer_call` authorization matrix | **Partial** | Destinations compile incompletely; triggers vs default plan vs semantic route selection not aligned with directive. |
| Warm transfer (`WarmTransferTask`) | **Not done** | Installed in LiveKit Agents 1.8.2; Transovo uses cold `JobContext.transfer_sip_participant` only. |
| Tool args / route model | **Partial** | Directive calls for `route_id` / structured plan; current contract uses destination phone resolution in TS returned to Python. |
| Transfer return-to-AI / SIP forward after transfer | **Partial** | Referenced in isolation doc for supported receptionist; completeness varies by scenario. |
| `ringing_timeout` on cold transfer | **Partial** | API supports it; JobContext wrapper does not pass through — executor must call lower-level SIP API. |

---

## 4. Conversation control & stale work

| Gap | Status | Where / notes |
|-----|--------|----------------|
| Single authoritative conversation revision on production tool path | **Partial** | `docs/VOICE-V3-TURN-REVISION-AND-OPERATION-LIFECYCLE-BENCHMARK.md` — freshness / abandonment semantics not fully unified on delegation + FunctionTool path. |
| `markCallerTurnSemanticApplied` on delegation completion | **Not wired** | `docs/VOICE-V3-CONVERSATION-FRESHNESS-ARCHITECTURE.md` — counters exist; completion does not always advance them. |
| Delegated Responses HTTP `cancel` | **Not wired** | Documented as separate from sideband; not connected for abandoning in-flight backend work. |
| `DelegationCreatedEvent.offset_ms` used for gates | **Not read in app** | Referenced in freshness architecture as unused in `src/`. |

---

## 5. Intake & book preconditions

| Gap | Status | Where / notes |
|-----|--------|----------------|
| Wizard field manifest → runtime intake schema | **Partial** | Intake-objective module + wizard bridge landed; `wizard-v3-manifest-builder.ts` still lists many fields as future consumers — not every wizard field drives `update_intake` + book preconditions. |
| Early `book_appointment` when intake incomplete | **Guard only** | Engine returns `not_ready` quickly; no hard API block preventing the model from invoking book before requirements are met. |

---

## 6. Observability (missing instrumentation / persistence)

| Gap | Status | Where / notes |
|-----|--------|----------------|
| Filler telemetry in forensics DB | **Partial** | `voice_v3_tool_filler_*` logged in Python worker only; not appended to forensic event batch on Node hot path. |
| `FUNCTION_TOOL_*` forensics detail | **Partial** | Events often lack `tool_name` on START/COMPLETE (summaries show `?`). |
| Chat metrics / e2e latency on worker | **Partial** | `stopped_speaking_at` / `e2e_latency` often N/A; some paths use monotonic seconds. |
| `sessionUsage` on call flush | **Partial** | Missing on some calls while stream snapshots exist. |

---

## 7. Tool UX: idle filler

| Item | Status | Notes |
|------|--------|--------|
| `with_filler` on shared FunctionTool wrapper | **Done** | `voice-runtime-python/transovo_voice/voice_v3/tool_idle_filler.py`; wired from `tools.py`. |
| Filler before FunctionTool starts (delegation / model latency) | **Not implemented** | No code bridges pre-tool silence; product decision unless scope expands. |
| Filler when tool finishes under 2s idle threshold | **By design** | `delay=2.0` — fast BOOK (~1.6–1.8s) never triggers filler; change is config/product, not a missing import. |

---

## 8. Booking strategies & providers (non-Microsoft)

| Gap | Status | Where / notes |
|-----|--------|----------------|
| **Google Calendar** on Voice V3 FIND/BOOK/MANAGE | **Not connected to V3 path** | Shared Google OAuth + Calendar API exist in `src/lib/calendar/**` (production). No `src/lib/voice-v3/**/google*` adapters; no `GOOGLE_CALENDAR` strategy; dispatch hard-coded to Microsoft. See `docs/VOICE-V3-GOOGLE-CALENDAR-REUSE-AUDIT.md`. |
| **Calendly** as V3 executor | **Not done** | Wizard fields tagged `FUTURE_CALENDLY` in `wizard-v3-manifest-builder.ts`. Calendly commit exists for **python/Front Desk** (`commit-booking-for-python.ts`), not V3 Microsoft-style pipeline. |
| **SEND_LINK** | **Partial** | `execute-send-booking-link.ts`, SMS path, tool catalog — works when strategy is `SEND_LINK`; manifest still labels some link fields `future SEND_LINK executor`; not equivalent depth to Microsoft book path. |
| **REQUEST_ONLY** / qualification / urgency flows | **Partial / future** | Manifest: `future qualification executor`, `future urgency executor` — wizard captures intent; runtime executors incomplete. |
| **RAG / website import → wizard prefill** | **Not done** | Manifest: `future RAG tool`, `future RAG crawl` — business import lib may exist elsewhere; not wired as authoritative V3 runtime knowledge on calls. |

---

## 9. After-hours, on-call, holidays (wizard vs runtime)

| Gap | Status | Where / notes |
|-----|--------|----------------|
| After-hours behavior executor | **Not done** | Wizard fields → `runtimeConsumer: "future after-hours executor"` in manifest. |
| Holiday closure | **Not done** | `future holiday closure`. |
| On-call routing / callback SLA | **Partial / future** | `future on-call routing`, `future callback SLA` — callback **tool** exists; full wizard-driven SLA/routing not wired. |

---

## 10. Implemented on hot path (do not re-list as gaps)

- FunctionTool transport default: `function_tool` (`intake-transport.ts`).
- Microsoft direct FIND → offer set → BOOK → `BOOKING_CONFIRMED` / `MICROSOFT_EVENT_CREATED` in Node logs when commit succeeds.
- Reschedule / cancel tooling on V3 catalog (Microsoft management executors).
- `request_callback`, `send_booking_link` (strategy-gated), `transfer_call` (cold), `end_call` tools present with authorization layers.
- Idle filler scope logging on voice worker when tools run.

---

## Key file paths

| Area | Path |
|------|------|
| LiveKit tools + filler | `voice-runtime-python/transovo_voice/voice_v3/tools.py`, `tool_idle_filler.py` |
| Book dispatch / Microsoft | `src/lib/voice-v3/calendar/book-dispatch.ts`, `microsoft/microsoft-create-booking.ts` |
| Durable booking (RAM) | `src/lib/voice-v3/calendar/durable-booking-store.ts` |
| Mark call booked (unused by V3 book) | `src/lib/voice/runtime-provider/livekit-call-telemetry.ts` → `markVoiceCallBooked` |
| Published agent → V3 config | `src/lib/voice-v3/config/from-published-agent.ts`, `compile-voice-v3-agent-config.ts` |
| Wizard ↔ runtime manifest | `src/lib/voice-v3/config/wizard-v3-manifest-builder.ts` |
| Transfer tool | `src/lib/voice-v3/tools/transfer-call-tool.ts` |
| Wizard / prompt audit | `docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md` |
| Runtime product boundary | `docs/voice-v3/VOICE-V3-RUNTIME-ISOLATION.md` |

---

## Suggested fix order (engineering only)

1. On `BOOKING_CONFIRMED`: persist `voice_appointments`, set `VoiceCall.appointmentBooked`, store `providerEventId` in metadata/forensics, call `markVoiceCallBooked` (notifications).
2. Replace or back `registerDurableBooking` with Postgres-backed booking attempts keyed by `callId`.
3. Wire wizard transfer + warm/waterfall into `VoiceV3AgentConfig` and Python transfer executor.
4. Map wizard persona/instructions into Live accept params without freezing entire prompt in `live-frontend-instructions.ts`.
5. Google Calendar provider + compile strategy (parallel to Microsoft, no semantic drift in tool descriptions).
6. Conversation freshness + tool execution rows + richer forensics payloads.
