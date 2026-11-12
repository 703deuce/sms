# Voice V3 — complete PSTN forensics (latest call)

**Generated:** 2026-09-21T15:44:31.231Z
**Room suffix:** `MoSPbJXesc6M`

## 1. Call identity

| Field | Value |
|-------|-------|
| VoiceCall ID | `lk_transovo-call-{caller-redacted}_MoSPbJXesc6M` |
| Room name | `transovo-call-{caller-redacted}_MoSPbJXesc6M` |
| LiveKit job ID | `AJ_ZraAQEjVM9Ci` |
| liveSessionId | `lk_transovo-call-{caller-redacted}_MoSPbJXesc6M` |
| GPT-Live session ID | `live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ` |
| Room suffix | `MoSPbJXesc6M` |
| Caller (redacted) | `N/A` |
| Called DID | `N/A` |
| Call start UTC | 2026-09-21T15:36:05.238Z |
| Call end UTC | 2026-09-21T15:38:02.400Z |
| Duration | 117.162 s |
| appointmentBooked | false |
| Voice worker commit (expected) | `c91c4f4c425af22aaceb3437a60d381db5744417` |
| Worker container image tag | `c91c4f4c425af22aaceb3437a60d381db5744417` (deploy finished 15:20:31 UTC) |
| Call after observability deploy | **YES** (call started 15:36:05 UTC) |
| GPT-Live model | gpt-live-1 |
| Delegation | responses |
| Backend model | gpt-5.6-sol |
| Reasoning effort | none |
| Web/runtime commit (repo HEAD at export) | see git branch / package version |
| Deployment build | Coolify voice worker queue 3054 @ 2026-09-21T15:20:31Z |

**Observability verification:** Call started **after** worker image `c91c4f4c…` (not calls `dYDMLQvxF9xC` / `BRMzndUiiSem`).

## 2. Telemetry inventory

- RAW forensic events: **333**
- DEDUPED events: **167**
- Dedupe key: kind | occurred_at_utc | monotonic_ms | source | response_id | delegation_id | call_id | client_event_id | function_call_id | tool | message_id | inner_type
- VOICE_V3_CHAT_MESSAGE_METRICS: **42**
- GPT_LIVE_BACKEND_RESPONSE_CREATED: **14**
- GPT_LIVE_DELEGATION_RESPONSE_CREATED (legacy): **0**
- SESSION_USAGE_UPDATED: **28**
- sessionUsage on flush package: **missing**

## 3. Complete conversation (USER_TURN_COMMITTED + AGENT_TURN_COMMITTED + metrics)

### Caller / user messages (chronological)

