# Page Blueprint — Meeting Editor

**Status:** FINAL — Batch 2  
**Routes:** `/appointments/types/meetings/new`, `/appointments/types/meetings/[id]`

---

```
PAGE: Meeting editor
CLASSIFICATION: SPLIT — simplest editor in Batch 2 (Calendly-style)
PRIMARY USER JOB: Create a simple meeting customers can schedule
```

## SECTIONS

1. Details — name, description, visibility  
2. Duration & availability — duration, notice, horizon, schedule link  
3. Hosts — assignment modes + staff pool  
4. Meeting method — location/video + Transovo Video settings  
5. Questions — lightweight booking questions  
6. Booking rules — approval, cancel/reschedule, recurring (collapsed advanced)  
7. Payment — optional, lower priority  
8. Confirmation — copy, active toggle, booking link  

## EXCLUDED

Service phases, resources, add-ons, categories, class capacity, packages

## CONTEXTUAL LINKS

Staff → `/appointments/staff`  
Availability → `/appointments/availability`  
Payment → `/settings/business`  
Integrations → external video providers

## BACKEND GAPS

No DELETE; client duplicate POST; legacy types without kind default SERVICE (hidden from list)

## BROWSER UAT

M1–M6; Meetings simpler than Services by design
