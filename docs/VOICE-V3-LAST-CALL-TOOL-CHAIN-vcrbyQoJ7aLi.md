# Voice V3 — tool & backend chain (last call)

**Generated:** 2026-09-21T13:29:35.839Z

## Files (click on GitHub to open)

| Artifact | Link |
|----------|------|
| Summary (this page) | [`VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.md`](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.md) |
| Tool events JSON blob | [`VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.events.json`](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.events.json) |
| All backend/tool forensics JSON | [`VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.backend-events.json`](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.backend-events.json) |

> On GitHub: open the `.json` files from the repo tree (syntax-highlighted), or use **Raw** on that file to copy/download the full blob.

**Room suffix:** `vcrbyQoJ7aLi`
**Call id:** `lk_transovo-call-_+1[REDACTED]_vcrbyQoJ7aLi`
**Wall clock:** 2026-09-21T13:03:49.479Z → 2026-09-21T13:07:03.994Z
**GPT-Live session:** live_u1_EQXyQp3oNLUlkOZ40P012CFGt7hb74Qr
**appointmentBooked flag:** false

> This report lists **tool and backend events only**. It does **not** include per-line transcript timestamps.

## Phase: after info-dump → until scheduling question

- **Info-dump end (caller utterance committed — Harriet/yahoo marker, no per-line transcript log):** monotonic 38137 ms (+38.137s from call start) · wall **2026-09-21T13:04:27.616Z**
- **Amy asks day/time (agent turn committed — content omitted here):** monotonic 84064 ms (+84.064s from call start) · wall **2026-09-21T13:05:13.543Z**
- **Gap (monotonic):** 45927 ms between those two markers.

### Tool/backend events in that window (6)

