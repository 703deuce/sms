# GPT-Live PSTN booking — known-good baseline (frozen)

**Status:** First end-to-end proof that **GPT-Live → OpenAI Responses delegation → Transovo Voice V2 tools → certified Microsoft FIND/BOOK → Microsoft Graph** works on a real PSTN call, with Amy confirming only after `BOOKING_CONFIRMED`.

**Do not casually refactor** the booking orchestration path documented here while optimizing latency. Extend and profile around it.

---

## Reference call

| Field | Value |
|--------|--------|
| **Call ID** | `cmu58huys1m0u2z480s656y3j` |
| **When (UTC)** | 2026-09-17 07:54:41 – 07:57:18 |
| **DID** | +1 571-407-3615 |
| **Workspace** | `ws_1` |
| **Transport** | `openai_live` · `openai-live-bridge` |
| **Delegation** | `live_delegation: true` · `live_split_prompts: true` |
| **Live model** | `gpt-live-1` · voice `marin` · `audio/pcmu@8000` |
| **Backend (Responses)** | `OPENAI_LIVE_BACKEND_MODEL` default `gpt-5-mini` |

**Full forensic report (latency, transcript, tools):** `docs/call-forensic-cmu58huys1m0u2z480s656y3j.md`

---

## Commits / deployment pins (at time of proof)

| Artifact | SHA / note |
|----------|------------|
| **Git (branch `cursor/openai-live-pstn-experiment-2304`)** | `de45e4c7` — BOOK/SAVE tool response formatters for Live |
| Prior fixes on same branch | Telnyx attach race · strict tool schema · delegation_id protocol · FIND supersede generation |
| **Tool adapter** | `src/lib/voice/telnyx/openai-live-bridge/live-tool-schema.ts` (`adaptParametersForOpenAiLiveStrict`) |
| **Tool dispatch** | `live-tool-runtime.ts` → same executors as Realtime (`executeMicrosoft365CertifiedFindAvailability`, `executeVoiceV2BookOfferedSlot`, …) |
| **Frozen Realtime bridge** | `openai-realtime-bridge/*` — not the authority for Live booking changes |

Production may run **hotpatched** `src/` via `./scripts/prod-voice-bridge-hotpatch.sh --live`; verify `GET /api/health` `commitSha` vs container.

---

## Graph / DB evidence (booking is real)

| Object | ID / value |
|--------|------------|
| Offer set | `v2offer_cmu58iz2l4j0u174p0h0u6c3t` |
| Slot | `slot_95e70e7a9bc0177c` · 9:00 AM America/Los_Angeles · Wed 2026-09-23 |
| `voiceAppointment` | `cmu58jd7t72471y1p6w1j2p01` · `status: confirmed` |
| Microsoft `event_id` | `AQMkADAwATM0MDAAMi1hOWY1LTY3MzEtMDACLTAwCgBGAAADxtFon5XuVEalmlhPr1nWBgcAs2vWk3hKT02vN5c-Q6OlzQAAAgENAAAAs2vWk3hKT02vN5c-Q6OlzQAAAEcWeDcAAAA=` |
| Service | 60 Minute Consultation |

**Tool outcomes (production `LIVE_TOOL_RESULT`):**

1. `voice_v2_find_availability` — `AVAILABILITY_FOUND` · 1846 ms  
2. `voice_v2_book_offered_slot` — `BOOKING_CONFIRMED` · 3492 ms  
3. `voice_v2_save_intake_fields` ×2 — `INTAKE_SAVED`  
4. `voice_v2_create_callback_request` — `CALLBACK_REQUESTED`

Note: `voiceToolExecution` rows were **not** written for this Live call; proof is logs + V2 persistence tables above.

---

## Architecture (what changed vs legacy orchestration)

**Transovo still owns:** CallContext · intake · date/time authority · FIND · offer sets · BOOK · Graph · validation · no confirmation before `BOOKING_CONFIRMED`.

**OpenAI now owns more of:** when to call tools · which tool · function schema invocation · post-tool reasoning · handing results to Live for speech.

**Proven chain:**

```
Responses chose FIND
  → certified FIND (Microsoft)
  → canonical offer set
Responses chose BOOK
  → certified BOOK
  → Graph CREATE + idempotency + voiceAppointment
  → BOOKING_CONFIRMED
  → Live spoke confirmation
```

---

## Session config surface (do not drift without re-cert)

| Piece | Source |
|--------|--------|
| Live `session.instructions` | `live-frontend-instructions.ts` |
| `session.delegation.responses.instructions` | `responses-backend-instructions.ts` |
| Tools | `live-tools.ts` (strict schemas via `live-tool-schema.ts`) |
| Session assembly | `build-live-session-config.ts` |
| Greeting kickoff | `live-greeting.ts` after `session.started` |
| Delegation loop | `live-delegation-handler.ts` (no `delegation_id` on outbound `response.*`) |

Env flags: `OPENAI_LIVE_DELEGATION`, `OPENAI_LIVE_SPLIT_PROMPTS`, `OPENAI_LIVE_BASELINE=G`, `VOICE_AI_TRANSPORT=openai_live`.

---

## Latency baseline from reference call (optimization targets)

**Startup (bottleneck = `session_resolve`, not OpenAI WS):**

| Milestone | ms since Telnyx media WS |
|-----------|---------------------------|
| `openai_ws_open` | 480 |
| `session_resolve_done` | 4454 |
| `session_started` | 4992 |
| `first_output_audio_delta` | 5413 |

**Tool backend (healthy):** FIND ~1.8 s · BOOK ~3.5 s.

**Perceived FIND→speech:** ~13 s after “let me check” (TTS reading 8 slots + pipeline outside FIND).

**Priority order for optimization (do not change BOOK/FIND semantics first):**

1. Eliminate / overlap `session_resolve` (~4 s) — profile: `openai_live_session_resolve_profile`  
2. Normal no-tool turn latency (target ~1 s perceived) — add `CALLER_AUDIO_END` … `FIRST_OUTPUT_AUDIO_DELTA` instrumentation  
3. FIND result → speech pipeline  
4. Offer fewer slots in speech (e.g. 3 at a time)  
5. BOOK only after the above  

**Live startup (post-baseline):** minimal `session.start` immediately; static delegation via `session.update`; booking DB work lazy on tool dispatch (`LIVE_VOICE_TOOLS`, `ensureLiveToolDispatchContextHydrated`).

---

## Regression checklist (before declaring a Live booking change safe)

- [ ] Same tool types: `voice_v2_find_availability`, `voice_v2_book_offered_slot`  
- [ ] `BOOKING_CONFIRMED` only before spoken confirmation  
- [ ] `formatVoiceV2BookTelnyxResponse` / `formatVoiceV2TelnyxToolResponse` on Live tool output  
- [ ] No outbound `delegation_id` on `response.item.create` / `response.create`  
- [ ] FIND supersede uses generation **after** `onFindStarted`  
- [ ] One real PSTN smoke on +1 571-407-3615 with Graph event + `voiceAppointment`  
- [ ] `npm run verify:mctb-final-pipeline` unchanged if MCTB untouched  

---

## Log grep

```bash
docker logs <web-container> 2>&1 | grep -F 'cmu58huys1m0u2z480s656y3j' | grep -E 'LIVE_FUNCTION_CALL|LIVE_TOOL_RESULT|openai_live_timing|openai_live_session_resolve_profile'
```

---

*Frozen baseline document. Update only when a **new** PSTN call supersedes this proof with the same or stronger evidence.*
