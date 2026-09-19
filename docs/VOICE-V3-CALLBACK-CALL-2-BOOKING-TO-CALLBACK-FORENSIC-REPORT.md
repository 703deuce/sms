# Voice V3 — Call 2 booking → callback forensic report

**Date:** 2026-09-19 (UTC)  
**Deploy under test:** `ea2114d9` (callback contract + `request_callback` tool pass)  
**Status:** Forensic only — no implementation, no deploy changes  

**Evidence sources:**

- Coolify runtime logs: web container `ds8s3hjin60qs6g7s0iqkixs-212720261414`, image `ea2114d9`
- Local log copy: `/opt/cursor/artifacts/coolify-voice-callback-tests-45m.log` (when captured on cloud agent VM)

**Calls:**

| Label | PSTN `call_id` | Live session | Ingress (UTC) |
|-------|----------------|--------------|---------------|
| Call 1 (known-good straight callback) | `v3:dfKE3rFRq8wDqMwzdOqbKIwpBIGL1lOAh2z2zM0chnF_JhGpmizBbA` | `live_u7_EPx5ep3oMdWQPvH8U6VTpXgwd2BpgIvL` | `2026-09-19T21:40:51.094Z` |
| Call 2 (booking path; no callback persist) | `v3:Pr6y46QrC2XBPx1meFVwawV78cWVTLrdjI55iIbKuRkCFwZ3Vr0z8Q` | `live_u7_EPx6op3oMJkX4996IhtNcCTuRpZ4P8cP` | `2026-09-19T21:42:03.691Z` |

**Executive summary**

- **Call 1** confirms the new architecture: Amy delegates → Astra invokes `request_callback` early → `needs_information` loop → persist → `callback_requested`. **Freeze straight-callback behavior; do not casually change that contract.**
- **Call 2** does **not** show a completed booking → callback switch. `request_callback` was never invoked; no `VOICE_V3_CALLBACK_*` persist. Runtime went `update_intake` → `set_scheduling_preference` (“Monday sometime”) → `find_availability` (Microsoft FIND dispatched).
- **`callback_open: true`** on Call 2 delegation #1 is **misleading telemetry** (message-only Astra output while callback is enabled), **not** proof that a callback operation was open.

---

## 1. What `callback_open` means

**Producer:** `ASTRA_DELEGATION_COMPLETED` in `src/lib/voice-v3/delegation/live-response-coordinator.ts`.

```typescript
callback_open:
  callbackEnabled && !callbackPersisted && functionNames.length === 0
    ? d?.messageOutputOccurred ?? false
    : false,
```

| Question | Answer (from code) |
|----------|-------------------|
| Semantics | **Derived telemetry only** — not stored in `VoiceV3CallContext`, not authoritative. |
| True when | `callbackRequestsEnabled` **and** no `callbackRequestId` yet **and** this delegation completed with **zero** function calls **and** Astra emitted a **message** item (`message_output_occurred`). |
| False when | Any tool ran on that delegation, or callback already persisted, or message-only did not occur. |
| “Runtime knew callback was open”? | **No.** It means: callback feature is on, nothing persisted yet, and this delegation was **message-only**. |
| Call 2 delegation #1 | `callback_open: true`, `active_goal: 'UNKNOWN'`, `function_names: []`, `message_output_occurred: true` → Astra spoke; no tools. |
| When it went false | As soon as delegation #2 ran `update_intake` (`function_names` non-empty). |

**Do not** interpret `callback_open: true` as evidence that the runtime had an open callback operation.

---

## 2. Call 2 — every delegation (chronological)

There are **two** Live delegations. `ASTRA_DELEGATION_COMPLETED` may log **multiple times** per delegation as nested `response.completed` events arrive; `function_names` **accumulates** within the same `delegation_id`.

### Delegation 1 — `item_EPx6sK62xmsfanLA67kro`