- **NODE_TOOL_EXECUTION_STARTED** · Mon Sep 21 2026 13:04:41 GMT+0000 (Coordinated Universal Time) · mono 51527 ms · {"tool_name":"update_intake","function_call_id":"call_KvtlIoH78FtiPkEB9XG4tBnE"}
- **NODE_TOOL_EXECUTION_COMPLETED** · Mon Sep 21 2026 13:04:41 GMT+0000 (Coordinated Universal Time) · mono 51540 ms · {"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":13,"function_call_id":"call_KvtlIoH78FtiPkEB9XG4tBnE"}
- **FUNCTION_TOOL_STARTED** · Mon Sep 21 2026 13:04:41 GMT+0000 (Coordinated Universal Time) · mono 54823 ms · {"tool":"update_intake","call_id":"call_KvtlIoH78FtiPkEB9XG4tBnE"}
- **FUNCTION_TOOL_COMPLETED** · Mon Sep 21 2026 13:04:41 GMT+0000 (Coordinated Universal Time) · mono 54880 ms · {"ok":true,"code":null,"tool":"update_intake","status":"INTAKE_UPDATED","call_id":"call_KvtlIoH78FtiPkEB9XG4tBnE","elapsed_ms":57}
- **BACKEND_LLM_METRICS_COLLECTED** · Mon Sep 21 2026 13:04:41 GMT+0000 (Coordinated Universal Time) · mono 55009 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995881.4280791,"request_id":"resp_03473b16f277cc25006ab12b5b086c87d1945822c06579ab76","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[redacted]","prompt_cached_tokens":"[redacted]","cache_creation_tokens":"[redacted]"}
- **BACKEND_LLM_METRICS_COLLECTED** · Mon Sep 21 2026 13:05:04 GMT+0000 (Coordinated Universal Time) · mono 78006 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995904.4267175,"request_id":"resp_03473b16f277cc25006ab12b6981e087d1adcbec5abe9ea389","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[redacted]","prompt_cached_tokens":"[redacted]","cache_creation_tokens":"[redacted]"}

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
| 1 | 51527 | 2026-09-21T13:04:41.006Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"update_intake","function_call_id":"call_KvtlIoH78FtiPkEB9XG4tBnE"}` |
| 2 | 51540 | 2026-09-21T13:04:41.019Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":13,"function_call_id":"call_KvtlIoH78FtiPkEB9XG4tBnE"}` |
| 3 | 54823 | 2026-09-21T13:04:44.302Z | python | FUNCTION_TOOL_STARTED | `{"tool":"update_intake","call_id":"call_KvtlIoH78FtiPkEB9XG4tBnE"}` |
| 4 | 54880 | 2026-09-21T13:04:44.359Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"update_intake","status":"INTAKE_UPDATED","call_id":"call_KvtlIoH78FtiPkEB9XG4tBnE","elapsed_ms":57}` |
| 5 | 55009 | 2026-09-21T13:04:44.488Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995881.4280791,"request_id":"resp_03473b16f277cc25006ab12b5b086c87d1945822c06579ab76","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 6 | 78006 | 2026-09-21T13:05:07.485Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995904.4267175,"request_id":"resp_03473b16f277cc25006ab12b6981e087d1adcbec5abe9ea389","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 7 | 103954 | 2026-09-21T13:05:33.433Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"set_scheduling_preference","function_call_id":"call_4Y8j05aHSLSl9HFy4aYwreI7"}` |
| 8 | 103960 | 2026-09-21T13:05:33.439Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"SCHEDULING_PREFERENCE_SET","tool_name":"set_scheduling_preference","elapsed_ms":6,"function_call_id":"call_4Y8j05aHSLSl9HFy4aYwreI7"}` |
| 9 | 107214 | 2026-09-21T13:05:36.693Z | python | FUNCTION_TOOL_STARTED | `{"tool":"set_scheduling_preference","call_id":"call_4Y8j05aHSLSl9HFy4aYwreI7"}` |
| 10 | 107296 | 2026-09-21T13:05:36.775Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"set_scheduling_preference","status":"SCHEDULING_PREFERENCE_SET","call_id":"call_4Y8j05aHSLSl9HFy4aYwreI7","elapsed_ms":82}` |
| 11 | 107905 | 2026-09-21T13:05:37.384Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995934.3255327,"request_id":"resp_03473b16f277cc25006ab12b8c6d2887d18c91ff30f3189ee8","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 12 | 118283 | 2026-09-21T13:05:47.762Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"find_availability","function_call_id":"call_IlkgFx9N2md9JhUW333WjGEt"}` |
| 13 | 119750 | 2026-09-21T13:05:49.229Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"available","tool_name":"find_availability","elapsed_ms":1468,"function_call_id":"call_IlkgFx9N2md9JhUW333WjGEt"}` |
| 14 | 121560 | 2026-09-21T13:05:51.039Z | python | FUNCTION_TOOL_STARTED | `{"tool":"find_availability","call_id":"call_IlkgFx9N2md9JhUW333WjGEt"}` |
| 15 | 121728 | 2026-09-21T13:05:51.207Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995948.1487248,"request_id":"resp_03473b16f277cc25006ab12b9e68d887d19685b3c78bacd5c4","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 16 | 123086 | 2026-09-21T13:05:52.565Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"find_availability","status":"available","call_id":"call_IlkgFx9N2md9JhUW333WjGEt","elapsed_ms":1526}` |
| 17 | 134705 | 2026-09-21T13:06:04.184Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995961.125867,"request_id":"resp_03473b16f277cc25006ab12bad966087d19bb86a9a5335c34c","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[re` |
| 18 | 149571 | 2026-09-21T13:06:19.050Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"book_appointment","function_call_id":"call_1q45tRWbe1qQ05ohBrPrgqXW"}` |
| 19 | 151209 | 2026-09-21T13:06:20.688Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"confirmed","tool_name":"book_appointment","elapsed_ms":1638,"function_call_id":"call_1q45tRWbe1qQ05ohBrPrgqXW"}` |
| 20 | 152758 | 2026-09-21T13:06:22.237Z | python | FUNCTION_TOOL_STARTED | `{"tool":"book_appointment","call_id":"call_1q45tRWbe1qQ05ohBrPrgqXW"}` |
| 21 | 152943 | 2026-09-21T13:06:22.422Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995979.3637247,"request_id":"resp_03473b16f277cc25006ab12bc23d9487d1bffe2f50fb08e624","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |
| 22 | 154543 | 2026-09-21T13:06:24.022Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"book_appointment","status":"confirmed","call_id":"call_1q45tRWbe1qQ05ohBrPrgqXW","elapsed_ms":1785}` |
| 23 | 163047 | 2026-09-21T13:06:32.526Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995989.4682286,"request_id":"resp_03473b16f277cc25006ab12bcd0c0087d1b7d56fd5002b975c","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","reasoning_tokens":"[redacted]","completion_tokens":"[redacted]","tokens_per_second":"[r` |

