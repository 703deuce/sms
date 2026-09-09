# Page Blueprint — Class Occurrence Detail

**Status:** FINAL — Batch 3  
**Route:** `/appointments/classes/occurrences/[id]`

```
PAGE: Class / Event session detail
CLASSIFICATION: SPLIT — operational (not configuration)
PRIMARY USER JOB: Manage this specific class session (attendees, check-in, waitlist)
```

## HEADER

Class/event name, date/time, instructor, location, enrollment/capacity, status

## PRIMARY ACTIONS

Add attendee, Check in (per row), Edit occurrence, Cancel occurrence

## SECTIONS

1. Overview — date, duration, capacity, spots remaining, series override indicator  
2. Attendees — semantic table: customer, party size, status, check-in, actions  
3. Waitlist — entries when runtime linked (generic waitlist may be UA_PENDING)  
4. Payments / access — read-only summary  
5. Activity — enrollment timestamps  

## LABELS

Presentation-aware: Class uses *Attendees/Enrollment*; Workshop uses *Registrations*

## BACKEND

`GET/PATCH /api/appointments/service-booking/classes/occurrences/[id]`  
`POST class-check-in`, `POST classes action=enroll`

## BACKEND GAPS

Dedicated class waitlist on occurrence; party size field; QR ticket UI

## NO DEDICATED CHECK-IN PAGE

Check-in contextual here unless existing front-desk page discovered

## BROWSER UAT

C7–C9 manual attendee + check-in
