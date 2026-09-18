# Voice V3 semantic transport report (Live delegation)

## A. Supported `ResponsesDelegationConfig` fields (openai@^7.17.0)

See `docs/voice-v3/LIVE-DELEGATION-RESPONSES-AUDIT.md` for the full table.

Summary: `model`, `instructions`, `max_output_tokens`, `parallel_tool_calls`, `reasoning`, `service_tier`, `text` (**verbosity only**), `tool_choice`, `tools` (`FunctionTool` with `strict`, `WebSearch`).

**Not supported on Live accept:** `text.format` (production 400 `unknown_parameter`).

## B. Strict function-call output

**Yes** — delegated Live `FunctionTool` supports `strict: true` with JSON Schema `parameters`.

Verified with `responses.create` using the same tool shape as Live accept (`scripts/test-voice-v3-astra-function-tool-integration.ts`).

Production transport (default): `emit_caller_meaning` with dynamic CallerMeaning schema (per-agent key enum).

## C. Nested `response.event` shape (function transport)

From integration test / Responses API:

```json
{
  "type": "function_call",
  "name": "emit_caller_meaning",
  "call_id": "...",
  "arguments": "{ ... JSON string ... }"
}
```

Live sideband delivers this inside `response.event` as `response.completed` → `response.output[]`, and/or `response.output_item.done` → `item`.

## D. `JSON.parse` usage

| Path | JSON.parse |
|------|------------|
| **function_tool (default)** | Only on `function_call.arguments` (API transport string), then `buildCallerMeaningZodSchema().safeParse` |
| **output_text fallback** (`VOICE_V3_INTAKE_TRANSPORT=output_text`) | On `output_text` body, then same Zod path |
| **responses.parse tests** | SDK `output_parsed` — no app JSON.parse on meaning |

No semantic parsing, regex recovery, or label guessing.

## E. Malformed output behavior

1. Transport decode fails (`JSON.parse` / missing function call / empty signal) → `ASTRA_MEANING_FAILED`, **no** `CALLER_MEANING_APPLIED`.
2. Zod or post-normalize rejection → `ASTRA_MEANING_SCHEMA_INVALID`, **no** state mutation.
3. Unknown intake keys in Zod-valid payload → stripped at normalize layer; duplicate conflicting values → field dropped + `VOICE_V3_DUPLICATE_FIELD_CONFLICT`.

## F. Production PSTN smoke

After deploy from branch with this transport:

1. Call provisioned Voice V3 PSTN number.
2. Grep Coolify logs for sequence:
   - `OPENAI_LIVE_INCOMING`
   - `VOICE_V3_LIVE_ACCEPT_PAYLOAD_VALIDATED` (`has_text_format: false`, `emit_caller_meaning` in `tool_names`)
   - `VOICE_V3_LIVE_ACCEPTED`
   - `VOICE_V3_SIDEBAND_CONNECTED`
   - `ASTRA_DELEGATION_STARTED`
   - `ASTRA_MEANING_RECEIVED` / `ASTRA_MEANING_SCHEMA_VALID`
   - `CALLER_MEANING_APPLIED` / `RULES_EVALUATED`

Record `call_id` / `live_session_id` from logs. Cloud agents cannot place PSTN calls; operator runs this step.

**Do not enable Microsoft FIND/BOOK until F is green.**
