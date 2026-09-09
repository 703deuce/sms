# Page Blueprint — Services List

**Status:** FINAL — Batch 2  
**Route:** `/appointments/types/services`  
**Batch boundary:** Services only — not Classes/Workshops

---

```
PAGE: Services
ROUTE: /appointments/types/services
CLASSIFICATION: SPLIT — focused list
PRIMARY USER: Business owner / scheduler admin
PRIMARY USER JOB: Show me the services customers can book
SOURCE FEATURE ROWS: APPOINTMENTS-MASTER-FEATURE-INVENTORY — Services / appointment types (SERVICE)
```

## PRIMARY ACTION

Create service → `/appointments/types/services/new` (no archetype picker)

## SECONDARY ACTIONS

Manage categories → `/appointments/categories`  
Row: Edit, Preview, Copy link, Duplicate, Enable/Disable

## LOCAL NAV

Booking Types → Services (back link to `/appointments/types`)

## PAGE SECTIONS IN ORDER

1. Back link — Booking Types
2. Header — H1 Services + supporting copy
3. Actions — Manage categories (secondary), Create service (primary)
4. List table or empty state

## TABLE/LIST FIELDS

| Column | Source |
|--------|--------|
| Service name | `name` → editor |
| Category | `config.categoryId` |
| Duration | `durationMinutes` / `durationOptions` summary |
| Price | `payment` / `priceDisplay` |
| Staff | `staffAssignment` + staff ids |
| Location | `locationIds` |
| Visibility | `config.visibility` |
| Status | `config.enabled` |

## EMPTY STATE

Headline: *Create the services your customers book*  
Body: Services are for one-on-one or provider-based appointments…  
CTA: Create your first service

## LOADING / ERROR / SUCCESS

Skeleton table; retry on error; row actions refresh list after duplicate/toggle

## DEPENDENCIES

`GET /api/appointments/types`, settings (staff/locations), categories API

## BACKEND GAPS

No DELETE — disable only. No duplicate API — POST copy client-side.

## OLD ROUTES

`/appointments/types/editor?segment=services` → list or focused editor redirect

## BROWSER UAT

S1 create flow entry; list shows saved service; mobile table responsive pattern

## RESPONSIVE / ACCESSIBILITY

Semantic table; icon buttons have aria-label; keyboard row actions