| Field | Value |
|--------|--------|
| Created | `2026-09-19T21:42:06.685Z` |
| Completed (message) | ~`2026-09-19T21:42:08.183Z` (`response.output_text.done` → `output_text.done_ignored`) |
| Caller turns before create | **None** — first `CALLER_TURN_COMMITTED` at `21:42:17` (turn 1) |
| Amy / delegation trigger | Live `session.delegation.created` ~3s after PSTN ingress; no committed turn yet |
| active_goal | `UNKNOWN` |
| callback_open | `true` (message-only, no tools) |
| Tools exposed | Full Astra catalog including `request_callback` |
| Tools selected | **None** |
| Astra message-only | Yes; text not logged (ignored for Live speech) |
| Intake / scheduling mutations | None |

### Delegation 2 — `item_EPx7vkMh8EUH80n94Gp1C`

| Field | Value |
|--------|--------|
| Created | `2026-09-19T21:43:11.402Z` — immediately after turn 10 (`21:43:07`, 4 transcript chars) |
| Turn 11 | `21:43:14.956Z`, 47 chars — **after** delegation start and **after** `update_intake` starts (`21:43:13.418Z`) |
| request_callback | **Never** |
| Callback persisted | **Never** |

**Tool sequence on delegation 2:**

| Time (UTC) | Tool | active_goal after | Notable result |
|------------|------|-------------------|----------------|
| 21:43:13.418 | `update_intake` | **UNKNOWN** | `updated_fields: ["phone","service_reason","notes"]`; thinking context: **Active operation: unresolved (no operation selected yet)** |
| 21:43:15.608 | `set_scheduling_preference` | **BOOK_APPOINTMENT** | `SCHEDULING_PREFERENCE_SET`, `display_preference: "Monday sometime"`, `generation: 1` |
| 21:43:17.368 | `find_availability` | **BOOK_APPOINTMENT** | `FIND_AVAILABILITY_DISPATCHED` (window `2026-09-21T13:00:00.000Z`–`2026-09-21T21:00:00.000Z`) |
| 21:43:15–24+ | (caller turns 12–16) | BOOK_APPOINTMENT | No new `session.delegation.created` |
| (end) | Hangup | — | `VOICE_V3_BASIC_CALL_HANGUP`, `normal_clearing` |

**Delegation summary table**

| # | delegation_id | Created (UTC) | Preceding caller signal | active_goal @ end | Tools | callback_open |
|---|---------------|---------------|-------------------------|-------------------|-------|----------------|
| 1 | `item_EPx6sK62xmsfanLA67kro` | 21:42:06 | No committed turn | UNKNOWN | — | true (message-only) |
| 2 | `item_EPx7vkMh8EUH80n94Gp1C` | 21:43:11 | Turns 1–10 (~453 rolling chars) | BOOK_APPOINTMENT | intake → scheduling → find | false |

**Per-delegation fields (where logs allow)**

- **Function arguments:** `VOICE_V3_PIPELINE_LOG=normal` logs `item_arguments_bytes` only, not decoded JSON.
- **Function results:** Present in `VOICE_TOOL_EXECUTION_SUCCEEDED` `output` blobs (e.g. intake updated fields; scheduling display string).
- **session.thinking.append:** Intake objective block after `update_intake` shows unresolved operation.
- **session.commentary.append:** Present in stream; no full caller quote in extracted production logs.

---

## 3. Exact `UNKNOWN` → `BOOK_APPOINTMENT` mutation

**First authoritative `dialog.activeGoal` change:** execution of **`set_scheduling_preference`**, not `update_intake`.

**File:** `src/lib/voice-v3/tools/set-scheduling-preference-tool.ts`

```typescript
const merged = mergeSchedulingMeaningIntoContext(snap, args);
let next = mergeDialogActiveGoalFromTool(merged.context, "BOOK_APPOINTMENT");
ctx.runtime.replaceContext(next);
```

- **Call 2 timestamp:** `2026-09-19T21:43:15.608Z` (Astra selected tool ~same second).

**Also forces booking goal:** `src/lib/voice-v3/tools/find-availability-tool.ts`

```typescript
snap = mergeDialogActiveGoalFromTool(snap, "BOOK_APPOINTMENT");
ctx.runtime.replaceContext(snap);
```

**`update_intake`:** Updates intake values only; does **not** call `mergeDialogActiveGoalFromTool` (`update-intake-tool.ts`).

