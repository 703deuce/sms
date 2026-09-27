## 15. Measured intervals (tool-bearing delegations; speech boundaries N/A when not native)

| tool | call_id | C created→fc | D fc→fn start | E fn duration | F fn end→output | G output→cont | H cont→next created | completed→output |
|------|---------|--------------|---------------|---------------|-----------------|---------------|---------------------|------------------|
| update_intake | call_hHyoNvkKuvdHAGxg4GnMv5yi | 3000 | 0 | 0 | 4000 | N/A | N/A | 4000 |
| set_scheduling_preference | call_BNo8rXo8bwpQox7Ydll3kIJN | 2000 | 0 | 0 | 1000 | N/A | N/A | 0 |
| find_availability | call_tdeV3JaSBxGaUB1H3Qv4B1S2 | 3000 | 0 | 1000 | 0 | N/A | N/A | 1000 |
| book_appointment | call_RoqRT73FxXNVKZpIUdHgzwKa | 3000 | 0 | 2000 | 0 | N/A | N/A | 2000 |

## 16. Five longest MEASURED UTC intervals (tool/Sol chain only; speech N/A)

- **4000 ms** — update_intake F_fn_finish_to_output (sol/tool handoff)
- **4000 ms** — update_intake response_completed_to_output (sol/tool handoff)
- **3000 ms** — update_intake C_response_created_to_fc (sol/tool handoff)
- **3000 ms** — find_availability C_response_created_to_fc (tool+provider)
- **3000 ms** — book_appointment C_response_created_to_fc (tool+provider)

## 17. Turn-type comparison (native user stop → Amy start: **N/A** on this call)

| Turn class | Count | user stop → Amy start | Notes |
|------------|-------|----------------------|-------|
| Normal conversational | 10 | N/A | no native stopped_speaking_at |
| update_intake | 1 | N/A | single Sol call, 6 argument keys |
| set_scheduling_preference | 1 | N/A | |
| find_availability | 1 | N/A | Node 1217 ms |
| book_appointment | 1 | N/A | Node 1723 ms |

## 19. Delegations / responses / tools per caller phase

- **GPT_LIVE_BACKEND_DELEGATION_CREATED (deduped):** 3
- **Backend response.created:** 7
- **Function tools executed:** 4
- **Continuations queued:** 4

Response roles (by order):

- Mon Sep 21 2026 15:36:38 GMT+0000 (Coordinated Universal Time) `resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426` → **INITIAL RESPONSE** (tool: yes)
- Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time) `resp_05b048154c30764a006ab14f0d949c87d1aa3f3fac611bff9a` → **REQUIRED TOOL CONTINUATION (no-tool completion)** (tool: NO TOOL)
- Mon Sep 21 2026 15:36:57 GMT+0000 (Coordinated Universal Time) `resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9` → **ADDITIONAL TOOL RESPONSE** (tool: yes)
- Mon Sep 21 2026 15:37:01 GMT+0000 (Coordinated Universal Time) `resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9` → **ADDITIONAL TOOL RESPONSE** (tool: yes)
- Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time) `resp_05b048154c30764a006ab14f21bb5487d18b9904f7a142c7cd` → **REQUIRED TOOL CONTINUATION (no-tool completion)** (tool: NO TOOL)
- Mon Sep 21 2026 15:37:15 GMT+0000 (Coordinated Universal Time) `resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf` → **ADDITIONAL TOOL RESPONSE** (tool: yes)
- Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time) `resp_05b048154c30764a006ab14f305ea087d1ba9f28bdd575ea41` → **REQUIRED TOOL CONTINUATION (no-tool completion)** (tool: NO TOOL)

## 20. Multi-field intake verification

- **MEASURED FACT:** exactly **one** `update_intake` function_call in this call.
- argument_key_names (6): ["email","mother_s_name","name","notes","phone","service_reason"]
- No second `update_intake` between caller utterances without a new user turn.

## VoiceToolExecution DB rows

_No VoiceToolExecution rows (defect E if tools ran)._

## 18. Tool-output handoff intervals

- `call_hHyoNvkKuvdHAGxg4GnMv5yi` fc_emitted→fn_start 0 ms · fn_finish→output_queued 4000 ms · response_completed→output_queued N/A ms
- `call_BNo8rXo8bwpQox7Ydll3kIJN` fc_emitted→fn_start 0 ms · fn_finish→output_queued 1000 ms · response_completed→output_queued N/A ms
- `call_tdeV3JaSBxGaUB1H3Qv4B1S2` fc_emitted→fn_start 0 ms · fn_finish→output_queued 0 ms · response_completed→output_queued N/A ms
- `call_RoqRT73FxXNVKZpIUdHgzwKa` fc_emitted→fn_start 0 ms · fn_finish→output_queued 0 ms · response_completed→output_queued N/A ms

## 7. Duplicate GPT-Live provider events

- RAW backend/delegation kinds: **58**
- DEDUPED backend/delegation kinds: **29**
- Duplicates removed (all kinds): **166**
- **SUPPORTED INFERENCE:** Identical rows at flush/checkpoint still duplicate some events; dedupe key does not collapse all GPT_LIVE_BACKEND_* floods.

## 23. Known observability defect checklist

- A duplicate GPT_LIVE / forensics events: **YES (166 duplicates in full stream)**
- B cross-process timestamp ordering: **user speech metrics use Python monotonic seconds — not comparable to Node UTC**
- C VoiceCall.appointmentBooked=false after BOOK: **YES (book_appointment status confirmed in Node)**
- D missing voice appointment association: _not fully audited in this export_
- E missing VoiceToolExecution rows: **YES**
- F ChatMessage.metrics absent: **NO — present**; user stopped_speaking_at **not populated**; assistant e2e_latency **not populated**
- G session_usage_updated absent: **NO — present in stream**; final flush sessionUsage package **MISSING**
- H provider response IDs: **present on backend events (response_id, call_id)**

## 25. Final summary (evidence only — no architecture recommendations)

1. **Call:** `lk_transovo-call-{caller-redacted}_MoSPbJXesc6M` · 2026-09-21T15:36:05.238Z → 2026-09-21T15:38:02.400Z · suffix `MoSPbJXesc6M`
2. **Transcript:** 13 user turns + 8 agent turns in §3
3. **Native per-turn latency:** user stop / Amy start wall intervals **N/A**; assistant playback_latency populated (seconds float)
4. **Delegations:** 3 session.delegation.created events
5. **Backend responses:** 7 response.created
6. **Tools:** update_intake (1×, 6 fields), set_scheduling_preference, find_availability, book_appointment
7. **Continuations:** 4 response.create queued after tool output
8. **Provider:** FIND Node ~1217 ms; BOOK Node ~1723 ms (see §12 web logs)
9. **Longest measured:** see §16
10. **Intake:** single batched update_intake — §20
11–12. **FIND/BOOK:** executed once each — §10–12
13. **Session usage:** 14 snapshots; final package missing on flush
14. **Telemetry gaps:** user stopped_speaking_at, e2e_latency, delegation_id on session.delegation.created, sessionUsage on flush
15. **Persistence:** appointmentBooked flag false despite confirmed book

