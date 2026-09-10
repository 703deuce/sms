# Batch 8D-5 — Booking Setup / Booking-Type Configuration (Wave 2)

**Date:** 2026-09-10  
**Branch:** `cursor/batch8d5-booking-setup-wave2-709b`  
**Base:** Post–Batch 8D-4 ledger (64 `V1_ADMIN_UI_GAP`)

## Admin gap summary

| Metric | Value |
|--------|-------|
| Starting `V1_ADMIN_UI_GAP` (post–8D-4) | **64** |
| Rows assigned to 8D-5 (booking setup family) | **31** |
| Resolved (`V1_COMPLETE`) | **30** |
| Reclassified | **1** (`9-5` → `V1_COMPLETE_RUNTIME_ONLY`) |
| Ending `V1_ADMIN_UI_GAP` | **33** |

## Batch worksheet (closed)

| ID | Surface | Resolution |
|----|---------|------------|
| 2-19 | Service add-ons | Price + duration delta on type editor |
| 2-20 | Forms | `/appointments/booking/forms` intake tab + type link |
| 2-22 | Service phases | Existing `TypeServicePhasesSection` |
| 2-23 | Processing phases | Phase `staffRequired` in editor |
| 2-25–2-35 | Booking pages | Hub, share/QR/embed, branding, direct links |
| 2-28 | Single-use links | `BookingAdvancedPanel` on booking hub |
| 2-37 | Named schedules | Rename + sync hours on availability |
| 2-38 | Categories | `CategoryManagerDrawer` + type section |
| 2-42 | Contracts | Forms hub contracts tab |
| 3-5 | Date overrides | UI + reload-after-save readback |
| 3-7, 3-10, 3-11 | Availability rules | Holidays, interval, density |
| 3-17 | External calendar | `CalendarIntegrationsCard` |
| 4-9, 4-10 | Rooms & equipment | Quantity + resource groups admin |
| 4-12 | Staff | Calendar color + round-robin stats |
| 6-5 | Events | `/appointments/types/events` + calendar link |
| 9-1–9-3 | Classes | `ClassesPanel` series/occurrences/enrollment |
| 9-5 | Class QR check-in | Runtime only (`class-check-in.ts`) |
| 19-6 | Intake templates | Forms hub intake builder |

## Key implementations

- `RoomsEquipmentAdminClient` — items, quantities, resource groups
- `FormsDocumentsClient` — intake / contracts / terms tabs
- `ClassesPanel` — class series admin depth
- Staff **Calendar display** tab — color + round-robin activity
- Staff added to availability nav children
- Availability save reloads settings (date override readback)
- Booking hub links → forms + share

## Remaining in family (none as `V1_ADMIN_UI_GAP`)

`9-5` class admission QR editor controls remain runtime/check-in path — not a separate admin gap row.

## Validation

- `node scripts/reconcile-appointments-batch8c.mjs` — PASS (33 admin gaps remaining)
- Appointments-related TypeScript — no errors in touched files
- Browser UAT — **not run** (per batch scope)

## Next wave (8D-6)

Recalculate remaining **33** `V1_ADMIN_UI_GAP` rows from regenerated ledger and group by domain (likely automations, commerce/packages, recalls, POS, workflows) — do not assume page list from pre-8D-5 counts.
