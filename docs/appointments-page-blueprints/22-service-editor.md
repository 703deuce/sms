# Page Blueprint — Service Editor (Batch 8B-1)

**Route:** `/appointments/types/services` + `/appointments/types/editor?segment=services`  
**Status:** Batch 8B-1 extended  
**Primary user job:** Configure the service my customers can book.

## Gap records

| FEATURE ID | AUDIT GAP | FINAL SECTION | BACKEND | UI CONTROL | STATUS |
|------------|-----------|---------------|---------|------------|--------|
| 2-38 | Categories admin | Category & image | `booking-category.ts` | ServiceCategoriesDrawer | ABSORBED_CANONICAL_UI |
| 2-16 | Image on type | Category & image | `imageUrl` | URL + preview | ALREADY_PRESENT |
| 2-18 | Add-ons on type | Add-ons | `add-ons.ts` | ServiceAddOnsPanel + selection | ABSORBED_CANONICAL_UI |
| 2-19 | Add-on duration/resources | Add-ons | `add-ons.ts` | Inline add-on editor fields | ABSORBED_CANONICAL_UI |
| 2-22 | Service phases | Service steps | `service-phases.ts` | TypeServicePhasesSection | ABSORBED_CANONICAL_UI |
| 2-23 | Processing / staff release | Service steps | `staff-phase-occupancy.ts` | Staff needed checkbox + copy | ABSORBED_CANONICAL_UI |
| 4-4 | Location-specific hours | Locations | `location-scheduling.ts` | Location picker + link to Locations | ALREADY_PRESENT |
| 5-2 | Deep link | Status panel | public flow | Copy booking link | ALREADY_PRESENT |
| 5-4 | Service picker | — | public | PUBLIC_WAVE_PENDING | PUBLIC_WAVE_PENDING |
| — | Multi-service chain | — | `multi-service.ts` | Customer selects at booking; no per-type chain object | RUNTIME_ONLY |
| — | Multi-staff per line | Staff assignment | collective mode | Collective staff pool | ALREADY_PRESENT |

## Remaining

- Image upload (media picker) — STILL_MISSING (URL field only)
- Per-phase resource IDs — STILL_MISSING
- Payment modes — ALREADY_PRESENT in TypeAdvancedSections (IA: not Transactions)
