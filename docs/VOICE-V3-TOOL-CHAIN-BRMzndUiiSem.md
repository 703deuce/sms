# Voice V3 — tool & backend chain (last call)

**Generated:** 2026-09-21T14:43:55.662Z

## Files (click on GitHub to open)

| Artifact | Link |
|----------|------|
| Summary (this page) | [`VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.md`](./VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.md) |
| Tool events JSON blob | [`VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.events.json`](./VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.events.json) |
| All backend/tool forensics JSON | [`VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.backend-events.json`](./VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.backend-events.json) |

> On GitHub: open the `.json` files from the repo tree (syntax-highlighted), or use **Raw** on that file to copy/download the full blob.

**Room suffix:** `BRMzndUiiSem`
**Call id:** `lk_transovo-call-_+1[REDACTED]_BRMzndUiiSem`
**Wall clock:** 2026-09-21T14:39:03.381Z → 2026-09-21T14:41:23.154Z
**GPT-Live session:** live_u2_EQZSap3oMmjtYOA4nt91xWHedBNOY2f3
**appointmentBooked flag:** false

> This report lists **tool and backend events only**. It does **not** include per-line transcript timestamps.

## Phase: after info-dump → until scheduling question

- **Info-dump end (caller utterance committed — Harriet/yahoo marker, no per-line transcript log):** monotonic 36077 ms (+36.077s from call start) · wall **2026-09-21T14:39:39.458Z**
- **Amy asks day/time (agent turn committed — content omitted here):** monotonic 48823 ms (+48.823s from call start) · wall **2026-09-21T14:39:52.204Z**
- **Gap (monotonic):** 12746 ms between those two markers.

### Tool/backend events in that window (7)

- **NODE_TOOL_EXECUTION_STARTED** · Mon Sep 21 2026 14:39:42 GMT+0000 (Coordinated Universal Time) · mono 38716 ms · {"tool_name":"update_intake","function_call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP"}
- **NODE_TOOL_EXECUTION_COMPLETED** · Mon Sep 21 2026 14:39:42 GMT+0000 (Coordinated Universal Time) · mono 38721 ms · {"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":5,"function_call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP"}
- **FUNCTION_TOOL_STARTED** · Mon Sep 21 2026 14:39:42 GMT+0000 (Coordinated Universal Time) · mono 41078 ms · {"tool":"update_intake","call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP"}
- **FUNCTION_TOOL_COMPLETED** · Mon Sep 21 2026 14:39:42 GMT+0000 (Coordinated Universal Time) · mono 41098 ms · {"ok":true,"code":null,"tool":"update_intake","status":"INTAKE_UPDATED","call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP","elapsed_ms":19}
- **BACKEND_LLM_METRICS_COLLECTED** · Mon Sep 21 2026 14:39:42 GMT+0000 (Coordinated Universal Time) · mono 41377 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001582.5636091,"request_id":"resp_031ee92aa6e89cff006ab141ab197c87d1b16788556b5f2266","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[redacted]","prompt_cached_tokens":"[redacted]","cache_creation_tokens":"[redacted]"}
- **GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED** · Mon Sep 21 2026 14:39:42 GMT+0000 (Coordinated Universal Time) · mono 41698 ms · {"call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_BRMzndUiiSem","client_event_id":"tool_output_8a504174673d","client_event_type":"response.item.create","gpt_live_session_id":"live_u2_EQZSap3oMmjtYOA4nt91xWHedBNOY2f3"}
- **BACKEND_LLM_METRICS_COLLECTED** · Mon Sep 21 2026 14:39:45 GMT+0000 (Coordinated Universal Time) · mono 43987 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001585.174044,"request_id":"resp_031ee92aa6e89cff006ab141aefbc087d1ac2c18585177fada","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[redacted]","prompt_cached_tokens":"[redacted]","cache_creation_tokens":"[redacted]"}

## Tool order (summary)

