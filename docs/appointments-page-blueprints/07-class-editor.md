# Page Blueprint — Class Editor

**Status:** FINAL — Batch 3  
**Routes:** `/appointments/types/classes/new`, `/appointments/types/classes/[id]`

```
PAGE: Class editor
CLASSIFICATION: SPLIT
PRIMARY USER JOB: Create/manage recurring group class
INTERNAL: bookingTypeKind CLASS, classPresentation recurring_class (hidden)
```

## SECTIONS

1. General — name, description, image, category, visibility, active  
2. Schedule — start date/time, duration, timezone, weekly recurrence, occurrence preview; syncs ClassSeries + generates occurrences  
3. Instructor & location — instructor select, location, contextual Add links  
4. Capacity — max attendees, capacity display mode (exact/limited/hidden), party size in metadata when supported  
5. Pricing & access — price/payment, packages/memberships links  
6. Customer information — questions, intake forms  
7. Policies — cancel/reschedule, terms link  
8. Waitlist — enable toggle, progressive advanced  
9. Admission — collapsed; check-in/tickets when enabled  

## CONTEXTUAL CREATE

Staff, location, package, membership, intake form — sessionStorage draft preservation

## BACKEND

Types API + `POST /api/appointments/service-booking/classes` (upsert series, action occurrences)

## BACKEND GAPS

Per-type package eligibility UI deferred; admission tickets lib-only

## BROWSER UAT

C1–C12 per Batch 3 spec
