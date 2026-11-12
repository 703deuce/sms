# Voice V3 callback — complete copy bundle

Single file for copy/paste: PSTN cert summary, forensic report (A–F), and tool/prompt/code reference.

**Generated:** 2026-09-19  
**Cert agent:** `cmshz2lc25c622c4i58303501` (ws_1)  
**Deploy SHA:** `2ec99bd64c8f73905b1a648eb7d60d910702d87a`  
**JSON contract dump:** `/opt/cursor/artifacts/voice-v3-callback-effective-contract-ws1.json`  
**Regenerate JSON:** `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/dump-voice-v3-callback-effective-contract.ts`

---

# Part 0 — PSTN cert summary

# Voice V3 callback PSTN cert — production forensics (2026-09-19)

**Deploy SHA:** `2ec99bd64c8f73905b1a648eb7d60d910702d87a`  
**Container:** `ds8s3hjin60qs6g7s0iqkixs-200028308882`  
**Line:** +1 571-749-1060 · **Agent:** `cmshz2lc25c622c4i58303501` · **Strategy:** MICROSOFT_365

---

## Call 1 — Cert A (straight callback)

| Field | Value |
|--------|--------|
| PSTN call-control ID | `v3:Nrnh_pvGJF2NSmWUP9npFpe1DRDenCBbthIqVZiB_ZyaDTgAj2Ofow` |
| Live session | `live_u7_EPwD9p3oMraqyUYEaPwGLyXEP0F0F6Jx` |
| Started (UTC) | ~`2026-09-19T20:44:32` |
| Duration | **73.9 s** (`total_call_duration_ms: 73920`) |
| Median turn latency | **1.76 s** (max 1.76 s; only one measured delegation) |
| Delegations | **1** |
| Astra function tools | **0** (`meaning_received: 0`, no `ASTRA_FUNCTION_CALL_RECEIVED` on this session) |
| `request_callback` | **None** |
| Callback persistence | **None** (`VOICE_V3_CALLBACK_REQUEST_PERSISTED` count in 90m window: **1**, on Call 2 only) |

### Cert A verdict: **FAIL**

**First failing boundary:** P2 — no authoritative `request_callback` execution (same class as pre-fix Call 1: conversational path only; backend never recorded a callback).

---

## Call 2 — Cert B (booking → callback switch)

| Field | Value |
|--------|--------|
| PSTN call-control ID | `v3:hV1BO4y66uUnxUwAw00T6Oq9wVgXmbuOZ01S5arpj8M1LnFgTWolwQ` |
| Live session | `live_u7_EPwERp3oMMiXvchUo0gQhuTaBmnkikzz` |
| Started (UTC) | ~`2026-09-19T20:45:52` |
| Duration | **157.7 s** (`total_call_duration_ms: 157670`) |
| Median / max turn latency | **1.85 s** / **8.18 s** |
| Delegations | **10** |
| Callback row ID | `cmu8uzrr31054452l0z121n14` |

### Chronological tool sequence (authoritative logs)

| Time (UTC) | Tool / event |
|------------|----------------|
| 20:46:34 | `set_scheduling_preference` |
| 20:46:38 | `find_availability` (async success) |
| 20:46:54 | `set_scheduling_preference` |
| 20:46:55 | `find_availability` (async success) |
| 20:47:16 | `update_intake` → **name** (objective still `book_appointment`; missing: phone, email, service_reason, mother_s_name) |
| 20:47:30 | `update_intake` → **phone** (still `book_appointment`; missing: email, service_reason, mother_s_name) |
| 20:47:44 | Caller turn 12 committed (64 chars — switch utterance window) |
| 20:47:46 | `request_callback` → VALIDATED → STARTED → **PERSISTED** → TOOL_SUCCEEDED (`callback_requested`, **347 ms**) |
| 20:48:29 | Hangup |

**After last booking-phase intake (20:47:30):** no further `update_intake` for **email** or **mother_s_name**. No `book_appointment`, no `SEND_BOOKING_LINK` in logs.

### Persistence evidence

```
VOICE_V3_CALLBACK_REQUEST_PERSISTED {
  callId: 'v3:hV1BO4y66uUnxUwAw00T6Oq9wVgXmbuOZ01S5arpj8M1LnFgTWolwQ',
  workspaceId: 'ws_1',
  agentId: 'cmshz2lc25c622c4i58303501',
  callbackRequestId: 'cmu8uzrr31054452l0z121n14'
}
```

P0 fix confirmed in production (compat `callbackRequest` path).

### Cert B verdict: **PARTIAL / conditional FAIL on strict switch semantics**

| Criterion | Result |
|-----------|--------|
| P0 persistence, single row, tool success | **PASS** |
| No booking / no SEND_LINK SMS | **PASS** (no booking/SMS tools in log) |
| No booking-only `update_intake` after phone capture | **PASS** (no email/mother_s_name updates) |
| Scheduling only before switch (~20:46:55 last find; switch ~20:47:44) | **PASS** |
| Objective flips to callback **immediately** on semantic switch (thinking shows `request_callback` before tool) | **FAIL / not proven** — last thinking append before callback still **Active operation: book_appointment** (20:47:30); `REQUEST_CALLBACK` goal tied to **request_callback** execution (~20:47:46) |

For product freeze: **treat Cert B as operational PASS on persistence + no obsolete intake fields**, but **not full PASS** on “immediate objective retarget” until `dialog.activeGoal` / intake thinking reflects `request_callback` when Astra recognizes the switch (without keyword routing).

---

