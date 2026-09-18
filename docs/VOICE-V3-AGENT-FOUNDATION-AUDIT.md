# Voice V3 — Production Agent Foundation Audit

Branch: `cursor/voice-v3-meaning-find-fix-2304` (updated after foundation completion pass).

## Status summary

| Area | Status | Notes |
|------|--------|--------|
| Authoritative runtime + `commitContext`/`replan` | **COMPLETE** | `replaceContext` → replan; meaning apply → replan |
| Composable agent planner | **COMPLETE** | `agent/agent-planner.ts` |
| Multi-goal (`goals[]` + `GoalManagerState`) | **COMPLETE** | Schema + `normalizeCallerGoals` + queue ordering |
| Operations registry (authoritative) | **COMPLETE** | `operations` on context; FIND wired; registry API |
| Claim gating from registry | **COMPLETE** | `evaluate-claims.ts` |
| Handoff / escalation | **COMPLETE** | `escalation.ts`, explicit transfer, blocker counters |
| Recovery matrix codes | **COMPLETE** | Including outcome-unknown for BOOK/RESCHEDULE/CANCEL |
| Invariant checker | **COMPLETE** | Core + `test-voice-v3-agent-invariants.ts` |
| Conversation simulator / foundation tests | **COMPLETE** | `npm run test:voice-v3-agent` (5 scripts) |
| Failure matrix §47 | **PARTIAL** | Representative scenarios in `test-voice-v3-agent-failure-matrix.ts`; not every HTTP code path |
| BOOK/RESCHEDULE operation registration on all executor paths | **PARTIAL** | FIND + test hooks; book/reschedule/cancel should register on start (follow-up in dispatch files) |
| Live snapshot supersede certification | **COMPLETE** | `state_version` + explicit supersede instruction in snapshot |
| PSTN certification §51 | **NOT RUN** | Manual after deploy |
| Real Astra multi-goal messy language | **NOT RUN** | Requires live Astra |

## Automated verification

```bash
npm run test:voice-v3-agent
npm run test:voice-v3-recovery
```

## Architecture loop

```
mutation → commitContext/replaceContext → invariants → planAgentState → Live snapshot (async)
```

## Remaining before PSTN

1. Register `BOOK_APPOINTMENT` / `RESCHEDULE_APPOINTMENT` / `CANCEL_APPOINTMENT` operations at commit boundaries in all dispatch paths (mirror FIND).
2. Expand failure-matrix tests for every listed Microsoft HTTP class if not already covered by integration tests.
3. Run real Astra integration with multi-goal utterances.
4. Deploy + PSTN A–E with production timeline inspection.
