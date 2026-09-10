# Appointments Final Pre-Convergence Reconciliation (Batch 8G-0)

**Generated:** 2026-09-10  
**Type:** Mechanical implementation reconciliation — NOT browser UAT  
**Waves reconciled:** 8D-1 through 8D-7 · 8F-1 Commerce admin depth · 8F-2 Operations admin · 8F-3 Booking permissions + polls · 8F-4 Contextual flow completion

## Executive summary

Full **308-row** mechanical re-audit from current codebase after all 8F implementation batches (integrated on `cursor/batch8g0-pre-convergence-reconcile-709b`).

| Metric | Count |
|--------|------:|
| **Total master rows** | 308 |
| **V1 rows** | 295 |
| **V2 rows** | 11 |
| **V1_COMPLETE** | 258 |
| **V1_COMPLETE_RUNTIME_ONLY** | 32 |
| **V1_PROVIDER_BLOCKED** | 6 |
| **V1_ADMIN_UI_GAP** | 0 |
| **V1_PUBLIC_UI_GAP** | 0 |
| **V1_PORTAL_UI_GAP** | 0 |
| **V1_CONTEXTUAL_FLOW_GAP** | 0 |
| **V1_BACKEND_GAP** | 0 |
| **V1_PERSISTENCE_GAP** | 0 |
| **V1_MOCK_OR_PLACEHOLDER** | 0 |
| **V1_WRONG_PLACEMENT** | 0 |
| **V1_DUPLICATE_CONFLICT** | 0 |
| **V2_DEFERRED** | 12 |
| **OUT_OF_SCOPE_ERROR** | 0 |
| **UNASSIGNED_ERROR** | 0 |
| Residual implementation rows | 0 |
| Backend ready / UI missing | 0 |
| UI present / backend gap | 0 |

### Special checks (mechanical)

| Check | Unique required V1 | Remaining IDs |
|-------|-------------------:|---------------|
| **Commerce** (`/appointments/commerce`) | 0 | — |
| **Policies** (`/appointments/policies`) | 0 | — |
| **Service-booking report** | 0 | — |
| **Legacy routing** | 0 | — |

### Readiness gates

| Gate | Result | Blockers |
|------|--------|----------|
| **READY_FOR_ROUTE_CONVERGENCE** | **YES** | None |
| **READY_FOR_MASTER_BROWSER_CERTIFICATION** | **YES** | None (provider-blocked + runtime-only excepted) |


> **Next batch:** 8G-1 — FINAL ROUTE CONVERGENCE + LEGACY RETIREMENT


> **Master browser certification:** Implementation gaps are zero, but route convergence must complete first. Do NOT run master browser certification until after 8G-1.


## Temp route summary

- **Blocking routes (unique V1 / compatibility):** 0
- **Ready for retirement:** 21
- **Discovered non-canonical routes:** 22

See `docs/APPOINTMENTS-FINAL-PRE-CONVERGENCE-TEMP-ROUTE-AUDIT.md` and `docs/APPOINTMENTS-FINAL-ROUTE-RETIREMENT-MAP.md`.

## Navigation / link audit (temp routes)

| Route | Internal references | External/historical risk |
|-------|--------------------:|--------------------------|
| `/appointments/booking/branding` | 5 | NO |
| `/appointments/booking/contracts` | 3 | NO |
| `/appointments/booking/share` | 10 | NO |
| `/appointments/categories` | 7 | NO |
| `/appointments/classes` | 11 | NO |
| `/appointments/client-restrictions` | 4 | NO |
| `/appointments/commerce` | 22 | NO |
| `/appointments/commerce/contact-merge` | 2 | NO |
| `/appointments/contracts` | 9 | NO |
| `/appointments/coupons` | 7 | NO |
| `/appointments/no-show-recovery` | 25 | NO |
| `/appointments/policies` | 6 | NO |
| `/appointments/recall-campaigns` | 25 | NO |
| `/appointments/reports/service-booking` | 4 | NO |
| `/appointments/resources` | 8 | NO |
| `/appointments/restrictions` | 6 | NO |
| `/appointments/routing` | 27 | NO |
| `/appointments/scheduled` | 7 | NO |
| `/appointments/segments` | 4 | NO |
| `/appointments/service-booking` | 122 | NO |
| `/appointments/voice-reminders` | 14 | NO |

## Artifacts

| File | Purpose |
|------|---------|
| `docs/APPOINTMENTS-FINAL-PRE-CONVERGENCE-LEDGER.csv` | Full 308-row current-state ledger |
| `docs/APPOINTMENTS-FINAL-PRE-CONVERGENCE-TEMP-ROUTE-AUDIT.md` | Temp route mechanical audit |
| `docs/APPOINTMENTS-FINAL-ROUTE-RETIREMENT-MAP.md` | 8G-1 redirect/retirement plan (not applied) |
| `docs/APPOINTMENTS-FINAL-PRE-CONVERGENCE-CLOSURE-SUMMARY.json` | Machine-readable counts |

---

*Source inventory: `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md` · Script: `scripts/reconcile-appointments-batch8c.mjs` · Run: `RECONCILE_BATCH=8G0 node scripts/reconcile-appointments-batch8c.mjs`*
