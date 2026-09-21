# Voice V3 — tool & backend chain (last call)

**Generated:** 2026-09-21T14:43:54.897Z

## Files (click on GitHub to open)

| Artifact | Link |
|----------|------|
| Summary (this page) | [`VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.md`](./VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.md) |
| Tool events JSON blob | [`VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.events.json`](./VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.events.json) |
| All backend/tool forensics JSON | [`VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.backend-events.json`](./VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.backend-events.json) |

> On GitHub: open the `.json` files from the repo tree (syntax-highlighted), or use **Raw** on that file to copy/download the full blob.

**Room suffix:** `dYDMLQvxF9xC`
**Call id:** `lk_transovo-call-_+1[REDACTED]_dYDMLQvxF9xC`
**Wall clock:** 2026-09-21T14:37:20.856Z → 2026-09-21T14:39:21.114Z
**GPT-Live session:** live_u0_EQZQwp3oMYnGThe4JGeEjiI0ypQPSGKP
**appointmentBooked flag:** false

> This report lists **tool and backend events only**. It does **not** include per-line transcript timestamps.

## Phase: after info-dump → until scheduling question

- **Info-dump end (caller utterance committed — Harriet/yahoo marker, no per-line transcript log):** monotonic 30447 ms (+30.447s from call start) · wall **2026-09-21T14:37:51.303Z**
- **Amy asks day/time (agent turn committed — content omitted here):** monotonic 56696 ms (+56.696s from call start) · wall **2026-09-21T14:38:17.552Z**
- **Gap (monotonic):** 26249 ms between those two markers.

### Tool/backend events in that window (8)

