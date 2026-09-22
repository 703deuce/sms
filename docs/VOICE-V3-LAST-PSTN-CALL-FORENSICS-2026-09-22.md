# Voice V3 — tool & backend chain (last call)

**Generated:** 2026-09-22T15:37:00.857Z

## Files (click on GitHub to open)

| Artifact | Link |
|----------|------|
| Summary (this page) | [`last-call-report.md`](./last-call-report.md) |
| Tool events JSON blob | [`last-call-report.events.json`](./last-call-report.events.json) |
| All backend/tool forensics JSON | [`last-call-report.backend-events.json`](./last-call-report.backend-events.json) |

> On GitHub: open the `.json` files from the repo tree (syntax-highlighted), or use **Raw** on that file to copy/download the full blob.

**Room suffix:** `xFxRUnQsjD2c`
**Call id:** `lk_transovo-call-_CALLER_E164_REDACTED_xFxRUnQsjD2c`
**Wall clock:** 2026-09-22T15:29:38.505Z → 2026-09-22T15:32:16.917Z
**GPT-Live session:** live_SESSION_REDACTED
**appointmentBooked flag:** true

> This report lists **tool and backend events only**. It does **not** include per-line transcript timestamps.

## Phase: after info-dump → until scheduling question

- **Info-dump end (caller utterance committed — Harriet/yahoo marker, no per-line transcript log):** monotonic 108528 ms (+108.528s from call start) · wall **2026-09-22T15:31:27.033Z**
- **Amy asks day/time (agent turn committed — content omitted here):** monotonic 75838 ms (+75.838s from call start) · wall **2026-09-22T15:30:54.343Z**
- **Gap (monotonic):** -32690 ms between those two markers.

### Tool/backend events in that window (0)

