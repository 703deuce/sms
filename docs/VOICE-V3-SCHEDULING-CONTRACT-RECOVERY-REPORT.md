# Voice V3 — Scheduling contract recovery report

**Status:** Implementation complete on branch `cursor/voice-v3-scheduling-preference-tool-2304`. **Do not production-deploy** until this report is reviewed.

## 1. Old CallerMeaning scheduling fields

`CallerMeaning.scheduling` used `schedulingMeaningZodObject` in `src/lib/voice-v3/intake/caller-meaning-schema.ts` (unchanged).

## 2. SchedulingMeaning type (authoritative)

```typescript
// src/lib/voice-v3/time/scheduling-types.ts
export interface SchedulingMeaning {
  date_expression: string | null;
  date_relation: SchedulingDateRelation;
  weekday: SchedulingWeekday | null;
  explicit_date: string | null;
  time_expression: string | null;
  time_kind: SchedulingTimeKind;
  exact_time: string | null;
  start_time: string | null;
  end_time: string | null;
  daypart: SchedulingDaypart | null;
}
```

### Field reference

| field | type | enums / notes | nullable | meaning | produced | consumed |
|-------|------|---------------|----------|---------|----------|----------|
| `date_expression` | string | — | yes | Caller-facing date phrase (audit/display) | Astra / CallerMeaning | normalizer `sourceDateExpression` |
| `date_relation` | enum | TODAY, TOMORROW, DAY_AFTER_TOMORROW, THIS_WEEKDAY, NEXT_WEEKDAY, EXPLICIT_DATE, UNSPECIFIED | no | Relative/explicit date semantics | Astra / CallerMeaning | `resolveLocalDate` in `scheduling-normalizer.ts` |
| `weekday` | enum | MONDAY…SUNDAY | yes | Weekday anchor for THIS/NEXT_WEEKDAY | Astra / CallerMeaning | `resolveWeekdayDate` |
| `explicit_date` | string (YMD) | — | yes | Calendar date when `EXPLICIT_DATE` | Astra / CallerMeaning | `resolveLocalDate` |
| `time_expression` | string | — | yes | Caller-facing time phrase | Astra / CallerMeaning | clarification + `sourceTimeExpression` |
| `time_kind` | enum | EXACT, AFTER, BEFORE, BETWEEN, DAYPART, ANYTIME, UNSPECIFIED | no | Time constraint shape | Astra / CallerMeaning | time window builders in normalizer |
| `exact_time` | string (HM) | — | yes | Exact local time for EXACT | Astra / CallerMeaning | exact window |
| `start_time` | string (HM) | — | yes | AFTER/BETWEEN lower bound | Astra / CallerMeaning | open/range window |
| `end_time` | string (HM) | — | yes | BEFORE/BETWEEN upper bound | Astra / CallerMeaning | open/range window |
| `daypart` | enum | MORNING, AFTERNOON, EVENING | yes | Daypart window when `time_kind=DAYPART` | Astra / CallerMeaning | `DEFAULT_SCHEDULING_POLICY` bands |

## 3. Normalizer input / output

- **Input:** `SchedulingMeaning` + `VoiceV3CallClock` (timezone, `localDate`, `localWeekday`, frozen `now`).
- **Output:** `NormalizedSchedulingPreference` (`localDate`, `localStartDateTime`, `localEndDateTime`, `utcStart`, `utcEnd`, `precision`, timezone).
- **Clarification:** `deriveSchedulingClarification` in `scheduling-clarification.ts`.

## 4. Old call chain (worked)

```
CallerMeaning.scheduling
  → applyCallerMeaningToContext (apply-caller-meaning.ts)
  → normalizeSchedulingMeaning + deriveSchedulingClarification
  → ctx.scheduling.{meaning, normalized, clarification, generation}
  → evaluateVoiceV3Rules / shouldDispatchFindAvailability
  → buildFindAvailabilityRequest → Microsoft
```

Telemetry: `SCHEDULING_MEANING_RECEIVED`, `SCHEDULING_NORMALIZED`, `SCHEDULING_GENERATION_CHANGED`.

## 5. New call chain

