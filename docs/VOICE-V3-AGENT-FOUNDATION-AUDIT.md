# Voice V3 — Production Agent Foundation Audit

Status as of agent foundation pass on branch `cursor/voice-v3-meaning-find-fix-2304`.

## Architecture reuse

| Area | Status | Location |
|------|--------|----------|
| Authoritative runtime | COMPLETE | `state/call-runtime.ts`, `state/call-context.ts` |
| Rules engine | COMPLETE | `state/call-rules.ts` |
| Meaning merge | COMPLETE | `intake/apply-caller-meaning.ts` |
| Goal merge (no UNKNOWN downgrade) | COMPLETE | `intake/merge-active-goal.ts` |
| Goal lifecycle / abandon | PARTIAL | `agent/goal-manager.ts` (single active instance; pending queue hook) |
| Recovery directives | PARTIAL | `recovery/evaluate-recovery.ts` (+ expanded codes) |
| Semantic retry | COMPLETE | `intake/semantic-extraction-retry.ts` |
| Composable agent planner | COMPLETE | `agent/agent-planner.ts` + evaluators |
| Agent snapshot → Live | COMPLETE | `agent/after-state-change.ts`, `agent/sync-agent-state-to-live.ts` |
| Claim gating | COMPLETE | `agent/evaluate-claims.ts` |
| Async operation registry (derived) | PARTIAL | `agent/async-operations.ts` (FIND/BOOK/CANCEL/RESCHEDULE) |
| Capabilities | COMPLETE | `agent/capability-state.ts` |
| Invariant checker | PARTIAL | `agent/runtime-invariants.ts` (core booking/slot checks) |
| Conversation simulator | PARTIAL | `scripts/test-voice-v3-agent-simulator.ts` |
| Handoff / escalation counters | MISSING | — |
| Full failure matrix tests (§47) | MISSING | — |
| PSTN certification (§51) | NOT RUN | Manual |

## Planner composition

`planAgentState` composes: `evaluateGoals`, `evaluateRequirements`, `evaluateOperations`, `evaluateRecoveryBlocker`, `evaluateAllowedClaims`, `chooseNextConversationAction`.

## Runtime loop

`afterVoiceV3StateChange` runs after caller meaning apply and FIND completion (non-blocking Live enqueue via `queueMicrotask`).

## Remaining limitations

- Multi-goal queue requires Astra/schema support for multiple intents per turn.
- Unified `operations` map on context not persisted (derived from calendar phases).
- Reschedule/cancel outcome-unknown recovery codes typed but not all executor paths emit them yet.
- PSTN and real Astra integration tests remain manual post-deploy.