1. **`update_intake`** — after info-dump (intake persisted on Node).
2. *(caller answers day/time — no tools)*
3. **`set_scheduling_preference`** — preference captured.
4. **`find_availability`** — Microsoft calendar query (~1.5 s Node).
5. *(offer slot, caller confirms)*
6. **`book_appointment`** — Microsoft Graph create (~1.6 s Node) → **`confirmed`**.

### Microsoft book pipeline (web runtime logs, same call)

| Wall UTC (approx) | Event | Notes |
|-------------------|-------|-------|
| `2026-09-21T13:06:19.330Z` | `BOOKING_COMMIT_SENT` | `provider: microsoft` |
| `2026-09-21T13:06:20.027Z` | `ASYNC_ACTION_SUCCEEDED` | `BOOK_APPOINTMENT`, `bka_cmub9e14x0d6m243i4m201q6g` |
| `2026-09-21T13:06:20.961Z` | `MICROSOFT_EVENT_CREATED` | Graph create **810 ms** |
| `2026-09-21T13:06:20.962Z` | `BOOKING_CONFIRMED` | `offer_set_b76853bdd0ca`, `slot_1` |

*(Pulled from Coolify web container during earlier forensics; current container log buffer may have rotated.)*

## Full tool chain (deduped, call order)

| # | Monotonic | Wall UTC | Source | Kind | Detail |
|---|-----------|----------|--------|------|--------|
| 1 | 38716 | 2026-09-21T14:39:42.097Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"update_intake","function_call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP"}` |
| 2 | 38721 | 2026-09-21T14:39:42.102Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":5,"function_call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP"}` |
| 3 | 41078 | 2026-09-21T14:39:44.459Z | python | FUNCTION_TOOL_STARTED | `{"tool":"update_intake","call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP"}` |
| 4 | 41098 | 2026-09-21T14:39:44.479Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"update_intake","status":"INTAKE_UPDATED","call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP","elapsed_ms":19}` |
| 5 | 41377 | 2026-09-21T14:39:44.758Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001582.5636091,"request_id":"resp_031ee92aa6e89cff006ab141ab197c87d1b16788556b5f2266","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 6 | 41698 | 2026-09-21T14:39:45.079Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_3PUIkjmR2JPrpgoCYCEE9KtP","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_BRMzndUiiSem","client_event_id":"tool_output_8a504174673d","client_event_type":"response.item.create","gpt_live_session_id":"live_u2_EQZSap3oMmjtYOA4nt91xWHedBNOY2f3"}` |
| 7 | 43987 | 2026-09-21T14:39:47.368Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001585.174044,"request_id":"resp_031ee92aa6e89cff006ab141aefbc087d1ac2c18585177fada","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[re` |
| 8 | 55536 | 2026-09-21T14:39:58.917Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"set_scheduling_preference","function_call_id":"call_pNpBmka3KGWdKs0mOIzAfvnF"}` |
| 9 | 55538 | 2026-09-21T14:39:58.919Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":false,"status":"not_ready","tool_name":"set_scheduling_preference","elapsed_ms":2,"function_call_id":"call_pNpBmka3KGWdKs0mOIzAfvnF"}` |
| 10 | 57898 | 2026-09-21T14:40:01.279Z | python | FUNCTION_TOOL_STARTED | `{"tool":"set_scheduling_preference","call_id":"call_pNpBmka3KGWdKs0mOIzAfvnF"}` |
| 11 | 57901 | 2026-09-21T14:40:01.282Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001599.087977,"request_id":"resp_031ee92aa6e89cff006ab141ba534c87d1bbe7a6c6989048a5","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[re` |
| 12 | 57917 | 2026-09-21T14:40:01.298Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":false,"code":"SCHEDULING_CLARIFICATION_REQUIRED","tool":"set_scheduling_preference","status":"not_ready","call_id":"call_pNpBmka3KGWdKs0mOIzAfvnF","elapsed_ms":19}` |
| 13 | 57920 | 2026-09-21T14:40:01.301Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_pNpBmka3KGWdKs0mOIzAfvnF","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_BRMzndUiiSem","client_event_id":"tool_output_74482e2b58a7","client_event_type":"response.item.create","gpt_live_session_id":"live_u2_EQZSap3oMmjtYOA4nt91xWHedBNOY2f3"}` |
| 14 | 61069 | 2026-09-21T14:40:04.450Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001602.2553437,"request_id":"resp_031ee92aa6e89cff006ab141bf351487d1bed869f9e71afddd","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 15 | 67555 | 2026-09-21T14:40:10.936Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"set_scheduling_preference","function_call_id":"call_wDfWxOLN0UcB45wpaj2YGhOY"}` |
| 16 | 67559 | 2026-09-21T14:40:10.940Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"SCHEDULING_PREFERENCE_SET","tool_name":"set_scheduling_preference","elapsed_ms":4,"function_call_id":"call_wDfWxOLN0UcB45wpaj2YGhOY"}` |
| 17 | 69920 | 2026-09-21T14:40:13.301Z | python | FUNCTION_TOOL_STARTED | `{"tool":"set_scheduling_preference","call_id":"call_wDfWxOLN0UcB45wpaj2YGhOY"}` |
| 18 | 69940 | 2026-09-21T14:40:13.321Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"set_scheduling_preference","status":"SCHEDULING_PREFERENCE_SET","call_id":"call_wDfWxOLN0UcB45wpaj2YGhOY","elapsed_ms":20}` |
| 19 | 69943 | 2026-09-21T14:40:13.324Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_wDfWxOLN0UcB45wpaj2YGhOY","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_BRMzndUiiSem","client_event_id":"tool_output_4e91bf5c91aa","client_event_type":"response.item.create","gpt_live_session_id":"live_u2_EQZSap3oMmjtYOA4nt91xWHedBNOY2f3"}` |
| 20 | 70207 | 2026-09-21T14:40:13.588Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001611.3933954,"request_id":"resp_031ee92aa6e89cff006ab141c7fb3c87d180e8609ef13ac301","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 21 | 81149 | 2026-09-21T14:40:24.530Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"find_availability","function_call_id":"call_oaVFtKIQYlQntFos0W5uVsN6"}` |
| 22 | 81955 | 2026-09-21T14:40:25.336Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"available","tool_name":"find_availability","elapsed_ms":806,"function_call_id":"call_oaVFtKIQYlQntFos0W5uVsN6"}` |
| 23 | 83318 | 2026-09-21T14:40:26.699Z | python | FUNCTION_TOOL_STARTED | `{"tool":"find_availability","call_id":"call_oaVFtKIQYlQntFos0W5uVsN6"}` |
| 24 | 83580 | 2026-09-21T14:40:26.961Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001624.766397,"request_id":"resp_031ee92aa6e89cff006ab141cb8fb487d1a9f5ef408a59c42c","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[re` |
| 25 | 84331 | 2026-09-21T14:40:27.712Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"find_availability","status":"available","call_id":"call_oaVFtKIQYlQntFos0W5uVsN6","elapsed_ms":1013}` |
| 26 | 84334 | 2026-09-21T14:40:27.715Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_oaVFtKIQYlQntFos0W5uVsN6","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_BRMzndUiiSem","client_event_id":"tool_output_45bdd3cd65c7","client_event_type":"response.item.create","gpt_live_session_id":"live_u2_EQZSap3oMmjtYOA4nt91xWHedBNOY2f3"}` |
| 27 | 89650 | 2026-09-21T14:40:33.031Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001630.8369157,"request_id":"resp_031ee92aa6e89cff006ab141d99bb887d193337cdaa70e225f","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 28 | 99549 | 2026-09-21T14:40:42.930Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"book_appointment","function_call_id":"call_IGDmjzdE6hNug9fxK6iKwLAe"}` |
| 29 | 100874 | 2026-09-21T14:40:44.255Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"confirmed","tool_name":"book_appointment","elapsed_ms":1325,"function_call_id":"call_IGDmjzdE6hNug9fxK6iKwLAe"}` |
| 30 | 101880 | 2026-09-21T14:40:45.261Z | python | FUNCTION_TOOL_STARTED | `{"tool":"book_appointment","call_id":"call_IGDmjzdE6hNug9fxK6iKwLAe"}` |
| 31 | 102206 | 2026-09-21T14:40:45.587Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001643.3928182,"request_id":"resp_031ee92aa6e89cff006ab141e567ac87d1a8ca87ab65904e13","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 32 | 103250 | 2026-09-21T14:40:46.631Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"book_appointment","status":"confirmed","call_id":"call_IGDmjzdE6hNug9fxK6iKwLAe","elapsed_ms":1369}` |
| 33 | 103253 | 2026-09-21T14:40:46.634Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_IGDmjzdE6hNug9fxK6iKwLAe","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_BRMzndUiiSem","client_event_id":"tool_output_1c6ecd2a1e99","client_event_type":"response.item.create","gpt_live_session_id":"live_u2_EQZSap3oMmjtYOA4nt91xWHedBNOY2f3"}` |
| 34 | 106816 | 2026-09-21T14:40:50.197Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001648.0024598,"request_id":"resp_031ee92aa6e89cff006ab141ec899c87d194ac724d6d41706f","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |

