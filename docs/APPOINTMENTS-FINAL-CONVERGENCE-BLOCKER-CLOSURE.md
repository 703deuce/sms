# Appointments Batch 8G-0C — Final Convergence Blocker Closure

**Generated:** 2026-09-10  
**Branch:** `cursor/batch8g0c-convergence-blockers-709b`  
**Type:** Implementation / compatibility — no route retirement

## Summary

Resolved the last three route-convergence blockers identified in Batch 8G-0. All master-row implementation gap categories remain **0**. **READY_FOR_ROUTE_CONVERGENCE = YES**.

| Blocker | Before | After | Canonical home |
|---------|--------|-------|------------------|
| Workspace-global policies | 1 unique V1 | **0** | Settings → Business → Default booking policies |
| Feature 16-6 service booking report | 1 unique V1 | **0** | Analytics → Reports (`/appointments/analytics/reports`) |
| Feature 15-2 legacy `routingRules[]` | 1 unique V1 (COMPATIBILITY_REQUIRED) | **0** | Booking → Routing (`/appointments/routing-forms`) |

Commerce remained **0** unique required V1 (from 8F-1).

## 1. Policies

**Legacy fields (unchanged persistence):**
- `cancellationPolicyText`
- `noShowPolicyText`
- `lateCancelHours`
- `extendedCancellation.{ policyText, noShowPolicyText, lateCancelHours, lateFeeCents }`

**Ownership decision:** Workspace-wide **defaults** stored on `AppointmentPlatformConfig` via `/api/appointments/settings`. Booking types with their own policy text in `TypeAdvancedSections` override at the type level; runtime snapshots continue to use per-type `cancellationPolicy` / `extendedCancellationPolicy` when present.

**Canonical UI:**
- `src/components/settings/kimi-ui/business/components/DefaultBookingPoliciesCard.tsx`
- Shared editor: `src/components/appointments/workspace-booking-policies-editor.tsx`
- Legacy `/appointments/policies` now reuses the same editor (thin wrapper + link to Settings)

**Backend:** Same PATCH fields as legacy page — no new policy model.

## 2. Reports (Feature 16-6)

**Backend:** `loadAcuityStyleReports` in `src/lib/appointments/service-booking/reporting.ts` (unchanged).

**Canonical UI:** `ServiceBookingReportCard` on Analytics → Reports — human-readable summary metrics, by-type table, by-status table, status filter, CSV export via existing `/api/appointments/service-booking/reports?format=csv`.

**ScheduleReportCard** unchanged (scheduled email reports).

## 3. Routing (Feature 15-2)

**Architecture:** Compatibility wrapper (Option B).

- Pure resolver extracted: `src/lib/appointments/routing-resolution.ts`
- Domain entry: `resolveAppointmentRouting()` in `src/lib/appointments/appointment-routing.ts`
- Public booking POST now calls `resolveAppointmentRouting(config, bookingAnswers)` instead of importing scheduling-domain directly
- Canonical admin: `LegacyRoutingRulesPanel` embedded in `/appointments/routing-forms`
- Legacy `/appointments/routing` delegates to same panel + link to canonical route

**Runtime:** Legacy `routingRules[]` remain authoritative for existing workspaces; public booking behavior preserved (focused static equivalence tests).

## Verification

```bash
npx tsx scripts/test-batch8g0c-convergence-blockers.ts
RECONCILE_BATCH=8G0 node scripts/reconcile-appointments-batch8c.mjs
```

## Next batch

**8G-1 — FINAL ROUTE CONVERGENCE + LEGACY RETIREMENT** (redirects, nav/link cleanup, retire 21 READY_FOR_RETIREMENT temp routes).

Do **not** run master browser certification until after 8G-1.