- **NODE_TOOL_EXECUTION_STARTED** · Mon Sep 21 2026 14:37:54 GMT+0000 (Coordinated Universal Time) · mono 33751 ms · {"tool_name":"update_intake","function_call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4"}
- **NODE_TOOL_EXECUTION_COMPLETED** · Mon Sep 21 2026 14:37:54 GMT+0000 (Coordinated Universal Time) · mono 33764 ms · {"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":13,"function_call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4"}
- **FUNCTION_TOOL_STARTED** · Mon Sep 21 2026 14:37:54 GMT+0000 (Coordinated Universal Time) · mono 36646 ms · {"tool":"update_intake","call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4"}
- **FUNCTION_TOOL_COMPLETED** · Mon Sep 21 2026 14:37:54 GMT+0000 (Coordinated Universal Time) · mono 36673 ms · {"ok":true,"code":null,"tool":"update_intake","status":"INTAKE_UPDATED","call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4","elapsed_ms":26}
- **BACKEND_LLM_METRICS_COLLECTED** · Mon Sep 21 2026 14:37:55 GMT+0000 (Coordinated Universal Time) · mono 36905 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001475.042935,"request_id":"resp_0f9e0702774de336006ab1413f205487d1a16c4092634986b7","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[redacted]","prompt_cached_tokens":"[redacted]","cache_creation_tokens":"[redacted]"}
- **GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED** · Mon Sep 21 2026 14:37:57 GMT+0000 (Coordinated Universal Time) · mono 39142 ms · {"call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_dYDMLQvxF9xC","client_event_id":"tool_output_f0e736eba47d","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQZQwp3oMYnGThe4JGeEjiI0ypQPSGKP"}
- **BACKEND_LLM_METRICS_COLLECTED** · Mon Sep 21 2026 14:38:00 GMT+0000 (Coordinated Universal Time) · mono 42849 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001480.9906168,"request_id":"resp_0f9e0702774de336006ab14145605887d1a0b166b551c6b5d2","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[redacted]","prompt_cached_tokens":"[redacted]","cache_creation_tokens":"[redacted]"}
- **BACKEND_LLM_METRICS_COLLECTED** · Mon Sep 21 2026 14:38:04 GMT+0000 (Coordinated Universal Time) · mono 46041 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001484.1821935,"request_id":"resp_0f9e0702774de336006ab14149030887d182d2a7094d9ed641","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[redacted]","prompt_cached_tokens":"[redacted]","cache_creation_tokens":"[redacted]"}

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
| 1 | 33751 | 2026-09-21T14:37:54.607Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"update_intake","function_call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4"}` |
| 2 | 33764 | 2026-09-21T14:37:54.620Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":13,"function_call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4"}` |
| 3 | 36646 | 2026-09-21T14:37:57.502Z | python | FUNCTION_TOOL_STARTED | `{"tool":"update_intake","call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4"}` |
| 4 | 36673 | 2026-09-21T14:37:57.529Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"update_intake","status":"INTAKE_UPDATED","call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4","elapsed_ms":26}` |
| 5 | 36905 | 2026-09-21T14:37:57.761Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001475.042935,"request_id":"resp_0f9e0702774de336006ab1413f205487d1a16c4092634986b7","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[re` |
| 6 | 39142 | 2026-09-21T14:37:59.998Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_hNd9X6VpgNvBZgYyG46Tmiz4","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_dYDMLQvxF9xC","client_event_id":"tool_output_f0e736eba47d","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQZQwp3oMYnGThe4JGeEjiI0ypQPSGKP"}` |
| 7 | 42849 | 2026-09-21T14:38:03.705Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001480.9906168,"request_id":"resp_0f9e0702774de336006ab14145605887d1a0b166b551c6b5d2","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 8 | 46041 | 2026-09-21T14:38:06.897Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001484.1821935,"request_id":"resp_0f9e0702774de336006ab14149030887d182d2a7094d9ed641","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 9 | 59814 | 2026-09-21T14:38:20.670Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"update_intake","function_call_id":"call_1nHnAFUEWDym91qsQ54wWIRs"}` |
| 10 | 59818 | 2026-09-21T14:38:20.674Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":4,"function_call_id":"call_1nHnAFUEWDym91qsQ54wWIRs"}` |
| 11 | 62694 | 2026-09-21T14:38:23.550Z | python | FUNCTION_TOOL_STARTED | `{"tool":"update_intake","call_id":"call_1nHnAFUEWDym91qsQ54wWIRs"}` |
| 12 | 62726 | 2026-09-21T14:38:23.582Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"update_intake","status":"INTAKE_UPDATED","call_id":"call_1nHnAFUEWDym91qsQ54wWIRs","elapsed_ms":32}` |
| 13 | 62975 | 2026-09-21T14:38:23.831Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001501.1164167,"request_id":"resp_0f9e0702774de336006ab1415ab5e087d1a76d6935c4a20e7e","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 14 | 66145 | 2026-09-21T14:38:27.001Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"set_scheduling_preference","function_call_id":"call_GpvLmEqqn9DUHQXvsRNRBsoQ"}` |
| 15 | 66148 | 2026-09-21T14:38:27.004Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"SCHEDULING_PREFERENCE_SET","tool_name":"set_scheduling_preference","elapsed_ms":3,"function_call_id":"call_GpvLmEqqn9DUHQXvsRNRBsoQ"}` |
| 16 | 66624 | 2026-09-21T14:38:27.480Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_1nHnAFUEWDym91qsQ54wWIRs","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_dYDMLQvxF9xC","client_event_id":"tool_output_dceccfda2d56","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQZQwp3oMYnGThe4JGeEjiI0ypQPSGKP"}` |
| 17 | 68162 | 2026-09-21T14:38:29.018Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"find_availability","function_call_id":"call_J7hPxuMlJDhaLsYPmHOZD0Ed"}` |
| 18 | 69022 | 2026-09-21T14:38:29.878Z | python | FUNCTION_TOOL_STARTED | `{"tool":"set_scheduling_preference","call_id":"call_GpvLmEqqn9DUHQXvsRNRBsoQ"}` |
| 19 | 69057 | 2026-09-21T14:38:29.913Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"set_scheduling_preference","status":"SCHEDULING_PREFERENCE_SET","call_id":"call_GpvLmEqqn9DUHQXvsRNRBsoQ","elapsed_ms":34}` |
| 20 | 69061 | 2026-09-21T14:38:29.917Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_GpvLmEqqn9DUHQXvsRNRBsoQ","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_dYDMLQvxF9xC","client_event_id":"tool_output_41907b0bbd9d","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQZQwp3oMYnGThe4JGeEjiI0ypQPSGKP"}` |
| 21 | 69263 | 2026-09-21T14:38:30.119Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001507.4039102,"request_id":"resp_0f9e0702774de336006ab14160e16c87d1abe011308c61827c","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 22 | 69614 | 2026-09-21T14:38:30.470Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"available","tool_name":"find_availability","elapsed_ms":1452,"function_call_id":"call_J7hPxuMlJDhaLsYPmHOZD0Ed"}` |
| 23 | 71050 | 2026-09-21T14:38:31.906Z | python | FUNCTION_TOOL_STARTED | `{"tool":"find_availability","call_id":"call_J7hPxuMlJDhaLsYPmHOZD0Ed"}` |
| 24 | 71343 | 2026-09-21T14:38:32.199Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001509.484144,"request_id":"resp_0f9e0702774de336006ab141637df487d1a5171d8542c8a120","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[re` |
| 25 | 72522 | 2026-09-21T14:38:33.378Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"find_availability","status":"available","call_id":"call_J7hPxuMlJDhaLsYPmHOZD0Ed","elapsed_ms":1471}` |
| 26 | 72525 | 2026-09-21T14:38:33.381Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_J7hPxuMlJDhaLsYPmHOZD0Ed","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_dYDMLQvxF9xC","client_event_id":"tool_output_1ec7d1b8dc56","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQZQwp3oMYnGThe4JGeEjiI0ypQPSGKP"}` |
| 27 | 75137 | 2026-09-21T14:38:35.993Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001513.2780006,"request_id":"resp_0f9e0702774de336006ab14166c1cc87d197b65e39946c2245","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 28 | 82459 | 2026-09-21T14:38:43.315Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"book_appointment","function_call_id":"call_nVhbFI0yfBtqwmtnDodxuYst"}` |
| 29 | 84313 | 2026-09-21T14:38:45.169Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"confirmed","tool_name":"book_appointment","elapsed_ms":1854,"function_call_id":"call_nVhbFI0yfBtqwmtnDodxuYst"}` |
| 30 | 85359 | 2026-09-21T14:38:46.215Z | python | FUNCTION_TOOL_STARTED | `{"tool":"book_appointment","call_id":"call_nVhbFI0yfBtqwmtnDodxuYst"}` |
| 31 | 85611 | 2026-09-21T14:38:46.467Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001523.752787,"request_id":"resp_0f9e0702774de336006ab14171239487d18e7d8ab1cc8bebe1","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[re` |
| 32 | 87221 | 2026-09-21T14:38:48.077Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"book_appointment","status":"confirmed","call_id":"call_nVhbFI0yfBtqwmtnDodxuYst","elapsed_ms":1861}` |
| 33 | 87223 | 2026-09-21T14:38:48.079Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_nVhbFI0yfBtqwmtnDodxuYst","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_[REDACTED]_dYDMLQvxF9xC","client_event_id":"tool_output_6f3c42b7425e","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQZQwp3oMYnGThe4JGeEjiI0ypQPSGKP"}` |
| 34 | 89247 | 2026-09-21T14:38:50.103Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001527.3880317,"request_id":"resp_0f9e0702774de336006ab14175857487d18d5bde321ca636e5","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |

## Per-tool latency (worker `FUNCTION_TOOL_*` pairs)

| Order | Tool | function_call_id | Start (mono) | End (mono) | Duration | Status | Start UTC | End UTC |
|-------|------|------------------|--------------|------------|----------|--------|-----------|---------|
| 1 | update_intake | `…` | 36646 | 36673 | **27 ms** | INTAKE_UPDATED | 2026-09-21T14:37:57.502Z | 2026-09-21T14:37:57.529Z |
| 2 | update_intake | `…` | 62694 | 62726 | **32 ms** | INTAKE_UPDATED | 2026-09-21T14:38:23.550Z | 2026-09-21T14:38:23.582Z |
| 3 | set_scheduling_preference | `…` | 69022 | 69057 | **35 ms** | SCHEDULING_PREFERENCE_SET | 2026-09-21T14:38:29.878Z | 2026-09-21T14:38:29.913Z |
| 4 | find_availability | `…` | 71050 | 72522 | **1472 ms** | available | 2026-09-21T14:38:31.906Z | 2026-09-21T14:38:33.378Z |
| 5 | book_appointment | `…` | 85359 | 87221 | **1862 ms** | confirmed | 2026-09-21T14:38:46.215Z | 2026-09-21T14:38:48.077Z |

## Node execution timing (`NODE_TOOL_EXECUTION_*`)