**Intake operation resolution:** `resolveActiveIntakeOperation` maps `UNKNOWN` → `unresolved` (`operation-requirements.ts`). After `update_intake` on Call 2, intake context correctly said **unresolved** while `activeGoal` remained `UNKNOWN`.

| Layer | What happened |
|--------|----------------|
| Astra | Chose scheduling/booking tools; did **not** choose `request_callback`. |
| Transovo executor | **Unconditionally** sets `BOOK_APPOINTMENT` when `set_scheduling_preference` / `find_availability` run successfully. |
| Distinction | Astra choosing scheduling ≠ explicit “caller wants to book” field; executor **pins** booking goal after those tools run. |

**Can scheduling tools overwrite unresolved / callback intent?**  
If Astra invokes them while `activeGoal` is `UNKNOWN`, **yes** — they promote to `BOOK_APPOINTMENT` without checking for a callback pivot. `REQUEST_CALLBACK` is set only when **`request_callback`** executes (`request-callback-tool.ts` → `mergeDialogActiveGoalFromTool(..., "REQUEST_CALLBACK")`).

---

## 4. Caller text and booking → callback switch

### What is recoverable from production logs

| Source | Call 2 |
|--------|--------|
| `CALLER_TURN_COMMITTED` | **Character counts only** — no transcript string (`caller-turn-manager.ts`) |
| `VOICE_V3_PIPELINE` (normal) | Suppresses `*.delta` — no stitched caller text |
| Astra message delegation #1 | `output_text.done_ignored` — no content |
| DB / `voiceCall` | Not reliably queryable by v3 call control id from agent environment |
| Telnyx audio/transcript | Not retrieved in this forensic pass |

### Caller turn timeline (recoverable)

| Turn | Committed (UTC) | transcript_chars | rolling_transcript_chars |
|------|-----------------|------------------|--------------------------|
| 1 | 21:42:17 | 21 | 43 |
| 2 | 21:42:18 | 11 | 67 |
| 3 | 21:42:28 | 58 | 185 |
| 4 | 21:42:29 | 9 | 204 |
| 5 | 21:42:30 | 17 | 239 |
| 6 | 21:42:43 | 25 | 291 |
| 7 | 21:42:45 | 22 | 336 |
| 8 | 21:42:57 | 47 | 432 |
| 9 | 21:42:58 | 5 | 443 |
| 10 | 21:43:07 | 4 | 453 |
| **11** | **21:43:14** | **47** | **549** |
| 12 | 21:43:15 | 8 | 567 |
| 13 | 21:43:17 | 18 | 605 |
| 14 | 21:43:24 | 9 | 625 |
| 15 | (later) | 58 | 743 |
| 16 | (later) | 20 | 785 |

### Switch boundary (if pivot was on turn 11 or later)

1. Delegation 2 **opened 21:43:11** — ~3.5s **before** turn 11 committed.  
2. `update_intake` **already running** before turn 11 landed.  
3. Turns **12–16** after find: **no** new delegation — later speech did not reach Astra via a new delegation.

**Exact caller wording:** **Not recoverable** from current production logging without verbose pipeline, DB transcript fields, or Telnyx recording.

---

## 5. Call 1 vs Call 2 at Astra’s decision boundary

| Dimension | Call 1 (straight callback — PASS) | Call 2 delegation 2 (FAIL for callback) |
|-----------|-----------------------------------|-------------------------------------------|
| First substantive tools | `request_callback` | `update_intake` + `set_scheduling_preference` + `find_availability` |
| Intake context in logs | `Active operation: request_callback` | After intake: `Active operation: unresolved` |
| active_goal during tools | `REQUEST_CALLBACK` | `UNKNOWN` until scheduling tool → `BOOK_APPOINTMENT` |
| Validator | `needs_information` → intake → retry → persist | N/A |
| Scheduling / find | Not on success path | Monday preference + FIND dispatched |
| Delegation count / timing | Multiple delegations through callback loop | **Two** delegations total; none after find |
| Prompt bundle (same deploy) | `astra_instructions_hash: 6ff0f420d83eb79e`, `voice-v3-astra-v2` | Same |

**Material differences**

