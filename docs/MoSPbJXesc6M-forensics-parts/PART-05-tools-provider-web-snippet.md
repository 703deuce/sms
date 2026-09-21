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