- **update_intake** — node slice **13 ms** (INTAKE_UPDATED) · 2026-09-21T14:37:54.607Z → 2026-09-21T14:37:54.620Z
- **update_intake** — node slice **4 ms** (INTAKE_UPDATED) · 2026-09-21T14:38:20.670Z → 2026-09-21T14:38:20.674Z
- **set_scheduling_preference** — node slice **3 ms** (SCHEDULING_PREFERENCE_SET) · 2026-09-21T14:38:27.001Z → 2026-09-21T14:38:27.004Z
- **find_availability** — node slice **1452 ms** (available) · 2026-09-21T14:38:29.018Z → 2026-09-21T14:38:30.470Z
- **book_appointment** — node slice **1854 ms** (confirmed) · 2026-09-21T14:38:43.315Z → 2026-09-21T14:38:45.169Z

## Backend LLM (delegation) metrics snapshots

- 2026-09-21T14:37:57.761Z · mono 36905 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001475.042935,"request_id":"resp_0f9e0702774de336006ab1413f205487d1a16c4092634986b7","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[
- 2026-09-21T14:38:03.705Z · mono 42849 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001480.9906168,"request_id":"resp_0f9e0702774de336006ab14145605887d1a0b166b551c6b5d2","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:38:06.897Z · mono 46041 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001484.1821935,"request_id":"resp_0f9e0702774de336006ab14149030887d182d2a7094d9ed641","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:38:23.831Z · mono 62975 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001501.1164167,"request_id":"resp_0f9e0702774de336006ab1415ab5e087d1a76d6935c4a20e7e","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:38:30.119Z · mono 69263 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001507.4039102,"request_id":"resp_0f9e0702774de336006ab14160e16c87d1abe011308c61827c","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:38:32.199Z · mono 71343 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001509.484144,"request_id":"resp_0f9e0702774de336006ab141637df487d1a5171d8542c8a120","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[
- 2026-09-21T14:38:35.993Z · mono 75137 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001513.2780006,"request_id":"resp_0f9e0702774de336006ab14166c1cc87d197b65e39946c2245","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T14:38:46.467Z · mono 85611 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001523.752787,"request_id":"resp_0f9e0702774de336006ab14171239487d18e7d8ab1cc8bebe1","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[
- 2026-09-21T14:38:50.103Z · mono 89247 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790001527.3880317,"request_id":"resp_0f9e0702774de336006ab14175857487d18d5bde321ca636e5","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"

## GPT-Live → Sol delegation lifecycle (provider events)

### Delegated response 1: `resp_0f9e0702774de336006ab1413f205487d1a16c4092634986b7`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZRPUrf52qjtwDsUVZFn` |
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

### Delegated response 2: `resp_0f9e0702774de336006ab14145605887d1a0b166b551c6b5d2`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZRPUrf52qjtwDsUVZFn` |
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

### Delegated response 3: `resp_0f9e0702774de336006ab14149030887d182d2a7094d9ed641`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZRYR5ozB9RlojFGMEQ0` |
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

### Delegated response 4: `resp_0f9e0702774de336006ab1415ab5e087d1a76d6935c4a20e7e`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZRq6Onwi8rw4TMBfOkh` |
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

### Delegated response 5: `resp_0f9e0702774de336006ab14160e16c87d1abe011308c61827c`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZRq6Onwi8rw4TMBfOkh` |
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

### Delegated response 6: `resp_0f9e0702774de336006ab141637df487d1a5171d8542c8a120`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZRq6Onwi8rw4TMBfOkh` |
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

### Delegated response 7: `resp_0f9e0702774de336006ab14166c1cc87d197b65e39946c2245`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZRq6Onwi8rw4TMBfOkh` |
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

### Delegated response 8: `resp_0f9e0702774de336006ab14171239487d18e7d8ab1cc8bebe1`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZSDOerk9GCaq5479QIx` |
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

### Delegated response 9: `resp_0f9e0702774de336006ab14175857487d18d5bde321ca636e5`

| Boundary | UTC |
|----------|-----|
| delegation_id | `item_EQZSDOerk9GCaq5479QIx` |
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

- [`VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.events.json`](./VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.events.json) — 34 tool-related forensics events
- [`VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.backend-events.json`](./VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.backend-events.json) — structured export (63 backend/tool events, pairs, phase markers)
