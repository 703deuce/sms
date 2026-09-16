# Voice V2 — After-hours operations

**Scope:** Operating state, on-call roster, friction telemetry, resolution audit, callback SLA, Quality Studio, analytics, mobile operations.

**Architecture:** One Amy · Voice V2 `CallContext` · pinned published config · dynamic operational overrides (no republish for tonight’s on-call / temp closure).

## Operating states

Canonical states: `OPEN`, `CLOSED_AFTER_HOURS`, `WEEKEND`, `HOLIDAY`, `TEMPORARILY_CLOSED`, `OVERFLOW`, `UNKNOWN`.

Resolver: `resolveVoiceV2OperatingState()` in `src/lib/voice-v2/operating-maturity/operating-state.ts`.

**Important:** Operating state does **not** change inbound routing (`VOICE_AGENT` / TeXML / MCTB / LiveKit). Calls still arrive via carrier forwarding; state only affects Amy’s allowed actions.

Pinned on call start via `buildVoiceV2CallContextPayload()` → `applyOperatingMaturityToCallContext()`.

## Business hours & holidays

Wizard home: **Information** (business schedule in `operatingMaturity.businessSchedule`).

Live temporary closure: `VoiceOperationalOverride` kind `TEMPORARY_CLOSURE` or wizard defaults.

## After-hours behavior

Wizard: **Call Handling** → `operatingMaturity.afterHoursBehavior` gates transfer/booking/callback when closed.

Capability gating: `gateCapabilitiesForOperatingState()` — deterministic; not prompt-only.

## On-call

Schedule: `operatingMaturity.onCallSchedule` (published).

Resolver: `resolveActiveOnCallTarget()`.

Operational override: `VoiceOperationalOverride` kind `ON_CALL` — immediate effect, audited.

Urgency `TRANSFER` reuses existing `executeVoiceV2TransferPlan` with on-call `transferPlanId` when configured.

## Callback SLA

Policy: `operatingMaturity.callbackSla`.

Lifecycle metadata on `CallbackRequest.metadata.voiceV2CallbackSla`.

Overdue scan job: `voice_v2_callback_sla_overdue_scan`.

## Friction telemetry

Realtime: `detectRealtimeFrictionSignals()` on measurable call context/meta.

Post-call LLM friction classifier: **telemetry only** (hook point reserved; do not drive transfer/booking).

## Resolution audit

`normalizeVoiceV2ResolutionAudit()` — extended statuses for after-hours quality record.

## Quality Studio

Headless runner: `runQualityStudioHeadless()` + API `POST /api/voice-v2/quality-studio/run`.

Wizard **Test** page should call API; `qualityStudioLastRun` tracks config hash staleness.

## Analytics

`GET /api/voice-v2/analytics/after-hours` — resolution rate, friction counts, recovery/callback fields from call metadata.

## Mobile operations

`/voice/operations` — responsive cards for state, on-call override, temporary closure.

## Tests

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-after-hours-maturity-headless.ts
```

## Dynamic vs pinned

| Pinned at publish | Resolved live |
|-------------------|---------------|
| Weekly hours template | Current operating state |
| After-hours behavior flags | Temp closure override |
| On-call schedule template | On-call operational override |
| Callback SLA policy | Callback deadlines / overdue |

## Known limitations (this pass)

- Wizard UI for full weekly hours editor is incremental; defaults apply when unset.
- Post-call friction LLM classifier is typed/stubbed; realtime signals are authoritative for gating.
- Full analytics dashboard UI is API-backed; drill-down uses existing call detail routes.
- PSTN certification for on-call transfer remains manual.
