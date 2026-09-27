# MCTB route timing matrix

**Purpose:** Measure every customer-visible MCTB surface’s server-side critical path (the loaders API routes call), without guessing from Home fixes alone.

**Run:**

```bash
WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-route-timing-matrix.ts
```

**Thresholds:** WARN ≥ 800 ms · FAIL ≥ 2000 ms (script exits non-zero when any FAIL).

---

## ws_1 snapshot (2026-09-27, post-Overview scope correction)

| Route | Phase | ms | Status | Risk flags |
|-------|-------|---:|--------|------------|
| `/mctb` | SSR `loadMctbOverviewCore` | 532 | OK | — |
| `/mctb` | client `overview-enrichment` | 435 | OK | — |
| `/mctb/missed-calls` | list API | 742 | OK | — |
| `/mctb/missed-calls/[id]` | detail API (sample) | 376 | OK | — |
| `/mctb/conversations` | inbox list | 360 | OK | — |
| `/mctb/conversations` | one thread hydrate | 238 | OK | — |
| `/mctb/analytics` | analytics loader | 315 | OK | — |
| `/mctb/voicemail` | voicemail list | 112 | OK | — |
| `/mctb/setup` | setup GET bundle | 251 | OK | — |
| `/mctb/setup` | onboarding GET | 83 | OK | — |
| **`/mctb/ai-recovery`** | **`/api/mctb/ai-recovery/context`** | **4050** | **FAIL** | `FULL_LR_CONFIG` |
| **`/mctb/ai-recovery`** | **`/api/mctb/lead-recovery/config` GET** | **11891** | **FAIL** | `FULL_LR_CONFIG`, `AI_BOOK_READINESS` |
| **`/mctb/ai-recovery`** | both APIs parallel (cold page) | **11029** | **FAIL** | `LR_CONFIG_TWICE` |
| `/mctb/setup/*` | handoff GET | 4332 | FAIL | `FULL_LR_CONFIG` |
| `/mctb/setup/exclusions` | exclusions GET | 95 | OK | — |
| `/mctb/compliance/consent` | consent-log | 1071 | WARN | — |
| (shell) | shell-context | 113 | OK | — |
| (reference) | `loadLeadRecoveryConfigPersisted` | 437 | OK | — |
| (reference) | `loadLeadRecoveryConfig` (full) | 4102 | FAIL | Microsoft path via policy health |

---

## Interpretation

### Overview is done

Home no longer pays the ~9 s legacy tax. Core + AI Recovery summary are sub-second on `ws_1`.

### Remaining known slow surfaces (do not optimize blindly — fix when touching that page)

1. **`/mctb/ai-recovery`** — primary suspect for “page takes forever.”
   - Context route alone: ~4 s (`loadLeadRecoveryConfig` inside parallel bundle).
   - Config route: ~12 s (full config + **second** `computeLeadRecoveryPolicyHealth` + **another** `evaluateMctbAiBookingReadiness` + business brain).
   - Opening the page fires **both** in parallel → ~11 s wall clock and **two** full config loads.

2. **`/api/mctb/handoff`** (setup notifications / handoff editors) — ~4.3 s because GET calls `loadLeadRecoveryConfig` only to expose `aiRepliesEnabled`.

3. **`loadLeadRecoveryConfig()` reference** — ~4.1 s on `ws_1`; same machinery as before Overview fix, now isolated to setup/runtime/AI Recovery paths.

### Healthy operational pages (this pass)

Missed Calls, Conversations, Analytics, Voicemail, Setup Home bundle, shell context — all under WARN threshold on `ws_1`.

### Consent log

~1 s WARN — worth watching; not in the same class as AI Recovery.

---

## Flag legend

| Flag | Meaning |
|------|---------|
| `FULL_LR_CONFIG` | `loadLeadRecoveryConfig()` → embedded `computeLeadRecoveryPolicyHealth()` |
| `AI_BOOK_READINESS` | Extra `evaluateMctbAiBookingReadiness` on the route (Microsoft/Calendly audit path) |
| `LR_CONFIG_TWICE` | Page triggers more than one full config load in parallel |

---

## Next steps (when approved)

Apply the **same product boundary** used on Overview only to pages that FAIL this matrix — starting with AI Recovery (persisted config + V1 Send-Link health; defer direct-booking readiness to explicit setup actions, not page load).

Do **not** mutate stored `AI_BOOK` workspace data; launch flags already prevent new V1 exposure.
