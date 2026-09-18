# Live API — `session.delegation.responses` audit

**SDK:** `openai@^7.17.0` (`openai/resources/live/live.d.ts`)  
**Production incident:** `sessions.accept` returned `400 unknown_parameter` for `session.delegation.responses.text.format`.

## Supported `ResponsesDelegationConfig` fields (Live delegation)

| Field | Type (SDK) | Notes |
|-------|------------|--------|
| `model` | `string` | **Required.** Delegated Responses model (e.g. `gpt-6-astra`). |
| `instructions` | `string \| null` | Backend prompt separate from Live `session.instructions`. |
| `max_output_tokens` | `number \| null` | Per delegated response cap. |
| `parallel_tool_calls` | `boolean \| null` | Multiple tool calls per delegated response. |
| `reasoning` | `{ effort?, summary? } \| null` | `effort`: none \| minimal \| low \| medium \| high \| xhigh |
| `service_tier` | enum \| null | auto, default, flex, priority, etc. |
| `text` | `{ verbosity?: low \| medium \| high } \| null` | **Only `verbosity` is defined on Live `Text`.** No `format`. |
| `tool_choice` | auto \| none \| required \| `{ type: 'function', name }` \| MCP variant | |
| `tools` | `Array<FunctionTool \| WebSearch>` | |

### Live `FunctionTool`

| Field | Type | Notes |
|-------|------|--------|
| `type` | `'function'` | Required |
| `name` | `string` | Required |
| `description` | `string \| null` | Optional |
| `parameters` | JSON Schema object \| null | Function arguments schema |
| `strict` | `boolean \| null` | **Supported on Live delegation** — enforce parameter schema |

### Live `WebSearch`

| Field | Type |
|-------|------|
| `type` | `'web_search'` |

## NOT supported on Live delegation (vs normal Responses API)

- `text.format` / `json_schema` Structured Outputs on `sessions.accept` — **server rejected** in production.
- Do not assume other `responses.create()` fields (e.g. `response_format`, `store`, `metadata`) apply to Live delegation without SDK + server proof.

## Structured output mechanisms investigated

| Mechanism | Live `sessions.accept` | Notes |
|-----------|------------------------|--------|
| `text.format` | **No** | Production 400 `unknown_parameter`. |
| `response_format` | Not on `ResponsesDelegationConfig` | |
| `json_schema` (top-level) | Not on config | |
| `structured_outputs` | Not in SDK type | |
| **Strict `FunctionTool`** | **Yes (SDK)** | `strict: true` + `parameters` JSON Schema |
| `session.update` delegation | `ResponsesDelegationUpdateConfig` | Same tool/text shape; still no `text.format` in SDK |

## Voice V3 production transport (chosen)

**Primary (A):** `emit_caller_meaning` strict function tool on `delegation.responses.tools`, arguments = dynamic `CallerMeaning` Zod → JSON Schema (per-agent key enum).

**Fallback (B):** `output_text` JSON only when `VOICE_V3_INTAKE_TRANSPORT=output_text` — still validated with `buildCallerMeaningZodSchema().safeParse` after transport `JSON.parse`.

Delegated output arrives as nested Live `response.event` → `response.completed` with `output[]` items of type `function_call` (`arguments` string per Responses API), and/or `response.output_item.done` with `item.type === "function_call"`.

## Runtime logs (PSTN smoke checklist)

| Log | When |
|-----|------|
| `OPENAI_LIVE_INCOMING` | SIP webhook received |
| `VOICE_V3_LIVE_ACCEPT_PAYLOAD_VALIDATED` | Accept payload built (no `text.format`) |
| `VOICE_V3_LIVE_ACCEPTED` | `live.sessions.accept` succeeded |
| `VOICE_V3_SIDEBAND_CONNECTED` | Sideband first event |
| `ASTRA_DELEGATION_STARTED` | `session.delegation.created` |
| `ASTRA_MEANING_RECEIVED` | Valid transport payload extracted |
| `ASTRA_MEANING_SCHEMA_VALID` | App Zod validation passed |
| `CALLER_MEANING_APPLIED` | State mutation |
| `RULES_EVALUATED` | Deterministic rules after apply |

Malformed meaning: `ASTRA_MEANING_SCHEMA_INVALID` or `ASTRA_MEANING_FAILED` — **no** `CALLER_MEANING_APPLIED`.

## References

- OpenAI Live delegation guide (nested `response.event`, sideband): https://developers.openai.com/api/docs/guides/live-delegation
- Installed types: `node_modules/openai/resources/live/live.d.ts` (`ResponsesDelegationConfig`, `FunctionTool`)
