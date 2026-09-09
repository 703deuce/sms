# Page Blueprint — Rooms & Equipment

**Status:** FINAL — Batch 5  
**Route:** `/appointments/rooms-equipment`

```
PAGE: Rooms & Equipment
ROUTE: /appointments/rooms-equipment (+ /new, /[id], groups local view)
CLASSIFICATION: NEW — focused list + editor (replaces parity Resources mega-section)
PRIMARY USER: Business owner / scheduler admin
PRIMARY USER JOB: Manage the rooms and equipment my services/classes need
SOURCE FEATURE ROWS: APPOINTMENTS-MASTER-FEATURE-INVENTORY — Scheduling resources, resource groups
```

## EXISTING UI TO PRESERVE

Commerce `ResourcesPanel` behavior (quantity, active) — not visual shell. Runtime: `schedulingResource`, `schedulingResourceGroup`.

## EXISTING COMPONENTS TO REUSE

`RefDecoPageHeader`, overview pilot table patterns, `PackagesListConnected` list structure, resource APIs.

## PRIMARY ACTION

Add room or equipment → `/appointments/rooms-equipment/new`

## SECONDARY ACTIONS

Groups (local secondary view), Edit, Duplicate, Disable/Enable, Delete when safe

## LOCAL NAV

Availability → Rooms & Equipment (replaces Resources label)

## PAGE SECTIONS IN ORDER

1. Header — H1 Rooms & Equipment + supporting copy
2. View toggle — All items | Groups
3. Table or empty state
4. Editor route for create/edit

## TABLE/LIST FIELDS

| Column | Source |
|--------|--------|
| Name | `name` |
| Type | `metadata.kind` → Room / Equipment / Other |
| Location | `metadata.locationIds` → location names |
| Quantity | `quantity` |
| Used by | `eligibleTypeIds` count |
| Status | `active` |

## DRAWERS / MODALS

Quick-create modal from Service/Class/Location editors: Name, Type, Location, Quantity

## EMPTY STATE

*Add the rooms and equipment your bookings depend on*  
CTA: Add room or equipment

## LOADING / ERROR / SUCCESS

Skeleton table; retry banner; inline save feedback on editor

## DEPENDENCIES

`GET/POST /api/appointments/service-booking/resources`, `GET/POST /api/appointments/service-booking/resource-groups`, settings locations

## CONTEXTUAL CREATE ACTIONS

Service → Staff, Locations & Rooms; Class → room requirement; Location → Rooms section

## PUBLIC COUNTERPART

Resource availability enforced at booking slot selection (runtime)

## RESPONSIVE

Stacked cards mobile; editor single column

## ACCESSIBILITY

Semantic table, labeled form fields, keyboard row actions

## BACKEND PRESENT

`listSchedulingResources`, `upsertSchedulingResource`, `listResourceGroups`, `upsertResourceGroup`, `assertResourcesAvailable`

## BACKEND GAPS

`kind` stored in metadata (not DB column); used-by drilldown deferred

## BROWSER UAT

R1–R5 per Batch 5 spec

## OLD ROUTES TO MERGE/RETIRE

`/appointments/resources` → redirect `/appointments/rooms-equipment`; Commerce Resources tab remains transitional