#### user — `speech_ebbdbbc12cca`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:11 GMT+0000 (Coordinated Universal Time)
- **Text:**  Hello
- started_speaking_at: 1790004971.213187 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_6d6bb5579b50`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:23 GMT+0000 (Coordinated Universal Time)
- **Text:**  Hey, I need to book an appointment because my toilet is leaking. My name is Anthony
- started_speaking_at: 1790004978.1214983 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_c6da0ec11aa2`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:25 GMT+0000 (Coordinated Universal Time)
- **Text:**  Johnson. My phone number's 
- started_speaking_at: 1790004983.3313427 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_f2780df88991`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:26 GMT+0000 (Coordinated Universal Time)
- **Text:** 571 
- started_speaking_at: 1790004985.0686052 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_474ddbab8704`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:27 GMT+0000 (Coordinated Universal Time)
- **Text:** 477
- started_speaking_at: 1790004986.4757283 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_150a1debd503`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:33 GMT+0000 (Coordinated Universal Time)
- **Text:** -6175. My email is anthony at yahoo dot com, and I live at 
- started_speaking_at: 1790004987.9175298 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_7247ea5b53e6`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:34 GMT+0000 (Coordinated Universal Time)
- **Text:** 123
- started_speaking_at: 1790004993.686368 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_2f44b16dab70`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:35 GMT+0000 (Coordinated Universal Time)
- **Text:**  Main Street
- started_speaking_at: 1790004994.6753445 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_19c62f25c033`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:39 GMT+0000 (Coordinated Universal Time)
- **Text:** , Alexandria, Virginia, and my mom's name is Harriet
- started_speaking_at: 1790004996.0677595 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_398b69e8995f`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:56 GMT+0000 (Coordinated Universal Time)
- **Text:**  Uh
- started_speaking_at: 1790005015.2706127 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_1a2eb112a425`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:58 GMT+0000 (Coordinated Universal Time)
- **Text:** , today, the earliest you have today
- started_speaking_at: 1790005016.1335654 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_00ba24c820e4`

- **Transcript commit UTC:** Mon Sep 21 2026 15:37:16 GMT+0000 (Coordinated Universal Time)
- **Text:**  Yes
- started_speaking_at: 1790005035.6194127 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

#### user — `speech_9d1f3e8c0298`

- **Transcript commit UTC:** Mon Sep 21 2026 15:37:32 GMT+0000 (Coordinated Universal Time)
- **Text:**  No, that's it
- started_speaking_at: 1790005050.9526477 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: N/A
- transcription_delay: N/A
- end_of_turn_delay: N/A
- on_user_turn_completed_delay: N/A
- provider_request_ids: "N/A"

### Amy / assistant messages (chronological)

#### assistant — `item_0b5c5ca67a59`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:16 GMT+0000 (Coordinated Universal Time)
- **Text:**  Thank you for calling WS1 Cert Plumbing Co. This is Riley. How can I help you today?
- started_speaking_at: 1790004971.5996985 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: 1790004976.1870315 (RAW — Python monotonic seconds, not wall UTC)
- e2e_latency: N/A
- playback_latency: 0.006184577941894531
- provider_request_ids: ["item_0b5c5ca67a59"]

#### assistant — `item_b484be8e4891`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time)
- **Text:**  Okay, Anthony, thank you for sharing all those details. Just one moment while I get that all straight.
- started_speaking_at: 1790004998.8791823 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: 1790005005.388756 (RAW — Python monotonic seconds, not wall UTC)
- e2e_latency: N/A
- playback_latency: 0.00028967857360839844
- provider_request_ids: ["item_b484be8e4891"]

#### assistant — `item_4e705e3592af`

- **Transcript commit UTC:** Mon Sep 21 2026 15:36:53 GMT+0000 (Coordinated Universal Time)
- **Text:**  Okay, I've got all that. What day and time would you prefer for the service visit?
- started_speaking_at: 1790005008.304624 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: 1790005013.2202375 (RAW — Python monotonic seconds, not wall UTC)
- e2e_latency: N/A
- playback_latency: 0.0001201629638671875
- provider_request_ids: ["item_4e705e3592af"]

#### assistant — `item_ff285de11e57`

- **Transcript commit UTC:** Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time)
- **Text:**  Sure, checking on that now.
- started_speaking_at: 1790005017.6835558 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: 1790005020.754683 (RAW — Python monotonic seconds, not wall UTC)
- e2e_latency: N/A
- playback_latency: 0.00011134147644042969
- provider_request_ids: ["item_ff285de11e57"]

#### assistant — `item_e308775529dd`

- **Transcript commit UTC:** Mon Sep 21 2026 15:37:13 GMT+0000 (Coordinated Universal Time)
- **Text:**  Okay, the earliest we have today is at two p.m. Would you like me to book that for you?
- started_speaking_at: 1790005028.597512 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: 1790005033.8676252 (RAW — Python monotonic seconds, not wall UTC)
- e2e_latency: N/A
- playback_latency: 0.00032901763916015625
- provider_request_ids: ["item_e308775529dd"]

#### assistant — `item_54e4cf99759c`

- **Transcript commit UTC:** Mon Sep 21 2026 15:37:17 GMT+0000 (Coordinated Universal Time)
- **Text:**  Okay.
- started_speaking_at: 1790005035.8964558 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: 1790005037.2809284 (RAW — Python monotonic seconds, not wall UTC)
- e2e_latency: N/A
- playback_latency: 0.0002627372741699219
- provider_request_ids: ["item_54e4cf99759c"]

#### assistant — `item_e1fe16ba3f5a`

- **Transcript commit UTC:** Mon Sep 21 2026 15:37:29 GMT+0000 (Coordinated Universal Time)
- **Text:**  Perfect. You're booked in for today at two p.m. Is there anything else I can help with?
- started_speaking_at: 1790005043.9194107 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: 1790005049.3823795 (RAW — Python monotonic seconds, not wall UTC)
- e2e_latency: N/A
- playback_latency: 0.0002765655517578125
- provider_request_ids: ["item_e1fe16ba3f5a"]

#### assistant — `item_b11ee5e6b322`

- **Transcript commit UTC:** Mon Sep 21 2026 15:37:36 GMT+0000 (Coordinated Universal Time)
- **Text:**  Great. Thanks again for calling. We look forward to helping you with that leak. Take care.
- started_speaking_at: 1790005051.7996287 (RAW — Python monotonic seconds, not wall UTC)
- stopped_speaking_at: 1790005056.403837 (RAW — Python monotonic seconds, not wall UTC)
- e2e_latency: N/A
- playback_latency: 0.0003008842468261719
- provider_request_ids: ["item_b11ee5e6b322"]

## 4. All VOICE_V3_CHAT_MESSAGE_METRICS (raw)

| UTC | rel ms | role | message_id | metrics JSON |
|-----|--------|------|------------|--------------|
| Mon Sep 21 2026 15:36:11 GMT+0000 (Coordinated Universal Time) | 9165 | user | `speech_ebbdbbc12cca` | {"started_speaking_at":1790004971.213187} |
| Mon Sep 21 2026 15:36:16 GMT+0000 (Coordinated Universal Time) | 13389 | assistant | `item_0b5c5ca67a59` | {"playback_latency":0.006184577941894531,"started_speaking_at":1790004971.5996985,"stopped_speaking_at":1790004976.1870315,"provider_request_ids":["item_0b5c5ca67a59"]} |
| Mon Sep 21 2026 15:36:23 GMT+0000 (Coordinated Universal Time) | 20266 | user | `speech_6d6bb5579b50` | {"started_speaking_at":1790004978.1214983} |
| Mon Sep 21 2026 15:36:25 GMT+0000 (Coordinated Universal Time) | 22265 | user | `speech_c6da0ec11aa2` | {"started_speaking_at":1790004983.3313427} |
| Mon Sep 21 2026 15:36:26 GMT+0000 (Coordinated Universal Time) | 23665 | user | `speech_f2780df88991` | {"started_speaking_at":1790004985.0686052} |
| Mon Sep 21 2026 15:36:27 GMT+0000 (Coordinated Universal Time) | 24465 | user | `speech_474ddbab8704` | {"started_speaking_at":1790004986.4757283} |
| Mon Sep 21 2026 15:36:33 GMT+0000 (Coordinated Universal Time) | 30866 | user | `speech_150a1debd503` | {"started_speaking_at":1790004987.9175298} |
| Mon Sep 21 2026 15:36:34 GMT+0000 (Coordinated Universal Time) | 31666 | user | `speech_7247ea5b53e6` | {"started_speaking_at":1790004993.686368} |
| Mon Sep 21 2026 15:36:35 GMT+0000 (Coordinated Universal Time) | 33066 | user | `speech_2f44b16dab70` | {"started_speaking_at":1790004994.6753445} |
| Mon Sep 21 2026 15:36:39 GMT+0000 (Coordinated Universal Time) | 36564 | user | `speech_19c62f25c033` | {"started_speaking_at":1790004996.0677595} |
| Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time) | 42591 | assistant | `item_b484be8e4891` | {"playback_latency":0.00028967857360839844,"started_speaking_at":1790004998.8791823,"stopped_speaking_at":1790005005.388756,"provider_request_ids":["item_b484be8e4891"]} |
| Mon Sep 21 2026 15:36:53 GMT+0000 (Coordinated Universal Time) | 50423 | assistant | `item_4e705e3592af` | {"playback_latency":0.0001201629638671875,"started_speaking_at":1790005008.304624,"stopped_speaking_at":1790005013.2202375,"provider_request_ids":["item_4e705e3592af"]} |
| Mon Sep 21 2026 15:36:56 GMT+0000 (Coordinated Universal Time) | 53265 | user | `speech_398b69e8995f` | {"started_speaking_at":1790005015.2706127} |
| Mon Sep 21 2026 15:36:58 GMT+0000 (Coordinated Universal Time) | 55364 | user | `speech_1a2eb112a425` | {"started_speaking_at":1790005016.1335654} |
| Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time) | 57957 | assistant | `item_ff285de11e57` | {"playback_latency":0.00011134147644042969,"started_speaking_at":1790005017.6835558,"stopped_speaking_at":1790005020.754683,"provider_request_ids":["item_ff285de11e57"]} |
| Mon Sep 21 2026 15:37:13 GMT+0000 (Coordinated Universal Time) | 71070 | assistant | `item_e308775529dd` | {"playback_latency":0.00032901763916015625,"started_speaking_at":1790005028.597512,"stopped_speaking_at":1790005033.8676252,"provider_request_ids":["item_e308775529dd"]} |
| Mon Sep 21 2026 15:37:16 GMT+0000 (Coordinated Universal Time) | 73615 | user | `speech_00ba24c820e4` | {"started_speaking_at":1790005035.6194127} |
| Mon Sep 21 2026 15:37:17 GMT+0000 (Coordinated Universal Time) | 74483 | assistant | `item_54e4cf99759c` | {"playback_latency":0.0002627372741699219,"started_speaking_at":1790005035.8964558,"stopped_speaking_at":1790005037.2809284,"provider_request_ids":["item_54e4cf99759c"]} |
| Mon Sep 21 2026 15:37:29 GMT+0000 (Coordinated Universal Time) | 86585 | assistant | `item_e1fe16ba3f5a` | {"playback_latency":0.0002765655517578125,"started_speaking_at":1790005043.9194107,"stopped_speaking_at":1790005049.3823795,"provider_request_ids":["item_e1fe16ba3f5a"]} |
| Mon Sep 21 2026 15:37:32 GMT+0000 (Coordinated Universal Time) | 89414 | user | `speech_9d1f3e8c0298` | {"started_speaking_at":1790005050.9526477} |
| Mon Sep 21 2026 15:37:36 GMT+0000 (Coordinated Universal Time) | 93606 | assistant | `item_b11ee5e6b322` | {"playback_latency":0.0003008842468261719,"started_speaking_at":1790005051.7996287,"stopped_speaking_at":1790005056.403837,"provider_request_ids":["item_b11ee5e6b322"]} |

## 5–6. GPT-Live provider + client delegation events (forensic records)

- `Mon Sep 21 2026 15:36:38 GMT+0000 (Coordinated Universal Time)` · 36091 ms · **GPT_LIVE_BACKEND_DELEGATION_CREATED** · {"direction":"server","delegation_id":null,"envelope_type":"session.delegation.created","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"session.delegation.created"}
- `Mon Sep 21 2026 15:36:38 GMT+0000 (Coordinated Universal Time)` · 36130 ms · **GPT_LIVE_BACKEND_RESPONSE_CREATED** · {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426","delegation_id":"item_EQaMI15D282NPNEbxj7PA","envelope_type":"response.event","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"in_progress","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.created"}
- `Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time)` · 38291 ms · **GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED** · {"call_id":"call_hHyoNvkKuvdHAGxg4GnMv5yi","item_id":"fc_05b048154c30764a006ab14f0803cc87d1ab9dd5170f1d2b03","direction":"server","item_type":"function_call","inner_type":"response.output_item.done","item_status":"completed","response_id":"resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426","delegation_id":"item_EQaMI15D282NPNEbxj7PA","envelope_type":"response.event","function_name":"update_intake","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","argument_key_names":["email","mother_s_name","name","notes","phone","service_reason"],"gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.output_item.done"}
- `Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time)` · 38562 ms · **GPT_LIVE_BACKEND_RESPONSE_COMPLETED** · {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426","delegation_id":"item_EQaMI15D282NPNEbxj7PA","envelope_type":"response.event","usage_summary":{"input_tokens":"[redacted]","total_tokens":"[redacted]","output_tokens":"[redacted]","input_tokens_details":"[redacted]","output_tokens_details":"[redacted]"},"voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"completed","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.completed","provider_completed_at":"[PHONE_REDACTED]"}
- `Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time)` · 42693 ms · **GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED** · {"call_id":"call_hHyoNvkKuvdHAGxg4GnMv5yi","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"tool_output_b1cecbda4c93","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.item.create"}
- `Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time)` · 42693 ms · **GPT_LIVE_BACKEND_CONTINUATION_QUEUED** · {"direction":"client","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"response_create_763720427029","client_event_type":"response.create","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.create"}
- `Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time)` · 43018 ms · **GPT_LIVE_BACKEND_RESPONSE_CREATED** · {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f0d949c87d1aa3f3fac611bff9a","delegation_id":"item_EQaMI15D282NPNEbxj7PA","envelope_type":"response.event","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"in_progress","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.created"}
- `Mon Sep 21 2026 15:36:47 GMT+0000 (Coordinated Universal Time)` · 44904 ms · **GPT_LIVE_BACKEND_RESPONSE_COMPLETED** · {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f0d949c87d1aa3f3fac611bff9a","delegation_id":"item_EQaMI15D282NPNEbxj7PA","envelope_type":"response.event","usage_summary":{"input_tokens":"[redacted]","total_tokens":"[redacted]","output_tokens":"[redacted]","input_tokens_details":"[redacted]","output_tokens_details":"[redacted]"},"voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"completed","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.completed","provider_completed_at":"[PHONE_REDACTED]"}
- `Mon Sep 21 2026 15:36:57 GMT+0000 (Coordinated Universal Time)` · 54734 ms · **GPT_LIVE_BACKEND_DELEGATION_CREATED** · {"direction":"server","delegation_id":null,"envelope_type":"session.delegation.created","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"session.delegation.created"}
- `Mon Sep 21 2026 15:36:57 GMT+0000 (Coordinated Universal Time)` · 54738 ms · **GPT_LIVE_BACKEND_RESPONSE_CREATED** · {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.event","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"in_progress","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.created"}
- `Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time)` · 56941 ms · **GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED** · {"call_id":"call_BNo8rXo8bwpQox7Ydll3kIJN","item_id":"fc_05b048154c30764a006ab14f1ae44c87d1af0780f8236f1b87","direction":"server","item_type":"function_call","inner_type":"response.output_item.done","item_status":"completed","response_id":"resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.event","function_name":"set_scheduling_preference","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","argument_key_names":["date_expression","date_relation","daypart","end_time","exact_time","explicit_date","start_time","time_expression","time_kind","weekday"],"gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.output_item.done"}
- `Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time)` · 57205 ms · **GPT_LIVE_BACKEND_RESPONSE_COMPLETED** · {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.event","usage_summary":{"input_tokens":"[redacted]","total_tokens":"[redacted]","output_tokens":"[redacted]","input_tokens_details":"[redacted]","output_tokens_details":"[redacted]"},"voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"completed","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.completed","provider_completed_at":"[PHONE_REDACTED]"}
- `Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time)` · 57961 ms · **GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED** · {"call_id":"call_BNo8rXo8bwpQox7Ydll3kIJN","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"tool_output_263b6e884944","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.item.create"}
- `Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time)` · 57962 ms · **GPT_LIVE_BACKEND_CONTINUATION_QUEUED** · {"direction":"client","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"response_create_2ab5accefc0a","client_event_type":"response.create","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.create"}
- `Mon Sep 21 2026 15:37:01 GMT+0000 (Coordinated Universal Time)` · 58243 ms · **GPT_LIVE_BACKEND_RESPONSE_CREATED** · {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.event","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"in_progress","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.created"}
- `Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time)` · 61605 ms · **GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED** · {"call_id":"call_tdeV3JaSBxGaUB1H3Qv4B1S2","item_id":"fc_05b048154c30764a006ab14f202a2887d1b663c8b73ec331fc","direction":"server","item_type":"function_call","inner_type":"response.output_item.done","item_status":"completed","response_id":"resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.event","function_name":"find_availability","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","argument_key_names":["service_id"],"gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.output_item.done"}
- `Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time)` · 61851 ms · **GPT_LIVE_BACKEND_RESPONSE_COMPLETED** · {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.event","usage_summary":{"input_tokens":"[redacted]","total_tokens":"[redacted]","output_tokens":"[redacted]","input_tokens_details":"[redacted]","output_tokens_details":"[redacted]"},"voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"completed","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.completed","provider_completed_at":"[PHONE_REDACTED]"}
- `Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time)` · 62840 ms · **GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED** · {"call_id":"call_tdeV3JaSBxGaUB1H3Qv4B1S2","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"tool_output_c5cb25b8d94f","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.item.create"}
- `Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time)` · 62840 ms · **GPT_LIVE_BACKEND_CONTINUATION_QUEUED** · {"direction":"client","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"response_create_7c4bb6782e08","client_event_type":"response.create","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.create"}
- `Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time)` · 63134 ms · **GPT_LIVE_BACKEND_RESPONSE_CREATED** · {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f21bb5487d18b9904f7a142c7cd","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.event","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"in_progress","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.created"}
- `Mon Sep 21 2026 15:37:07 GMT+0000 (Coordinated Universal Time)` · 65168 ms · **GPT_LIVE_BACKEND_RESPONSE_COMPLETED** · {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f21bb5487d18b9904f7a142c7cd","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.event","usage_summary":{"input_tokens":"[redacted]","total_tokens":"[redacted]","output_tokens":"[redacted]","input_tokens_details":"[redacted]","output_tokens_details":"[redacted]"},"voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"completed","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.completed","provider_completed_at":"[PHONE_REDACTED]"}
- `Mon Sep 21 2026 15:37:15 GMT+0000 (Coordinated Universal Time)` · 72953 ms · **GPT_LIVE_BACKEND_DELEGATION_CREATED** · {"direction":"server","delegation_id":null,"envelope_type":"session.delegation.created","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"session.delegation.created"}
- `Mon Sep 21 2026 15:37:15 GMT+0000 (Coordinated Universal Time)` · 72956 ms · **GPT_LIVE_BACKEND_RESPONSE_CREATED** · {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf","delegation_id":"item_EQaMtH9ozMNe1VWM96O8u","envelope_type":"response.event","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"in_progress","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.created"}
- `Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time)` · 75736 ms · **GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED** · {"call_id":"call_RoqRT73FxXNVKZpIUdHgzwKa","item_id":"fc_05b048154c30764a006ab14f2e14b087d1a3040e661e04206c","direction":"server","item_type":"function_call","inner_type":"response.output_item.done","item_status":"completed","response_id":"resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf","delegation_id":"item_EQaMtH9ozMNe1VWM96O8u","envelope_type":"response.event","function_name":"book_appointment","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","argument_key_names":["offer_set_id","slot_id"],"gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.output_item.done"}
- `Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time)` · 75968 ms · **GPT_LIVE_BACKEND_RESPONSE_COMPLETED** · {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf","delegation_id":"item_EQaMtH9ozMNe1VWM96O8u","envelope_type":"response.event","usage_summary":{"input_tokens":"[redacted]","total_tokens":"[redacted]","output_tokens":"[redacted]","input_tokens_details":"[redacted]","output_tokens_details":"[redacted]"},"voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"completed","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.completed","provider_completed_at":"[PHONE_REDACTED]"}
- `Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time)` · 77481 ms · **GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED** · {"call_id":"call_RoqRT73FxXNVKZpIUdHgzwKa","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"tool_output_b58635678a21","client_event_type":"response.item.create","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.item.create"}
- `Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time)` · 77482 ms · **GPT_LIVE_BACKEND_CONTINUATION_QUEUED** · {"direction":"client","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"response_create_288126576b3f","client_event_type":"response.create","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_event_type":"response.create"}
- `Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time)` · 77758 ms · **GPT_LIVE_BACKEND_RESPONSE_CREATED** · {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f305ea087d1ba9f28bdd575ea41","delegation_id":"item_EQaMtH9ozMNe1VWM96O8u","envelope_type":"response.event","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"in_progress","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.created"}
- `Mon Sep 21 2026 15:37:23 GMT+0000 (Coordinated Universal Time)` · 80404 ms · **GPT_LIVE_BACKEND_RESPONSE_COMPLETED** · {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f305ea087d1ba9f28bdd575ea41","delegation_id":"item_EQaMtH9ozMNe1VWM96O8u","envelope_type":"response.event","usage_summary":{"input_tokens":"[redacted]","total_tokens":"[redacted]","output_tokens":"[redacted]","input_tokens_details":"[redacted]","output_tokens_details":"[redacted]"},"voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","response_model":"gpt-5.6-sol","response_status":"completed","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ","provider_created_at":"[PHONE_REDACTED]","provider_event_type":"response.completed","provider_completed_at":"[PHONE_REDACTED]"}

## 8. Every Sol backend response

| delegation_id | response_id | created | fc emitted | tool | call_id | completed | created→fc ms | created→completed ms |
|---------------|-------------|---------|------------|------|---------|-----------|---------------|---------------------|
| item_EQaMI15D282NPNEbxj7PA | resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426 | Mon Sep 21 2026 15:36:38 GMT+0000 (Coordinated Universal Time) | NO TOOL | NO TOOL |  | Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) | N/A | 3000 |
| item_EQaMI15D282NPNEbxj7PA | resp_05b048154c30764a006ab14f0d949c87d1aa3f3fac611bff9a | Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time) | NO TOOL | NO TOOL |  | Mon Sep 21 2026 15:36:47 GMT+0000 (Coordinated Universal Time) | N/A | 2000 |
| item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9 | Mon Sep 21 2026 15:36:57 GMT+0000 (Coordinated Universal Time) | NO TOOL | NO TOOL |  | Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time) | N/A | 3000 |
| item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9 | Mon Sep 21 2026 15:37:01 GMT+0000 (Coordinated Universal Time) | NO TOOL | NO TOOL |  | Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time) | N/A | 3000 |
| item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f21bb5487d18b9904f7a142c7cd | Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time) | NO TOOL | NO TOOL |  | Mon Sep 21 2026 15:37:07 GMT+0000 (Coordinated Universal Time) | N/A | 2000 |
| item_EQaMtH9ozMNe1VWM96O8u | resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf | Mon Sep 21 2026 15:37:15 GMT+0000 (Coordinated Universal Time) | NO TOOL | NO TOOL |  | Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time) | N/A | 3000 |
| item_EQaMtH9ozMNe1VWM96O8u | resp_05b048154c30764a006ab14f305ea087d1ba9f28bdd575ea41 | Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time) | NO TOOL | NO TOOL |  | Mon Sep 21 2026 15:37:23 GMT+0000 (Coordinated Universal Time) | N/A | 3000 |

## 9. Session usage (every SESSION_USAGE_UPDATED, deduped)

### Mon Sep 21 2026 15:36:06 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1')])"
```
### Mon Sep 21 2026 15:36:22 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=15.0)])"
```
### Mon Sep 21 2026 15:36:37 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=30.0)])"
```
### Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=30.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=11781, input_cache_creation_tokens=11652, output_tokens=64)])"
```
### Mon Sep 21 2026 15:36:47 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=30.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=23698, input_cache_creation_tokens=11652, output_tokens=87)])"
```
### Mon Sep 21 2026 15:36:52 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=45.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=23698, input_cache_creation_tokens=11652, output_tokens=87)])"
```
### Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=45.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=35760, input_cached_tokens=11115, input_cache_creation_tokens=11797, output_tokens=159)])"
```
### Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=45.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=47955, input_cached_tokens=22230, input_cache_creation_tokens=11930, output_tokens=181)])"
```
### Mon Sep 21 2026 15:37:07 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=60.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=47955, input_cached_tokens=22230, input_cache_creation_tokens=11930, output_tokens=181)])"
```
### Mon Sep 21 2026 15:37:07 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=60.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=60300, input_cached_tokens=34369, input_cache_creation_tokens=12080, output_tokens=204)])"
```
### Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=60.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=72771, input_cached_tokens=46508, input_cache_creation_tokens=12206, output_tokens=239)])"
```
### Mon Sep 21 2026 15:37:22 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=75.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=72771, input_cached_tokens=46508, input_cache_creation_tokens=12206, output_tokens=239)])"
```
### Mon Sep 21 2026 15:37:23 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=75.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=85394, input_cached_tokens=58647, input_cache_creation_tokens=12358, output_tokens=264)])"
```
### Mon Sep 21 2026 15:37:37 GMT+0000 (Coordinated Universal Time)
```json
"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=90.0), LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-5.6-sol', input_tokens=85394, input_cached_tokens=58647, input_cache_creation_tokens=12358, output_tokens=264)])"
```
Final sessionUsage package: missing

