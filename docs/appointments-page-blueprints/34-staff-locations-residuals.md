# Blueprint 34 — Staff + Locations residuals

## Staff (`/appointments/staff`)

| Feature | Section | Backend | Status |
|---|---|---|---|
| Round-robin participation | Scheduling tab | `roundRobinEligible`, `roundRobinState` | ABSORBED |
| Calendar display color | Calendar display tab | `calendarColors.staffColors` | ABSORBED |

## Locations (`/appointments/locations`)

Prior batch B14.3 covered core location scheduling. Batch 8B-3 verifies timezone, hours, services, staff, and rooms remain wired to `location-scheduling.ts` and settings PATCH — no duplicate availability engine introduced.