1. Tool choice: `request_callback` vs booking pipeline despite unresolved intake operation text.  
2. Authoritative goal: `REQUEST_CALLBACK` vs executor-pinned `BOOK_APPOINTMENT`.  
3. Amy: Call 2 did not re-delegate after turns 11–16.  
4. Same compiled instructions hash — difference is conversation + tool choice, not a different prompt deploy.

### Call 1 persistence (freeze reference)

- `VOICE_V3_CALLBACK_REQUEST_PERSISTED` → `callbackRequestId: cmu8wwzuc05405k6x1g5d6t0p`  
- `VOICE_V3_CALLBACK_TOOL_SUCCEEDED` → `status: callback_requested`  
- `needs_information` for `name`, `service_reason` before success  

---

## 6. Competing tool contracts (vs strengthened `request_callback`)

**`request_callback`:** Early invoke, booking → callback switch, `needs_information` loop — **proven on Call 1**.

**Booking / scheduling (unchanged relative strength)**

- **`astra-cross-tool-instructions.ts`:** Numbered **“New booking path: update_intake → set_scheduling_preference → find_availability → …”** before callback block in structure.  
- **`SET_SCHEDULING_PREFERENCE_TOOL_DESCRIPTION`:** Use when caller provides scheduling information — no “stop if caller switched to callback.”  
- **`FIND_AVAILABILITY_TOOL_DESCRIPTION`:** Use when caller wants open times or to schedule and preference is established.  
- **`UPDATE_INTAKE`:** Not for scheduling; does not say “do not proceed with booking path when caller requests callback.”

**Asymmetry:** Callback text says abandon booking; scheduling tools + executors **bind** `BOOK_APPOINTMENT` once invoked. In a thread with ~453 chars of pre-delegation-2 speech (likely booking-oriented), scheduling tools are semantically and runtime-strong.

No exact phrase “booking takes precedence over callback,” but **executor goal pinning** + **booking path ordering** produce similar effects after Astra picks `set_scheduling_preference`.

---

## 7. Operation-switch instructions (Astra / Amy)

**Present today**

- `astra-cross-tool-instructions.ts` — callback path (callback authoritative; booking → callback; stop abandoned-op-only fields; early `request_callback`).  
- `build-intake-context.ts` — change intent (e.g. booking → callback); stop requiring previous-op-only fields.  
- `astra-backend-core-instructions.ts` — newest clear correction; multiple independent tools per span when appropriate.  
- `live-delegation-policy.ts` — delegate when caller changes to callback (including from booking).

**Gaps (relative to desired architecture)**

- No explicit: “If the newest utterance requests callback, do not call `set_scheduling_preference` / `find_availability` even if scheduling was discussed earlier.”  
- No Amy rule: “If caller pivots after booking tools start, delegate again immediately.”  
- Executors do not implement “newest intent wins” — they set `BOOK_APPOINTMENT` on scheduling tool success regardless of prior `UNKNOWN` goal.

---

## 8. Stale scheduling state at pivot

**At delegation 2 create (21:43:11)**

| State | Value |
|--------|--------|
| `dialog.activeGoal` | `UNKNOWN` |
| Scheduling preference | Not yet authoritative (set at 21:43:15) |
| Offer set | No until find |
| Shared intake | Filled by `update_intake` moments later |

**After booking tools**

| State | Persists? | Effect on callback |
|--------|-----------|-------------------|
| `BOOK_APPOINTMENT` | Yes | Intake op follows booking, not `request_callback` |
| Scheduling generation 1 | Yes | Facts reusable; goal not reset on pivot |
| FIND dispatched / results | Yes | Context biased toward slots |
| `callbackRequestId` | Never set | — |

**Verdict:** Shared facts (phone, service_reason, notes) are reusable. **Operation** (`activeGoal`, scheduling generation, find) becomes authoritative when scheduling tools run **without** `request_callback`. Facts vs objective are **not** fully separated at the executor layer.

---

## 9. Root cause classification

### Failure layers (evidence-based)