## STOP — do not broad-fix automatically

Per instructions: **Cert A failed** → stop. Next work should target **first boundary: straight-callback path still not invoking `request_callback`** (P2 / delegation surface on short callback-only calls), not Microsoft/SEND_LINK.

Callback is **not FROZEN**.


---

# Part 1 — Forensic report (A–F)


# Voice V3 callback — forensic report (A–F)

**Scope:** PSTN cert on deploy `2ec99bd64c8f73905b1a648eb7d60d910702d87a` · Agent `cmshz2lc25c622c4i58303501` · ws_1 · MICROSOFT_365  
**Evidence:** `/tmp/prod-voice-90m.log`, `voice-v3-callback-pstn-cert-2026-09-19-report.md`, compiled contract dump `voice-v3-callback-effective-contract-ws1.json` (repo @ same commit family + published wizard `c16da5ee5cd783f1`)  
**No code changes applied** (audit only).

---

## Executive summary

Both failures are symptoms of **one incomplete callback contract**, not two unrelated bugs.

| Symptom | Call A (straight callback) | Call B (booking → callback) |
|--------|---------------------------|------------------------------|
| `request_callback` | Never invoked | Invoked ~2s after switch delegation; persisted |
| Root divergence | Astra ended delegation with **`message` only**; runtime **discards** that output; **no second delegation** | Prior `update_intake` filled **name + phone**; switch delegation led to tool call |
| Shared gap | **`activeGoal` / intake objective stay on `book_appointment`** until `request_callback` runs; Amy/Astra **static instructions never mention “callback”**; Amy **delegation policy omits callback** |

P0 persistence (Call B) is **not** the problem anymore. The problem is **getting to a successful `request_callback` reliably** and **aligning operation context when intent changes**.

---

## C. Effective callback contract (what Amy and Astra actually see)

Reconstructed from **production log fingerprints** + **compiler output** for the cert agent (not source intent alone).

### Production contract versions (both calls, session accept)

| Field | Value |
|--------|--------|
| `live_prompt_version` | `voice-v3-live-v2` |
| `astra_prompt_version` | `voice-v3-astra-v2` |
| `tool_contract_version` | `1df5e2c6553b4af8` |
| `agent_config_version` | `3a8fc8bcb0e88af2` (log) / wizard `c16da5ee5cd783f1` (published) |
| `astra_instructions_hash` | `9494859c1a5bf893` |
| `live_instructions_hash` | `bad335ec59a20f93` |
| Astra context size | **8903 chars** (both calls) |
| Amy sections | **25** |
| Astra tools on accept | **10** — includes `request_callback` |

### Configured callback requirements (authoritative)

From published wizard + `operationRequirements`:

```json
"request_callback": ["name", "phone", "service_reason"]
```

Booking requirements (for contrast):

```json
"book_appointment": ["name", "phone", "email", "service_reason", "mother_s_name"]
```

`callHandling`: `callbackRequestsEnabled: true`, `callbackUseAniByDefault: true`.

### 1–5. Amy instructions (effective themes)

Full compiled Amy text: **~14,179 chars** (`buildLiveFrontendInstructions` + delegation policy).  
**Word “callback” does not appear anywhere in Amy’s compiled instructions** (`amy_contains_callback_word: false`).

| # | Area | Effective content |
|---|------|-------------------|
| 1 | System/developer | Role: live receptionist; backend handles tools; **TRUTH AND CONFIRMATION** — never claim external actions succeeded without backend |
| 2 | Callback-specific | **Absent** |
| 3 | Intake | Delegate when caller provides facts to store; no callback-specific intake rules |
| 4 | Operation/objective | **Absent** — no mention of callback as an operation |
| 5 | Delegation | `buildLiveDelegationPolicySection`: lists booking, find/reschedule/cancel, transfer, intake — **no “request callback” / “arrange callback”**; delegate when “external action” needed but **no line for callback** |

Amy capability summary mentions booking/reschedule/cancel/transfer/messages — **not callback**.

### 6–9. Astra instructions (effective themes)

Full compiled Astra text: **8903 chars**.  
**Word “callback” does not appear in the instruction body** (`astra_contains_callback_word: false`). Callback semantics exist **only** on the `request_callback` tool description.

| # | Area | Effective content |
|---|------|-------------------|
| 6 | Core | Use tools for authoritative work; don’t fabricate success; **“Do not call a tool when no tool is required”** for greetings/small talk |
| 7 | Callback-specific | **Only via tool description** (see below) — not in core/cross-tool/intake sections |
| 8 | Operation switch | `buildIntakeObjectiveContext` rules say: *“When the caller changes intent (e.g. booking to callback), stop requiring fields that belong only to the previous operation”* — but this block is **only pushed after `update_intake`**, not at call start |
| 9 | Completion | Per-tool description for `request_callback`; cross-tool list has paths 2–4 for booking/reschedule/cancel — **no “callback path”** |

### 10–12. `request_callback` tool (production)

**Description (exact, from compiler):** see `voice-v3-callback-effective-contract-ws1.json` → `request_callback_tool.description`.  
Covers: when to use (including switch from booking), reuse facts, ANI for phone, completion only after `callback_requested`, `needs_information` retry semantics, don’t claim success early.

**JSON schema (Astra receives):**

| Property | Type | Required in strict schema | Who supplies |
|----------|------|---------------------------|--------------|
| `callback_phone` | string \| null | yes (nullable) | Astra when different from ANI; else null → runtime uses ANI/captured phone |
| `reason` | string \| null | yes (nullable) | Astra when not in shared facts |
| `preferred_time` | string \| null | yes (nullable) | Optional caller preference |
| `notes` | string \| null | yes (nullable) | Optional |