## Per-tool latency (worker `FUNCTION_TOOL_*` pairs)

| Order | Tool | function_call_id | Start (mono) | End (mono) | Duration | Status | Start UTC | End UTC |
|-------|------|------------------|--------------|------------|----------|--------|-----------|---------|
| 1 | update_intake | `…` | 41078 | 41098 | **20 ms** | INTAKE_UPDATED | 2026-09-21T14:39:44.459Z | 2026-09-21T14:39:44.479Z |
| 2 | set_scheduling_preference | `…` | 57898 | 57917 | **19 ms** | not_ready | 2026-09-21T14:40:01.279Z | 2026-09-21T14:40:01.298Z |
| 3 | set_scheduling_preference | `…` | 69920 | 69940 | **20 ms** | SCHEDULING_PREFERENCE_SET | 2026-09-21T14:40:13.301Z | 2026-09-21T14:40:13.321Z |
| 4 | find_availability | `…` | 83318 | 84331 | **1013 ms** | available | 2026-09-21T14:40:26.699Z | 2026-09-21T14:40:27.712Z |
| 5 | book_appointment | `…` | 101880 | 103250 | **1370 ms** | confirmed | 2026-09-21T14:40:45.261Z | 2026-09-21T14:40:46.631Z |

## Node execution timing (`NODE_TOOL_EXECUTION_*`)