| Code | Description | Call 2 |
|------|-------------|--------|
| A | Amy failed to delegate changed intent | **Yes** — if pivot on turn 11+: delegation B before turn 11; no re-delegation after turns 12–16 |
| B | Amy delegated; Astra did not choose `request_callback` | **Yes** — booking tool chain on delegation B |
| C | Stale/incorrect context made booking authoritative | **Partial** — intake said **unresolved** after `update_intake`; booking goal came from **tool executors**, not stale pre-call `BOOK_APPOINTMENT` |
| D | Competing tool mutated state to `BOOK_APPOINTMENT` | **Yes** — `set_scheduling_preference` at 21:43:15.608Z (after Astra chose it) |
| E | Astra chose callback but runtime rejected | **No** — never invoked |
| F | Other | — |

### Recommended **first failing boundary** (booking → callback test)

**Primary: A (delegation timing / no re-delegation), with B on the same delegation**

Evidence chain:

1. `21:43:11` — Delegation B opens on conversation through turn 10 only.  
2. `21:43:14` — Turn 11 (47 chars) commits during booking tool execution.  
3. `21:43:13–17` — Booking chain; never `request_callback`.  
4. `21:43:15` — Executor sets `BOOK_APPOINTMENT`.  
5. After find — turns 12–16; no new delegation.

If pivot was only in turns 11–16, the **first** loss is opening/running booking backend work **before** that text was in the committed turn stream, plus **no re-delegation** after pivot.

**Secondary: B** — Astra chose booking tools while intake context still said unresolved.

**Contributing: D** — Scheduling executors hard-set `BOOK_APPOINTMENT`.

### Smallest correction directions (report only — do not implement here)

1. **Preserve Call 1** — do not weaken `request_callback` or straight-callback flow.  
2. **If boundary A** — ensure post-pivot turns trigger new backend delegation; avoid starting booking delegation before pivot turn is committed (Amy/Live orchestration).  
3. **If boundary B + D** — decouple `mergeDialogActiveGoalFromTool("BOOK_APPOINTMENT")` from scheduling tools or gate on explicit booking intent; let `request_callback` set `REQUEST_CALLBACK` when Astra chooses it.  
4. **Next evidence** — re-test with `VOICE_V3_PIPELINE_LOG=verbose` or persisted transcripts to align turn 11/15 text with `21:43:11`.

---

## 10. Constraints honored in this pass

- No Microsoft booking/find/reschedule/cancel changes  
- No SEND_LINK changes  
- No callback persistence changes  
- No keyword routing, pre-Astra classifier, CallerMeaning revival, or heuristic re-delegation loop  
- No weakening of straight-callback contract  
- No merge or deploy from this document  

---

## Appendix A — Key code references

| Topic | Path |
|-------|------|
| `callback_open` telemetry | `src/lib/voice-v3/delegation/live-response-coordinator.ts` |
| Goal merge from tools | `src/lib/voice-v3/intake/merge-intake-state.ts` |
| Intake operation from goal | `src/lib/voice-v3/intake-objective/operation-requirements.ts` |
| Intake context for Astra | `src/lib/voice-v3/intake-objective/build-intake-context.ts` |
| Scheduling → BOOK_APPOINTMENT | `src/lib/voice-v3/tools/set-scheduling-preference-tool.ts` |
| Find → BOOK_APPOINTMENT | `src/lib/voice-v3/tools/find-availability-tool.ts` |
| Callback → REQUEST_CALLBACK | `src/lib/voice-v3/tools/request-callback-tool.ts` |
| Cross-tool + callback path prompts | `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts` |
| Amy delegation policy | `src/lib/voice-v3/prompts/live-delegation-policy.ts` |
| Tool descriptions | `src/lib/voice-v3/tools/astra-tool-contracts.ts` |
| Caller turn logging (no text) | `src/lib/voice-v3/conversation/caller-turn-manager.ts` |
| Pipeline log modes | `src/lib/voice-v3/telemetry/pipeline-log.ts` |

---

## Appendix B — Related docs

- `docs/VOICE-V3-CALLBACK-CONTRACT-CORRECTION-IMPLEMENTATION-REPORT.md`  
- `docs/VOICE-V3-REQUEST-CALLBACK-TOOL-CONTRACT-PASS.md`  
- `docs/VOICE-V3-CALLBACK-TOOL-AND-PROMPT-REFERENCE.md`  
- `scripts/inspect-voice-v3-callback-pstn-cert.ts` (post-PSTN DB inspect; may need correct `voiceCall.id`)

---

*End of forensic report.*