Runtime derives: workspace, agent, call IDs, idempotency, persistence — **not** in schema (correct).

**`operationRequirements.request_callback`:** `["name","phone","service_reason"]` — **not copied into Astra instruction body**; enforced in `executeRequestCallback` → `needs_information` + `missingFields`.

### 13–16. Runtime context at call start (before any tools)

**Intake objective thinking** (would be shown after first intake update; at call start if computed):

- `Active operation: book_appointment` (because `dialog.activeGoal` is `UNKNOWN` → `resolveActiveIntakeOperation` defaults to booking)
- Missing: name, phone, email, service_reason, mother_s_name

**`buildAstraBusinessContext.missing_required_information`:** same booking list — **not callback-scoped**.

**Collected facts at Call A delegation:** none persisted (`update_intake` never ran).

**Collected facts at Call B switch delegation:** name + phone in intake; email/mother_s_name still missing **for booking** but not collected after switch.

**Tools visible to Astra:** all 10 on every delegation (including `request_callback`).

**`meaning_received: 0` on both calls:** legacy `CallerMeaning` / `active_goal` merge path is **not** used in production (`function_tool` transport). Goal changes only via **tool side effects** (e.g. `mergeDialogActiveGoalFromTool` on `request_callback`).

---

## Side-by-side: Call A vs Call B (first meaningful divergence)

| Dimension | Call A — `live_u7_EPwD9p3o…` / delegation `item_EPwDFfAf5IRBDlni7r81p` | Call B — switch delegation `item_EPwGGRTaqaqOQwB9gAET0` |
|-----------|------------------------------------------------------------------------|----------------------------------------------------------|
| **When** | `2026-09-19T20:44:38Z` (~1s after greeting) | `2026-09-19T20:47:44Z` (~2s after switch utterance) |
| **Delegations total** | **1** | **10** (switch is ~9th) |
| **Caller utterance (logs)** | Transcript text **not** logged; cert intent = straight callback | Turn ~64 chars at ~20:47:44 (switch) |
| **Amy context** | Same static 14k instructions; **no callback delegation trigger** | Same; plus long booking conversation history |
| **Active objective** | `book_appointment` (default) | Still `book_appointment` in last thinking append (20:47:30) |
| **Collected facts** | **None** in authoritative intake | **name**, **phone** |
| **Missing (booking lens)** | All booking fields | email, service_reason, mother_s_name |
| **Missing (callback lens)** | name, service_reason (phone = ANI OK) | service_reason only (name+phone present) |
| **Astra instructions** | 8903 chars, no callback body | Identical |
| **Tools** | 10 incl. `request_callback` | Same |
| **Astra output** | `response.output_item.done` **`item_type: message`** | `item_type: function_call`, **`request_callback`** |
| **Function calls** | **0** | **1** → persist OK |
| **Subsequent Amy** | **No further delegation** (~74s call) | Confirms after tool success |
| **First divergence** | Astra chose **conversational message** over tools; runtime **ignored** text (`output_text.done_ignored`) | Enough facts + clear switch utterance → **tool invocation** |

### Call A delegation timeline (authoritative)

1. `session.delegation.created` 20:44:38.014  
2. Astra streams `response.output_text.delta` (many)  
3. `response.output_item.done` **`item_type: message`** 20:44:39.776  
4. **No** `ASTRA_FUNCTION_CALL_RECEIVED`  
5. `ASTRA_DELEGATION_COMPLETED` 20:44:39.996  
6. Call ends 20:45:52 — **no second delegation**

### Call B switch delegation timeline

1. `session.delegation.created` 20:47:44.896  
2. `request_callback` function call 20:47:46.831  
3. `VOICE_V3_CALLBACK_REQUEST_PERSISTED` — row `cmu8uzrr31054452l0z121n14`

---

## Audit: `request_callback` tool contract vs required semantics

| Question | Verdict |
|----------|---------|
| **WHEN** — direct callback, leave message, switch from booking | **In tool description only** — strong wording; **not reinforced** in Astra cross-tool paths or Amy delegation |
| **WHAT** — required fields | Enforced at runtime (`getMissingCallbackRequirementKeys`); **not listed in Astra instructions**; intake projection shows **booking** requirements instead |
| **REUSE** | Tool description + callback-requirements code (ANI, shared facts) — **good** |
| **MISSING facts** | `needs_information` + `missingFields` **exists** in executor — **only if tool is called** |
| **COMPLETION** | Tool description + Amy truth rules — **undermined** when Astra returns message-only and Amy never re-delegates |
| **FAILURE / RETRY loop** | Designed: call → `needs_information` → collect → call again — **no production log** of `needs_information` on these calls (Call B had sufficient facts) |

**Naming:** `request_callback` is clear to engineers; for the model, the **operation lifecycle is split** between a long tool description and **competing `book_appointment` intake objective** text.

---

## Operation-switch contract

**Two competing concepts today:**

1. **Astra semantic choice** (tools + conversation)  
2. **Deterministic `dialog.activeGoal` + `deriveIntakeObjective`** — defaults `UNKNOWN` → **`book_appointment`**

They **disagree until** `request_callback` executes (`activeGoal` set in `execute-request-callback` / tool wrapper).

`buildIntakeObjectiveContext` **documents** switch behavior but is **not** shown to Amy/Astra at switch time unless `update_intake` runs.

