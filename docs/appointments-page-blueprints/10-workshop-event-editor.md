# Page Blueprint — Workshop / Event Editor

**Status:** FINAL — Batch 3  
**Routes:** `/appointments/types/workshops/new`, `/appointments/types/workshops/[id]`

```
PAGE: Workshop / Event editor
CLASSIFICATION: SPLIT — simpler than Class editor
INTERNAL: classPresentation workshop_event
```

## SECTIONS

1. General  
2. Date & time — single (or limited) date; no weekly recurrence UI  
3. Location  
4. Registration — capacity, party size, deadline, waitlist  
5. Pricing & access  
6. Customer information  
7. Policies  
8. Admission / check-in — when enabled  

## HINT

"Running this every week? Create a Class instead." — link to Classes

## SHARED

Same hook/engine as Class editor; workshop variant hides recurrence

## OCCURRENCE OPS

Reuse occurrence detail page with workshop labels

## BROWSER UAT

E1–E7
