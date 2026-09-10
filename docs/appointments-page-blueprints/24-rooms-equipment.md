# Page Blueprint — Rooms & Equipment (Batch 8B-1)

**Route:** `/appointments/booking/rooms-equipment`  
**Status:** Batch 8B-1 implemented (new canonical page)  
**Primary user job:** Manage bookable rooms, equipment, and groups.

## Gap records

| FEATURE ID | AUDIT GAP | FINAL SECTION | BACKEND | UI CONTROL | STATUS |
|------------|-----------|---------------|---------|------------|--------|
| 4-8 | Resources parity | Items | `resources.ts` | List, create, quantity | ABSORBED_CANONICAL_UI |
| 4-9 | Quantity / capacity | Items | `SchedulingResource.quantity` | Quantity field + helper | ABSORBED_CANONICAL_UI |
| 4-10 | Resource pools | Groups | `resource-pools.ts` | Groups tab (customer label) | ABSORBED_CANONICAL_UI |

## Remaining

- Type/location fields on resource rows — STILL_MISSING (name + quantity only)
- Contextual quick-create from Service editor preserving draft — STILL_MISSING
- Legacy `/appointments/resources` preserved