**Authoritative for intake missing lists:** `deriveIntakeObjective` → booking fields on Call B until tool call — matches cert observation (thinking still `book_appointment` at 20:47:30).

---

## Investigation: 12 delegation hypotheses (Call A)

| # | Hypothesis | Verdict |
|---|------------|---------|
| 1 | Amy delegated too early | **Possible** — 1 delegation ~1s after greeting; no intake persisted |
| 2 | Astra saw missing info, no collect path | **Partial** — missing name/service_reason for callback; Astra emitted **message**, not `needs_information` loop |
| 3 | Astra returned commentary not function call | **Proven** — `item_type: message` |
| 4 | Amy told to collect but didn’t re-delegate | **Proven** — 1 delegation total; no callback in delegation policy |
| 5 | Tool description doesn’t mandate tool | **Partial** — description is strong; **undercut** by core “no tool for small talk” + booking missing-field signals |
| 6 | Schema implies already satisfied | **Unlikely** — all-null args valid; phone can be ANI |
| 7 | Amy allowed verbal success | **Plausible** — no backend action; conversation continued ~70s |
| 8 | No second Astra pass after collection | **Proven** — no re-delegation |
| 9 | Booking objective overrode callback | **Proven** — default `book_appointment` intake + business `missing_required_information` |
| 10 | `request_callback` gated off | **Eliminated** — on tool list both calls |
| 11 | Callback requirements not in Astra context | **Proven** — not in instructions; business context booking-only |
| 12 | No continuation loop for missing info | **Proven for message-only path** — `output_text.done_ignored`; no structured feedback |

---

## D. Contract gaps (prompt / schema / instructions)

1. **Amy: zero callback vocabulary** — no delegate-when, no capability, no completion rule specific to callback.  
2. **Amy delegation policy** — no bullet for “caller wants a callback / message / follow-up call”.  
3. **Astra instruction body** — no callback workflow step; cross-tool paths 2–4 are booking-only.  
4. **Default operation = `book_appointment`** for `UNKNOWN` goal — poisons intake objective + `missing_required_information` on straight-callback calls.  
5. **Intake objective purpose string** — “service and **schedule** the request” — booking-framed.  
6. **`activeGoal` only flips on tool execution** — too late for switch semantics and Amy thinking.  
7. **No `CallerMeaning` / `active_goal` in production** (`meaning_received: 0`) — documented switch in intake rules never applied via meaning merge.  
8. **Tool description isolated** — model must find callback solely among 10 tools while intake context screams booking.  
9. **Strict schema requires all four keys** with nulls — acceptable but does not teach **which** fields are operationally required (name vs notes).  
10. **Completion coupling** — Amy “don’t claim success” without “must re-delegate until `request_callback` succeeds” for callback intent.

---

## E. Runtime / code gaps (separate from prompt)

1. **Message-only Astra delegations are dropped** — `handle-delegated-meaning.ts` logs `output_text.done_ignored`; no tool, no `needs_information`, no forced continuation.  
2. **No automatic re-delegation** when delegation completes with zero function calls and callback-class intent (no router — but **completion detector** could use “0 tools + open callback” from conversation).  
3. **`buildAstraBusinessContext.missing_required_information`** uses booking-derived intake objective — not operation-aware for callback.  
4. **`resolveActiveIntakeOperation` default** maps `UNKNOWN`/`GENERAL` → `book_appointment` (or send_link) — no neutral “intent not yet chosen” mode.  
5. **Intake thinking append** only on `update_intake` — callback switch without intake update leaves stale booking objective (Call B).  
6. **Telemetry:** `meaning_received: 0` — cannot audit `active_goal` from meaning path on these calls.

**Not gaps (working):** `request_callback` authorization, validation, persistence (Call B), `needs_information` executor, ANI phone resolution, idempotency.

---

## A. Straight callback root cause (Call A)

**Proximate cause:** On the only delegation, **Astra completed with a plain `message` item and zero function calls.** The runtime **intentionally ignores** delegated `output_text`, so **no `request_callback`**, no `update_intake`, and no `needs_information` feedback loop ran.

**Why that outcome is likely (contract, not random model noise):**

- At delegation time, **authoritative state** still presented a **booking** intake gap (five fields), not callback’s three (with ANI for phone).  
- **Amy never re-delegated** after the failed backend pass; callback is **not** in Amy’s delegate-when list.  
- Astra’s global rules say **not to call tools** for conversational responses; without a **callback operation path**, a model can treat “I’ll have someone call you” as sufficient.  
- **Straight callback** never reached the fact density Call B had (name/phone captured via booking intake).

**First failing boundary:** Delegation completes without authoritative tool → conversational success illusion.

---

## B. Booking → callback analysis (Call B)

**Why it worked:** After booking intake, **name and phone** were in shared state; ANI policy satisfied phone; switch utterance triggered a **new delegation** where Astra invoked **`request_callback`** with args (~139 bytes) → validation → **persist**.

**Was the switch semantically authoritative at the right time?** **No.**

- Until `request_callback` ran, **`activeGoal` and intake thinking remained `book_appointment`**.  
- No booking-only `update_intake` after switch (good).  
- **Callback operation was not reflected in Live thinking until tool execution** set `REQUEST_CALLBACK`.  
- So persistence is **correct**, but **operation context lagged** semantic switch by ~2s+ and only aligned because the tool fired.

**Do not treat Call B as “switch path fixed”** — treat it as **“tool fired once facts + utterance aligned”**; fragile if Astra message-only or if caller switches before name/phone collected.

