# Voice V3 — OpenAI Live protocol (installed SDK)

**Installed package:** `openai@^7.17.0` (see `package.json`)

**Authority:** Official OpenAI Live TypeScript types in `node_modules/openai/resources/live/live.d.ts` plus current Live delegation docs. If this document conflicts with installed types, **types win**.

## Live session ingress (SIP)

- Webhook: `live.transport.incoming` — preserve opaque session id.
- Accept: `client.live.sessions.accept(sessionId, { session: { model, type: "live", ... } })`.
- SIP negotiates media; do not set `audio.format` for SIP unless docs change.

## Transcript events (fragments only)

- `session.input_transcript.delta` — caller fragment; **no** transcript-done event in SDK.
- `session.output_transcript.delta` — assistant fragment.
- Application must accumulate fragments in order; fragments do not define completed semantic turns.

## Delegated Responses envelope

```text
type: "response.event"
delegation_id?: string | null
event: { type: "response.<nested>", ... }
```

Route on `envelope.event.type`. Retain outer `delegation_id` for correlation.

## Authoritative function call completion

**Do not** treat `response.function_call_arguments.done` as completed call identity.

Completed tool call:

```text
nested.type === "response.output_item.done"
nested.item.type === "function_call"
→ call_id, name, arguments (authoritative)
```

## Tool output → continuation (mandatory order)

For each completed function call:

1. `response.item.create` with `item.type: "function_call_output"`, **same** `call_id`, JSON `output` string.
2. Do **not** attach `delegation_id` on `response.item.create` (SDK: optional/null only on other events).
3. After **all** pending function outputs for that delegated response are submitted:
4. `response.create` with `event_id` only — **no** `delegation_id`, model, or Responses body on continuation.

Invariant: `pendingToolOutputCount > 0` ⇒ continuation `response.create` is forbidden.

## Live context primitives

| Event | Purpose |
|--------|---------|
| `session.thinking.append` | Silent authoritative context (snapshot, recovery, ops) |
| `session.commentary.append` | Information Live should communicate (paraphrased aloud) |
| `session.instructions.append` | Behavioral policy changes (sparse) |

Ack events (`*.appended`) confirm incorporation timing — **not** proof of exact audio playback.

## `response.create`

Requests or continues a delegated Responses backend response. Must be centrally gated (see `live-response-coordinator.ts`).

## SIP transfer (when needed)

`client.live.sessions.refer(sessionID, { target_uri })` per installed SDK.

## Fields we intentionally do not send on continuation

- `delegation_id` on `response.create`
- Full Responses request body on Live continuation
- Guessed / undocumented nested fields

## Voice V3 mapping

| Concern | Module |
|---------|--------|
| Protocol + pending tool outputs | `src/lib/voice-v3/delegation/live-response-coordinator.ts` |
| Transcript accumulation | `src/lib/voice-v3/conversation/transcript-accumulator.ts` |
| Caller turn commits + semantic watchdog | `src/lib/voice-v3/conversation/caller-turn-manager.ts` |
| Delegated meaning | `src/lib/voice-v3/intake/handle-delegated-meaning.ts` |
| Planner → Live speak | `src/lib/voice-v3/agent/live-speak-sync.ts` |
