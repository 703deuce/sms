# Page Blueprint — Classes List

**Status:** FINAL — Batch 3  
**Route:** `/appointments/types/classes`

```
PAGE: Classes
ROUTE: /appointments/types/classes
CLASSIFICATION: SPLIT — focused list
PRIMARY USER: Business owner / scheduler admin
PRIMARY USER JOB: Show me the classes my business runs
SOURCE FEATURE ROWS: APPOINTMENTS-MASTER-FEATURE-INVENTORY §9 Class series/occurrences
```

## PRIMARY ACTION

Create class → `/appointments/types/classes/new`

## SECONDARY ACTIONS

Manage categories (if used), row: Edit, View next occurrence, Copy link, Duplicate, Enable/Disable

## LOCAL NAV

Booking Types → Classes

## TABLE FIELDS

Class name | Instructor | Location | Schedule summary | Next occurrence | Capacity | Enrolled | Status | Actions

## FILTERS (v1)

Active/Inactive via list meta; instructor/location deferred

## EMPTY STATE

*Start offering group classes* + Create your first class

## COMPONENTS

`ClassesListConnected`, `class-display.ts`, pilot chrome

## BACKEND

`GET /api/appointments/types` (CLASS + recurring_class) + `GET /api/appointments/service-booking/classes` for occurrences

## BACKEND GAPS

Type↔series link may be missing on legacy rows; list shows type data with series overlay when linked

## OLD ROUTES

`/appointments/types/editor?segment=classes` → redirect; `/appointments/classes` legacy shell preserved

## BROWSER UAT

C1 entry; no archetype picker