---

## F. Minimal correction proposal (after A–E)

**Goal:** Both scenarios complete **`request_callback` → persist → Amy confirms** without keyword routers, Microsoft/SEND_LINK changes, or resurrecting `CallerMeaning` planners.

### F1. Prompt contract (smallest high-leverage)

1. **Amy `buildLiveDelegationPolicySection`:** Add backend capability + delegate-when bullets for **callback requests** and **re-delegate until backend confirms callback**.  
2. **Amy capability summary:** Mention callback when `callbackRequestsEnabled`.  
3. **Amy completion:** Explicit: *Do not tell the caller a callback is recorded until backend confirms `request_callback` success; if unsure, delegate again.*  
4. **Astra `buildAstraCrossToolInstructions`:** Add **Callback path** step: recognize callback / switch → reuse facts → call `request_callback` → handle `needs_information` → only then complete.  
5. **Astra backend instructions:** Inject **configured `operationRequirements.request_callback`** and **ANI reuse** (from config, not hardcoded fields).  
6. **Intake objective purpose / default operation:** When goal is `UNKNOWN`, do **not** advertise full booking required set as the only missing list; either omit aggressive missing list or show **parallel note**: “If caller wants callback, required: …”

### F2. Runtime (minimal, preserves P0)

1. **On delegation complete with 0 function calls:** If session has callback-class open intent (heuristic: last caller turn semantically about callback — **or** safer: **always** append compact **callback requirements + “invoke request_callback”** to next delegation input when `callbackRequestsEnabled` and no `callbackRequestId` yet) — prefer narrow trigger to avoid booking regression.  
2. **Message-only Astra output:** Optionally treat as **failed backend pass** for continuation (re-open delegation or append thinking to Amy: “backend did not record callback; collect X and delegate”).  
3. **`buildAstraBusinessContext`:** Include `callback_missing_fields` from `getMissingCallbackRequirementKeys` when callback is enabled — **or** switch missing list when last successful tool was booking but transcript indicates switch (defer to Astra tools if avoiding router).  
4. **On semantic switch without `update_intake`:** Push `buildIntakeObjectiveContext` with operation **`request_callback`** when Astra selects `request_callback` **or** when executor returns `needs_information` (already partially there).

**Preserve:** `execute-request-callback`, prisma-compat persistence, Microsoft/SEND_LINK executors frozen.

### F3. What NOT to do

- No keyword intent router.  
- No revival of full `CallerMeaning` JSON planner as primary path.  
- No broad booking/intake rewrites.

### F4. Verification after fix

- Re-run PSTN Cert A + B.  
- Log assertions: Call A must show `ASTRA_FUNCTION_CALL_RECEIVED` + `VOICE_V3_CALLBACK_REQUEST_PERSISTED`; Call B must show intake thinking **`request_callback`** before or at switch delegation, not only after tool.

---

## Artifacts

| File | Purpose |
|------|---------|
| `/opt/cursor/artifacts/voice-v3-callback-effective-contract-ws1.json` | Tool description, schema, requirements, intake at call start |
| `/opt/cursor/artifacts/voice-v3-callback-pstn-cert-2026-09-19-report.md` | PSTN timing summary |
| `/workspace/scripts/dump-voice-v3-callback-effective-contract.ts` | Regenerate contract dump (forensic helper; not a product fix) |

---

**STOP:** No implementation, merge, or deploy in this pass — report only.


---

# Part 2 — Tool, prompts, and code reference


# Voice V3 callback — tool, prompts, and code reference

Copy-friendly reference for how callback works in Voice V3: tool name, wiring, descriptions, schema, executors, and what Amy vs Astra actually see.

**Cert agent:** `cmshz2lc25c622c4i58303501` (ws_1)  
**Related artifact:** `/opt/cursor/artifacts/voice-v3-callback-effective-contract-ws1.json`  
**Regenerate contract dump:** `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/dump-voice-v3-callback-effective-contract.ts`

---

## 1. Tool name and who uses it

- **OpenAI function name:** `request_callback`
- **Who calls it:** **Astra** (delegated `gpt-6-astra` on Live `sessions.accept`), not Amy. Amy only delegates; she does not get tool schemas.
- **Registration:** catalog entry → `buildVoiceV3AstraFunctionTools` → `buildVoiceV3AstraDelegationResponses(...).tools` on session accept.

### Catalog entry

**File:** `src/lib/voice-v3/tools/voice-tool-catalog.ts`

```typescript
  {
    name: "request_callback",
    kind: "mutation",
    telemetryName: "request_callback",
    definition: requestCallbackTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildRequestCallbackOpenAiTool,
  },
```

Gating in same file:

```typescript
    case "request_callback":
      return isRequestCallbackAuthorized(config);
```

### Delegation attach (session accept)

**File:** `src/lib/voice-v3/intake/delegation-config.ts`

```typescript
export function buildVoiceV3AstraDelegationResponses(
  astraInstructions: string,
  agentConfig: VoiceV3AgentConfig = resolveVoiceV3AgentConfig(),
): ResponsesDelegationConfig {
  const intakeEnabled = voiceV3IntakePipelineEnabled();
  const transport = resolveVoiceV3IntakeTransport();
  const useFunctionTool = intakeEnabled && transport === "function_tool";

  const tools = useFunctionTool ? buildVoiceV3AstraFunctionTools(agentConfig) : [];

  return {
    model: VOICE_V3_ASTRA_MODEL,
    instructions: astraInstructions,
    reasoning: {
      effort: "low",
    },
    text: {
      verbosity: "low",
    },
    parallel_tool_calls: useFunctionTool && voiceV3DelegationParallelToolCallsEnabled(),
    tool_choice: useFunctionTool ? "auto" : "auto",
    max_output_tokens: intakeEnabled ? 768 : 200,
    tools,
  };
}
```

