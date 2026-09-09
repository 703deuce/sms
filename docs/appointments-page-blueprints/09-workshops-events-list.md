# Page Blueprint — Workshops & Events List

**Status:** FINAL — Batch 3  
**Route:** `/appointments/types/workshops`

```
PAGE: Workshops & Events
CLASSIFICATION: SPLIT
PRIMARY USER JOB: Show workshops and special events customers register for
INTERNAL: CLASS + classPresentation workshop_event (hidden)
```

## PRIMARY ACTION

Create workshop or event → `/appointments/types/workshops/new`

## TABLE FIELDS

Name | Date (next) | Location | Capacity | Registered | Price | Status | Actions

## EMPTY STATE

*Create your first workshop or event*

## DIFFERENCE FROM CLASSES

Event-oriented columns; no weekly schedule summary

## BACKEND

Same engines as Classes list with workshop filter

## BROWSER UAT

E1, E4
