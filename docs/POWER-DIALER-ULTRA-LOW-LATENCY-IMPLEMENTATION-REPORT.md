# Power Dialer Ultra-Low-Latency — Implementation Report

**Date:** 2026-10-24  
**Repository:** `703deuce/sms`  
**Production commit:** `a4cb36edff5a86d3b30a1bde54f2b8d9ac5e2f66` (short: `a4cb36edf`)  
**Prior production baseline:** `3b6e44b9d035f987cec9c4af10b21dc5e6e76a42`  
**Branch merged:** `cursor/power-dialer-ultra-low-latency-9779` → `master`  
**Coolify deployment:** **3959** (finished)  
**Production URL:** https://transovo.ai  
**Health check:** `GET https://transovo.ai/api/health` → `commitSha` matches deploy  

Related audit (read-only analysis): `docs/POWER-DIALER-TELNYX-ULTRA-LOW-LATENCY-AUDIT.md`

---

## Mission (what this work was for)

Minimize delay between a prospect answering and the salesperson hearing/speaking on live audio across all five Transovo dialing modes, without breaking screening, AMD machine filtering, iOS screening, predictive pacing, or existing Telnyx bridge architecture.

**Engineering targets (not guarantees):** p95 answer-to-first-audio ≤500 ms where achievable; ≤250 ms stretch. **No claim** that targets were met in production — live PSTN first-audio was **not** measured in this run.

---

## Executive summary

| Area | Outcome |
|------|---------|
| Session warm agent media | Implemented — session-start SIP leg; dials blocked until `agentMediaReady` when server-iOS path applies |
| Fast parallel (no machine filter) | Implemented — connect on prospect `call.answered`, not only after AMD human |
| Parallel + machine filter (`parallel_amd`) | Preserved — still requires confirmed human before bridge/winner |
| iOS screening server PSTN | Preserved — fast-connect **disabled** when iOS screening wire is active |
| Atomic parallel winner | Implemented — Postgres conditional JSON update before loser hangups |
| Direct bridge | Default; optimized hot path hooks |
| Conference benchmark | Optional via env — not measured vs direct in production |
| Latency instrumentation | Milestone events on `PowerDialerDetectionEvent` (async, off critical path) |
| Tests | Four script suites PASS; `new-app` production build PASS |
| Deploy | Merged to `master`, pushed, Coolify 3959 healthy |

---

## Architecture implemented

### 1. Session warm agent media (primary change for server-iOS)

When a rep starts a dialing session and server-iOS screening origination applies:

1. Client calls session action **`prepare_agent_media`** with outbound caller ID (`fromE164`).
2. Server originates a **persistent agent SIP leg** (`kind: pd_session_warm_agent`) — not one new agent call per prospect.
3. Browser auto-answers via existing server-iOS inbound flow (`primePowerDialerAgentLeg` + `serverIosOutboundRef`).
4. On Telnyx `call.answered` for that leg, server sets **`agentMediaReady: true`** in `parallelStateJson`.
5. **`create_attempt`** / server-iOS origination is **blocked** until media is ready (when warm agent is required).

**Cleanup:** Session end runs `teardownSessionAgentMedia` (hangup shared control ID, complete warm `humanCall`).

**When warm agent is NOT required:** `prepare_agent_media` can mark ready immediately (`warm_agent_not_required`); WebRTC-only workspaces use **`report_agent_media_ready`** if needed.

**Disable warm leg:** `POWER_DIALER_SESSION_WARM_AGENT=0` (default: enabled when iOS origination applies).

### 2. Shared agent leg across prospects

- `power-dialer-server-pstn-dial.ts` reuses **session** `sharedIosAgentCallControlId` for **all** modes when present (not only multiline).
- New per-prospect agent SIP dial is skipped when shared leg already exists.

### 3. Connection policies (AMD vs fast-connect)

**Module:** `new-app/lib/server/phone/power-dialer/connection-policy.ts`

| Mode / setting | Bridge / winner behavior |
|----------------|---------------------------|
| **Preview** | Fast-connect on answer when policy allows (no unnecessary AMD wait for non-gated paths) |
| **Power** | Fast-connect when not AMD/iOS-gated; AMD can still run async on Telnyx |
| **Parallel** (standard) | **Fast-connect on prospect answer** — does not wait for AMD human |
| **Parallel + machine filter** (`parallel_amd` or `amdFilter`) | **Confirmed human** required before bridge (unchanged intent) |
| **Predictive** | Same policy layer as multiline where applicable |
| **iOS screening wire active** | **No** fast-connect on raw answer — still waits for classification/screening gates |

**Important:** Biggest speed win for many customers is **removing unnecessary AMD wait on standard parallel**, not replacing Telnyx direct bridge. Machine-filtered and iOS-screening modes stay protected.

### 4. Fast connect on `call.answered`

**Module:** `new-app/lib/server/phone/power-dialer/power-dialer-fast-connect.ts`  
**Wired in:** `new-app/lib/server/phone/calls-service.ts` on power-dialer prospect leg answer.