- **update_intake** — node slice **5 ms** (INTAKE_UPDATED) · 2026-09-21T14:39:42.097Z → 2026-09-21T14:39:42.102Z
- **set_scheduling_preference** — node slice **2 ms** (not_ready) · 2026-09-21T14:39:58.917Z → 2026-09-21T14:39:58.919Z
- **set_scheduling_preference** — node slice **4 ms** (SCHEDULING_PREFERENCE_SET) · 2026-09-21T14:40:10.936Z → 2026-09-21T14:40:10.940Z
- **find_availability** — node slice **806 ms** (available) · 2026-09-21T14:40:24.530Z → 2026-09-21T14:40:25.336Z
- **book_appointment** — node slice **1325 ms** (confirmed) · 2026-09-21T14:40:42.930Z → 2026-09-21T14:40:44.255Z

## Backend LLM (delegation) metrics snapshots

- 2026-09-21T14:39:44.758Z · mono 41377 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001582.5636091,"request_id":"resp_031ee92aa6e89cff006ab141ab197c87d1b16788556b5f2266","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:39:47.368Z · mono 43987 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001585.174044,"request_id":"resp_031ee92aa6e89cff006ab141aefbc087d1ac2c18585177fada","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[
- 2026-09-21T14:40:01.282Z · mono 57901 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001599.087977,"request_id":"resp_031ee92aa6e89cff006ab141ba534c87d1bbe7a6c6989048a5","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[
- 2026-09-21T14:40:04.450Z · mono 61069 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001602.2553437,"request_id":"resp_031ee92aa6e89cff006ab141bf351487d1bed869f9e71afddd","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:40:13.588Z · mono 70207 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001611.3933954,"request_id":"resp_031ee92aa6e89cff006ab141c7fb3c87d180e8609ef13ac301","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:40:26.961Z · mono 83580 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001624.766397,"request_id":"resp_031ee92aa6e89cff006ab141cb8fb487d1a9f5ef408a59c42c","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[
- 2026-09-21T14:40:33.031Z · mono 89650 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001630.8369157,"request_id":"resp_031ee92aa6e89cff006ab141d99bb887d193337cdaa70e225f","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:40:45.587Z · mono 102206 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001643.3928182,"request_id":"resp_031ee92aa6e89cff006ab141e567ac87d1a8ca87ab65904e13","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:40:50.197Z · mono 106816 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001648.0024598,"request_id":"resp_031ee92aa6e89cff006ab141ec899c87d194ac724d6d41706f","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"

## GPT-Live → Sol delegation lifecycle (provider events)

### Delegated response 1: `resp_031ee92aa6e89cff006ab141ab197c87d1b16788556b5f2266`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZT9HI4kX0nUwhaVXDr1` |
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (resp complete) | N/A |

| Interval | ms |
|----------|-----|
| created → function_call emitted | N/A |
| function_call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| created → response.completed | N/A |

### Delegated response 2: `resp_031ee92aa6e89cff006ab141aefbc087d1ac2c18585177fada`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZT9HI4kX0nUwhaVXDr1` |
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (resp complete) | N/A |

| Interval | ms |
|----------|-----|
| created → function_call emitted | N/A |
| function_call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| created → response.completed | N/A |

### Delegated response 3: `resp_031ee92aa6e89cff006ab141ba534c87d1bbe7a6c6989048a5`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZTOgH4mDPRHK8xWoGK7` |
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (resp complete) | N/A |

| Interval | ms |
|----------|-----|
| created → function_call emitted | N/A |
| function_call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| created → response.completed | N/A |

### Delegated response 4: `resp_031ee92aa6e89cff006ab141bf351487d1bed869f9e71afddd`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZTOgH4mDPRHK8xWoGK7` |
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (resp complete) | N/A |

| Interval | ms |
|----------|-----|
| created → function_call emitted | N/A |
| function_call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| created → response.completed | N/A |

### Delegated response 5: `resp_031ee92aa6e89cff006ab141c7fb3c87d180e8609ef13ac301`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZTberIC9YdRXX4TcWtb` |
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (resp complete) | N/A |

| Interval | ms |
|----------|-----|
| created → function_call emitted | N/A |
| function_call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| created → response.completed | N/A |

### Delegated response 6: `resp_031ee92aa6e89cff006ab141cb8fb487d1a9f5ef408a59c42c`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZTberIC9YdRXX4TcWtb` |
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (resp complete) | N/A |

| Interval | ms |
|----------|-----|
| created → function_call emitted | N/A |
| function_call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| created → response.completed | N/A |

### Delegated response 7: `resp_031ee92aa6e89cff006ab141d99bb887d193337cdaa70e225f`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZTberIC9YdRXX4TcWtb` |
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (resp complete) | N/A |

| Interval | ms |
|----------|-----|
| created → function_call emitted | N/A |
| function_call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| created → response.completed | N/A |

### Delegated response 8: `resp_031ee92aa6e89cff006ab141e567ac87d1a8ca87ab65904e13`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZU53Vu8MamIG5IUJFIZ` |
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (resp complete) | N/A |

| Interval | ms |
|----------|-----|
| created → function_call emitted | N/A |
| function_call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| created → response.completed | N/A |

### Delegated response 9: `resp_031ee92aa6e89cff006ab141ec899c87d194ac724d6d41706f`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZU53Vu8MamIG5IUJFIZ` |
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (resp complete) | N/A |

| Interval | ms |
|----------|-----|
| created → function_call emitted | N/A |
| function_call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| created → response.completed | N/A |


## Raw JSON blobs

Full machine-readable payloads are **not** inlined here (too large for one page). Use the linked files:

- [`VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.events.json`](./VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.events.json) — 34 tool-related forensics events
- [`VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.backend-events.json`](./VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.backend-events.json) — structured export (63 backend/tool events, pairs, phase markers)
