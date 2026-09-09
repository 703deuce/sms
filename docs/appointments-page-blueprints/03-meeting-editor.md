# Page Blueprint — Meeting Editor

**Status:** FINAL — Batch 2A  
**Routes:** `/appointments/types/meetings/new`, `/appointments/types/meetings/[id]`  
**Backend:** Existing `voiceService` + `AppointmentTypeConfig` with `bookingTypeKind: MEETING`  
**Batch boundary:** No Services/Classes/Workshops UI

---

```
PAGE: Meeting editor (create + edit)
PRIMARY USER JOB: Configure a simple Calendly-style meeting type
DESIGN PRINCIPLE: Lean — no Acuity service machinery by default
```

## Sections (in order)

1. **Details** — name, description, visibility (public/unlisted/secret), optional image if supported
2. **Duration & availability** — duration, duration options, named schedule, min notice, max horizon, link to Manage Availability
3. **Hosts** — plain-language assignment modes; staff pool; Add host link
4. **Meeting method** — location/method select; Transovo Video settings; notetaker for external providers
5. **Questions** — lightweight booking questions (+ Add question)
6. **Booking rules** — approval, cancellation/reschedule, recurring (if supported); advanced collapsed
7. **Payment** — optional, lower priority; connect Stripe/Square contextual CTAs
8. **Confirmation** — confirmation copy, redirect, booking link sidebar

## Excluded from Meetings UI

Service phases, resources, add-ons, categories, intake forms, class capacity, packages, POS, seat maps.

## Contextual creation (links preserve draft via in-app navigation)

| Dependency | Action |
|------------|--------|
| No hosts | Link → `/appointments/staff` |
| No availability | Link → `/appointments/availability` |
| Paid + no provider | Link → payment settings |
| External video | Link → integrations when needed |

## Backend gaps (documented)

| Gap | Handling |
|-----|----------|
| No DELETE API | Disable only |
| No duplicate API | POST copy client-side |
| Legacy types without `bookingTypeKind` | Default SERVICE — not shown in Meetings list |

## Legacy redirect

`/appointments/types/editor?segment=meetings&create=1` → `/appointments/types/meetings/new`  
`/appointments/types/editor?id={id}` (MEETING) → `/appointments/types/meetings/{id}`

## UAT matrix

| # | Test | Pass criteria |
|---|------|---------------|
| 1 | Create basic meeting | No archetype picker; appears in list |
| 2 | Public booking | Link works; appointment created |
| 3 | Host assignment | Correct host on appointment |
| 4 | Meeting method | Join info when Transovo Video |
| 5 | Rules | Cancel/reschedule enforced on manage |
| 6 | Paid meeting | PROVIDER_BLOCKED if no Stripe/Square |
| 7 | Edit | Persists after reload |
| 8 | Mobile | No horizontal overflow |
| 9 | Keyboard | Focus visible; save reachable |

## Stop gate

Do not begin Services blueprint until Meetings UAT passes.
