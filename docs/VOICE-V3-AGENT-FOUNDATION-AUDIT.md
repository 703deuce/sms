# Voice V3 — Production Agent Foundation Audit

Branch: `cursor/voice-v3-meaning-find-fix-2304`

## Status summary

| Area | Status | Notes |
|------|--------|--------|
| Authoritative runtime | **COMPLETE** | `commitContext` / `replaceContext` → replan |
| Planner | **COMPLETE** | Composable `agent-planner.ts` |
| Multi-goal | **COMPLETE** | `goals[]`, `GoalManagerState`, queue ordering |
| Operations registry | **COMPLETE** | Shared lifecycle via `run-authoritative-operation.ts` |
| Claim gating | **COMPLETE** | `evaluate-claims.ts` + outcome-unknown blocks success claims |
| Handoff / escalation | **COMPLETE** | `escalation.ts`, explicit transfer |
| Recovery matrix | **COMPLETE** | Central `evaluate-recovery.ts` |
| Invariants | **COMPLETE** | `runtime-invariants.ts` + tests |
| Conversation simulator | **COMPLETE** | `test-voice-v3-agent-simulator.ts` |
| Failure matrix §47 | **COMPLETE** | `test-voice-v3-s47-complete.ts`, failure-matrix, closed-loop |
| BOOK operation integration | **COMPLETE** | `runAuthoritativeOperation` in `book-dispatch.ts` |
| RESCHEDULE operation integration | **COMPLETE** | `runAuthoritativeOperation` in `reschedule-dispatch.ts` |
| CANCEL operation integration | **COMPLETE** | `runAuthoritativeOperation` in `cancel-dispatch.ts` |
| FIND operation integration | **COMPLETE** | `startOperation` / `transitionOperation` in `find-dispatch.ts` (read op helper available) |
| Live snapshot supersede | **COMPLETE** | `state_version` in Live snapshot |
| Live + Astra messy multi-goal | **COMPLETE** (automated) | `test-voice-v3-astra-multi-goal-live.ts` — ran in CI-capable env with `OPENAI_API_KEY` |
| PSTN certification §51 (A–E) | **NOT RUN** | Manual after deploy |
| Live delegation protocol (production regression) | **COMPLETE** (automated) | `test-voice-v3-delegation-protocol-race.ts` — 2026-09-18 PSTN `live_u7_EPUw0p3oNCWpJREgASWvqW2QrPIdZXdG` race |

**PARTIAL / MISSING:** none (foundation).

### Production regression (2026-09-18)

PSTN call hit `Submit the pending function call outputs before response.create` when semantic recovery issued `response.create` before `emit_caller_meaning` was closed. Fixed with per-session delegation coordinator (`response.item.create` function_call_output before any gated `response.create`), authoritative `response.output_item.done` handling, active-recovery planner precedence, and greeting barge-in telemetry (overlap vs interruption).

## Automated verification

```bash
npm run test:voice-v3-agent
npm run test:voice-v3-recovery
npm run test:voice-v3-intake
npm run test:voice-v3-availability   # includes datetime
npm run test:voice-v3-booking
npm run test:voice-v3-cancellation
npm run test:voice-v3-reschedule
npm run test:voice-v3-prompts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-astra-multi-goal-live.ts
```

## Architecture loop

```
mutation → commitContext/replaceContext → invariants → planAgentState → Live snapshot (async)
```

## Before PSTN deploy

1. Merge foundation branch and deploy.
2. Verify deployed SHA / runtime health.
3. Run PSTN A–E with production timeline inspection.
