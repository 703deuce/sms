# Page Blueprint — Staff Extension

**Status:** FINAL — Batch 5  
**Route:** `/appointments/staff`

```
PAGE: Staff (Team)
ROUTE: /appointments/staff
CLASSIFICATION: EXTEND — preserve Kimi staff visual design, reorganize editor tabs
PRIMARY USER: Business owner / scheduler
PRIMARY USER JOB: Manage the people who provide meetings, services, and classes
SOURCE FEATURE ROWS: Bookable staff, assignments, availability overrides
```

## EXISTING UI TO PRESERVE

`StaffView`, `StaffListPanel`, `StaffEditorPanel` visual language — do not redesign

## EXISTING COMPONENTS TO REUSE

`StaffConnected`, `map-staff`, settings PATCH, Kimi reference CSS

## PRIMARY ACTION

Add staff

## SECONDARY ACTIONS

Save, Remove, context-specific quick-create (host / staff / instructor)

## LOCAL NAV

Availability → Staff (new nav entry)

## PAGE SECTIONS IN ORDER (editor tabs)

1. Profile — name, email, role, image, active, customer-selectable  
2. Services — meetings/services/classes eligibility (appointment types)  
3. Availability — custom hours / schedule summary + link to schedules  
4. Locations — location checklist (synced with Location → Staff)  
5. Calendar — connect Google/Outlook links to integrations  
6. Scheduling — round robin / team notes when supported  
7. Calendar Display — color picker when supported

## TABLE/LIST FIELDS

Name, active, type count, location count (existing list panel)

## DRAWERS / MODALS

Quick-create: Name, Email, role/title

## EMPTY STATE

Existing StaffView empty state

## LOADING / ERROR / SUCCESS

Existing StaffLoading/StaffError patterns

## DEPENDENCIES

`/api/appointments/settings`, `/api/appointments/types`, `/integrations/calendars`

## CONTEXTUAL CREATE ACTIONS

Meeting/Service/Class editors with draft preservation

## PUBLIC COUNTERPART

Staff picker on public booking

## RESPONSIVE

Existing grid collapse preserved

## ACCESSIBILITY

Existing staff-tab pattern; focus on quick-create return

## BACKEND PRESENT

`BookableStaffMember` on settings; appointmentTypeIds; locationIds; weeklyHours

## BACKEND GAPS

Calendar connection UI is informational + link; full OAuth UAT provider-blocked

## BROWSER UAT

S1–S6 per Batch 5 spec

## OLD ROUTES TO MERGE/RETIRE

None retired; `/appointments/enterprise` remains separate
