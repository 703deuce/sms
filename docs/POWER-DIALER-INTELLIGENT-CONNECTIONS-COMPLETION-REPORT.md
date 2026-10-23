# Power Dialer — Intelligent Connections completion report

**Branch:** `cursor/intelligent-connections-9779`  
**Baseline:** `master` @ `7296e2068`  
**Merge/deploy:** Not performed (per directive).

## A. What was implemented

| Area | Files |
|------|--------|
| Answer classification | `new-app/lib/server/phone/power-dialer/answer-classification.ts` |
| AMD entitlement / billing gate | `new-app/lib/server/phone/power-dialer/amd-policy.ts`, `power-dialer-amd.ts` |
| Webhook lifecycle | `new-app/lib/server/phone/power-dialer/amd-webhook-handler.ts`, `answer-detection-events.ts` |
| Screening execution | `new-app/lib/server/phone/power-dialer/screening-executor.ts`, `screening-timeout.ts` |
| Parallel machine filter | `parallel-orchestrator.ts` (`hangupNonHumanParallelLeg`, `assertParallelWinnerEligible`) |
| Connection UX model | `connection-intelligence.ts`, `session-runtime.ts`, `power-dialer-session.tsx` |
| Telnyx ingress | `calls-service.ts` (webhooks + answer phase metadata) |
| Call history / CRM | `call-source-context.ts`, `call-source-label.ts`, `calls-table.tsx`, `contact-timeline.ts` |
| Analytics KPI fix | `analytics-service.ts` (confirmed human connections only) |
| Tests | `scripts/test-power-dialer-intelligent-connections.ts`, fixture updates |

## B. Telnyx integration

**AMD start (WebRTC + Call Control):** After PSTN link, `startPowerDialerAmdOnCallControlLeg` resolves policy via `resolvePowerDialerAmdStartPlan`:

- Standard `Detect` when premium not required.
- `detection_mode: Premium` when premium entitlement / parallel_amd / screening settings require it.
- When call screening is enabled: **Premium AMD-start only**; `iosScreeningRequested` + `iosScreeningWireStatus: requested_pending_dial_origination` until PSTN is originated via documented API (see `docs/POWER-DIALER-TELNYX-IOS-SCREENING-INTEGRATION-PATH.md`).

**Apple iOS screening (blocker resolved in policy, not in live wire):** Telnyx documents `premium_ios_call_screening_detection` on **POST /v2/calls** and **transfer** — not on post-answer `answering_machine_detection_start`. We no longer send `PremiumCallScreening` on AMD-start. Webhook handlers remain for when Phase 2 dial-origination is enabled (`POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION=1`, implementation pending).

**Webhooks handled:**

- `call.machine.detection.ended`
- `call.machine.premium.detection.ended`
- `call.machine.premium.call_screening.detected` (`result=screening` → `screener`)
- `call.machine.premium.greeting.ended` (`prompt_ended`, `beep_detected`)

Idempotency via `powerDialerDetectionEvent.idempotencyKey`; stale events ignored for terminal attempts.

## C. Call behavior

| Case | Behavior |
|------|----------|
| Human | Classification `human`; parallel winner eligible; phase `human_connected`; counts as confirmed human conversation. |
| Voicemail / machine greeting | `voicemail` or `machine`; parallel_amd hangs up filtered legs; not a confirmed human conversation. |
| Apple screening | When `iosScreeningWireActive` and `call.machine.premium.call_screening.detected` → `screener`; intro per policy; bounded timeout; not counted as human until post-screening AMD returns `human`. **Not live-wired on WebRTC-only path today.** |
| Uncertain | `not_sure` / `silence` → `uncertain`; parallel_amd excludes from winner; policy may hang up or voicemail path. |
| Screening timeout | No fabricated accept; leg hung up; `screeningOutcome: timeout`. |

## D. UI placement

- **Dialer session:** `power-dialer-session.tsx` — connection phase label + screening notice.
- **Call history:** `calls-table.tsx` (power_dialer variant) — Answer column (classification, screening, AMD mode).
- **CRM timeline:** `contact-timeline.ts` — disposition + answer + screening outcome on PD attempts.

## E. Verification

```bash
cd new-app && npx tsx scripts/test-power-dialer-intelligent-connections.ts
npx tsx scripts/test-power-dialer-b1.ts
npx tsx scripts/test-power-dialer-batch8.ts
```

All passed in implementation environment. No live PSTN / Telnyx account tests.

## F. Cost handling

- Single AMD session per leg (`amdSessionStarted` in attempt metadata).
- Premium start gated by `parseAdvancedDialEntitlements` and mode (`parallel_amd` requires `premiumAmdEnabled`).
- `amdBillingTier` / `amdDetectionMode` stored on attempt for visibility.

## G. External dependencies

- Telnyx account must support Premium AMD (billable).
- Apple iOS screening requires `premium_ios_call_screening_detection` on dial/transfer (Phase 2) or explicit Telnyx confirmation for AMD-start on WebRTC legs.

## H. Deployment readiness

**Ready for controlled merge/live test:** parallel machine filter, premium AMD, screening policy execution, CRM/UI, analytics — without Apple screening SLA.

**Not production-ready without Phase 2:** Apple iOS Call Screening detection on outbound dials. See `docs/POWER-DIALER-TELNYX-IOS-SCREENING-INTEGRATION-PATH.md`. Do not merge/deploy Apple screening as a shipped guarantee until dial-origination or Telnyx AMD-start confirmation + live smoke.