Flow:

1. Prospect PSTN leg answers → webhook updates attempt → `maybeFastConnectPowerDialerOnAnswer`.
2. If policy allows → parallel: `onParallelHumanAnswered` with classification `uncertain`; single-line: `maybeBridgePowerDialerAgentToProspect` with reason `fast_connect_answer`.
3. AMD webhooks still run for machine filter, iOS screening, voicemail drop, etc.

### 5. Atomic parallel winner selection

**Module:** `new-app/lib/server/phone/power-dialer/parallel-winner-claim.ts`  
**Used by:** `parallel-orchestrator.ts` → `onParallelHumanAnswered`.

- Conditional `UPDATE` on `power_dialer_sessions.parallelStateJson` sets `winnerAttemptId` only if none exists (or same attempt idempotent retry).
- Loser hangups happen **after** durable winner commit.
- Duplicate/simultaneous webhooks should not bridge two prospects to one rep.

### 6. Bridge mechanism

- **Default:** `bridgeCalls` (direct Telnyx bridge) via `bridgeCallsWithBenchmark`.
- **Benchmark only:** `POWER_DIALER_BRIDGE_BENCHMARK=conference` joins agent + prospect to a conference (for controlled comparison — **not** verified in this deployment).

**Module:** `power-dialer-leg-bridge.ts` — uses `classificationSatisfiesBridgeGate` so fast-connect can bridge on `uncertain` when policy allows; AMD-filtered modes still require human.

### 7. Dial coordinator

**Module:** `new-app/lib/server/phone/power-dialer/dial-coordinator.ts`

Read-only session snapshot from Postgres: agent media ready, shared agent control ID, winner attempt ID, live attempt count. **No** process-local cache for correctness.

### 8. Latency instrumentation

**Module:** `new-app/lib/server/phone/power-dialer/latency-timeline.ts`

Milestones (examples): `session_start`, `agent_media_ready`, `prospect_answered`, `answer_webhook_received`, `winner_claim_attempted`, `winner_committed`, `bridge_command_issued`, `bridge_api_response`, `telnyx_bridge_completed`, etc.

Stored as `PowerDialerDetectionEvent` with `eventType: latency_<milestone>` and idempotency keys. **Not** full p50/p95/p99 dashboards yet — data layer for future analytics.

**Not implemented:** Measured answer-to-first-audio at PSTN endpoint (would need controlled test call + audio capture).

### 9. Browser / WebRTC

**`workspace-provider.tsx`:**

- `primePowerDialerAgentLeg` — arms auto-answer for session warm SIP leg.
- Mic `getUserMedia` prefetch when Telnyx reports ready (reduces first-answer delay).

**`power-dialer-session.tsx`:**

- On session start: `prepare_agent_media` + prime leg when `humanCallId` returned.

### 10. API surface

**`PATCH /api/phone/power-dialer/sessions/[id]`** new actions:

| Action | Body | Purpose |
|--------|------|---------|
| `prepare_agent_media` | `{ fromE164 }` | Start session warm agent SIP leg |
| `report_agent_media_ready` | — | Mark ready when warm leg not required (WebRTC-only path) |

**GET session runtime** now includes:

```json
"agentMedia": {
  "required": true,
  "ready": false,
  "warmAgentHumanCallId": "..."
}
```

---

## Files changed (complete list)

### New files

| Path |
|------|
| `docs/POWER-DIALER-TELNYX-ULTRA-LOW-LATENCY-AUDIT.md` |
| `docs/POWER-DIALER-ULTRA-LOW-LATENCY-IMPLEMENTATION-REPORT.md` (this file) |
| `new-app/lib/server/phone/power-dialer/connection-policy.ts` |
| `new-app/lib/server/phone/power-dialer/dial-coordinator.ts` |
| `new-app/lib/server/phone/power-dialer/latency-timeline.ts` |
| `new-app/lib/server/phone/power-dialer/parallel-winner-claim.ts` |
| `new-app/lib/server/phone/power-dialer/power-dialer-fast-connect.ts` |
| `new-app/lib/server/phone/power-dialer/session-agent-media.ts` |
| `new-app/scripts/test-power-dialer-low-latency.ts` |

### Modified files

| Path | Role |
|------|------|
| `new-app/app/api/phone/power-dialer/sessions/[id]/route.ts` | `prepare_agent_media`, `report_agent_media_ready` |
| `new-app/components/phone/power-dialer-session.tsx` | Session start warm media |
| `new-app/components/providers/workspace-provider.tsx` | `primePowerDialerAgentLeg`, mic prefetch |
| `new-app/lib/phone-api.ts` | Types + action union |
| `new-app/lib/server/phone/calls-service.ts` | Warm leg answered, fast connect, bridge milestone |
| `new-app/lib/server/phone/power-dialer/amd-webhook-handler.ts` | Pass classification to parallel winner |
| `new-app/lib/server/phone/power-dialer/parallel-orchestrator.ts` | Atomic claim, iOS gate on eligibility |
| `new-app/lib/server/phone/power-dialer/power-dialer-leg-bridge.ts` | Policy gate + benchmark bridge + latency |
| `new-app/lib/server/phone/power-dialer/power-dialer-server-pstn-dial.ts` | Shared session agent for all modes |
| `new-app/lib/server/phone/power-dialer/session-runtime.ts` | Agent media gate + runtime field + teardown |
| `new-app/lib/server/phone/routing/telnyx-call-control.ts` | `bridgeCallsWithBenchmark` |