_No tool executions logged between info-dump end and scheduling question — model may have been thinking/speaking without tools._

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
| 1 | 61539 | 2026-09-22T15:30:40.044Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"update_intake","function_call_id":"call_E1H0xVKTA8W34PsIjGJWbw51"}` |
| 2 | 61548 | 2026-09-22T15:30:40.053Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":9,"function_call_id":"call_E1H0xVKTA8W34PsIjGJWbw51"}` |
| 3 | 65557 | 2026-09-22T15:30:44.062Z | python | FUNCTION_TOOL_STARTED | `{"tool":"update_intake","call_id":"call_REDACTED"}` |
| 4 | 65580 | 2026-09-22T15:30:44.085Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"update_intake","status":"INTAKE_UPDATED","call_id":"call_REDACTED","elapsed_ms":23}` |
| 5 | 65765 | 2026-09-22T15:30:44.270Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091040.3855917,"request_id":"resp_0ab27fe908a701bc006ab29f1d866087d18296454e267002f7","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","re` |
| 6 | 68344 | 2026-09-22T15:30:46.849Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_REDACTED","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+15714776175_xFxRUnQsjD2c","client_event_id":"tool_output_d0535f91cfd5","client_event_type":"response.item.create","gpt_live_session_id":"live_SESSION_REDACTED","provider_event_type":"response.item.create"}` |
| 7 | 70199 | 2026-09-22T15:30:48.704Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091044.8220053,"request_id":"resp_0ab27fe908a701bc006ab29f230ef887d18187d710928e299c","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","re` |
| 8 | 79687 | 2026-09-22T15:30:58.192Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"set_scheduling_preference","function_call_id":"call_4OTyBioMOOKmx4vHCRloYqNZ"}` |
| 9 | 79693 | 2026-09-22T15:30:58.198Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"SCHEDULING_PREFERENCE_SET","tool_name":"set_scheduling_preference","elapsed_ms":6,"function_call_id":"call_4OTyBioMOOKmx4vHCRloYqNZ"}` |
| 10 | 82173 | 2026-09-22T15:31:00.678Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"find_availability","function_call_id":"call_P8KnD5g0o2HKAAUp0Td6SHdN"}` |
| 11 | 83206 | 2026-09-22T15:31:01.711Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"available","tool_name":"find_availability","elapsed_ms":1033,"function_call_id":"call_P8KnD5g0o2HKAAUp0Td6SHdN"}` |
| 12 | 83704 | 2026-09-22T15:31:02.209Z | python | FUNCTION_TOOL_STARTED | `{"tool":"set_scheduling_preference","call_id":"call_REDACTED"}` |
| 13 | 83724 | 2026-09-22T15:31:02.229Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"set_scheduling_preference","status":"SCHEDULING_PREFERENCE_SET","call_id":"call_REDACTED","elapsed_ms":20}` |
| 14 | 83884 | 2026-09-22T15:31:02.389Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091058.5066147,"request_id":"resp_0ab27fe908a701bc006ab29f30678c87d1b47d627c45539c2a","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","re` |
| 15 | 85049 | 2026-09-22T15:31:03.554Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_REDACTED","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+15714776175_xFxRUnQsjD2c","client_event_id":"tool_output_350d98b4137b","client_event_type":"response.item.create","gpt_live_session_id":"live_SESSION_REDACTED","provider_event_type":"response.item.create"}` |
| 16 | 86189 | 2026-09-22T15:31:04.694Z | python | FUNCTION_TOOL_STARTED | `{"tool":"find_availability","call_id":"call_REDACTED"}` |
| 17 | 86378 | 2026-09-22T15:31:04.883Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091061.000708,"request_id":"resp_0ab27fe908a701bc006ab29f33c1f487d1a71a83581189518a","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","rea` |
| 18 | 87236 | 2026-09-22T15:31:05.741Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"find_availability","status":"available","call_id":"call_REDACTED","elapsed_ms":1047}` |
| 19 | 87238 | 2026-09-22T15:31:05.743Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_REDACTED","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+15714776175_xFxRUnQsjD2c","client_event_id":"tool_output_fca960fabbd6","client_event_type":"response.item.create","gpt_live_session_id":"live_SESSION_REDACTED","provider_event_type":"response.item.create"}` |
| 20 | 88808 | 2026-09-22T15:31:07.313Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091063.4304724,"request_id":"resp_0ab27fe908a701bc006ab29f35f21887d1839628da3c49c573","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","re` |
| 21 | 96848 | 2026-09-22T15:31:15.353Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"book_appointment","function_call_id":"call_KU8vCd36tVQp2vav1vMv9td0"}` |
| 22 | 96852 | 2026-09-22T15:31:15.357Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":false,"status":"not_ready","tool_name":"book_appointment","elapsed_ms":4,"function_call_id":"call_KU8vCd36tVQp2vav1vMv9td0"}` |
| 23 | 100868 | 2026-09-22T15:31:19.373Z | python | FUNCTION_TOOL_STARTED | `{"tool":"book_appointment","call_id":"call_REDACTED"}` |
| 24 | 100883 | 2026-09-22T15:31:19.388Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":false,"code":"MISSING_REQUIRED_INFORMATION","tool":"book_appointment","status":"not_ready","call_id":"call_REDACTED","elapsed_ms":14}` |
| 25 | 101075 | 2026-09-22T15:31:19.580Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091075.6974673,"request_id":"resp_0ab27fe908a701bc006ab29f41549887d1b86092b6405ff43f","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","re` |
| 26 | 101965 | 2026-09-22T15:31:20.470Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_REDACTED","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+15714776175_xFxRUnQsjD2c","client_event_id":"tool_output_361a0b404c36","client_event_type":"response.item.create","gpt_live_session_id":"live_SESSION_REDACTED","provider_event_type":"response.item.create"}` |
| 27 | 104175 | 2026-09-22T15:31:22.680Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091078.7983644,"request_id":"resp_0ab27fe908a701bc006ab29f44ac1087d1acd7f0cb83715b7e","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","re` |
| 28 | 110231 | 2026-09-22T15:31:28.736Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"update_intake","function_call_id":"lk_fc_7b53e7cd3eb7"}` |
| 29 | 110236 | 2026-09-22T15:31:28.741Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":5,"function_call_id":"lk_fc_7b53e7cd3eb7"}` |
| 30 | 113405 | 2026-09-22T15:31:31.910Z | node | NODE_TOOL_EXECUTION_STARTED | `{"tool_name":"book_appointment","function_call_id":"call_NNdmgS65UuT4QqMxXWjxtcCe"}` |
| 31 | 114269 | 2026-09-22T15:31:32.774Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_REDACTED","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+15714776175_xFxRUnQsjD2c","client_event_id":"tool_output_debb2295ec0f","client_event_type":"response.item.create","gpt_live_session_id":"live_SESSION_REDACTED","provider_event_type":"response.item.create"}` |
| 32 | 114429 | 2026-09-22T15:31:32.934Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091089.052102,"request_id":"resp_0ab27fe908a701bc006ab29f4e4f9c87d1bd8ef6f0e4e7343f","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","rea` |
| 33 | 115372 | 2026-09-22T15:31:33.877Z | node | NODE_TOOL_EXECUTION_COMPLETED | `{"ok":true,"status":"confirmed","tool_name":"book_appointment","elapsed_ms":1967,"function_call_id":"call_NNdmgS65UuT4QqMxXWjxtcCe"}` |
| 34 | 117425 | 2026-09-22T15:31:35.930Z | python | FUNCTION_TOOL_STARTED | `{"tool":"book_appointment","call_id":"call_REDACTED"}` |
| 35 | 117611 | 2026-09-22T15:31:36.116Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091092.2335553,"request_id":"resp_0ab27fe908a701bc006ab29f5131e087d1a9f396c21936eb57","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","re` |
| 36 | 119404 | 2026-09-22T15:31:37.909Z | python | FUNCTION_TOOL_COMPLETED | `{"ok":true,"code":null,"tool":"book_appointment","status":"confirmed","call_id":"call_REDACTED","elapsed_ms":1978}` |
| 37 | 119412 | 2026-09-22T15:31:37.917Z | python | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED | `{"call_id":"call_REDACTED","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+15714776175_xFxRUnQsjD2c","client_event_id":"tool_output_e46f45abebd9","client_event_type":"response.item.create","gpt_live_session_id":"live_SESSION_REDACTED","provider_event_type":"response.item.create"}` |
| 38 | 121274 | 2026-09-22T15:31:39.779Z | python | BACKEND_LLM_METRICS_COLLECTED | `{"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091095.896914,"request_id":"resp_0ab27fe908a701bc006ab29f561f9087d187fb2a25eb0845fc","total_tokens":"[redacted]","metrics_label":"LLMMetrics","prompt_tokens":"[redacted]","rea` |