## 10–11. FunctionTool + Node timings

- **update_intake** `call_hHyoNvkKuvdHAGxg4GnMv5yi` · Py Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) → Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) (23 ms) · Node Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) → Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) (13 ms)
- **set_scheduling_preference** `call_BNo8rXo8bwpQox7Ydll3kIJN` · Py Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time) → Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time) (22 ms) · Node Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time) → Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time) (8 ms)
- **find_availability** `call_tdeV3JaSBxGaUB1H3Qv4B1S2` · Py Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time) → Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time) (1227 ms) · Node Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time) → Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time) (1217 ms)
- **book_appointment** `call_RoqRT73FxXNVKZpIUdHgzwKa` · Py Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time) → Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time) (1737 ms) · Node Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time) → Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time) (1723 ms)

## 13. update_intake focus

### call_id `call_hHyoNvkKuvdHAGxg4GnMv5yi`
{
  "emitted": {
    "call_id": "call_hHyoNvkKuvdHAGxg4GnMv5yi",
    "item_id": "fc_05b048154c30764a006ab14f0803cc87d1ab9dd5170f1d2b03",
    "direction": "server",
    "item_type": "function_call",
    "inner_type": "response.output_item.done",
    "item_status": "completed",
    "response_id": "resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426",
    "delegation_id": "item_EQaMI15D282NPNEbxj7PA",
    "envelope_type": "response.event",
    "function_name": "update_intake",
    "voice_call_id": "lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M",
    "argument_key_names": [
      "email",
      "mother_s_name",
      "name",
      "notes",
      "phone",
      "service_reason"
    ],
    "gpt_live_session_id": "live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ",
    "provider_event_type": "response.output_item.done"
  }
}

## 12. Provider / calendar timings (from Node elapsed + web logs)

| tool | Node elapsed_ms | provider sub-steps in forensics |
|------|-----------------|--------------------------------|
| update_intake | 13 | N/A (not separately instrumented in forensics DB) |
| set_scheduling_preference | 8 | N/A (not separately instrumented in forensics DB) |
| find_availability | 1217 | booking engine + calendar list inside Node; see web FIND_* / VOICE_TOOL_* logs |
| book_appointment | 1723 | validation + Graph insert inside Node; see web BOOKING_* / MICROSOFT_* logs |

Filtered web/runtime log lines for FIND/BOOK/MICROSOFT (sanitized):

```
  booking_strategy: 'MICROSOFT_365',
VOICE_V3_BOOKING_PIPELINE_ACTIVE {
VOICE_TOOL_REQUESTED {
VOICE_TOOL_VALIDATED {
VOICE_TOOL_EXECUTION_STARTED {
VOICE_TOOL_EXECUTION_SUCCEEDED {
VOICE_TOOL_REQUESTED {
VOICE_TOOL_VALIDATED {
VOICE_TOOL_EXECUTION_STARTED {
VOICE_TOOL_EXECUTION_SUCCEEDED {
VOICE_TOOL_REQUESTED {
VOICE_TOOL_VALIDATED {
VOICE_TOOL_EXECUTION_STARTED {
FIND_AVAILABILITY_REQUIRED {
  action: 'FIND_AVAILABILITY',
  operation_type: 'FIND_AVAILABILITY',
FIND_AVAILABILITY_DISPATCHED {
MICROSOFT_AVAILABILITY_REQUEST_STARTED {
MICROSOFT_AVAILABILITY_REQUEST_COMPLETED {
  operation_type: 'FIND_AVAILABILITY',
  action: 'FIND_AVAILABILITY',
VOICE_TOOL_EXECUTION_SUCCEEDED {
VOICE_TOOL_REQUESTED {
VOICE_TOOL_VALIDATED {
VOICE_TOOL_EXECUTION_STARTED {
BOOKING_READY {
BOOKING_ATTEMPT_CREATED {
BOOKING_REVALIDATION_STARTED {
BOOKING_REVALIDATION_PASSED {
  allowed_claims: [ 'PRESENT_AVAILABILITY', 'CLAIM_BOOKING_IN_PROGRESS' ]
BOOKING_COMMIT_STARTED {
BOOKING_COMMIT_SENT {
MICROSOFT_EVENT_CREATED {
BOOKING_CONFIRMED {
LIVE_BOOKING_CONFIRMATION_SENT {
VOICE_TOOL_EXECUTION_SUCCEEDED {
```

## 14. Master chronological timeline (full, deduped, sorted by UTC)

