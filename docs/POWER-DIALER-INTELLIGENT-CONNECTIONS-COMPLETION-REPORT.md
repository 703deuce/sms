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
- `detection_mode: PremiumCallScreening` + `answering_machine_detection_config.prompt_end_timeout_millis` when workspace call screening is enabled and premium AMD is entitled (TeXML-aligned naming; live Telnyx validation required).

**Documented limitation:** Telnyx documents `premium_ios_call_screening_detection` on **POST /v2/calls** at origination. Power Dialer still uses WebRTC `newCall` + post-link AMD-start; iOS screening webhooks are only reliable when Telnyx honors `PremiumCallScreening` on AMD-start or when a future server-originated PSTN leg is added.

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
| Apple screening | Authoritative `call.machine.premium.call_screening.detected` → `screener`; intro per policy; bounded timeout; not counted as human until post-screening AMD returns `human`. |
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

- Telnyx account must support Premium AMD and (for iOS) screening mode on AMD-start or dial-origination path.
- Live validation of `PremiumCallScreening` on `answering_machine_detection_start` vs dial-time `premium_ios_call_screening_detection`.

## H. Deployment readiness

Implementation complete on branch `cursor/intelligent-connections-9779`; ready for review. Do not merge until product signs off on WebRTC vs dial-origination AMD strategy and live Telnyx smoke.