### Build entrypoint

**File:** `src/lib/voice-v3/tools/build-openai-tools.ts`

```typescript
export function buildVoiceV3AstraFunctionTools(config: VoiceV3AgentConfig): FunctionTool[] {
  return buildVoiceV3AstraFunctionToolsFromCatalog(config);
}
```

### Authorization gate

**File:** `src/lib/voice-v3/tools/authorize-tool-for-config.ts`

```typescript
export function isRequestCallbackAuthorized(config: VoiceV3AgentConfig): boolean {
  return config.callHandling.callbackRequestsEnabled === true;
}
```

```typescript
    case "request_callback":
      return isRequestCallbackAuthorized(config);
```

---

## 2. Tool description (what Astra reads on the function)

This is the **only** place the word “callback” appears in the compiled Astra instruction bundle; it is **not** repeated in the ~8903-char Astra system prompt body.

**File:** `src/lib/voice-v3/tools/astra-tool-contracts.ts`

```typescript
export const REQUEST_CALLBACK_TOOL_DESCRIPTION = `Authoritative action to arrange a business callback on this call. Use when the caller asks for a callback, asks someone from the business to contact them later, cannot complete another action and wants human follow-up, or changes from another workflow such as booking or receiving a booking link to requesting a callback instead. Do not use merely because the caller has a general question you can answer from business knowledge. Before submitting, ensure only the configured callback-required information is known — reuse facts already collected during this call via update_intake and do not ask for booking-only fields (email, scheduling preference, booking notes, etc.) unless they are also required for callback. Null callback_phone uses the trusted inbound caller number when configured; provide callback_phone only when the caller wants a different number. Null reason is allowed when the reason is already stored in shared call facts. You must invoke this tool to arrange a callback — conversational reassurance alone does not record anything. Do not tell the caller that someone will call them back, that the callback is arranged, recorded, or confirmed until this tool returns callback_requested with success. If required callback facts are still missing, collect only those missing callback fields, then call this tool. If the tool fails or returns needs_information, do not claim success.`;
```

---

## 3. Tool schema + OpenAI wire format (Zod → strict function)

**File:** `src/lib/voice-v3/tools/request-callback-tool.ts`

```typescript
const requestCallbackArgsSchema = z.object({
  callback_phone: z
    .string()
    .nullable()
    .describe(
      "Callback number when the caller wants a different number than the inbound line. Null to use shared call facts or trusted inbound caller ID.",
    ),
  reason: z
    .string()
    .nullable()
    .describe(
      "Why the caller wants a callback, when not already stored in shared call facts.",
    ),
  preferred_time: z
    .string()
    .nullable()
    .describe(
      "Optional natural-language callback time preference (morning, afternoon, anytime, etc.). Not a scheduled appointment.",
    ),
  notes: z
    .string()
    .nullable()
    .describe("Optional extra notes for the business; not trusted configuration."),
});

export type RequestCallbackArgs = z.infer<typeof requestCallbackArgsSchema>;

export function buildRequestCallbackOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "request_callback",
    parameters: requestCallbackArgsSchema,
    description: REQUEST_CALLBACK_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}
```

**Note:** On the cert agent, the compiled JSON schema marks all four properties as required (each may be `null`). **Name / phone / service_reason** requirements are **not** in the schema; they come from `operationRequirements.request_callback` and `src/lib/voice-v3/callback/callback-requirements.ts` at execution time.

**Cert agent `operationRequirements.request_callback`:**

```json
["name", "phone", "service_reason"]
```

**Booking contrast:**

```json
["name", "phone", "email", "service_reason", "mother_s_name"]
```

---

## 4. Runtime tool handler (what runs when Astra calls the function)

**File:** `src/lib/voice-v3/tools/request-callback-tool.ts`

```typescript
export const requestCallbackTool: VoiceToolDefinition<RequestCallbackArgs> = {
  name: "request_callback",
  description: "request_callback",
  parameters: {},
  validate: (raw) => requestCallbackArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const denied = authorizeRequestCallbackOrError(config);
    if (denied) return denied;

    let snap = mergeDialogActiveGoalFromTool(ctx.runtime.getSnapshot(), "REQUEST_CALLBACK");
    ctx.runtime.replaceContext(snap);
    const workspaceId = config.workspaceId?.trim() || ctx.tenantId;
    const { executeRequestCallback } = await import("../callback/execute-request-callback");
    const { result, nextContext } = await executeRequestCallback({
      workspaceId,
      agentId: config.agentId ?? null,
      config,
      context: snap,
      args,
    });
    ctx.runtime.replaceContext(nextContext);
    return result;
  },
};
```

---

## 5. Executor (requirements, ANI, persist, tool results)

**File:** `src/lib/voice-v3/callback/execute-request-callback.ts`

Key flow:

1. Check `callbackRequestsEnabled`
2. `getMissingCallbackRequirementKeys` → `needs_information` + `missingFields` if incomplete
3. `resolveCallbackPhoneE164` (arg, intake phone, or ANI when `callbackUseAniByDefault`)
4. Idempotency → `persistVoiceV3CallbackRequest`
5. Success: `callback_requested` + set `dialog.activeGoal: "REQUEST_CALLBACK"` via `withCallback`