## Per-tool latency (worker `FUNCTION_TOOL_*` pairs)

| Order | Tool | function_call_id | Start (mono) | End (mono) | Duration | Status | Start UTC | End UTC |
|-------|------|------------------|--------------|------------|----------|--------|-----------|---------|
| 1 | update_intake | `…` | 65557 | 65580 | **23 ms** | INTAKE_UPDATED | 2026-09-22T15:30:44.062Z | 2026-09-22T15:30:44.085Z |
| 2 | set_scheduling_preference | `…` | 83704 | 83724 | **20 ms** | SCHEDULING_PREFERENCE_SET | 2026-09-22T15:31:02.209Z | 2026-09-22T15:31:02.229Z |
| 3 | find_availability | `…` | 86189 | 87236 | **1047 ms** | available | 2026-09-22T15:31:04.694Z | 2026-09-22T15:31:05.741Z |
| 4 | book_appointment | `…` | 100868 | 100883 | **15 ms** | not_ready | 2026-09-22T15:31:19.373Z | 2026-09-22T15:31:19.388Z |
| 5 | book_appointment | `…` | 117425 | 119404 | **1979 ms** | confirmed | 2026-09-22T15:31:35.930Z | 2026-09-22T15:31:37.909Z |

## Node execution timing (`NODE_TOOL_EXECUTION_*`)

- **update_intake** — node slice **9 ms** (INTAKE_UPDATED) · 2026-09-22T15:30:40.044Z → 2026-09-22T15:30:40.053Z
- **set_scheduling_preference** — node slice **6 ms** (SCHEDULING_PREFERENCE_SET) · 2026-09-22T15:30:58.192Z → 2026-09-22T15:30:58.198Z
- **find_availability** — node slice **1033 ms** (available) · 2026-09-22T15:31:00.678Z → 2026-09-22T15:31:01.711Z
- **book_appointment** — node slice **4 ms** (not_ready) · 2026-09-22T15:31:15.353Z → 2026-09-22T15:31:15.357Z
- **update_intake** — node slice **5 ms** (INTAKE_UPDATED) · 2026-09-22T15:31:28.736Z → 2026-09-22T15:31:28.741Z
- **book_appointment** — node slice **1967 ms** (confirmed) · 2026-09-22T15:31:31.910Z → 2026-09-22T15:31:33.877Z

## Backend LLM (delegation) metrics snapshots

