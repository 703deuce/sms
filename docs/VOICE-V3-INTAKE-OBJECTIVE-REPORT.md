# Voice V3 — Intake Objective Architecture Report

**Branch:** merged to `master` (`fa4065a8`+)  
**Status:** Intake Objective on production path — review before PSTN certification.

**Amendment (drive-through lessons):** See `docs/VOICE-V3-DRIVE-THROUGH-ARCHITECTURE-LESSONS.md` — simplified field lifecycles (standard = missing/collected only), persistent vs temporary operation args, one-utterance/multi-tool invariant, dynamic schema constraints, full-chain certification target.

## 1. Old intake path (before)

```
Caller turn / delegation
  → (removed) CallerMeaning extraction on PSTN
  → update_intake tool
      → applyIntakeToolPatch (merge-intake-state)
          → mergeIntakeFieldValues
          → mergeDialogActiveGoalFromTool (active_goal on intake)
          → mergeSchedulingNaturalLanguage (date/time on intake)
      → evaluateVoiceV3Rules (truthy string missing fields)
```

Parallel legacy (tests/scripts only): `apply-caller-meaning.ts` → GoalManager, slot selection, scheduling from CallerMeaning blob.

## 2. Legacy modules

| Module | Disposition |
|--------|-------------|
| `intake-objective/*` | **New** — authoritative intake objective |
| `tools/update-intake-tool.ts` | **Rewritten** — multi-field merge, no active_goal/scheduling |
| `intake/merge-intake-state.ts` | **Retained** — scheduling/goal helpers for legacy tests; `applyIntakeToolPatch` deprecated |
| `intake/apply-caller-meaning.ts` | **Retained test-only** — not on PSTN tool path |
| `intake/caller-meaning-schema.ts` | **Retained** — decoder/tests |
| `state/call-rules.ts` | **Updated** — derives objective; BOOK uses operation requirements |

## 3. AgentConfig intake field type

`src/lib/voice-v3/config/agent-config.ts`:

- `description` (required string, model-facing)
- `collectionStrategy?`: `standard` \| `voice_email` \| `voice_phone` \| `voice_address` \| `voice_date`
- `verificationRequired?` (defaults: true for `voice_email`, else false)
- `intake.objectiveDescription?`
- `operationRequirements?` per operation (e.g. `find_availability: []`, `book_appointment: [name, email, phone]`)

## 4. IntakeObjective types

`src/lib/voice-v3/intake-objective/types.ts` — `IntakeObjectiveStatus`, `IntakeFieldStatus`, `IntakeObjectiveState`, `IntakeFieldState`.

`CapturedField` extended with `revision?`, `verificationStatus?` (`candidate` \| `collected` \| `verified` \| `declined`).

## 5. `deriveIntakeObjective()`

Implementation: `src/lib/voice-v3/intake-objective/derive-intake-objective.ts` — projection from `AgentConfig.intakeFields` + `context.intake.values`; completion uses `fieldSatisfiesObjectiveRequirement` (verification-aware).

## 6. `update_intake` production contract

- **Name:** `update_intake`
- **Description:** `UPDATE_INTAKE_TOOL_DESCRIPTION` in `astra-tool-contracts.ts` (multi-field, no scheduling)
- **Schema:** Strict nullable per configured field via `buildUpdateIntakeZodSchema` — **no** `active_goal`, `date_expression`, `time_expression`

## 7. Astra intake instructions

`src/lib/voice-v3/prompts/astra-intake-instructions.ts` — embedded in `buildAstraBackendInstructions()`.

## 8. Multi-field persistence

Single tool call → `mergeIntakeUpdate` validates each non-null field → partial success (valid fields persist, invalid rejected) → atomic context replace → telemetry + thinking context publish.

## 9. Corrections

New explicit value increments `revision`; newest valid value wins. Email: second identical save promotes `candidate` → `verified` when verification required.

## 10. Invalid / incomplete values

Deterministic validation in `validate-intake-value.ts`. Rejected fields returned in tool result; no state corruption. All-invalid update → `INVALID_INTAKE_FIELD`.

## 11. Surfacing missing fields (no Amy scripting)

`buildIntakeObjectiveContext()` → `session.thinking.append` after successful updates. No `getNextIntakeQuestion`, no intake-triggered conversational `response.create`.

## 12. Concurrent objectives

`active_goal` removed from `update_intake`. Scheduling progresses via `find_availability` independently of intake phase.

## 13. BOOK vs FIND intake

`getMissingFieldsForOperation()` — FIND default `[]`; BOOK uses `operationRequirements` or all required fields. `book_appointment` returns `MISSING_REQUIRED_INFORMATION` with `missing_fields`.

## 14–15. Astra / Live conversational certification

- **Automated (API):** `scripts/test-voice-v3-astra-intake-cert.ts` (requires `OPENAI_API_KEY`)
- **Live PSTN:** not run in cloud agent — manual per user checklist §32

## 16. Unit / integration tests

| Script | Result |
|--------|--------|
| `test-voice-v3-intake-objective.ts` | PASS |
| `test-voice-v3-intake-architecture-guards.ts` | PASS |
| `test-voice-v3-astra-tool-contracts-audit.ts` | PASS |
| `test-voice-v3-closed-loop-intake-multiturn.ts` | PASS |
| `test-voice-v3-architecture-invariants.ts` | PASS |
| `test-voice-v3-prompts.ts` | PASS |
| `test-voice-v3-tool-safety-layer.ts` | PASS |

## 17. Architecture guards

`test-voice-v3-intake-architecture-guards.ts` — intake-objective tree must not import planner/speech helpers; `update_intake` must not include `active_goal` or dispatch FIND.

## 18. Typecheck / build

**Production `npm run build` not run** per cloud agent policy. Static scripts above exercise changed paths.

## Dependency map (audit §1)

`apply-caller-meaning.ts` **still contains** semantic merge, GoalManager, scheduling — **not invoked** from `handleDelegatedVoiceToolCall` / `update_intake`. Production intake is exclusively `update_intake` → `mergeIntakeUpdate` → `deriveIntakeObjective`.

## Follow-ups (not in this pass)

- Dedicated `confirm_intake_field` or voice-email normalizer parity with LiveKit GetEmailTask edge cases
- Stale confirmation rejection at dedicated confirm tool boundary
- Full Astra cert cases 3–4, 7–10 and live conversational scenarios A–D on staging/PSTN
