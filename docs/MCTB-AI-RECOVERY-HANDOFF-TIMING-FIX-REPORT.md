# MCTB AI Recovery + Handoff timing fix report

Date: 2026-09-27 · Workspace: `ws_1`

## 1. AI Recovery — before call graph

```
/mctb/ai-recovery (cold)
├── GET /api/mctb/ai-recovery/context
│     loadLeadRecoveryConfig() → policy health → evaluateMctbAiBookingReadiness()
└── GET /api/mctb/lead-recovery/config  (parallel)
      loadLeadRecoveryConfig() → policy health → evaluateMctbAiBookingReadiness()
      → computeLeadRecoveryPolicyHealth (again)
      → loadBusinessBrain
```

Measured: context ~4050 ms · config GET ~11891 ms · parallel ~11029 ms.

## 2. AI Recovery — after call graph

```
/mctb/ai-recovery (Stage 2 cold)
└── GET /api/mctb/ai-recovery/context only
      loadLeadRecoveryConfigPersisted()
      + business / messaging / booking links (parallel, no Microsoft readiness)
      exposes collectCapabilities on recovery.*
```

Optional `GET /api/mctb/lead-recovery/config` (legacy editor / simulate / providerDiagnostics=1):

- **Default:** `loadLeadRecoveryConfigPersisted` + `computeLeadRecoveryV1PolicyHealth` (send-link + on-call checks)
- **`?providerDiagnostics=1`:** prior full path (Microsoft/Calendly readiness + brain) — explicit opt-in only

Measured: context ~470 ms · config V1 GET ~509 ms · cold page ~413 ms.

## 3. Handoff — before / after

**Before**

```
GET /api/mctb/handoff
  → loadLeadRecoveryConfig()  (~4.3s)
  → aiRepliesEnabled
```

**After**

```
GET /api/mctb/handoff
  → isLeadRecoveryAiRepliesEnabled()  (persisted config only)
```

Measured: ~707 ms (under WARN).

## 4. Removed from initial reads

| Operation | Where removed |
|-----------|----------------|
| `loadLeadRecoveryConfig()` on AI Recovery context | → `loadLeadRecoveryConfigPersisted` |
| Duplicate config fetch on Stage 2 AI Recovery page | single context fetch |
| `evaluateMctbAiBookingReadiness` on default config GET | → `providerDiagnostics=1` only |
| `loadBusinessBrain` on default config GET | deferred (knowledge stub; runtime unchanged) |
| `computeLeadRecoveryPolicyHealth` on default config GET | → `computeLeadRecoveryV1PolicyHealth` |
| Full LR config on Handoff GET/POST guard | → `isLeadRecoveryAiRepliesEnabled` |

## 5. Preserved

- `loadLeadRecoveryConfig()` + full policy health on **save** (`POST` lead-recovery/config, ai-recovery/settings)
- SMS Send Booking Link runtime (`action-runtime.ts`)
- Lead Recovery conversation runtime (still uses full config at interaction time)
- Inbound routing, consent, platform sender
- Dormant `src/lib/mctb/ai-booking/*` (+ `?providerDiagnostics=1` escape hatch)

## 6. Full route matrix (after)

| Route | Phase | ms | Status |
|-------|-------|---:|--------|
| /mctb | SSR core | 584 | OK |
| /mctb | enrichment | 445 | OK |
| /mctb/missed-calls | list | 690 | OK |
| /mctb/missed-calls/[id] | detail | 383 | OK |
| /mctb/conversations | list | 342 | OK |
| /mctb/conversations | thread | 247 | OK |
| /mctb/analytics | 30d | 456 | OK |
| /mctb/voicemail | list | 104 | OK |
| /mctb/setup | setup GET | 270 | OK |
| /mctb/setup | onboarding | 81 | OK |
| **/mctb/ai-recovery** | **context (cold)** | **470** | **OK** |
| /mctb/ai-recovery | config GET V1 | 509 | OK |
| /mctb/ai-recovery | cold page | 413 | OK |
| **/mctb/setup/\*** | **handoff GET** | **707** | **OK** |
| /mctb/setup/exclusions | exclusions | 78 | OK |
| /mctb/compliance/consent | consent-log | 1132 | WARN |
| (shell) | shell-context | 118 | OK |

**Customer-visible FAILs:** 0

**Reference only (runtime/save path, not page load):** `loadLeadRecoveryConfig()` full ~4617 ms — still used where policy health is required after save/runtime.

## 7. WARN remaining

- `/mctb/compliance/consent` ~1132 ms — out of scope this pass.

## 8. Stage 2 gate

`npm run verify:mctb-stage2-presentation` — all zeros, **PURE_OPUS**.

## 9. Files changed

- `src/lib/mctb/lead-recovery/v1-policy-health.ts` (new)
- `src/lib/mctb/lead-recovery/v1-config-api-payload.ts` (new)
- `src/lib/mctb/lead-recovery/config.ts` — `isLeadRecoveryAiRepliesEnabled`
- `src/lib/mctb/overview-lead-recovery-card.ts` — reuse V1 health
- `src/app/api/mctb/ai-recovery/context/route.ts`
- `src/app/api/mctb/lead-recovery/config/route.ts`
- `src/app/api/mctb/handoff/route.ts`
- `src/newui-transplant/connected/mctb/ai-recovery-page.tsx`
- `src/components/mctb/ai-recovery/ai-recovery-settings-page.tsx`
- `scripts/mctb-route-timing-matrix.ts`
