# Voice V3 — OpenAI-native first architecture

**Status:** governing rule for all Voice V3 milestones after Basic PSTN + greeting + prompt freeze.  
**SDK pin:** `openai@^7.17.0` (inspect `node_modules/openai/resources/live/live.d.ts` when types lag docs).

## Principle

For every proposed subsystem, answer first:

**Does OpenAI already provide this capability natively?**

| Answer | Action |
|--------|--------|
| **Yes** | Use OpenAI’s built-in mechanism. Do **not** build a parallel homemade version. |
| **No** | Build the smallest deterministic application layer. |

If uncertain, inspect in order:

1. Current official OpenAI docs (GPT-Live-1, Live delegation, GPT-6 Astra / Responses).
2. Installed SDK types (`openai/resources/live`, `openai/resources/responses`).
3. Live / Astra API reference for the exact event or config shape.
4. Only then decide to implement ourselves.

Do not guess.

## Use OpenAI natively (do not duplicate)

| Capability | OpenAI mechanism | Repo touchpoints |
|------------|------------------|------------------|
| Full-duplex speech + barge-in | **GPT-Live-1** Live session | `src/lib/voice-v3-basic/live-session-config.ts`, SIP accept |
| Backend reasoning + tools | **Responses delegation** on Live (`delegation.type: responses`, `gpt-6-astra`) | Same; sideband observes `session.delegation.created`, `response.event` |
| Backend tools / function calling | Responses **function tools** on delegated backend | Add tools to `delegation.responses.tools` — not a second tool router |
| Async tool calling (when appropriate) | Astra / Responses async tool flow; **app still executes tools** | Executor owns pending work + correlation |
| Silent backend / planner context | `session.thinking.append` | Sideband `send`; see `live.d.ts` `ThinkingAppendEvent` |
| Caller-communicable progress | `session.commentary.append` | `src/lib/voice-v3/greeting.ts` (greeting); V2 reference: `live-tool-wait-commentary.ts` |
| Update backend while call is active | `session.update` — **delegation settings only**; type cannot change | `SessionUpdateConfig` in `live.d.ts` |
| Structured semantic extraction | **Astra Structured Outputs** (`json_schema` on Responses) | `intake/delegation-config.ts` + sideband merge → `VoiceV3CallContext` |
| Mid-turn steering | Live / delegated Responses steering (per current API) | Prefer API over custom turn detectors |

### SDK anchors (verified in-repo)

- `session.commentary.append` / `session.thinking.append` — `node_modules/openai/resources/live/live.d.ts`
- `session.update` — “Only delegation backend settings can be updated” — same file, `SessionUpdateConfig`
- `ResponsesDelegationConfig` — model, instructions, tools, `parallel_tool_calls`, reasoning, text verbosity

**Note:** If official docs expose Structured Output `text.format` on delegated Responses but SDK `ResponsesDelegationConfig.Text` is narrower, treat docs + live API as authority and extend our accept payload; do not invent a second extraction pipeline.

## Application-owned truth (we build this)

OpenAI does **not** know our business truth. We own:

| Concern | Owner |
|---------|--------|
| Per-customer intake schema / required fields | Business config + `VoiceV3BusinessConfig` |
| Durable per-call state | `VoiceV3CallContext` |
| Required-field presence, corrections, readiness | Deterministic rules (`src/lib/voice-v3/rules/`) |
| Date/time normalization | App (timezone from config; Guide #10) |
| Canonical offer / slot ownership | App + booking executor |
| Stale availability / stale tool results | Generation counters + invalidation in CallContext |
| Idempotency (book, hold, dispatch) | App executors |
| Tenant isolation (workspace, call ownership) | App auth + persistence |
| External system truth (Microsoft, Calendly, etc.) | Tool executors + reconciliation |

## Target pipeline (intake milestone)

Preferred path:

```
Caller speech
  → GPT-Live-1 (conversation)
  → delegated GPT-6 Astra (reasoning)
  → Structured Output (typed intake delta)
  → mergeIntakeExtractionIntoCallContext (deterministic)
  → session.thinking.append (optional: compact state snapshot for backend)
  → Live speaks from frontend + delegation (no homemade “semantic interpreter”)
```

**Avoid:**

```
Caller speech → homemade transcript interpreter → custom parser → parallel semantic layer → state
```

## Smallest custom layer

```
VoiceV3CallContext
  + VoiceV3BusinessConfig (intake schema, timezone, booking mode, …)
  + deterministic rules (readiness, merge, stale guards, normalization)
```

No giant state machine replacing Live/Astra conversation. Rules **gate** tools and **merge** extractions; they do not replace duplex audio or delegation.

## Explicit non-goals

- Rebuilding V2 VAD / “complete turn” heuristics on Live transcript deltas
- Telnyx TeXML / `<Say>` greeting on V3 Basic (GPT-Live owns opening speech)
- Duplicate MCTB or Voice V2 booking engines under `voice-v3` without audit
- Telemetry or intake merge on the critical path for `sessions.accept` or first audio

## Pre-implementation checklist (every PR)

- [ ] Listed each new module in the table above (native vs app-owned).
- [ ] No second tool runtime, parser, or delegation loop.
- [ ] CallContext mutations go through deterministic merge helpers (tested).
- [ ] Tool results carry `toolGeneration` / `delegationId` where stale discard applies.
- [ ] Prompts stay in `src/lib/voice-v3/prompts/` (not inline in webhooks).
- [ ] Voice V3 Basic PSTN path unchanged unless PR says otherwise and re-cert is planned.

## Related docs

- `docs/voice-v3/NEW_NUMBER_PROVISIONING.md` — frozen Telnyx / SIP reference line
- `src/lib/voice-v3/state/` — one `VoiceV3CallRuntime` + authoritative `VoiceV3CallContext`
- `src/lib/voice-v3/config/` — dynamic `VoiceV3AgentConfig` (test agent uses odd fields)
- `src/lib/voice-v3/intake/` — `voice_v3_caller_meaning` Structured Output + apply (no save_* tools)

## Intake pipeline (implemented)

- Accept: `delegation.responses.text.format` = `zodTextFormat(buildCallerMeaningZodSchema(agentConfig), "voice_v3_caller_meaning")` (`json_schema`, per-config key enum).
- Webhook: `createVoiceV3CallRuntime` before `sessions.accept` (`VOICE_V3_INTAKE_ENABLED=0` to disable).
- Sideband: async `handleDelegatedAstraResponseEvent` → `runtime.applyEvent(CALLER_MEANING_APPLIED)` → `session.thinking.append` (`delegation_id: null`).
- Tests: `npm run test:voice-v3-intake` (deterministic + optional live Astra via `OPENAI_API_KEY`).

## Next milestone

**Booking tools:** gate `find_availability` / `book` on `getVoiceV3IntakeReadiness` + stale guards; executors own Microsoft/Calendly truth — still no homemade conversation stack.