```typescript
export async function executeRequestCallback(
  input: ExecuteRequestCallbackInput,
): Promise<ExecuteRequestCallbackOutput> {
  const { config, context, args } = input;
  let ctx = context;

  console.log("VOICE_V3_CALLBACK_REQUEST_STARTED", {
    callId: ctx.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });

  if (!config.callHandling.callbackRequestsEnabled) {
    return {
      result: toolOk("not_available", { status: "not_available" }),
      nextContext: ctx,
    };
  }

  ctx = withCallback(ctx, callbackFromContext(ctx));

  const missing = getMissingCallbackRequirementKeys(config, ctx, args);
  if (missing.length > 0) {
    console.log("VOICE_V3_CALLBACK_REQUIREMENTS_MISSING", {
      callId: ctx.callId,
      missingFields: missing,
    });
    return {
      result: toolOk("needs_information", {
        status: "needs_information",
        missingFields: missing,
      }),
      nextContext: ctx,
    };
  }

  const callbackPhone = resolveCallbackPhoneE164(config, ctx, args);
  if (!callbackPhone) {
    return {
      result: toolOk("needs_information", {
        status: "needs_information",
        missingFields: ["phone"],
      }),
      nextContext: ctx,
    };
  }

  const reason = resolveCallbackReasonText(config, ctx, args);
  const callerName = resolveCallbackCallerName(ctx);
  const preferredTime = args.preferred_time?.trim() || null;

  // ... idempotency, persistVoiceV3CallbackRequest, callback_requested ...
}
```

**Requirements helper:** `src/lib/voice-v3/callback/callback-requirements.ts` (`resolveConfiguredCallbackRequiredKeys`, `getMissingCallbackRequirementKeys`, ANI policy).

---

## 6. Persistence

**File:** `src/lib/voice-v3/callback/persist-voice-v3-callback-request.ts`

```typescript
export async function persistVoiceV3CallbackRequest(
  input: VoiceV3CallbackPersistInput,
): Promise<VoiceV3CallbackPersistResult> {
  const prisma = getPrisma();
  const existing = await prisma.callbackRequest.findFirst({
    where: {
      workspaceId: input.workspaceId,
      metadata: {
        path: ["voiceV3", "idempotencyKey"],
        equals: input.idempotencyKey,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, callbackRequestId: existing.id, duplicate: true };
  }

  const row = await prisma.callbackRequest.create({
    data: {
      workspaceId: input.workspaceId,
      callerE164: input.callbackPhoneE164,
      businessE164: input.businessE164,
      phoneNumberId: input.phoneNumberId,
      reason: input.reason,
      notes: input.notes,
      status: "new",
      sourceRoute: "voice_v3_request_callback",
      metadata: {
        source: "VOICE_V3",
        voiceV3: {
          idempotencyKey: input.idempotencyKey,
          lifecycleStatus: "REQUESTED",
          callId: input.callId,
          liveSessionId: input.liveSessionId,
          agentId: input.agentId,
          callerName: input.callerName,
          inboundAni: input.inboundAni,
          preferredCallbackTime: input.preferredTime,
          customFieldsSnapshot: input.customFieldsSnapshot,
        },
      },
    },
    select: { id: true },
  });
  // ...
}
```

---

## 7. Prompt parts — Amy (GPT-Live)

Amy instructions: `src/lib/voice-v3/prompts/live-frontend-instructions.ts` (includes delegation policy, capability summary, truth rules).

### Delegation policy (no callback bullet)

**File:** `src/lib/voice-v3/prompts/live-delegation-policy.ts`

```typescript
export function buildLiveDelegationPolicySection(
  config?: VoiceV3AgentConfig,
): string {
  const caps = config?.capabilities;
  const backendCaps: string[] = [];
  if (!caps || caps.collectIntake) {
    backendCaps.push("- Save or correct caller information required by the business.");
  }
  if (!caps || caps.checkAvailability) {
    backendCaps.push("- Check real appointment availability.");
  }
  if (!caps || caps.bookAppointments) {
    backendCaps.push("- Create new appointments.");
  }
  if (!caps || caps.findAppointments) {
    backendCaps.push("- Find existing appointments.");
  }
  if (!caps || caps.rescheduleAppointments) {
    backendCaps.push("- Reschedule existing appointments.");
  }
  if (!caps || caps.cancelAppointments) {
    backendCaps.push("- Cancel existing appointments.");
  }
  if (!caps || caps.transferCalls) {
    backendCaps.push("- Transfer the live call to an authorized human or destination.");
  }
  backendCaps.push(
    "- End the telephone call through the telephony/application layer when appropriate.",
  );

  return `
# DELEGATION POLICY

Backend capabilities:
${backendCaps.join("\n")}

Delegate to the backend when:
- The caller asks what appointment dates or times are available.
- The caller asks whether a specific appointment time is available.
- The caller wants to create an appointment.
- The caller wants information about an appointment that already exists.
- The caller wants to reschedule an existing appointment.
- The caller wants to cancel an existing appointment.
- The caller provides or corrects information that must be stored in authoritative business state.
- The caller asks for a real call transfer or accepts a transfer.
- A correction changes backend work that has already been requested or is currently in progress.
- The answer depends on authoritative application state, provider state, or an external action.
- Careful backend reasoning is required beyond a simple conversational response.

