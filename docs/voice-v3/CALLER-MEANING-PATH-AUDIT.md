# Voice V3 caller-meaning path — audit (read-only)

**Scope:** How GPT-6 Astra structured output becomes `VoiceV3CallContext` today.  
**SDK:** `openai@^7.17.0`  
**Audit date:** 2026-09-18 (pre date/time normalization work)

---

## Executive summary

There are **two paths**:

| Path | Who calls Astra | How we read the result |
|------|------------------|-------------------------|
| **Production (PSTN / Live)** | **OpenAI** via Live `delegation.responses` on `sessions.accept` — **no** `client.responses.create` / `responses.parse` in app code | Sideband `response.event` → **`output_text` string** → **`JSON.parse`** → **Zod** (`safeParseCallerMeaning`) |
| **Integration test only** | `client.responses.parse({ model: "gpt-6-astra", text: { format: zodTextFormat(...) } })` | Uses **`response.output_text`** + **`parseCallerMeaningFromOutputText`** (again **`JSON.parse`**) — **does not use `response.output_parsed`** |

**Layer 1 (OpenAI):** `json_schema` on accept via `zodTextFormat(callerMeaningZodSchema, "voice_v3_caller_meaning")` on `delegation.responses.text.format`.  
**Layer 2 (app):** Zod on parsed JSON; intake keys filtered with `isConfiguredKey` against `AgentConfig.intakeFields[].key`.  
**Gap vs preferred design:** `key` is **`z.string()`**, not a per-config **`enum`** — unknown keys can pass Zod but are **dropped** at merge (silently). Production path does **not** use SDK `output_parsed` even where `responses.parse` is available in tests.

---

## Answers to the 10 audit questions

### 1. Where is the GPT-6 Astra request created?

**Production:** The app does **not** create a standalone Responses request. It configures Astra on **Live session accept**:

- File: `src/lib/voice-v3-basic/live-session-config.ts` — `buildBasicLiveSession()` sets `delegation.type: "responses"` and `delegation.responses: buildVoiceV3AstraDelegationResponses(...)`.
- File: `src/lib/voice-v3-basic/openai-live-webhook.ts` — `await client.live.sessions.accept(sessionId, buildBasicLiveSessionAcceptParams())`.

OpenAI runs **GPT-Live-1** and, on delegation, **GPT-6 Astra** on the Responses backend configured in that payload.

**Tests (integration only):**

- File: `scripts/test-voice-v3-astra-meaning-integration.ts` — `client.responses.parse({ model: "gpt-6-astra", text: { format: voiceV3CallerMeaningTextFormat() } })`.

---

### 2. What exact OpenAI SDK method is used?

| Context | Method |
|---------|--------|
| Production voice | `client.live.sessions.accept(sessionId, { session: … })` only |
| Integration test | `client.responses.parse(...)` |
| Production | **No** `responses.create`, **no** `responses.parse` |

---

### 3. What exact `text.format` / Structured Outputs schema is supplied?

- File: `src/lib/voice-v3/intake/delegation-config.ts` — `buildVoiceV3AstraDelegationResponses()`
- **Wire field:** `session.delegation.responses.text.format`
- **Helper:** `zodTextFormat` from `openai/helpers/zod`
- **Name:** `voice_v3_caller_meaning` (`CALLER_MEANING_STRUCTURED_OUTPUT_NAME`)
- **Zod schema:** `src/lib/voice-v3/intake/caller-meaning-schema.ts` — `callerMeaningZodSchema`

`zodTextFormat` generates **`type: 'json_schema'`, `strict: true`** (per SDK `node_modules/openai/src/helpers/zod.ts`).

---

### 4. Does OpenAI enforce the schema before the result reaches our code?

**On the delegated Astra Responses backend (production):** Yes — Structured Outputs / `json_schema` on `text.format` constrains generation.

**In our repo:** We do **not** receive a pre-parsed SDK object on the Live sideband path. We only see nested streaming/completion events and treat the payload as **text** (`output_text`), then validate again with Zod.

**Caveat:** With Live delegation we are **not** using `responses.parse`'s `output_parsed` pipeline on the production path; enforcement is API-side at generation + our Zod pass after `JSON.parse`.

---

