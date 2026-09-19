# Voice V3 callback — minimal contract correction (implementation report)

**Status:** Implemented on branch `cursor/voice-v3-callback-contract-2304` — **not merged, not deployed.**  
**Scope:** Prompt/contract + neutral UNKNOWN intake projection + delegation telemetry. **No** F2 heuristics, **no** Microsoft/SEND_LINK executor changes.

---

## 1. Files changed

| Area | Files |
|------|--------|
| Amy delegation + capability | `src/lib/voice-v3/prompts/live-delegation-policy.ts`, `src/lib/voice-v3/prompts/live-frontend-instructions.ts` |
| Astra callback workflow + requirements | `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts`, `src/lib/voice-v3/prompts/astra-callback-instructions.ts` (new), `src/lib/voice-v3/prompts/astra-backend-instructions.ts`, `src/lib/voice-v3/prompts/build-voice-v3-prompts.ts` |
| Neutral UNKNOWN operation | `src/lib/voice-v3/intake-objective/operation-requirements.ts`, `derive-intake-objective.ts`, `build-intake-context.ts`, `index.ts` |
| Booking rules (no implicit book on UNKNOWN) | `src/lib/voice-v3/state/call-rules.ts` |
| Contract hash / telemetry | `src/lib/voice-v3/telemetry/contract-versions.ts`, `src/lib/voice-v3/delegation/types.ts`, `src/lib/voice-v3/delegation/live-response-coordinator.ts` |
| Tests | `scripts/test-voice-v3-callback-prompt-contract.ts` (new), `scripts/test-voice-v3-intake-objective.ts`, `scripts/test-voice-v3-intake.ts`, `scripts/fixtures/voice-v3-odd-intake-harness-config.ts` |
| Minor robustness | `src/lib/voice-v3/tools/voice-tool-catalog.ts` (partial test configs without `capabilities`) |

**Unchanged (per instruction):** `execute-request-callback.ts`, `persist-voice-v3-callback-request.ts`, Microsoft booking/find/cancel/reschedule, SEND_LINK executors, `output_text.done_ignored` behavior.

---

## 2. Before / after — Amy callback sections

**Before (callback enabled):** compiled Amy ~14k chars, **zero** occurrences of “callback”; delegation policy had no callback capability or delegate-when bullets.

**After (callback enabled):**

- Capability summary: *“Arranging a callback when the caller wants the business to call them back.”*
- Backend capability: *“Record a request for the business to call the caller back.”*
- Delegate when: caller asks for callback; switch from booking (etc.); authoritative action (ack alone does not record).
- Completion: no confirmation until backend success; collect missing fields and delegate again; confirm only after success.

**After (callback disabled):** no callback capability or delegate-when lines (contract test asserts).

---

## 3. Before / after — Astra callback sections

**Before:** ~8903 char body, **zero** “callback” in instructions; only `request_callback` tool description among 10 tools.

**After (callback enabled):**

- **Callback path** block in cross-tool instructions (10 steps: authoritative op, switch from booking/SEND_LINK, reuse facts, `request_callback`, `needs_information` / retry, no conversational completion).
- **Configured requirements** section from `operationRequirements.request_callback` with field labels + ANI policy when `callbackUseAniByDefault` (dynamic per tenant — not hardcoded cert fields in global text).

**Compiled hash (booking test config, callback on):** `astra_instructions_hash` changes (e.g. `72e1c4e55cf1332c` in contract test run vs prior `9494859c…` on production cert agent).

---

## 4. Before / after — UNKNOWN intake projection

| | Before | After |
|---|--------|--------|
| `resolveActiveIntakeOperation` for `UNKNOWN`/`GENERAL` | `book_appointment` or `send_booking_link` | `unresolved` |
| Missing required fields at call start | Full booking list | `[]` |
| Intake thinking “Active operation” | `book_appointment` | `unresolved (no operation selected yet)` |
| Required information block | Booking fields listed | “(none — wait for caller's intent…)” |
| `call-rules` `isBookGoal` | Included `UNKNOWN` | Only `BOOK_APPOINTMENT` |

`REQUEST_CALLBACK` still set when Astra invokes `request_callback` (existing tool wrapper) — not from transcript classification.

---

## 5. Dynamic callback requirements (cert-like agent)

For config with:

```json
"request_callback": ["name", "phone", "service_reason"]
```

Astra instructions include labeled lines for those keys and ANI reuse when enabled. Cert agent would see **name**, **phone**, **service_reason** — another tenant with `["name"]` only would see **name** only.

---

## 6. `needs_information` continuation test

`scripts/test-voice-v3-callback-prompt-contract.ts`:

1. `executeRequestCallback` with ANI only → `needs_information`, missing `name` + `service_reason`.
2. `mergeIntakeUpdate` supplies facts → second call → `callback_requested`, persist count 1.
3. `requestCallbackTool.execute` returns `needs_information` with `missingFields` array for Live/Astra continuation.

---

## 7. Booking → callback transition test

Same script + `scripts/test-voice-v3-callback-shared-facts-transitions.ts`:

- `BOOK_APPOINTMENT` with name/phone/email/mother_s_name collected.
- `mergeDialogActiveGoalFromTool(..., "REQUEST_CALLBACK")` → objective missing only `service_reason`; email and mother_s_name not in `requiredFields`.

---

## 8. Frozen regression results

All **PASS** (single batch run on 2026-09-19):

- `test-voice-v3-callback-prompt-contract`
- `test-voice-v3-intake-objective`, `test-voice-v3-intake`
- `test-voice-v3-callback-shared-facts-transitions`, `test-voice-v3-callback-matrix`, `test-voice-v3-callback-invariants`, `test-voice-v3-callback-isolation`
- `test-voice-v3-microsoft-appointment-management`, `test-voice-v3-appointment-discovery`, `test-voice-v3-reschedule`
- `test-voice-v3-send-booking-link-matrix` (14/14), `test-voice-v3-booking-link-sms-isolation`
- `test-voice-v3-astra-tool-contracts-audit`, `test-voice-v3-architecture-invariants`, `test-voice-v3-prompts`

---

## 9. Failures

None in automated suite above.

---

## 10. P1 telemetry (no behavior change)

`ASTRA_DELEGATION_COMPLETED` now logs: `active_goal`, `function_call_count`, `function_names`, `message_output_occurred`, `callback_enabled`, `callback_request_persisted`, `callback_open` (observability only).

---

## Next step (awaiting approval)

Merge/deploy → PSTN **Cert A** (straight callback) and **Cert B** (booking → callback). Do **not** add F2 re-delegation/heuristics unless contract-fixed PSTN still fails.
