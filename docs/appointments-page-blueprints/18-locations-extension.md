# Page Blueprint — Locations Extension

**Status:** FINAL — Batch 5  
**Route:** `/appointments/locations`

```
PAGE: Locations
ROUTE: /appointments/locations
CLASSIFICATION: EXTEND — preserve visual design, add tabbed editor sections
PRIMARY USER: Business owner / multi-location operator
PRIMARY USER JOB: Manage where my business provides appointments and classes
SOURCE FEATURE ROWS: Locations, location hours, assignments
```

## EXISTING UI TO PRESERVE

Header, card/list structure, typography, field styling, buttons, spacing — `LocationsConnected` shell

## EXISTING COMPONENTS TO REUSE

`LocationsConnected`, settings PATCH, `defaultWeeklyHours`, resource/staff/type checklists

## PRIMARY ACTION

Add location

## SECONDARY ACTIONS

Save, Remove location, Quick-create from Service/Class/Event

## LOCAL NAV

Availability → Locations

## PAGE SECTIONS IN ORDER (editor tabs)

1. General — name, address, timezone, active  
2. Hours — inherit vs custom weekly  
3. Services — appointment type checklist  
4. Staff — staff checklist  
5. Rooms & Equipment — resource checklist (renamed labels)  
6. Public Details — display name, directions, parking, phone

## TABLE/LIST FIELDS

Location name, address snippet, timezone label, status (list sidebar)

## DRAWERS / MODALS

Quick-create: Name, Address, Timezone

## EMPTY STATE

Existing empty list state preserved

## LOADING / ERROR / SUCCESS

Existing patterns + tab-level save feedback

## DEPENDENCIES

`/api/appointments/settings`, types API, resources API

## CONTEXTUAL CREATE ACTIONS

Service/Class/Event → Add location with draft preservation

## PUBLIC COUNTERPART

Location picker on public booking

## RESPONSIVE

Existing responsive behavior preserved

## ACCESSIBILITY

Tab keyboard nav, labeled inputs, time inputs with aria-labels

## BACKEND PRESENT

Location model on settings JSON; weeklyHours; staffIds; appointmentTypeIds; resourceIds

## BACKEND GAPS

Public details fields may be partial in runtime — show when supported

## BROWSER UAT

L1–L6 per Batch 5 spec

## OLD ROUTES TO MERGE/RETIRE

None retired this batch