### 5. What exact property does our code read?

**Production (sideband):** `src/lib/voice-v3/intake/parse-astra-meaning-response.ts`

- On `response.completed`: `collectOutputTextFromResponse(response)` — prefers `response.output_text`, else walks `output[]` message `output_text` parts.
- On `response.output_text.done`: `nestedEvent.text`.

**Not used in `src/lib/voice-v3`:** `response.output_parsed`, `content.parsed`.

**Integration test:** `scripts/test-voice-v3-astra-meaning-integration.ts` uses `response.output_text` then `parseCallerMeaningFromOutputText(text)` — **not** `output_parsed`.

---

### 6. Are we calling `JSON.parse()` anywhere?

**Yes** — only in `src/lib/voice-v3/intake/parse-astra-meaning-response.ts`:

- `extractCallerMeaningFromAstraResponseEvent` — `JSON.parse(text)` then `safeParseCallerMeaning(raw)`
- `parseCallerMeaningFromOutputText` — `JSON.parse(text)` then `parseCallerMeaning(raw)`

This is **not** parsing free-form model prose for semantics; it is parsing the **JSON text blob** that Structured Outputs is meant to produce, then **Zod-validating**. It is still **`JSON.parse` on a string**, not SDK `output_parsed`.

---

### 7. Regex, splitting, key guessing, manual extraction?

**Under `src/lib/voice-v3`:** No regex, no `match`, no label-based extraction for intake.

Deterministic unit tests build `CallerMeaning` objects directly (`scripts/test-voice-v3-intake.ts`) — no Astra.

---

### 8. Field identity: stable keys vs labels?

**Config** uses stable **`key`** (e.g. `mothers_name`, `favorite_dinosaur`) in `src/lib/voice-v3/config/test-agent-config.ts`.

**Merge** matches **`captured_fields[].key`** to **`config.intakeFields[].key`** only in `src/lib/voice-v3/intake/apply-caller-meaning.ts` (`isConfiguredKey`). Labels are **not** used for identity.

---

### 9. Failure behavior

| Case | Behavior |
|------|----------|
| **Unknown field key** | `isConfiguredKey` → **`continue`** (silent skip). No `logUnknownField`. |
| **Duplicate key in one payload** | Later array entry **overwrites** earlier in same `applyCallerMeaningToContext` loop. |
| **Missing required schema property** | `safeParseCallerMeaning` fails → `null` → no `applyEvent` → `ASTRA_MEANING_FAILED` (`schema_validation_or_empty`) on `response.completed`. |
| **Invalid enum** (e.g. `active_goal`) | Zod fails → no state mutation. |
| **Null where Zod disallows** | Zod fails → no mutation. (Scheduling fields are **nullable** by design.) |
| **Malformed JSON** | `JSON.parse` throws → caught → `null` → no mutation. |
| **Valid schema but “empty” meaning** | `meaningHasSignal` false → `null` → no mutation. |

Handler: `src/lib/voice-v3/intake/handle-delegated-meaning.ts`

---

### 10. What function mutates `CallContext`?

1. `handleDelegatedAstraResponseEvent` → `runtime.applyEvent({ type: "CALLER_MEANING_APPLIED", meaning })`
2. `VoiceV3CallRuntime.applyEvent` (`src/lib/voice-v3/state/call-runtime.ts`) → `applyCallerMeaningToContext`
3. `applyCallerMeaningToContext` (`src/lib/voice-v3/intake/apply-caller-meaning.ts`) returns new context; `this.context = applied.context`

There is **no** per-field `FIELD_CAPTURED` event type today — one blob **`CALLER_MEANING_APPLIED`** with full **`CallerMeaning`**.

---

## End-to-end code path (production)

```
Telnyx SIP
  → openai-live-webhook: client.live.sessions.accept(..., delegation.responses + text.format json_schema)
  → OpenAI: GPT-Live-1 delegates → GPT-6 Astra (Responses, structured)
  → live-sideband-session: sideband.on("event") type === "response.event"
  → handle-delegated-meaning.ts: queueMicrotask (non-blocking)
  → parse-astra-meaning-response.ts:
        output_text / nested.text
        → JSON.parse
        → safeParseCallerMeaning (Zod)
  → call-runtime.ts: applyEvent(CALLER_MEANING_APPLIED)
  → apply-caller-meaning.ts: filter keys by AgentConfig; merge
  → evaluateVoiceV3Rules (call-rules.ts)
  → session.thinking.append (delegation_id: null)
```

