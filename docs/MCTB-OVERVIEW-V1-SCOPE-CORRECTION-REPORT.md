# MCTB Overview V1 scope correction report

Branch: `cursor/mctb-critical-path-perf-2304`  
Date: 2026-09-27

## Before call graph (Overview enrichment)

```
/mctb (Stage 2)
  loadMctbOverviewCore (~392–657 ms) — KPIs, recent activity, setup health
  loadMctbOverviewEnrichment (~9 s) — client fetch /api/mctb/overview-enrichment
    loadLeadRecoveryConfig()
      assemble config
      computeLeadRecoveryPolicyHealth()
        evaluateMctbAiBookingReadiness()  ← Microsoft heal + provider audit + booking context
    computeLeadRecoveryPolicyHealth()     ← again
      evaluateMctbAiBookingReadiness()    ← again
    evaluateMctbAiBookingReadiness()      ← third direct call
    loadMctbLineInboundConfig()
    resolveInboundHandlingDecision()      ← unused by Opus Overview UI
```

Legacy readiness produced Overview attention such as “Calendar provider disconnected” → `/integrations?provider=microsoft` even when V1 booking is **Send Booking Link** only.

## After call graph (Overview enrichment)

```
/mctb (Stage 2)
  loadMctbOverviewCore — unchanged Tier 1
  loadMctbOverviewEnrichment (~456 ms on ws_1)
    loadLeadRecoveryConfigPersisted()
      workspace customFields + loadMctbAiBookingConfig (DB flags only, no provider audit)
    buildMctbOverviewLeadRecoveryCard()
      policy summary from enabled scenarios
      if booking + SEND_BOOKING_LINK → mctbBookingLink count / bookingLinkId URL check
      if emergencies + ROUTE_TO_ON_CALL → onCallRecipientId present
```

`callHandling` remains the static Tier-1 placeholder; enrichment no longer computes inbound routing.

## Removed from Overview path

| Call | Where it was removed |
|------|----------------------|
| `evaluateMctbAiBookingReadiness()` | `src/lib/mctb/overview.ts` |
| `computeLeadRecoveryPolicyHealth()` | `src/lib/mctb/overview.ts` |
| `loadLeadRecoveryConfig()` (full, with health) | Overview enrichment |
| `loadMctbLineInboundConfig()` | `src/lib/mctb/overview.ts` |
| `resolveInboundHandlingDecision()` | `src/lib/mctb/overview.ts` |
| Microsoft “calendar disconnected” Overview attention | `buildMctbOverviewLeadRecoveryCard` |

## Preserved runtime

| Path | Status |
|------|--------|
| Send Booking Link SMS | `src/lib/mctb/lead-recovery/action-runtime.ts` → `resolveBookingUrl()` → `SEND_BOOKING_LINK` unchanged |
| AI Recovery conversation runtime | `conversation-runtime.ts`, `action-runtime.ts`, full `loadLeadRecoveryConfig()` + `computeLeadRecoveryPolicyHealth()` for setup/AI Recovery pages |
| Inbound call routing | `loadMctbLineInboundConfig`, `resolveInboundHandlingDecision` still used on voice/MCTB ingress paths |
| Dormant `src/lib/mctb/ai-booking/*` | Not deleted |

## Timing (ws_1, `scripts/mctb-critical-path-timings.ts`)

| Step | Before (trace) | After |
|------|----------------|-------|
| `loadMctbOverviewCore` | ~392–657 ms | ~657 ms |
| `loadMctbOverviewEnrichment` | ~9,000 ms | **456 ms** |
| Full `loadLeadRecoveryConfig` (setup/runtime) | ~4.5–6.7 s | ~6773 ms (still includes policy health — not Overview) |

Static scope checks (from timing script):

- `OVERVIEW_FORBIDDEN_SYMBOLS_IN_overview.ts: 0`
- `OVERVIEW_DIRECT_AI_BOOKING_READINESS_CALLS: 0`
- `OVERVIEW_INBOUND_DECISION_CALLS: 0`

## V1 exposure (AI_BOOK)

- `MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI` and `MCTB_LAUNCH_HIDE_AI_BOOK_UI` in `src/lib/mctb/launch-flags.ts` hide AI_BOOK in setup and AI Recovery UI; saves normalize away `AI_BOOK` when those flags are on (`sync-collection-config.ts`, `ai-lead-recovery-page.tsx`).
- New customers through current Stage 2 Opus surfaces should not enable direct calendar booking from UI.

## Compatibility (stored workspaces)

- Workspaces may still have stored `AI_BOOK` in `customFieldsConfig.mctb.leadRecovery` or legacy `aiBooking.enabled` migration paths inside `loadLeadRecoveryConfigPersisted`.
- Overview **no longer** marks them unhealthy because Microsoft/Calendly direct booking is unavailable.
- Runtime may still honor stored `AI_BOOK` if present and entitled; this pass does not mutate stored config.
- Workspaces with booking scenario + `SEND_BOOKING_LINK` and no link still get legitimate “Add a booking link” attention.

## Code changes

- `loadLeadRecoveryConfigPersisted()` — new export in `src/lib/mctb/lead-recovery/config.ts`
- `buildMctbOverviewLeadRecoveryCard()` — `src/lib/mctb/overview-lead-recovery-card.ts`
- `loadMctbOverviewEnrichment()` — slimmed in `src/lib/mctb/overview.ts`
- Client hook — `overview-enrichment.tsx` only merges `leadRecovery`

## Tests

```
npm run verify:mctb-stage2-presentation
```

```
MCTB_STAGE2_LEGACY_PRESENTATION_IMPORTS: 0
MCTB_STAGE2_LEGACY_COMPONENTS_RENDERED: 0
MCTB_STAGE2_LEGACY_CSS_LOADED: 0
MCTB_CUSTOMER_VISIBLE_DEMO_STATE: 0
MCTB_STAGE2_FRONTEND: PURE_OPUS
```

## Related trace

See `docs/MCTB-OVERVIEW-ENRICHMENT-SCOPE-TRACE.md` for the read-only forensic pass that motivated this correction.
