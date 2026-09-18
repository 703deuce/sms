# Voice V3 — Production Agent Foundation Audit

Branch: `cursor/voice-v3-meaning-find-fix-2304`

## Status summary

| Area | Status | Notes |
|------|--------|--------|
| Authoritative runtime + `commitContext`/`replan` | **COMPLETE** | `replaceContext` → replan; meaning apply → replan |
| Composable agent planner | **COMPLETE** | `agent/agent-planner.ts` |
| Multi-goal (`goals[]` + `GoalManagerState`) | **COMPLETE** | Schema + `normalizeCallerGoals` + queue ordering |
| Operations registry (authoritative) | **COMPLETE** | FIND + BOOK + RESCHEDULE + CANCEL at commit boundary |
| Claim gating from registry | **COMPLETE** | `evaluate-claims.ts` |
| Handoff / escalation | **COMPLETE** | `escalation.ts`, explicit transfer, blocker counters |
| Recovery matrix codes | **COMPLETE** | Including outcome-unknown for BOOK/RESCHEDULE/CANCEL |
| Invariant checker | **COMPLETE** | Core + `test-voice-v3-agent-invariants.ts` |
| Conversation simulator / foundation tests | **COMPLETE** | `npm run test:voice-v3-agent` |
| Failure matrix §47 (production classes) | **COMPLETE** | `test-voice-v3-agent-failure-matrix.ts` |
| BOOK/RESCHEDULE/CANCEL operation registration | **COMPLETE** | `dispatch-mutations.ts` + `test-voice-v3-operation-registration.ts` |
| Live snapshot supersede certification | **COMPLETE** | `state_version` + explicit supersede instruction in snapshot |
| Live + Astra messy multi-goal certification | **NOT RUN** | Catalog: `scripts/test-voice-v3-live-astra-multi-goal-cert.ts` |
| PSTN certification §51 (A–E) | **NOT RUN** | Manual after deploy |

## Automated verification

```bash
npm run test:voice-v3-agent
npm run test:voice-v3-recovery
npm run test:voice-v3-booking
```

Optional (staging, not CI gate):

```bash
VOICE_V3_LIVE_ASTRA_CERT=1 VOICE_V3_CERT_BASE_URL=https://... tsx scripts/test-voice-v3-live-astra-multi-goal-cert.ts
```

## Architecture loop

```
mutation → commitContext/replaceContext → invariants → planAgentState → Live snapshot (async)
```

## Before PSTN deploy

1. Run Live + Astra messy multi-goal cert on staging (cases in cert script).
2. Merge foundation branch, deploy, run PSTN A–E with production timeline inspection.