- 2026-09-22T15:30:44.270Z · mono 65765 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091040.3855917,"request_id":"resp_0ab27fe908a701bc006ab29f1d866087d18296454
- 2026-09-22T15:30:48.704Z · mono 70199 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091044.8220053,"request_id":"resp_0ab27fe908a701bc006ab29f230ef887d18187d71
- 2026-09-22T15:31:02.389Z · mono 83884 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091058.5066147,"request_id":"resp_0ab27fe908a701bc006ab29f30678c87d1b47d627
- 2026-09-22T15:31:04.883Z · mono 86378 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091061.000708,"request_id":"resp_0ab27fe908a701bc006ab29f33c1f487d1a71a8358
- 2026-09-22T15:31:07.313Z · mono 88808 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091063.4304724,"request_id":"resp_0ab27fe908a701bc006ab29f35f21887d1839628d
- 2026-09-22T15:31:19.580Z · mono 101075 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091075.6974673,"request_id":"resp_0ab27fe908a701bc006ab29f41549887d1b86092b
- 2026-09-22T15:31:22.680Z · mono 104175 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091078.7983644,"request_id":"resp_0ab27fe908a701bc006ab29f44ac1087d1acd7f0c
- 2026-09-22T15:31:32.934Z · mono 114429 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091089.052102,"request_id":"resp_0ab27fe908a701bc006ab29f4e4f9c87d1bd8ef6f0
- 2026-09-22T15:31:36.116Z · mono 117611 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091092.2335553,"request_id":"resp_0ab27fe908a701bc006ab29f5131e087d1a9f396c
- 2026-09-22T15:31:39.779Z · mono 121274 ms · {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0,"metadata":{"model_name":"gpt-5.6-sol","model_provider":"api.openai.com"},"cancelled":false,"speech_id":null,"timestamp":1790091095.896914,"request_id":"resp_0ab27fe908a701bc006ab29f561f9087d187fb2a25

## GPT-Live → Sol delegation lifecycle (provider events)

### DELEGATION `item_EQwk1VhVXwMeJe6zarDdV`

#### Response 1: `resp_0ab27fe908a701bc006ab29f1d866087d18296454e267002f7`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

#### Response 2: `resp_0ab27fe908a701bc006ab29f230ef887d18187d710928e299c`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

**Delegation-chain elapsed (first created → last completed):** N/A ms

### DELEGATION `item_EQwkK0VTzej5HYKKiFl9X`

#### Response 1: `resp_0ab27fe908a701bc006ab29f30678c87d1b47d627c45539c2a`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

#### Response 2: `resp_0ab27fe908a701bc006ab29f33c1f487d1a71a83581189518a`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

#### Response 3: `resp_0ab27fe908a701bc006ab29f35f21887d1839628da3c49c573`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

**Delegation-chain elapsed (first created → last completed):** N/A ms

### DELEGATION `item_EQwkbWrIALXjvs50uSmyC`

#### Response 1: `resp_0ab27fe908a701bc006ab29f41549887d1b86092b6405ff43f`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

#### Response 2: `resp_0ab27fe908a701bc006ab29f44ac1087d1acd7f0cb83715b7e`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

**Delegation-chain elapsed (first created → last completed):** N/A ms

### DELEGATION `item_EQwkouBCT7iWbaS4gbGZc`

#### Response 1: `resp_0ab27fe908a701bc006ab29f4e4f9c87d1bd8ef6f0e4e7343f`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

#### Response 2: `resp_0ab27fe908a701bc006ab29f5131e087d1a9f396c21936eb57`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

#### Response 3: `resp_0ab27fe908a701bc006ab29f561f9087d187fb2a25eb0845fc`

| Boundary | UTC |
|----------|-----|
| response.created (observed) | N/A |
| output_item.done (function_call) | N/A |
| call_id / tool | `N/A` / N/A |
| FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL_COMPLETED | N/A |
| response.item.create (tool result queued) | N/A |
| response.create (continuation) | N/A |
| next response.created (observed) | N/A |
| response.completed (observed) | N/A |
| BACKEND_LLM_METRICS (legacy resp complete) | N/A |

| Interval (UTC cross-process) | ms |
|----------|-----|
| backend response created observed → function call emitted | N/A |
| function call emitted → FUNCTION_TOOL_STARTED | N/A |
| FUNCTION_TOOL duration | N/A |
| FUNCTION_TOOL_COMPLETED → tool result queued | N/A |
| tool result queued → continuation response.create | N/A |
| continuation response.create → next response.created observed | N/A |
| response.created observed → response.completed observed | N/A |

**Delegation-chain elapsed (first created → last completed):** N/A ms


## Native LiveKit per-turn latency

| role | message id | started_speaking_at | stopped_speaking_at | e2e_latency | playback_latency | transcription_delay | end_of_turn_delay | provider_request_ids |
|------|------------|---------------------|---------------------|-------------|------------------|---------------------|-------------------|----------------------|
| user | `speech_3d85bb257cc5` | 1790090985.3623533 | N/A | N/A | N/A | N/A | N/A | N/A |
| assistant | `item_49bb74a9dd42` | 1790090986.0642228 | 1790090991.2781596 | N/A | 0.009381532669067383 | N/A | N/A | item_49bb74a9dd42 |
| user | `speech_f43652c51dba` | 1790090992.0531454 | N/A | N/A | N/A | N/A | N/A | N/A |
| user | `speech_508bcb1a1717` | 1790090994.95512 | N/A | N/A | N/A | N/A | N/A | N/A |
| user | `speech_adf78f0e3728` | 1790090996.595768 | N/A | N/A | N/A | N/A | N/A | N/A |
| assistant | `item_91dab96e764d` | 1790090999.3483853 | 1790091002.761137 | N/A | 0.0002663135528564453 | N/A | N/A | item_91dab96e764d |
| user | `speech_fbfd121d69fb` | 1790091006.1622357 | N/A | N/A | N/A | N/A | N/A | N/A |
| assistant | `item_017e88f3cf8f` | 1790091011.0624776 | 1790091017.4662187 | N/A | 0.00041866302490234375 | N/A | N/A | item_017e88f3cf8f |
| user | `speech_d0e069db5d8f` | 1790091020.1995542 | N/A | N/A | N/A | N/A | N/A | N/A |
| user | `speech_fad9e5ab7b1e` | 1790091021.36116 | N/A | N/A | N/A | N/A | N/A | N/A |
| user | `speech_283a88bb9804` | 1790091026.9650922 | N/A | N/A | N/A | N/A | N/A | N/A |
| user | `speech_ce62ed353fc6` | 1790091030.3576024 | N/A | N/A | N/A | N/A | N/A | N/A |
| user | `speech_5163bc819892` | 1790091031.164584 | N/A | N/A | N/A | N/A | N/A | N/A |
| user | `speech_bfffd9142e9d` | 1790091031.9587157 | N/A | N/A | N/A | N/A | N/A | N/A |
| user | `speech_f9a6cb1f73ea` | 1790091033.2007446 | N/A | N/A | N/A | N/A | N/A | N/A |
| user | `speech_b1c9c35aa9c4` | 1790091035.4044945 | N/A | N/A | N/A | N/A | N/A | N/A |
| assistant | `item_332d4c9302a5` | 1790091038.242953 | 1790091042.8632922 | N/A | 0.0003039836883544922 | N/A | N/A | item_332d4c9302a5 |
| assistant | `item_c47a97713a0a` | 1790091045.5440905 | 1790091050.4601824 | N/A | 0.0002090930938720703 | N/A | N/A | item_c47a97713a0a |
| user | `speech_b23894cb5edd` | 1790091054.4252918 | N/A | N/A | N/A | N/A | N/A | N/A |
| assistant | `item_e79108cf75cb` | 1790091057.4062278 | 1790091059.6683276 | N/A | 0.0003325939178466797 | N/A | N/A | item_e79108cf75cb |
| assistant | `item_ffdb50b4d85e` | 1790091064.549398 | 1790091070.1393592 | N/A | 0.0002276897430419922 | N/A | N/A | item_ffdb50b4d85e |
| user | `speech_1d7816687fb1` | 1790091072.3720026 | N/A | N/A | N/A | N/A | N/A | N/A |
| assistant | `item_78643783adda` | 1790091074.034767 | 1790091076.5847483 | N/A | 0.00020503997802734375 | N/A | N/A | item_78643783adda |
| assistant | `item_5e1f80e72ef5` | 1790091079.5533323 | 1790091082.656036 | N/A | 0.00015282630920410156 | N/A | N/A | item_5e1f80e72ef5 |
| user | `speech_78e308e90272` | 1790091085.3566062 | N/A | N/A | N/A | N/A | N/A | N/A |
| assistant | `item_d7bcbd17ed9b` | 1790091087.048501 | 1790091088.5431345 | N/A | 0.0002377033233642578 | N/A | N/A | item_d7bcbd17ed9b |
| assistant | `item_34452e17822c` | 1790091096.6583128 | 1790091102.4617598 | N/A | 0.00023055076599121094 | N/A | N/A | item_34452e17822c |
| user | `speech_7b19df737da3` | 1790091105.0179365 | N/A | N/A | N/A | N/A | N/A | N/A |
| assistant | `item_9ddf712b5c61` | 1790091105.7514734 | 1790091110.785536 | N/A | 0.00010967254638671875 | N/A | N/A | item_9ddf712b5c61 |

## Session usage (LiveKit native)

Last `SESSION_USAGE_UPDATED` at :

```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=132.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=125539, input_cached_tokens=107203, input_cache_creation_tokens=13164, output_tokens=356)])"
```


## Raw JSON blobs

Full machine-readable payloads are **not** inlined here (too large for one page). Use the linked files:

- [`last-call-report.events.json`](./last-call-report.events.json) — 38 tool-related forensics events
- [`last-call-report.backend-events.json`](./last-call-report.backend-events.json) — structured export (75 backend/tool events, pairs, phase markers)