---

## Environment variables

| Variable | Values | Effect |
|----------|--------|--------|
| `POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION` | `1` (production) | Server PSTN + iOS screening origination |
| `POWER_DIALER_SESSION_WARM_AGENT` | `0` to disable | Session warm SIP leg at session start |
| `POWER_DIALER_BRIDGE_BENCHMARK` | `conference` | Use conference join instead of direct bridge (benchmark only) |

Production container (deploy 3959) confirmed: `POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION=1`, `SOURCE_COMMIT=a4cb36edf...`

---

## Testing executed

Run from `new-app/`:

```bash
npx tsx scripts/test-power-dialer-low-latency.ts
npx tsx scripts/test-power-dialer-intelligent-connections.ts
npx tsx scripts/test-power-dialer-batch8.ts
npx tsx scripts/test-power-dialer-ios-screening-dial.ts
npm run build
```

| Suite | Result |
|-------|--------|
| `test-power-dialer-low-latency.ts` | **PASS** |
| `test-power-dialer-intelligent-connections.ts` | **PASS** |
| `test-power-dialer-batch8.ts` | **PASS** |
| `test-power-dialer-ios-screening-dial.ts` | **PASS** |
| `npm run build` | **PASS** (Next.js may prompt security advisory once; retry succeeds) |

### Not verified in this run

- Live PSTN answer-to-first-audio latency (p50/p95/p99)
- Conference vs direct bridge under identical PSTN conditions
- Load test of concurrent AMD/answer webhooks across multiple Coolify instances
- Full manual dialer UI walkthrough on production with real calls

---

## Performance / metrics (honest)

| Metric | Status |
|--------|--------|
| Before/after production latency | **Not available** |
| Agent media setup time | Instrumented (`latency_agent_media_*`); not aggregated here |
| Answer-to-bridge p50/p95/p99 | Partially supported via `answerToBridgeMs` on winner metadata + latency events; **not computed** in this report |
| Answer-to-first-audio | **Not measured** (bridge completion ≠ audible speech) |

---

## Deployment verification

| Check | Result |
|-------|--------|
| Git `master` on GitHub | `a4cb36edff5a86d3b30a1bde54f2b8d9ac5e2f66` |
| Coolify queue id | **3959** — `finished` |
| Container name (example) | `ds8s3hjin60qs6g7s0iqkixs-20261024T101837` |
| Image | `ds8s3hjin60qs6g7s0iqkixs:a4cb36edff5a86d3b30a1bde54f2b8d9ac5e2f66` |
| `GET /api/health` | `ok: true`, `commitSha` matches |
| `/app/power-dialer/dialer` | HTTP 200 (smoke) |
| Container startup logs | Next.js ready, no fatal errors in tail |
| Rollback performed | **No** |

**SSH:** `coolify-server` (see `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`). Web app UUID: `ds8s3hjin60qs6g7s0iqkixs`.

---

## Preserved features (intent)

Preview, Power, Parallel, Parallel + machine filtering, Predictive, iOS screening, premium AMD, voicemail workflows, recording, dispositions, CRM, call history, caller ID, WebRTC, session pause/resume/stop, workspace isolation — **no deliberate removal**; behavior changes are policy-gated as above.

---

## Known limitations / reviewer notes

1. **Atomic winner SQL** merges `parallelStateJson` with `jsonb_build_object`; concurrent updates to other keys in the same column should remain rare but are worth watching.
2. **Fast parallel** can connect before AMD on non-iOS, non-filter paths — by design; use `parallel_amd` / machine filter for stricter human-only bridging.
3. **Session warm agent** requires browser to answer session SIP; if auto-answer fails, `create_attempt` errors until media is ready.
4. **Concurrent webhook integration tests** against real Postgres were not added; unit/policy tests + existing batch suites cover regressions.

---

## Next.js security advisory

Build may stop once with a security nudge. From `new-app/`:

```bash
next upgrade --agent=security --internal-nudge-id=23882fe6-ecbc-44fc-a9df-6fc3785fdf2b
```

Reference: https://registry.npmjs.org/-/npm/v1/security/advisories/bulk

---

## Quick copy: commit message used

```
Implement power dialer ultra-low-latency architecture

Add session warm agent media, per-mode connection policies with fast parallel
connect, atomic parallel winner claims, webhook fast-connect path, latency
milestones, dial coordinator state, and optional conference bridge benchmark.
```

---

*End of report.*
