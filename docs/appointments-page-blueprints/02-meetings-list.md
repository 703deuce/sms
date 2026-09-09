# Page Blueprint — Meetings List

**Status:** FINAL — Batch 2  
**Route:** `/appointments/types/meetings`

---

```
PAGE: Meetings
ROUTE: /appointments/types/meetings
CLASSIFICATION: SPLIT — focused list
PRIMARY USER: Business owner / scheduler admin
PRIMARY USER JOB: Show me the meeting types customers can schedule
```

## PRIMARY ACTION

Create meeting → `/appointments/types/meetings/new`

## SECONDARY ACTIONS

Row: Edit, Preview, Copy link, Duplicate, Enable/Disable

## TABLE/LIST FIELDS

Meeting name | Duration | Hosts | Method | Visibility | Status | Actions

## EMPTY STATE

*Schedule calls without the back-and-forth* + Create your first meeting

## EXISTING COMPONENTS

`MeetingsListConnected`, overview pilot chrome, `appt-pilot-data-table`

## BACKEND

`GET /api/appointments/types` filtered `bookingTypeKind === MEETING`

## OLD ROUTES

Transitional segment list retired for meetings; generic editor redirects here

## BROWSER UAT

M1, M5, M6; no archetype picker on create