| UTC | rel ms | source | category | event | delegation_id | response_id | call_id | tool | message_id | notes |
|-----|--------|--------|----------|-------|---------------|-------------|---------|------|------------|-------|
| Mon Sep 21 2026 15:36:02 GMT+0000 (Coordinated Universal Time) | -3238 | python | session | VOICE_V3_SESSION_BOOTSTRAP_START |  |  |  |  |  | {"room":"transovo-call-_+1[REDACTED]_MoSPbJXesc6M"} |
| Mon Sep 21 2026 15:36:05 GMT+0000 (Coordinated Universal Time) | -238 | node | session | VOICE_V3_SESSION_BOOTSTRAP_START |  |  |  |  |  | {"room_name":"transovo-call-_+1[REDACTED]_MoSPbJXesc6M","dialed_e164":"+1[REDACTED]","backend_model":"gpt-5.6-sol","live_voice_id":"vesper","caller_present":true} |
| Mon Sep 21 2026 15:36:05 GMT+0000 (Coordinated Universal Time) | -238 | node | session | VOICE_V3_SESSION_CONFIG_RESOLVED |  |  |  |  |  | {"tool_count":16} |
| Mon Sep 21 2026 15:36:03 GMT+0000 (Coordinated Universal Time) | -2238 | python | session | AGENTSESSION_START_REQUESTED |  |  |  |  |  | {} |
| Mon Sep 21 2026 15:36:05 GMT+0000 (Coordinated Universal Time) | -238 | python | session | AGENTSESSION_STARTED |  |  |  |  |  | {} |
| Mon Sep 21 2026 15:36:05 GMT+0000 (Coordinated Universal Time) | -238 | python | session | AGENTSESSION_START_COMPLETED |  |  |  |  |  | {} |
| Mon Sep 21 2026 15:36:05 GMT+0000 (Coordinated Universal Time) | -238 | python | gpt-live/sol | GPT_LIVE_DELEGATION_TELEMETRY_ATTACHED |  |  |  |  |  | {} |
| Mon Sep 21 2026 15:36:06 GMT+0000 (Coordinated Universal Time) | 762 | python | gpt-live/sol | GPT_LIVE_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"realtime_model_metrics","label":"","duration":0,"metadata":{"model_name":"gpt-live-1","model_pro |
| Mon Sep 21 2026 15:36:06 GMT+0000 (Coordinated Universal Time) | 762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1')])"} |
| Mon Sep 21 2026 15:36:07 GMT+0000 (Coordinated Universal Time) | 1762 | python | gpt-live/sol | GPT_LIVE_SESSION_AVAILABLE |  |  |  |  |  | {"session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ"} |
| Mon Sep 21 2026 15:36:12 GMT+0000 (Coordinated Universal Time) | 6762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"Hello","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_1","sequence":1,"committed_at":{},"utterance_chars":5} |
| Mon Sep 21 2026 15:36:11 GMT+0000 (Coordinated Universal Time) | 5762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_ebbdbbc12cca","utterance_chars":5} |
| Mon Sep 21 2026 15:36:11 GMT+0000 (Coordinated Universal Time) | 5762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_ebbdbbc12cca | {"role":"user","metrics":{"started_speaking_at":1790004971.213187},"message_id":"speech_ebbdbbc12cca","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaLm |
| Mon Sep 21 2026 15:36:11 GMT+0000 (Coordinated Universal Time) | 5762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_ebbdbbc12cca | {"role":"user","text":" Hello","metrics":{"started_speaking_at":1790004971.213187},"sequence_hint":1,"conversation_item_id":"speech_ebbdbbc12cca"} |
| Mon Sep 21 2026 15:36:12 GMT+0000 (Coordinated Universal Time) | 6762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_1","sequence":1,"committed":true},"utterance_chars":5} |
| Mon Sep 21 2026 15:36:16 GMT+0000 (Coordinated Universal Time) | 10762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | item_0b5c5ca67a59 | {"role":"assistant","metrics":{"playback_latency":0.006184577941894531,"started_speaking_at":1790004971.5996985,"stopped_speaking_at":1790004976.1870315,"provider_request_ids":["item_0b5c5ca67a59"]}," |
| Mon Sep 21 2026 15:36:16 GMT+0000 (Coordinated Universal Time) | 10762 | python | speech/transcript | AGENT_TURN_COMMITTED |  |  |  |  | item_0b5c5ca67a59 | {"role":"assistant","text":" Thank you for calling WS1 Cert Plumbing Co. This is Riley. How can I help you today?","metrics":{"playback_latency":0.006184577941894531,"started_speaking_at":1790004971.5 |
| Mon Sep 21 2026 15:36:23 GMT+0000 (Coordinated Universal Time) | 17762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"Hey, I need to book an appointment because my toilet is leaking. My name is Anthony","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_2","sequence":2,"committed_at":{},"utterance_c |
| Mon Sep 21 2026 15:36:22 GMT+0000 (Coordinated Universal Time) | 16762 | python | gpt-live/sol | GPT_LIVE_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"realtime_model_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","d |
| Mon Sep 21 2026 15:36:22 GMT+0000 (Coordinated Universal Time) | 16762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=15.0)])"} |
| Mon Sep 21 2026 15:36:25 GMT+0000 (Coordinated Universal Time) | 19762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"Johnson. My phone number's","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_3","sequence":3,"committed_at":{},"utterance_chars":26} |
| Mon Sep 21 2026 15:36:23 GMT+0000 (Coordinated Universal Time) | 17762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_6d6bb5579b50","utterance_chars":83} |
| Mon Sep 21 2026 15:36:23 GMT+0000 (Coordinated Universal Time) | 17762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_6d6bb5579b50 | {"role":"user","metrics":{"started_speaking_at":1790004978.1214983},"message_id":"speech_6d6bb5579b50","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:36:23 GMT+0000 (Coordinated Universal Time) | 17762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_6d6bb5579b50 | {"role":"user","text":" Hey, I need to book an appointment because my toilet is leaking. My name is Anthony","metrics":{"started_speaking_at":1790004978.1214983},"sequence_hint":3,"conversation_item_i |
| Mon Sep 21 2026 15:36:23 GMT+0000 (Coordinated Universal Time) | 17762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_2","sequence":2,"committed":true},"utterance_chars":83} |
| Mon Sep 21 2026 15:36:26 GMT+0000 (Coordinated Universal Time) | 20762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"571","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_4","sequence":4,"committed_at":{},"utterance_chars":3} |
| Mon Sep 21 2026 15:36:27 GMT+0000 (Coordinated Universal Time) | 21762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"477","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_5","sequence":5,"committed_at":{},"utterance_chars":3} |
| Mon Sep 21 2026 15:36:25 GMT+0000 (Coordinated Universal Time) | 19762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_c6da0ec11aa2","utterance_chars":26} |
| Mon Sep 21 2026 15:36:25 GMT+0000 (Coordinated Universal Time) | 19762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_c6da0ec11aa2 | {"role":"user","metrics":{"started_speaking_at":1790004983.3313427},"message_id":"speech_c6da0ec11aa2","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:36:25 GMT+0000 (Coordinated Universal Time) | 19762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_c6da0ec11aa2 | {"role":"user","text":" Johnson. My phone number's ","metrics":{"started_speaking_at":1790004983.3313427},"sequence_hint":4,"conversation_item_id":"speech_c6da0ec11aa2"} |
| Mon Sep 21 2026 15:36:25 GMT+0000 (Coordinated Universal Time) | 19762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_3","sequence":3,"committed":true},"utterance_chars":26} |
| Mon Sep 21 2026 15:36:26 GMT+0000 (Coordinated Universal Time) | 20762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_f2780df88991","utterance_chars":3} |
| Mon Sep 21 2026 15:36:26 GMT+0000 (Coordinated Universal Time) | 20762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_f2780df88991 | {"role":"user","metrics":{"started_speaking_at":1790004985.0686052},"message_id":"speech_f2780df88991","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:36:26 GMT+0000 (Coordinated Universal Time) | 20762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_f2780df88991 | {"role":"user","text":"571 ","metrics":{"started_speaking_at":1790004985.0686052},"sequence_hint":5,"conversation_item_id":"speech_f2780df88991"} |
| Mon Sep 21 2026 15:36:26 GMT+0000 (Coordinated Universal Time) | 20762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_4","sequence":4,"committed":true},"utterance_chars":3} |
| Mon Sep 21 2026 15:36:27 GMT+0000 (Coordinated Universal Time) | 21762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_474ddbab8704","utterance_chars":3} |
| Mon Sep 21 2026 15:36:27 GMT+0000 (Coordinated Universal Time) | 21762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_474ddbab8704 | {"role":"user","metrics":{"started_speaking_at":1790004986.4757283},"message_id":"speech_474ddbab8704","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:36:27 GMT+0000 (Coordinated Universal Time) | 21762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_474ddbab8704 | {"role":"user","text":"477","metrics":{"started_speaking_at":1790004986.4757283},"sequence_hint":6,"conversation_item_id":"speech_474ddbab8704"} |
| Mon Sep 21 2026 15:36:27 GMT+0000 (Coordinated Universal Time) | 21762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_5","sequence":5,"committed":true},"utterance_chars":3} |
| Mon Sep 21 2026 15:36:33 GMT+0000 (Coordinated Universal Time) | 27762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"-6175. My email is anthony at yahoo dot com, and I live at","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_6","sequence":6,"committed_at":{},"utterance_chars":58} |
| Mon Sep 21 2026 15:36:34 GMT+0000 (Coordinated Universal Time) | 28762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"123","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_7","sequence":7,"committed_at":{},"utterance_chars":3} |
| Mon Sep 21 2026 15:36:35 GMT+0000 (Coordinated Universal Time) | 29762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"Main Street","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_8","sequence":8,"committed_at":{},"utterance_chars":11} |
| Mon Sep 21 2026 15:36:33 GMT+0000 (Coordinated Universal Time) | 27762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_150a1debd503","utterance_chars":58} |
| Mon Sep 21 2026 15:36:33 GMT+0000 (Coordinated Universal Time) | 27762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_150a1debd503 | {"role":"user","metrics":{"started_speaking_at":1790004987.9175298},"message_id":"speech_150a1debd503","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:36:33 GMT+0000 (Coordinated Universal Time) | 27762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_150a1debd503 | {"role":"user","text":"-6175. My email is anthony at yahoo dot com, and I live at ","metrics":{"started_speaking_at":1790004987.9175298},"sequence_hint":7,"conversation_item_id":"speech_150a1debd503"} |
| Mon Sep 21 2026 15:36:33 GMT+0000 (Coordinated Universal Time) | 27762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_6","sequence":6,"committed":true},"utterance_chars":58} |
| Mon Sep 21 2026 15:36:34 GMT+0000 (Coordinated Universal Time) | 28762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_7247ea5b53e6","utterance_chars":3} |
| Mon Sep 21 2026 15:36:34 GMT+0000 (Coordinated Universal Time) | 28762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_7247ea5b53e6 | {"role":"user","metrics":{"started_speaking_at":1790004993.686368},"message_id":"speech_7247ea5b53e6","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaLm |
| Mon Sep 21 2026 15:36:34 GMT+0000 (Coordinated Universal Time) | 28762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_7247ea5b53e6 | {"role":"user","text":"123","metrics":{"started_speaking_at":1790004993.686368},"sequence_hint":8,"conversation_item_id":"speech_7247ea5b53e6"} |
| Mon Sep 21 2026 15:36:34 GMT+0000 (Coordinated Universal Time) | 28762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_7","sequence":7,"committed":true},"utterance_chars":3} |
| Mon Sep 21 2026 15:36:35 GMT+0000 (Coordinated Universal Time) | 29762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_2f44b16dab70","utterance_chars":11} |
| Mon Sep 21 2026 15:36:35 GMT+0000 (Coordinated Universal Time) | 29762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_2f44b16dab70 | {"role":"user","metrics":{"started_speaking_at":1790004994.6753445},"message_id":"speech_2f44b16dab70","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:36:35 GMT+0000 (Coordinated Universal Time) | 29762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_2f44b16dab70 | {"role":"user","text":" Main Street","metrics":{"started_speaking_at":1790004994.6753445},"sequence_hint":9,"conversation_item_id":"speech_2f44b16dab70"} |
| Mon Sep 21 2026 15:36:35 GMT+0000 (Coordinated Universal Time) | 29762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_8","sequence":8,"committed":true},"utterance_chars":11} |
| Mon Sep 21 2026 15:36:39 GMT+0000 (Coordinated Universal Time) | 33762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":", Alexandria, Virginia, and my mom's name is Harriet","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_9","sequence":9,"committed_at":{},"utterance_chars":52} |
| Mon Sep 21 2026 15:36:37 GMT+0000 (Coordinated Universal Time) | 31762 | python | gpt-live/sol | GPT_LIVE_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"realtime_model_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","d |
| Mon Sep 21 2026 15:36:37 GMT+0000 (Coordinated Universal Time) | 31762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=30.0)])"} |
| Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) | 35762 | node | tool | NODE_TOOL_EXECUTION_STARTED |  |  | call_hHyoNvkKuvdHAGxg4GnMv5yi | update_intake |  | {"tool_name":"update_intake","function_call_id":"call_hHyoNvkKuvdHAGxg4GnMv5yi"} |
| Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) | 35762 | node | tool | NODE_TOOL_EXECUTION_COMPLETED |  |  | call_hHyoNvkKuvdHAGxg4GnMv5yi | update_intake |  | {"ok":true,"status":"INTAKE_UPDATED","tool_name":"update_intake","elapsed_ms":13,"function_call_id":"call_hHyoNvkKuvdHAGxg4GnMv5yi"} |
| Mon Sep 21 2026 15:36:38 GMT+0000 (Coordinated Universal Time) | 32762 | python | gpt-live/sol | GPT_LIVE_BACKEND_DELEGATION_CREATED |  |  |  |  |  | {"direction":"server","delegation_id":null,"envelope_type":"session.delegation.created","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7 |
| Mon Sep 21 2026 15:36:38 GMT+0000 (Coordinated Universal Time) | 32762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_CREATED | item_EQaMI15D282NPNEbxj7PA | resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426 |  |  |  | {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426","delegation_id":"item_EQaMI15D282NPNEbxj7PA","envelope_type":"response.eve |
| Mon Sep 21 2026 15:36:39 GMT+0000 (Coordinated Universal Time) | 33762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_19c62f25c033","utterance_chars":52} |
| Mon Sep 21 2026 15:36:39 GMT+0000 (Coordinated Universal Time) | 33762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_19c62f25c033 | {"role":"user","metrics":{"started_speaking_at":1790004996.0677595},"message_id":"speech_19c62f25c033","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:36:39 GMT+0000 (Coordinated Universal Time) | 33762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_19c62f25c033 | {"role":"user","text":", Alexandria, Virginia, and my mom's name is Harriet","metrics":{"started_speaking_at":1790004996.0677595},"sequence_hint":10,"conversation_item_id":"speech_19c62f25c033"} |
| Mon Sep 21 2026 15:36:39 GMT+0000 (Coordinated Universal Time) | 33762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_9","sequence":9,"committed":true},"utterance_chars":52} |
| Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) | 35762 | python | gpt-live/sol | GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED | item_EQaMI15D282NPNEbxj7PA | resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426 | call_hHyoNvkKuvdHAGxg4GnMv5yi | update_intake |  | {"call_id":"call_hHyoNvkKuvdHAGxg4GnMv5yi","item_id":"fc_05b048154c30764a006ab14f0803cc87d1ab9dd5170f1d2b03","direction":"server","item_type":"function_call","inner_type":"response.output_item.done"," |
| Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) | 35762 | python | tool | FUNCTION_TOOL_STARTED |  |  | call_hHyoNvkKuvdHAGxg4GnMv5yi | update_intake |  | {"tool":"update_intake","call_id":"call_hHyoNvkKuvdHAGxg4GnMv5yi"} |
| Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) | 35762 | python | tool | FUNCTION_TOOL_COMPLETED |  |  | call_hHyoNvkKuvdHAGxg4GnMv5yi | update_intake |  | {"ok":true,"code":null,"tool":"update_intake","status":"INTAKE_UPDATED","call_id":"call_hHyoNvkKuvdHAGxg4GnMv5yi","elapsed_ms":23} |
| Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) | 35762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_COMPLETED | item_EQaMI15D282NPNEbxj7PA | resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426 |  |  |  | {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f0695d087d1aa49a87ef01ba426","delegation_id":"item_EQaMI15D282NPNEbxj7PA","envelope_type":"response.e |
| Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) | 35762 | python | gpt-live/sol | BACKEND_LLM_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0, |
| Mon Sep 21 2026 15:36:41 GMT+0000 (Coordinated Universal Time) | 35762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=30.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time) | 39762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | item_b484be8e4891 | {"role":"assistant","metrics":{"playback_latency":0.00028967857360839844,"started_speaking_at":1790004998.8791823,"stopped_speaking_at":1790005005.388756,"provider_request_ids":["item_b484be8e4891"]}, |
| Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time) | 39762 | python | speech/transcript | AGENT_TURN_COMMITTED |  |  |  |  | item_b484be8e4891 | {"role":"assistant","text":" Okay, Anthony, thank you for sharing all those details. Just one moment while I get that all straight.","metrics":{"playback_latency":0.00028967857360839844,"started_speak |
| Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time) | 39762 | python | gpt-live/sol | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED |  |  | call_hHyoNvkKuvdHAGxg4GnMv5yi |  |  | {"call_id":"call_hHyoNvkKuvdHAGxg4GnMv5yi","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"tool_output_b1cecbda |
| Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time) | 39762 | python | gpt-live/sol | GPT_LIVE_BACKEND_CONTINUATION_QUEUED |  |  |  |  |  | {"direction":"client","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"response_create_763720427029","client_event_type":"response.create","gpt_live_session_id":"live_u |
| Mon Sep 21 2026 15:36:45 GMT+0000 (Coordinated Universal Time) | 39762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_CREATED | item_EQaMI15D282NPNEbxj7PA | resp_05b048154c30764a006ab14f0d949c87d1aa3f3fac611bff9a |  |  |  | {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f0d949c87d1aa3f3fac611bff9a","delegation_id":"item_EQaMI15D282NPNEbxj7PA","envelope_type":"response.eve |
| Mon Sep 21 2026 15:36:47 GMT+0000 (Coordinated Universal Time) | 41762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_COMPLETED | item_EQaMI15D282NPNEbxj7PA | resp_05b048154c30764a006ab14f0d949c87d1aa3f3fac611bff9a |  |  |  | {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f0d949c87d1aa3f3fac611bff9a","delegation_id":"item_EQaMI15D282NPNEbxj7PA","envelope_type":"response.e |
| Mon Sep 21 2026 15:36:47 GMT+0000 (Coordinated Universal Time) | 41762 | python | gpt-live/sol | BACKEND_LLM_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0, |
| Mon Sep 21 2026 15:36:47 GMT+0000 (Coordinated Universal Time) | 41762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=30.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:36:52 GMT+0000 (Coordinated Universal Time) | 46762 | python | gpt-live/sol | GPT_LIVE_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"realtime_model_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","d |
| Mon Sep 21 2026 15:36:52 GMT+0000 (Coordinated Universal Time) | 46762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=45.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:36:53 GMT+0000 (Coordinated Universal Time) | 47762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | item_4e705e3592af | {"role":"assistant","metrics":{"playback_latency":0.0001201629638671875,"started_speaking_at":1790005008.304624,"stopped_speaking_at":1790005013.2202375,"provider_request_ids":["item_4e705e3592af"]}," |
| Mon Sep 21 2026 15:36:53 GMT+0000 (Coordinated Universal Time) | 47762 | python | speech/transcript | AGENT_TURN_COMMITTED |  |  |  |  | item_4e705e3592af | {"role":"assistant","text":" Okay, I've got all that. What day and time would you prefer for the service visit?","metrics":{"playback_latency":0.0001201629638671875,"started_speaking_at":1790005008.30 |
| Mon Sep 21 2026 15:36:56 GMT+0000 (Coordinated Universal Time) | 50762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"Uh","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_10","sequence":10,"committed_at":{},"utterance_chars":2} |
| Mon Sep 21 2026 15:36:58 GMT+0000 (Coordinated Universal Time) | 52762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":", today, the earliest you have today","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_11","sequence":11,"committed_at":{},"utterance_chars":36} |
| Mon Sep 21 2026 15:36:56 GMT+0000 (Coordinated Universal Time) | 50762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_398b69e8995f","utterance_chars":2} |
| Mon Sep 21 2026 15:36:56 GMT+0000 (Coordinated Universal Time) | 50762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_398b69e8995f | {"role":"user","metrics":{"started_speaking_at":1790005015.2706127},"message_id":"speech_398b69e8995f","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:36:56 GMT+0000 (Coordinated Universal Time) | 50762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_398b69e8995f | {"role":"user","text":" Uh","metrics":{"started_speaking_at":1790005015.2706127},"sequence_hint":13,"conversation_item_id":"speech_398b69e8995f"} |
| Mon Sep 21 2026 15:36:56 GMT+0000 (Coordinated Universal Time) | 50762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_10","sequence":10,"committed":true},"utterance_chars":2} |
| Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time) | 53762 | node | tool | NODE_TOOL_EXECUTION_STARTED |  |  | call_BNo8rXo8bwpQox7Ydll3kIJN | set_scheduling_preference |  | {"tool_name":"set_scheduling_preference","function_call_id":"call_BNo8rXo8bwpQox7Ydll3kIJN"} |
| Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time) | 53762 | node | tool | NODE_TOOL_EXECUTION_COMPLETED |  |  | call_BNo8rXo8bwpQox7Ydll3kIJN | set_scheduling_preference |  | {"ok":true,"status":"SCHEDULING_PREFERENCE_SET","tool_name":"set_scheduling_preference","elapsed_ms":8,"function_call_id":"call_BNo8rXo8bwpQox7Ydll3kIJN"} |
| Mon Sep 21 2026 15:36:57 GMT+0000 (Coordinated Universal Time) | 51762 | python | gpt-live/sol | GPT_LIVE_BACKEND_DELEGATION_CREATED |  |  |  |  |  | {"direction":"server","delegation_id":null,"envelope_type":"session.delegation.created","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7 |
| Mon Sep 21 2026 15:36:57 GMT+0000 (Coordinated Universal Time) | 51762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_CREATED | item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9 |  |  |  | {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.eve |
| Mon Sep 21 2026 15:36:58 GMT+0000 (Coordinated Universal Time) | 52762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_1a2eb112a425","utterance_chars":36} |
| Mon Sep 21 2026 15:36:58 GMT+0000 (Coordinated Universal Time) | 52762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_1a2eb112a425 | {"role":"user","metrics":{"started_speaking_at":1790005016.1335654},"message_id":"speech_1a2eb112a425","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:36:58 GMT+0000 (Coordinated Universal Time) | 52762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_1a2eb112a425 | {"role":"user","text":", today, the earliest you have today","metrics":{"started_speaking_at":1790005016.1335654},"sequence_hint":14,"conversation_item_id":"speech_1a2eb112a425"} |
| Mon Sep 21 2026 15:36:58 GMT+0000 (Coordinated Universal Time) | 52762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_11","sequence":11,"committed":true},"utterance_chars":36} |
| Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time) | 53762 | python | gpt-live/sol | GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED | item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9 | call_BNo8rXo8bwpQox7Ydll3kIJN | set_scheduling_preference |  | {"call_id":"call_BNo8rXo8bwpQox7Ydll3kIJN","item_id":"fc_05b048154c30764a006ab14f1ae44c87d1af0780f8236f1b87","direction":"server","item_type":"function_call","inner_type":"response.output_item.done"," |
| Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time) | 53762 | python | tool | FUNCTION_TOOL_STARTED |  |  | call_BNo8rXo8bwpQox7Ydll3kIJN | set_scheduling_preference |  | {"tool":"set_scheduling_preference","call_id":"call_BNo8rXo8bwpQox7Ydll3kIJN"} |
| Mon Sep 21 2026 15:36:59 GMT+0000 (Coordinated Universal Time) | 53762 | python | tool | FUNCTION_TOOL_COMPLETED |  |  | call_BNo8rXo8bwpQox7Ydll3kIJN | set_scheduling_preference |  | {"ok":true,"code":null,"tool":"set_scheduling_preference","status":"SCHEDULING_PREFERENCE_SET","call_id":"call_BNo8rXo8bwpQox7Ydll3kIJN","elapsed_ms":22} |
| Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time) | 54762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_COMPLETED | item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9 |  |  |  | {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f195b0087d18c08c74e3145f7f9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.e |
| Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time) | 54762 | python | gpt-live/sol | BACKEND_LLM_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0, |
| Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time) | 54762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=45.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time) | 54762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | item_ff285de11e57 | {"role":"assistant","metrics":{"playback_latency":0.00011134147644042969,"started_speaking_at":1790005017.6835558,"stopped_speaking_at":1790005020.754683,"provider_request_ids":["item_ff285de11e57"]}, |
| Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time) | 54762 | python | speech/transcript | AGENT_TURN_COMMITTED |  |  |  |  | item_ff285de11e57 | {"role":"assistant","text":" Sure, checking on that now.","metrics":{"playback_latency":0.00011134147644042969,"started_speaking_at":1790005017.6835558,"stopped_speaking_at":1790005020.754683,"provide |
| Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time) | 54762 | python | gpt-live/sol | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED |  |  | call_BNo8rXo8bwpQox7Ydll3kIJN |  |  | {"call_id":"call_BNo8rXo8bwpQox7Ydll3kIJN","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"tool_output_263b6e88 |
| Mon Sep 21 2026 15:37:00 GMT+0000 (Coordinated Universal Time) | 54762 | python | gpt-live/sol | GPT_LIVE_BACKEND_CONTINUATION_QUEUED |  |  |  |  |  | {"direction":"client","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"response_create_2ab5accefc0a","client_event_type":"response.create","gpt_live_session_id":"live_u |
| Mon Sep 21 2026 15:37:01 GMT+0000 (Coordinated Universal Time) | 55762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_CREATED | item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9 |  |  |  | {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.eve |
| Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time) | 58762 | node | tool | NODE_TOOL_EXECUTION_STARTED |  |  | call_tdeV3JaSBxGaUB1H3Qv4B1S2 | find_availability |  | {"tool_name":"find_availability","function_call_id":"call_tdeV3JaSBxGaUB1H3Qv4B1S2"} |
| Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time) | 59762 | node | tool | NODE_TOOL_EXECUTION_COMPLETED |  |  | call_tdeV3JaSBxGaUB1H3Qv4B1S2 | find_availability |  | {"ok":true,"status":"available","tool_name":"find_availability","elapsed_ms":1217,"function_call_id":"call_tdeV3JaSBxGaUB1H3Qv4B1S2"} |
| Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time) | 58762 | python | gpt-live/sol | GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED | item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9 | call_tdeV3JaSBxGaUB1H3Qv4B1S2 | find_availability |  | {"call_id":"call_tdeV3JaSBxGaUB1H3Qv4B1S2","item_id":"fc_05b048154c30764a006ab14f202a2887d1b663c8b73ec331fc","direction":"server","item_type":"function_call","inner_type":"response.output_item.done"," |
| Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time) | 58762 | python | tool | FUNCTION_TOOL_STARTED |  |  | call_tdeV3JaSBxGaUB1H3Qv4B1S2 | find_availability |  | {"tool":"find_availability","call_id":"call_tdeV3JaSBxGaUB1H3Qv4B1S2"} |
| Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time) | 58762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_COMPLETED | item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9 |  |  |  | {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f1cd9d887d1b414139aa6715ac9","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.e |
| Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time) | 58762 | python | gpt-live/sol | BACKEND_LLM_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0, |
| Mon Sep 21 2026 15:37:04 GMT+0000 (Coordinated Universal Time) | 58762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=45.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time) | 59762 | python | tool | FUNCTION_TOOL_COMPLETED |  |  | call_tdeV3JaSBxGaUB1H3Qv4B1S2 | find_availability |  | {"ok":true,"code":null,"tool":"find_availability","status":"available","call_id":"call_tdeV3JaSBxGaUB1H3Qv4B1S2","elapsed_ms":1227} |
| Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time) | 59762 | python | gpt-live/sol | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED |  |  | call_tdeV3JaSBxGaUB1H3Qv4B1S2 |  |  | {"call_id":"call_tdeV3JaSBxGaUB1H3Qv4B1S2","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"tool_output_c5cb25b8 |
| Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time) | 59762 | python | gpt-live/sol | GPT_LIVE_BACKEND_CONTINUATION_QUEUED |  |  |  |  |  | {"direction":"client","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"response_create_7c4bb6782e08","client_event_type":"response.create","gpt_live_session_id":"live_u |
| Mon Sep 21 2026 15:37:05 GMT+0000 (Coordinated Universal Time) | 59762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_CREATED | item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f21bb5487d18b9904f7a142c7cd |  |  |  | {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f21bb5487d18b9904f7a142c7cd","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.eve |
| Mon Sep 21 2026 15:37:07 GMT+0000 (Coordinated Universal Time) | 61762 | python | gpt-live/sol | GPT_LIVE_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"realtime_model_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","d |
| Mon Sep 21 2026 15:37:07 GMT+0000 (Coordinated Universal Time) | 61762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=60.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:37:07 GMT+0000 (Coordinated Universal Time) | 61762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_COMPLETED | item_EQaMbK3OqCZzcD5m1ICFQ | resp_05b048154c30764a006ab14f21bb5487d18b9904f7a142c7cd |  |  |  | {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f21bb5487d18b9904f7a142c7cd","delegation_id":"item_EQaMbK3OqCZzcD5m1ICFQ","envelope_type":"response.e |
| Mon Sep 21 2026 15:37:07 GMT+0000 (Coordinated Universal Time) | 61762 | python | gpt-live/sol | BACKEND_LLM_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0, |
| Mon Sep 21 2026 15:37:07 GMT+0000 (Coordinated Universal Time) | 61762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=60.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:37:13 GMT+0000 (Coordinated Universal Time) | 67762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | item_e308775529dd | {"role":"assistant","metrics":{"playback_latency":0.00032901763916015625,"started_speaking_at":1790005028.597512,"stopped_speaking_at":1790005033.8676252,"provider_request_ids":["item_e308775529dd"]}, |
| Mon Sep 21 2026 15:37:13 GMT+0000 (Coordinated Universal Time) | 67762 | python | speech/transcript | AGENT_TURN_COMMITTED |  |  |  |  | item_e308775529dd | {"role":"assistant","text":" Okay, the earliest we have today is at two p.m. Would you like me to book that for you?","metrics":{"playback_latency":0.00032901763916015625,"started_speaking_at":1790005 |
| Mon Sep 21 2026 15:37:16 GMT+0000 (Coordinated Universal Time) | 70762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"Yes","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_12","sequence":12,"committed_at":{},"utterance_chars":3} |
| Mon Sep 21 2026 15:37:15 GMT+0000 (Coordinated Universal Time) | 69762 | python | gpt-live/sol | GPT_LIVE_BACKEND_DELEGATION_CREATED |  |  |  |  |  | {"direction":"server","delegation_id":null,"envelope_type":"session.delegation.created","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7 |
| Mon Sep 21 2026 15:37:15 GMT+0000 (Coordinated Universal Time) | 69762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_CREATED | item_EQaMtH9ozMNe1VWM96O8u | resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf |  |  |  | {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf","delegation_id":"item_EQaMtH9ozMNe1VWM96O8u","envelope_type":"response.eve |
| Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time) | 72762 | node | tool | NODE_TOOL_EXECUTION_STARTED |  |  | call_RoqRT73FxXNVKZpIUdHgzwKa | book_appointment |  | {"tool_name":"book_appointment","function_call_id":"call_RoqRT73FxXNVKZpIUdHgzwKa"} |
| Mon Sep 21 2026 15:37:16 GMT+0000 (Coordinated Universal Time) | 70762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_00ba24c820e4","utterance_chars":3} |
| Mon Sep 21 2026 15:37:16 GMT+0000 (Coordinated Universal Time) | 70762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_00ba24c820e4 | {"role":"user","metrics":{"started_speaking_at":1790005035.6194127},"message_id":"speech_00ba24c820e4","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:37:16 GMT+0000 (Coordinated Universal Time) | 70762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_00ba24c820e4 | {"role":"user","text":" Yes","metrics":{"started_speaking_at":1790005035.6194127},"sequence_hint":17,"conversation_item_id":"speech_00ba24c820e4"} |
| Mon Sep 21 2026 15:37:16 GMT+0000 (Coordinated Universal Time) | 70762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_12","sequence":12,"committed":true},"utterance_chars":3} |
| Mon Sep 21 2026 15:37:17 GMT+0000 (Coordinated Universal Time) | 71762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | item_54e4cf99759c | {"role":"assistant","metrics":{"playback_latency":0.0002627372741699219,"started_speaking_at":1790005035.8964558,"stopped_speaking_at":1790005037.2809284,"provider_request_ids":["item_54e4cf99759c"]}, |
| Mon Sep 21 2026 15:37:17 GMT+0000 (Coordinated Universal Time) | 71762 | python | speech/transcript | AGENT_TURN_COMMITTED |  |  |  |  | item_54e4cf99759c | {"role":"assistant","text":" Okay.","metrics":{"playback_latency":0.0002627372741699219,"started_speaking_at":1790005035.8964558,"stopped_speaking_at":1790005037.2809284,"provider_request_ids":["item_ |
| Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time) | 74762 | node | tool | NODE_TOOL_EXECUTION_COMPLETED |  |  | call_RoqRT73FxXNVKZpIUdHgzwKa | book_appointment |  | {"ok":true,"status":"confirmed","tool_name":"book_appointment","elapsed_ms":1723,"function_call_id":"call_RoqRT73FxXNVKZpIUdHgzwKa"} |
| Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time) | 72762 | python | gpt-live/sol | GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED | item_EQaMtH9ozMNe1VWM96O8u | resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf | call_RoqRT73FxXNVKZpIUdHgzwKa | book_appointment |  | {"call_id":"call_RoqRT73FxXNVKZpIUdHgzwKa","item_id":"fc_05b048154c30764a006ab14f2e14b087d1a3040e661e04206c","direction":"server","item_type":"function_call","inner_type":"response.output_item.done"," |
| Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time) | 72762 | python | tool | FUNCTION_TOOL_STARTED |  |  | call_RoqRT73FxXNVKZpIUdHgzwKa | book_appointment |  | {"tool":"book_appointment","call_id":"call_RoqRT73FxXNVKZpIUdHgzwKa"} |
| Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time) | 72762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_COMPLETED | item_EQaMtH9ozMNe1VWM96O8u | resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf |  |  |  | {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f2b924087d1b54931914f2ccccf","delegation_id":"item_EQaMtH9ozMNe1VWM96O8u","envelope_type":"response.e |
| Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time) | 72762 | python | gpt-live/sol | BACKEND_LLM_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0, |
| Mon Sep 21 2026 15:37:18 GMT+0000 (Coordinated Universal Time) | 72762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=60.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time) | 74762 | python | tool | FUNCTION_TOOL_COMPLETED |  |  | call_RoqRT73FxXNVKZpIUdHgzwKa | book_appointment |  | {"ok":true,"code":null,"tool":"book_appointment","status":"confirmed","call_id":"call_RoqRT73FxXNVKZpIUdHgzwKa","elapsed_ms":1737} |
| Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time) | 74762 | python | gpt-live/sol | GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED |  |  | call_RoqRT73FxXNVKZpIUdHgzwKa |  |  | {"call_id":"call_RoqRT73FxXNVKZpIUdHgzwKa","direction":"client","item_type":"function_call_output","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"tool_output_b5863567 |
| Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time) | 74762 | python | gpt-live/sol | GPT_LIVE_BACKEND_CONTINUATION_QUEUED |  |  |  |  |  | {"direction":"client","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","client_event_id":"response_create_288126576b3f","client_event_type":"response.create","gpt_live_session_id":"live_u |
| Mon Sep 21 2026 15:37:20 GMT+0000 (Coordinated Universal Time) | 74762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_CREATED | item_EQaMtH9ozMNe1VWM96O8u | resp_05b048154c30764a006ab14f305ea087d1ba9f28bdd575ea41 |  |  |  | {"direction":"server","inner_type":"response.created","response_id":"resp_05b048154c30764a006ab14f305ea087d1ba9f28bdd575ea41","delegation_id":"item_EQaMtH9ozMNe1VWM96O8u","envelope_type":"response.eve |
| Mon Sep 21 2026 15:37:22 GMT+0000 (Coordinated Universal Time) | 76762 | python | gpt-live/sol | GPT_LIVE_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"realtime_model_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","d |
| Mon Sep 21 2026 15:37:22 GMT+0000 (Coordinated Universal Time) | 76762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=75.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:37:23 GMT+0000 (Coordinated Universal Time) | 77762 | python | gpt-live/sol | GPT_LIVE_BACKEND_RESPONSE_COMPLETED | item_EQaMtH9ozMNe1VWM96O8u | resp_05b048154c30764a006ab14f305ea087d1ba9f28bdd575ea41 |  |  |  | {"direction":"server","inner_type":"response.completed","response_id":"resp_05b048154c30764a006ab14f305ea087d1ba9f28bdd575ea41","delegation_id":"item_EQaMtH9ozMNe1VWM96O8u","envelope_type":"response.e |
| Mon Sep 21 2026 15:37:23 GMT+0000 (Coordinated Universal Time) | 77762 | python | gpt-live/sol | BACKEND_LLM_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"llm_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","duration":0, |
| Mon Sep 21 2026 15:37:23 GMT+0000 (Coordinated Universal Time) | 77762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=75.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:37:29 GMT+0000 (Coordinated Universal Time) | 83762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | item_e1fe16ba3f5a | {"role":"assistant","metrics":{"playback_latency":0.0002765655517578125,"started_speaking_at":1790005043.9194107,"stopped_speaking_at":1790005049.3823795,"provider_request_ids":["item_e1fe16ba3f5a"]}, |
| Mon Sep 21 2026 15:37:29 GMT+0000 (Coordinated Universal Time) | 83762 | python | speech/transcript | AGENT_TURN_COMMITTED |  |  |  |  | item_e1fe16ba3f5a | {"role":"assistant","text":" Perfect. You're booked in for today at two p.m. Is there anything else I can help with?","metrics":{"playback_latency":0.0002765655517578125,"started_speaking_at":17900050 |
| Mon Sep 21 2026 15:37:32 GMT+0000 (Coordinated Universal Time) | 86762 | node | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"text":"No, that's it","turn_id":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_13","sequence":13,"committed_at":{},"utterance_chars":13} |
| Mon Sep 21 2026 15:37:32 GMT+0000 (Coordinated Universal Time) | 86762 | python | speech/transcript | CALLER_UTTERANCE_TRANSCRIBED |  |  |  |  |  | {"item_id":"speech_9d1f3e8c0298","utterance_chars":13} |
| Mon Sep 21 2026 15:37:32 GMT+0000 (Coordinated Universal Time) | 86762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | speech_9d1f3e8c0298 | {"role":"user","metrics":{"started_speaking_at":1790005050.9526477},"message_id":"speech_9d1f3e8c0298","voice_call_id":"lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M","gpt_live_session_id":"live_u0_EQaL |
| Mon Sep 21 2026 15:37:32 GMT+0000 (Coordinated Universal Time) | 86762 | python | speech/transcript | USER_TURN_COMMITTED |  |  |  |  | speech_9d1f3e8c0298 | {"role":"user","text":" No, that's it","metrics":{"started_speaking_at":1790005050.9526477},"sequence_hint":20,"conversation_item_id":"speech_9d1f3e8c0298"} |
| Mon Sep 21 2026 15:37:32 GMT+0000 (Coordinated Universal Time) | 86762 | python | speech/transcript | CALLER_UTTERANCE_COMMITTED |  |  |  |  |  | {"result":{"turnId":"turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_13","sequence":13,"committed":true},"utterance_chars":13} |
| Mon Sep 21 2026 15:37:36 GMT+0000 (Coordinated Universal Time) | 90762 | python | speech/transcript | VOICE_V3_CHAT_MESSAGE_METRICS |  |  |  |  | item_b11ee5e6b322 | {"role":"assistant","metrics":{"playback_latency":0.0003008842468261719,"started_speaking_at":1790005051.7996287,"stopped_speaking_at":1790005056.403837,"provider_request_ids":["item_b11ee5e6b322"]}," |
| Mon Sep 21 2026 15:37:36 GMT+0000 (Coordinated Universal Time) | 90762 | python | speech/transcript | AGENT_TURN_COMMITTED |  |  |  |  | item_b11ee5e6b322 | {"role":"assistant","text":" Great. Thanks again for calling. We look forward to helping you with that leak. Take care.","metrics":{"playback_latency":0.0003008842468261719,"started_speaking_at":17900 |
| Mon Sep 21 2026 15:37:36 GMT+0000 (Coordinated Universal Time) | 90762 | python | other | VOICE_V3_CALLER_DISCONNECTED |  |  |  |  |  | {} |
| Mon Sep 21 2026 15:37:37 GMT+0000 (Coordinated Universal Time) | 91762 | python | gpt-live/sol | GPT_LIVE_METRICS_COLLECTED |  |  |  |  |  | {"note":"Prefer session_usage_updated and VOICE_V3_CHAT_MESSAGE_METRICS for GPT-Live","ttft":-1,"type":"realtime_model_metrics","label":"livekit.plugins.openai.realtime.gpt_live_model.GPTLiveModel","d |
| Mon Sep 21 2026 15:37:37 GMT+0000 (Coordinated Universal Time) | 91762 | python | session | SESSION_USAGE_UPDATED |  |  |  |  |  | {"usage":"AgentSessionUsage(model_usage=[LLMModelUsage(type='llm_usage', provider='api.openai.com', model='gpt-live-1', session_duration=90.0), LLMModelUsage(type='llm_usage', provider='api.openai.com |
| Mon Sep 21 2026 15:37:37 GMT+0000 (Coordinated Universal Time) | 91762 | python | session | AGENTSESSION_CLOSED |  |  |  |  |  | {"reason":"CloseReason.PARTICIPANT_DISCONNECTED"} |
| Mon Sep 21 2026 15:38:02 GMT+0000 (Coordinated Universal Time) | 116762 | node | other | VOICE_V3_FORENSIC_FLUSH_REQUESTED |  |  |  |  |  | {"live_kit_job_id":"AJ_ZraAQEjVM9Ci","gpt_live_session_id":"live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ"} |
| Mon Sep 21 2026 15:38:04 GMT+0000 (Coordinated Universal Time) | 118762 | node | other | VOICE_V3_NODE_FORENSICS_FINALIZE_REQUESTED |  |  |  |  |  | {"flushed_from":"python"} |
| Mon Sep 21 2026 15:38:02 GMT+0000 (Coordinated Universal Time) | 116762 | python | session | VOICE_V3_SESSION_END |  |  |  |  |  | {} |

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

## 21. Voice worker logs (sanitized window)

```
{"message": "received job request", "level": "INFO", "name": "livekit.agents", "job_id": "AJ_ZraAQEjVM9Ci", "dispatch_id": "AD_kG9YtqHTmC8G", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "room_id": "RM_R6VEU46EisYM", "agent_name": "transovo-voice-v3", "resuming": false, "enable_recording": true, "timestamp": "2026-09-21T15:36:02.755273+00:00"}
{"service": "transovo-voice", "source": "transovo-voice-main", "event": "voice_worker_registered", "timestamp": "2026-09-21T15:36:02.766259Z", "workerId": "180da8b812d3", "workerType": "livekit_rtc_session", "agentName": "transovo-voice-v3", "workerProfile": "v3", "namespace": "[URL_REDACTED]", "connectedToLiveKit": true, "registeredAt": "2026-09-21T15:36:02.766245Z"}
{"message": "initializing process", "level": "INFO", "name": "livekit.agents", "pid": 371, "timestamp": "2026-09-21T15:36:02.790971+00:00"}
{"message": "process initialized", "level": "INFO", "name": "livekit.agents", "pid": 371, "elapsed_time": 0.04, "timestamp": "2026-09-21T15:36:02.831503+00:00"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:03.066764Z", "endpoint": "/api/internal/voice-runtime", "action": "resolve_voice_v3_livekit_session", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:05.454282Z", "endpoint": "/api/internal/voice-runtime", "action": "resolve_voice_v3_livekit_session", "status": 200, "content_type": "application/json", "body_length": 62140, "duration_ms": 2386, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_session_starting", "timestamp": "2026-09-21T15:36:05.459015Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "liveSessionId": "lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "toolCount": 17, "workspaceId": "ws_1", "agentId": "cmshz2lc25c622c4i58303501", "amyNativeTools": ["end_call"], "amyToolNames": []}
{"message": "metrics_collected is deprecated. Use session_usage_updated for usage tracking and ChatMessage.metrics for per-turn latency.", "level": "WARNING", "name": "livekit.agents", "service": "transovo-voice", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "impl": "python", "profile": "voice_v3_gpt_live", "pid": 71, "job_id": "AJ_ZraAQEjVM9Ci", "room_id": "RM_R6VEU46EisYM", "timestamp": "2026-09-21T15:36:05.458530+00:00"}
{"message": "RoomIO linked to participant", "level": "INFO", "name": "livekit.agents", "lk.pii.participant_identity": "sip_+1[REDACTED]", "lk.pii.room_name": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "service": "transovo-voice", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "impl": "python", "profile": "voice_v3_gpt_live", "pid": 71, "job_id": "AJ_ZraAQEjVM9Ci", "room_id": "RM_R6VEU46EisYM", "timestamp": "2026-09-21T15:36:05.470112+00:00"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:11.964855Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:12.030907Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 93, "duration_ms": 65, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:12.031024Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 1, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_1"}, "utterance_chars": 5}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:12.031076Z", "endpoint": "/api/internal/voice-runtime", "action": "append_voice_v3_forensic_events", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:13.226720Z", "endpoint": "/api/internal/voice-runtime", "action": "append_voice_v3_forensic_events", "status": 200, "content_type": "application/json", "body_length": 25, "duration_ms": 1195, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:23.064465Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:23.098152Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 93, "duration_ms": 33, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:23.098265Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 2, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_2"}, "utterance_chars": 83}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:25.063120Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:25.076839Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 93, "duration_ms": 13, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:25.076959Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 3, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_3"}, "utterance_chars": 26}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:26.463279Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:26.479808Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 93, "duration_ms": 16, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:26.479986Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 4, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_4"}, "utterance_chars": 3}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:27.264176Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:27.278162Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 93, "duration_ms": 13, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:27.278250Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 5, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_5"}, "utterance_chars": 3}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:33.664361Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:33.713983Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 93, "duration_ms": 49, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:33.714186Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 6, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_6"}, "utterance_chars": 58}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:34.464294Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:34.484751Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 93, "duration_ms": 20, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:34.484993Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 7, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_7"}, "utterance_chars": 3}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:35.864541Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:35.885063Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 93, "duration_ms": 20, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:35.885326Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 8, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_8"}, "utterance_chars": 11}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:39.362691Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:39.377565Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 93, "duration_ms": 14, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:39.377852Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 9, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_9"}, "utterance_chars": 52}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:41.094519Z", "endpoint": "/api/internal/voice-runtime", "action": "execute_voice_v3_livekit_tool", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:41.118267Z", "endpoint": "/api/internal/voice-runtime", "action": "execute_voice_v3_livekit_tool", "status": 200, "content_type": "application/json", "body_length": 263, "duration_ms": 23, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:56.063220Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:56.117578Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 95, "duration_ms": 54, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:56.117687Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 10, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_10"}, "utterance_chars": 2}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:58.162719Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:58.176181Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 95, "duration_ms": 13, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:36:58.176349Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 11, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_11"}, "utterance_chars": 36}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:58.176919Z", "endpoint": "/api/internal/voice-runtime", "action": "append_voice_v3_forensic_events", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:59.412171Z", "endpoint": "/api/internal/voice-runtime", "action": "append_voice_v3_forensic_events", "status": 200, "content_type": "application/json", "body_length": 25, "duration_ms": 1235, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:36:59.740496Z", "endpoint": "/api/internal/voice-runtime", "action": "execute_voice_v3_livekit_tool", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:36:59.762676Z", "endpoint": "/api/internal/voice-runtime", "action": "execute_voice_v3_livekit_tool", "status": 200, "content_type": "application/json", "body_length": 203, "duration_ms": 22, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:37:04.407816Z", "endpoint": "/api/internal/voice-runtime", "action": "execute_voice_v3_livekit_tool", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:37:05.635726Z", "endpoint": "/api/internal/voice-runtime", "action": "execute_voice_v3_livekit_tool", "status": 200, "content_type": "application/json", "body_length": 306, "duration_ms": 1227, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:37:16.412750Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:37:16.603936Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 95, "duration_ms": 191, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:37:16.604078Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 12, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_12"}, "utterance_chars": 3}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:37:18.538577Z", "endpoint": "/api/internal/voice-runtime", "action": "execute_voice_v3_livekit_tool", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:37:20.275823Z", "endpoint": "/api/internal/voice-runtime", "action": "execute_voice_v3_livekit_tool", "status": 200, "content_type": "application/json", "body_length": 204, "duration_ms": 1737, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:37:32.212732Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:37:32.263738Z", "endpoint": "/api/internal/voice-runtime", "action": "commit_voice_v3_livekit_caller_utterance", "status": 200, "content_type": "application/json", "body_length": 95, "duration_ms": 50, "attempt": 1}
{"service": "transovo-voice", "source": "voice-python", "event": "voice_v3_caller_utterance_committed", "timestamp": "2026-09-21T15:37:32.263832Z", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "result": {"committed": true, "sequence": 13, "turnId": "turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_13"}, "utterance_chars": 13}
{"service": "transovo-voice", "source": "voice-python", "event": "VOICE_V3_CALLER_DISCONNECTED", "timestamp": "2026-09-21T15:37:36.668820Z", "callId": "lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "workspaceId": "ws_1", "agentId": "cmshz2lc25c622c4i58303501", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M"}
{"message": "closing agent session due to participant disconnect (disable via `RoomInputOptions.close_on_disconnect=False`)", "level": "INFO", "name": "livekit.agents", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "participant": "sip_+1[REDACTED]", "reason": "CLIENT_INITIATED", "service": "transovo-voice", "impl": "python", "profile": "voice_v3_gpt_live", "pid": 71, "job_id": "AJ_ZraAQEjVM9Ci", "room_id": "RM_R6VEU46EisYM", "timestamp": "2026-09-21T15:37:36.669261+00:00"}
{"message": "livekit_api::signal_client:660:livekit_api::signal_client - dropping pass-through signal — no stream available", "level": "WARNING", "name": "livekit", "service": "transovo-voice", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "impl": "python", "profile": "voice_v3_gpt_live", "pid": 71, "job_id": "AJ_ZraAQEjVM9Ci", "room_id": "RM_R6VEU46EisYM", "timestamp": "2026-09-21T15:38:00.885543+00:00"}
{"message": "process exiting", "level": "INFO", "name": "livekit.agents", "reason": "room disconnected", "pid": 71, "job_id": "AJ_ZraAQEjVM9Ci", "room": "transovo-call-_+1[REDACTED]_MoSPbJXesc6M", "room_id": "RM_R6VEU46EisYM", "timestamp": "2026-09-21T15:38:02.182401+00:00"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_request_started", "timestamp": "2026-09-21T15:38:02.185293Z", "endpoint": "/api/internal/voice-runtime", "action": "flush_voice_v3_forensics", "backendUrl": "[URL_REDACTED]"}
{"service": "transovo-voice", "source": "voice-python", "event": "backend_response_received", "timestamp": "2026-09-21T15:38:04.148039Z", "endpoint": "/api/internal/voice-runtime", "action": "flush_voice_v3_forensics", "status": 200, "content_type": "application/json", "body_length": 11, "duration_ms": 1962, "attempt": 1}

```

## 22. Web/runtime logs (filtered, sanitized)

```
VOICE_V3_AGENT_CONFIG_RESOLVED {
  booking_strategy: 'MICROSOFT_365',
VOICE_V3_AMY_CONTEXT_COMPILED { section_count: 28 }
VOICE_V3_ASTRA_CONTEXT_COMPILED { char_count: 11210 }
VOICE_V3_TOOL_SURFACE_COMPILED {
VOICE_V3_PIPELINE {
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
VOICE_V3_BOOKING_PIPELINE_ACTIVE {
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_V3_CONTRACT_VERSIONS {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_1',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_2',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_3',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_4',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_5',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_6',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_7',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_8',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_9',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_REQUESTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_VALIDATED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_EXECUTION_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_EXECUTION_SUCCEEDED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_10',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_11',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_REQUESTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_VALIDATED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_EXECUTION_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
VOICE_TOOL_EXECUTION_SUCCEEDED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_REQUESTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_VALIDATED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_EXECUTION_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  request_key: 'lk_transovo-call-_[phone]_MoSPbJXesc6M|1|2026-09-21T13:00:00.000Z|2026-09-21T21:00:00.000Z|60|primary'
FIND_AVAILABILITY_REQUIRED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
ASYNC_ACTION_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  action: 'FIND_AVAILABILITY',
  attempt_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M|1|2026-09-21T13:00:00.000Z|2026-09-21T21:00:00.000Z|60|primary'
ASYNC_ACTION_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  operation_id: 'find_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_1_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M|1|2026-09-21T13:00:00.000Z|2026-09-21T21:00:00.000Z|60|primary',
  operation_type: 'FIND_AVAILABILITY',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
FIND_AVAILABILITY_DISPATCHED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  request_key: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M|1|2026-09-21T13:00:00.000Z|2026-09-21T21:00:00.000Z|60|primary',
MICROSOFT_AVAILABILITY_REQUEST_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
MICROSOFT_AVAILABILITY_REQUEST_COMPLETED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
ASYNC_ACTION_SUCCEEDED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  operation_id: 'find_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_1_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M|1|2026-09-21T13:00:00.000Z|2026-09-21T21:00:00.000Z|60|primary',
  operation_type: 'FIND_AVAILABILITY',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
ASYNC_ACTION_SUCCEEDED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  action: 'FIND_AVAILABILITY',
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_EXECUTION_SUCCEEDED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_12',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_REQUESTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_VALIDATED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_TOOL_EXECUTION_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
BOOKING_READY {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
BOOKING_ATTEMPT_CREATED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
BOOKING_REVALIDATION_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
BOOKING_REVALIDATION_PASSED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
ASYNC_ACTION_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  allowed_claims: [ 'PRESENT_AVAILABILITY', 'CLAIM_BOOKING_IN_PROGRESS' ]
BOOKING_COMMIT_STARTED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
BOOKING_COMMIT_SENT {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
ASYNC_ACTION_SUCCEEDED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
MICROSOFT_EVENT_CREATED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
BOOKING_CONFIRMED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
LIVE_BOOKING_CONFIRMATION_SENT {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
VOICE_V3_PIPELINE {
  call_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_[phone]_MoSPbJXesc6M',
VOICE_TOOL_EXECUTION_SUCCEEDED {
  call_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',
  turn_id: 'turn_lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M_13',
  live_session_id: 'lk_transovo-call-_+1[REDACTED]_MoSPbJXesc6M',

```