## Per-tool latency (worker `FUNCTION_TOOL_*` pairs)

| Order | Tool | function_call_id | Start (mono) | End (mono) | Duration | Status | Start UTC | End UTC |
|-------|------|------------------|--------------|------------|----------|--------|-----------|---------|
| 1 | update_intake | `…` | 54823 | 54880 | **57 ms** | INTAKE_UPDATED | 2026-09-21T13:04:44.302Z | 2026-09-21T13:04:44.359Z |
| 2 | set_scheduling_preference | `…` | 107214 | 107296 | **82 ms** | SCHEDULING_PREFERENCE_SET | 2026-09-21T13:05:36.693Z | 2026-09-21T13:05:36.775Z |
| 3 | find_availability | `…` | 121560 | 123086 | **1526 ms** | available | 2026-09-21T13:05:51.039Z | 2026-09-21T13:05:52.565Z |
| 4 | book_appointment | `…` | 152758 | 154543 | **1785 ms** | confirmed | 2026-09-21T13:06:22.237Z | 2026-09-21T13:06:24.022Z |

## Node execution timing (`NODE_TOOL_EXECUTION_*`)

- **update_intake** — node slice **13 ms** (INTAKE_UPDATED) · 2026-09-21T13:04:41.006Z → 2026-09-21T13:04:41.019Z
- **set_scheduling_preference** — node slice **6 ms** (SCHEDULING_PREFERENCE_SET) · 2026-09-21T13:05:33.433Z → 2026-09-21T13:05:33.439Z
- **find_availability** — node slice **1467 ms** (available) · 2026-09-21T13:05:47.762Z → 2026-09-21T13:05:49.229Z
- **book_appointment** — node slice **1638 ms** (confirmed) · 2026-09-21T13:06:19.050Z → 2026-09-21T13:06:20.688Z

## Backend LLM (delegation) metrics snapshots

- 2026-09-21T13:04:44.488Z · mono 55009 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995881.4280791,"request_id":"resp_03473b16f277cc25006ab12b5b086c87d1945822c06579ab76","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T13:05:07.485Z · mono 78006 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995904.4267175,"request_id":"resp_03473b16f277cc25006ab12b6981e087d1adcbec5abe9ea389","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T13:05:37.384Z · mono 107905 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995934.3255327,"request_id":"resp_03473b16f277cc25006ab12b8c6d2887d18c91ff30f3189ee8","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T13:05:51.207Z · mono 121728 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995948.1487248,"request_id":"resp_03473b16f277cc25006ab12b9e68d887d19685b3c78bacd5c4","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T13:06:04.184Z · mono 134705 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995961.125867,"request_id":"resp_03473b16f277cc25006ab12bad966087d19bb86a9a5335c34c","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[
- 2026-09-21T13:06:22.422Z · mono 152943 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995979.3637247,"request_id":"resp_03473b16f277cc25006ab12bc23d9487d1bffe2f50fb08e624","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"
- 2026-09-21T13:06:32.526Z · mono 163047 ms · {"ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1789995989.4682286,"request_id":"resp_03473b16f277cc25006ab12bcd0c0087d1b7d56fd5002b975c","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"

## Raw JSON blobs

Full machine-readable payloads are **not** inlined here (too large for one page). Use the linked files:

- [`VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.events.json`](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.events.json) — 23 tool-related forensics events
- [`VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.backend-events.json`](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.backend-events.json) — structured export (23 backend/tool events, pairs, phase markers)