**Files in order:**

1. `src/lib/voice-v3-basic/openai-live-webhook.ts` — accept + `createVoiceV3CallRuntime`
2. `src/lib/voice-v3-basic/live-session-config.ts` — delegation config
3. `src/lib/voice-v3/intake/delegation-config.ts` — `text.format`
4. `src/lib/voice-v3/live-sideband-session.ts` — `response.event`
5. `src/lib/voice-v3/intake/handle-delegated-meaning.ts`
6. `src/lib/voice-v3/intake/parse-astra-meaning-response.ts`
7. `src/lib/voice-v3/intake/caller-meaning-schema.ts` — Zod
8. `src/lib/voice-v3/state/call-runtime.ts` — `applyEvent`
9. `src/lib/voice-v3/intake/apply-caller-meaning.ts`
10. `src/lib/voice-v3/state/call-rules.ts` — `evaluateVoiceV3Rules`

---

## Target architecture (desired)

```
Astra
  → OpenAI Structured Outputs / JSON Schema
  → typed CallerMeaning object
  → validate allowed field keys against current AgentConfig
  → runtime.applyEvent(...)
  → CallContext
```

**Not:**

```
Astra → free-form text → JSON.parse() → regex → "maybe this means email" → state
```

**Preferred two layers:**

1. **OpenAI Structured Outputs** — overall shape (`captured_fields[]`, `key`, `value`, `confidence`, `corrections[]`, …).
2. **Application** — validate dynamic `key` against `config.intakeFields` (ideally **`key` enum generated per AgentConfig** in JSON Schema).

Example app validation:

```typescript
const allowedKeys = new Set(config.intakeFields.map((f) => f.key));
for (const field of meaning.captured_fields) {
  if (!allowedKeys.has(field.key)) {
    logUnknownField(field.key);
    continue;
  }
  // merge...
}
```

Ideal schema generation:

```json
"key": {
  "type": "string",
  "enum": ["name", "email", "mothers_name", "favorite_dinosaur"]
}
```

---

## Invariant checklist (current state)

| Invariant | Status |
|-----------|--------|
| No free-form semantic parsing | **Mostly yes** — structured JSON + Zod |
| No regex extraction | **Yes** in voice-v3 intake |
| No label-based field identity | **Yes** — keys only |
| No guessed keys in state | **Yes** — unknown keys skipped |
| Unknown keys entering CallContext | **Blocked** (silent skip) |
| No state mutation from schema-invalid output | **Yes** |
| `responses.parse` = SDK typed parse | **Partial** — tests only; still uses `output_text` + `JSON.parse`, not `output_parsed` |
| Production = Structured Outputs → typed object | **Partial** — API enforces shape; app uses `JSON.parse` + Zod |
| Per-config `key` enum in JSON Schema | **No** — `key: z.string()` only |

---

## Gaps before date/time work (recommendations — not implemented in this audit)

1. **Production / Live path:** Prefer SDK-parse if Live exposes `output_parsed` on nested events; otherwise keep `JSON.parse` + Zod but document that text is schema-constrained, not prose.
2. **Integration test:** Use **`response.output_parsed`** from `responses.parse` instead of re-parsing `output_text`.
3. **Dynamic enum:** Generate `key` enum from `AgentConfig.intakeFields` in per-config `zodTextFormat` schema.
4. **Observability:** Log rejected unknown keys (today silent `continue`).
5. **Optional:** Finer events (`FIELD_CAPTURED`) — today one `CALLER_MEANING_APPLIED` per completion.

---

## Verdict

`responses.parse` appears **only in the integration test**; production relies on **Live delegation + `output_text` + `JSON.parse` + Zod**. That is **not** brittle prose parsing, but it is **not** the ideal “SDK `output_parsed` only” path either. **Per-config key enums** are not implemented yet; app-side key filter is the second layer.

Safe to proceed on date/time **if** you accept tightening parse/enum/logging as a small follow-up; otherwise fix those first.