```
Astra set_scheduling_preference(SchedulingMeaning)
  → mergeSchedulingMeaningIntoContext (merge-scheduling-meaning.ts)
  → same normalizer + clarification + generation/staleness
  → find_availability({ service_id? }) reads ctx.scheduling.normalized
  → dispatchFindAvailabilityIfRequired → Microsoft
```

## 6. Preserved components

- `scheduling-normalizer.ts`, `scheduling-clarification.ts`, `scheduling-types.ts`, `call-clock.ts`, timezone helpers
- Generation bump, selection invalidation, `markOperationsStaleForScheduling`
- FIND dispatch, Microsoft adapter, slot generation
- `applyCallerMeaningToContext` scheduling block (tests) now delegates to shared merge

## 7. Removed / replaced

- **Removed:** `parse-scheduling-expressions.ts` (English NLP patch)
- **Removed:** `find_availability` `date_expression` / `time_expression` arguments
- **Deprecated no-op:** `mergeSchedulingNaturalLanguage` (no longer parses English)
- **Not reintroduced:** CallerMeaning on PSTN tool path, GoalManager orchestration for scheduling

## 8. OpenAI tool: `set_scheduling_preference`

- **Schema:** strict `schedulingMeaningZodObject` (same fields as CallerMeaning.scheduling)
- **Registry:** `src/lib/voice-v3/tools/voice-tool-catalog.ts` (9 tools)

## 9. Tool description

See `SET_SCHEDULING_PREFERENCE_TOOL_DESCRIPTION` in `src/lib/voice-v3/tools/astra-tool-contracts.ts`.

## 10. Astra cross-tool instructions

Updated in `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts` (booking/reschedule paths, scheduling block, parallel rules).

## 11. Executor

`src/lib/voice-v3/tools/set-scheduling-preference-tool.ts` — validate → `mergeSchedulingMeaningIntoContext` → `SCHEDULING_PREFERENCE_SET` or `SCHEDULING_CLARIFICATION_REQUIRED`.

`src/lib/voice-v3/tools/find-availability-tool.ts` — `SCHEDULING_PREFERENCE_REQUIRED` when no normalized preference; no NL merge.

## 12. parse-scheduling-expressions.ts

Deleted. `scripts/test-voice-v3-parse-scheduling-expressions.ts` deleted.

## 13. Regression: old vs new normalization

`scripts/test-voice-v3-scheduling-preference-parity.ts` — CallerMeaning path vs `mergeSchedulingMeaningIntoContext` for 8 semantic fixtures.

## 14. Real Astra certification

**Script:** `npm run test:voice-v3-astra-scheduling-cert`

**Live run (2026-09-19): PASS** — all eight scenarios produced valid `SchedulingMeaning` via `set_scheduling_preference`:

| Scenario | Key semantics verified |
|----------|------------------------|
| Tuesday afternoon | THIS_WEEKDAY + TUESDAY + DAYPART + AFTERNOON |
| Tomorrow at 3 | TOMORROW + EXACT + 15:00 |
| Next Wednesday morning | NEXT_WEEKDAY + WEDNESDAY + MORNING |
| After 3 Friday | AFTER + start_time 15:00 + FRIDAY |
| Before noon tomorrow | TOMORROW + BEFORE + end_time 12:00 |
| Between 2 and 5 Tuesday | BETWEEN + 14:00–17:00 |
| September 28 at 11 | EXPLICIT_DATE 2026-09-28 + EXACT 11:00 |
| Correction to Wednesday | WEDNESDAY + MORNING (not Tuesday) |

Also: `test-voice-v3-astra-tool-selection.ts` (production contracts) PASS including `scheduling_correction` → `set_scheduling_preference`.

## 15–18. Verification commands

```bash
npm run test:voice-v3-availability
npm run test:voice-v3-architecture-invariants
npm run test:voice-v3-intake
npm run test:voice-v3-prompts
npx tsc --noEmit -p tsconfig.json
```

## STOP

Architecture target:

**Astra → structured `set_scheduling_preference` → same deterministic normalizer → FIND → Microsoft**

Not: **Astra → English strings → homemade parser → normalizer**.
