# Page Blueprint — Recalls

**Batch:** 7 | **Route:** `/appointments/recalls` | **Classification:** KEEP / EXTEND

```
PAGE: Recalls
ROUTE: /appointments/recalls
CLASSIFICATION: KEEP / EXTEND
PRIMARY USER: Front desk / owner
PRIMARY USER JOB: Show me customers who should come back and help me get them rebooked
```

## Sections

1. Page header + filters (Due now, Overdue, Upcoming, Contacted, Booked, Dismissed)
2. Due customers table (Customer, Last appointment, Service, Recommended return, Status, Last contact, Actions)
3. Recent recall activity (existing)
4. Link to Automations for recall workflow configuration

## Actions

- Book appointment, Message customer, Send reminder, View customer, Dismiss

## States

Loading skeleton, empty ("Bring customers back at the right time"), filtered empty, error + retry

## Backend

`resolveRecallSegmentContacts`, `listRecallActivity`, dismiss state in platform config `recallDismissals`

## Old routes

- `/appointments/recall-campaigns` → Automations → Recall (transitional banner)

## UAT

RC1–RC5 per batch spec