Do not delegate to the backend when:
- The caller is greeting you or making ordinary conversation.
- You can answer naturally from the current conversation.
- The caller asks you to repeat or clarify a still-current result already available in the conversation.
- You need a brief conversational clarification before the backend could perform useful work.
- No authoritative application state, external lookup, external action, or backend reasoning is required.

Delegate before making a claim that depends on backend work.
Do not guess availability, booking state, cancellation state, transfer state, or any other external result while backend work is pending.
Continue the natural spoken conversation while backend work is running when the next conversational response does not depend on that result.
An interruption in conversation does not automatically cancel backend work.
If the caller corrects or changes a backend request, delegate the correction so the backend can update the active work.
Do not promise that an external action succeeded until verified backend/provider state supports that claim.
`.trim();
}
```

**Compiled Amy instructions on cert agent:** ~14,179 chars. Word **“callback” does not appear** in the compiled Amy text (`amy_contains_callback_word: false` in contract dump).

Amy has generic **TRUTH AND CONFIRMATION** in `live-frontend-instructions.ts` (never claim success without backend) but nothing naming callback or `request_callback`.

---

## 8. Prompt parts — Astra (system instructions)

Built in `src/lib/voice-v3/prompts/astra-backend-instructions.ts` from:

- `buildAstraBackendCoreInstructions()` — `src/lib/voice-v3/prompts/astra-backend-core-instructions.ts`
- Business / intake catalog / booking strategy append
- `buildAstraIntakeInstructions()` — `src/lib/voice-v3/prompts/astra-intake-instructions.ts`
- `buildAstraCrossToolInstructions()` — `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts`
- Closing: *“Each function tool description defines when to call…”*

**Compiled Astra instructions on cert agent:** ~8903 chars. Word **“callback” does not appear** in the instruction body (`astra_contains_callback_word: false`). Callback semantics are on the **tool description** only.

### Cross-tool paths (booking / reschedule / cancel — no callback path)

**File:** `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts` (excerpt)

```text
Tool discipline (production):
1. One authoritative step at a time. Prefer the most specific tool for the caller's immediate need.
2. New booking path: update_intake (contact fields as needed) → set_scheduling_preference (date/time semantics) → find_availability → caller chooses slot → book_appointment.
3. Reschedule path: find_appointment → set_scheduling_preference (new time semantics) → find_availability → caller chooses slot → reschedule_appointment.
4. Cancel path: find_appointment → explicit caller confirmation → cancel_appointment with confirmed=true.
5. Never invent offer_set_id, slot_id, or provider_event_id. Only use values returned by tools in this call.
...
```

---

## 9. Intake / operation context (Live thinking append)

Not in Amy’s initial system prompt; pushed via `session.thinking.append` (e.g. after `update_intake`).

**File:** `src/lib/voice-v3/intake-objective/build-intake-context.ts`

```typescript
  return `
INTAKE OBJECTIVE
Purpose: ${objectiveDescription}
Active operation: ${operation}
Status: ${objective.status}
Required information (for this operation only):
${requiredLines.join("\n") || "(none configured)"}
Optional information:
${optionalLines.join("\n") || "(none configured)"}
Rules:
- Caller facts are shared for the whole call; only missing fields for the active operation need collection.
- When the caller changes intent (for example booking to callback), stop requiring fields that belong only to the previous operation.
- Persistent caller facts belong in intake state; incomplete scheduling preferences may stay conversational until find_availability has enough to search.
- Preserve already collected information.
- Collect missing required information naturally (model decides how to ask — no scripted next question from Transovo).
- The caller may provide multiple fields at once; one caller utterance may require multiple tools when appropriate.
- Do not unnecessarily ask again for information already collected or verified.
- Email fields marked for voice verification may show as candidate until confirmed.
`.trim();
```

**Active operation resolution:** `src/lib/voice-v3/intake-objective/operation-requirements.ts` — `UNKNOWN` / `GENERAL` defaults to **`book_appointment`** (or send_link strategy). `REQUEST_CALLBACK` goal maps to `request_callback` only after tool sets goal.

---

## 10. End-to-end flow

1. **Amy** delegates (Live creates `session.delegation`).
2. **Astra** receives `instructions` + `tools[]` including `request_callback`.
3. Astra calls **`request_callback`** (function call on delegated Responses).
4. **`requestCallbackTool.execute`** → **`executeRequestCallback`** → **`persistVoiceV3CallbackRequest`**.
5. Function output returned to delegation; Amy may speak using authoritative result.

**If Astra returns plain message text instead of a function call:** `handle-delegated-meaning.ts` logs `output_text.done_ignored` — no tool, no persistence.

---

## 11. Production tool surface (cert PSTN log fingerprint)

Both cert calls logged:

```text
VOICE_V3_TOOL_SURFACE_COMPILED {
  tool_count: 10,
  tools: [
    'update_intake',
    'set_scheduling_preference',
    'find_availability',
    'book_appointment',
    'find_appointment',
    'reschedule_appointment',
    'cancel_appointment',
    'transfer_call',
    'end_call',
    'request_callback'
  ]
}
```

Contract versions (Call A accept):

- `live_prompt_version`: `voice-v3-live-v2`
- `astra_prompt_version`: `voice-v3-astra-v2`
- `tool_contract_version`: `1df5e2c6553b4af8`
- `astra_instructions_hash`: `9494859c1a5bf893`

---

## 12. Related forensic reports

- `/opt/cursor/artifacts/voice-v3-callback-forensic-report-A-F.md` — PSTN cert root cause A–F
- `/opt/cursor/artifacts/voice-v3-callback-pstn-cert-2026-09-19-report.md` — cert timing summary
