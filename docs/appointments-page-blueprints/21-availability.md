# Page Blueprint — Availability (Batch 8B-1)

**Route:** `/appointments/availability`  
**Status:** Batch 8B-1 extended  
**Primary user job:** When can customers book?

## Sections

1. Schedules — weekly hours, timezone, named schedules  
2. Special Dates — date overrides, blackouts, holidays  
3. Booking Rules — start interval, fixed starts, limits  
4. Availability Preferences — density, minimize gaps  
5. Diagnostics — Check a time (`SlotDiagnosticsPanel`)

## Gap records

| FEATURE ID | AUDIT GAP | FINAL SECTION | BACKEND | UI CONTROL | STATUS |
|------------|-----------|---------------|---------|------------|--------|
| 3-5 | Date overrides | Special Dates | `dateOverrides` | Add special date CLOSED/CUSTOM | ABSORBED_CANONICAL_UI |
| 3-6 | Blackout dates | Special Dates | platform config | Blackout list | ABSORBED_CANONICAL_UI |
| 3-7 | Holidays | Special Dates | `holidays` | Holiday calendar | ABSORBED_CANONICAL_UI |
| 3-9 | Fixed start times | Booking Rules | `fixed-start-times.ts` | Allowed start times list | ABSORBED_CANONICAL_UI |
| 3-10 | Start interval | Booking Rules | scheduling limits | Interval select | ABSORBED_CANONICAL_UI |
| 3-11 | Make Me Look Busy | Preferences | `availability-density.ts` | Hide % of slots | ABSORBED_CANONICAL_UI |
| 3-12 | Compact scheduling | Preferences | `minimize-gaps.ts` | Prefer near appointments | ABSORBED_CANONICAL_UI |
| 3-15 | Collective scheduling | — | `scheduling-domain.ts` | Runtime only; config on booking types | RUNTIME_ONLY |
| 3-16 | Resource constraints | Diagnostics | `resource-availability.ts` | Diagnostic reasons | RUNTIME_ONLY |
| 3-17 | External calendar busy | Integrations card | integrations | CalendarIntegrationsCard | ABSORBED_CANONICAL_UI |
| 3-18 | Atomic booking | Diagnostics | `slot-booking.ts` | No admin toggle | RUNTIME_ONLY |
| 3-19 | Slot validation | Diagnostics | `slot-validation.ts` | No admin toggle | RUNTIME_ONLY |
| 3-20 | Slot diagnostics | Diagnostics | `slot-diagnostics.ts` | Check a time tool | ABSORBED_CANONICAL_UI |
| 3-22 | Admin availability query | Diagnostics | `availability-engine.ts` | Powers diagnostics | ABSORBED_CANONICAL_UI |
| 2-37 | Named schedules | Schedules | scheduling capabilities | Named schedule list | ABSORBED_CANONICAL_UI |

## Remaining

- Staff/location pickers in diagnostics (optional fields — staff ID text only; polish in later batch)
- Room/equipment in diagnostics query — STILL_MISSING (optional enhancement)
