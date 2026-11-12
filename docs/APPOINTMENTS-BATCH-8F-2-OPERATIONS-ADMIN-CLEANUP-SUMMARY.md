# Appointments Batch 8F-2 — Operations Admin Cleanup Summary

**Date:** 2026-09-10  
**Branch:** `cursor/batch8f2-operations-admin-709b`

## Starting state (post-8F-1)

| Metric | Count |
|--------|------:|
| 8F-2 rows | 4 (`3-21`, `6-2`, `7-1`, `18-7`) |
| V1_ADMIN_UI_GAP | 5 |
| V1_CONTEXTUAL_FLOW_GAP | 1 (`3-20`) |
| V1_BACKEND_GAP | 0 |

## Rows resolved

| ID | Feature | Implementation |
|----|---------|----------------|
| **6-2** | Create appointment (staff) | `/appointments/new` — staff/location pickers, booking questions, slot-scoped availability, dynamic price quote, `staff_created` source |
| **7-1** | Manage appointment link | Appointment detail `ManageAppointmentLinkCard` + `ensure_manage_link` / `regenerate_manage_link` PATCH actions |
| **18-7** | Audit timeline on appointment | `map-detail` reads `timeline[].label`; chronological ActivityTimeline; manage-link + staff-create audit events |
| **3-21** | Dynamic pricing by slot | `DynamicPricingRulesEditor` under Service type editor → Payment → Price rules; authoritative `evaluate` API |

## Rows reclassified

None.

## Ending state

| Metric | Count |
|--------|------:|
| V1_ADMIN_UI_GAP | 1 (`15-7` → 8F-3) |
| V1_CONTEXTUAL_FLOW_GAP | 1 (`3-20` → 8F-4) |
| V1_BACKEND_GAP | 0 |
| Residual implementation rows | 2 |

## Slot diagnostics (3-20)

Left for **8F-4** — not in 8F-2 scope.

## Key files

- `src/components/appointments/kimi-ui/appointments-new/components/appointment-form.tsx`
- `src/components/appointments/kimi-ui/detail/components/ManageAppointmentLinkCard.tsx`
- `src/components/appointments/kimi-ui/appointment-types/components/DynamicPricingRulesEditor.tsx`
- `src/lib/appointments/booking-platform.ts`
- `scripts/test-batch8f2-operations-admin.ts`

## Verification

```bash
npx tsx scripts/test-batch8f2-operations-admin.ts
node scripts/reconcile-appointments-batch8c.mjs
```
