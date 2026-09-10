# Page Blueprint — Service Editor (Batch 8B-1)

**Route:** `/appointments/types/services` (+ editor deep link)  
**Classification:** KEEP VISUAL + EXTEND INTO EXISTING SECTIONS  
**Primary user job:** Configure exactly how this service is booked and delivered.

## Sections (absorbed into `TypeEditorPanel`)

| Section | Controls added | Backend |
|---------|----------------|---------|
| General | Category select, image URL/preview, Manage categories drawer | `booking-category.ts`, `imageUrl` |
| Scheduling | Service steps/phases | `service-phases.ts`, `staff-phase-occupancy.ts` |
| Staff/Locations/Rooms | Required rooms & equipment + contextual create | `resources.ts` |
| Customer info | Intake form + contextual create | `intake-forms.ts` |
| Add-ons | Full add-on panel | `add-ons.ts` |
| Pricing | Payment modes (existing advanced sections) | `payments-extended.ts` |
| Policies | Approval toggle (TypePublishingSections) | `booking-approval.ts` |

## Contextual create flows

- Category → `ServiceCategoriesDrawer` → auto-select `categoryId`, draft preserved
- Room/equipment → `ServiceResourceQuickCreate` → auto-select `resourceIds`
- Intake form → `IntakeFormQuickCreate` → auto-select `intakeFormIds`

## STILL_MISSING

- Multi-service compatibility toggle (no per-type config field in backend yet)
- Multi-staff required count (needs scheduling domain field)
- Contract/terms contextual create from Service editor
- Image upload (media picker) — URL field only

## Absorbed from

- `/appointments/categories` → Manage categories drawer
- `/appointments/commerce` service parity controls
- `/appointments/resources` assignment UX
