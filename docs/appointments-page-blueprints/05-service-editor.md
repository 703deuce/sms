# Page Blueprint — Service Editor

**Status:** FINAL — Batch 2  
**Routes:** `/appointments/types/services/new`, `/appointments/types/services/[id]`  
**Backend:** `voiceService` + `AppointmentTypeConfig` with `bookingTypeKind: SERVICE`

---

```
PAGE: Service editor
CLASSIFICATION: SPLIT — focused editor (most complex in Batch 2)
PRIMARY USER JOB: Configure provider-based service customers can book
DESIGN PRINCIPLE: Deeper than Meetings — progressive disclosure, contextual create links
```

## SECTIONS (in order)

1. **General** — name, description, category, image, visibility, active
2. **Scheduling** — duration, duration options, recurring, schedule; advanced → service steps (phases)
3. **Staff, locations & rooms** — assignment modes, locations, rooms & equipment
4. **Customer information** — booking questions, intake forms
5. **Add-ons** — select eligible add-ons
6. **Pricing & access** — display price, payment collection; packages/memberships → commerce links (deferred assignment UI)
7. **Policies & documents** — cancel/reschedule/approval; terms/contracts → policy routes (transitional)
8. **Confirmation** — message, redirect, booking link

## CONTEXTUAL CREATE (draft preserved via sessionStorage)

| Dependency | Empty state CTA |
|------------|-----------------|
| Staff | Add staff member → `/appointments/staff` |
| Location | Add location → `/appointments/locations` |
| Rooms/equipment | Add room → `/appointments/resources` |
| Availability | Create schedule → `/appointments/availability` |
| Categories | Manage categories → `/appointments/categories` |
| Add-ons | Commerce → `/appointments/commerce` |
| Intake | Commerce (transitional) |
| Payment | Settings business |

## BACKEND GAPS (documented)

| Gap | Handling |
|-----|----------|
| Per-service package eligibility | Link to commerce; full UI in Packages batch |
| Per-service terms/contract picker | Link to policies/contracts; Contracts batch |
| Member-only access on type | Deferred — commerce/settings |
| Quick-create drawers in-editor | Links + sessionStorage draft; full drawers later |

## OLD ROUTES

`editor?segment=services&create=1` → `/services/new`  
`editor?id={SERVICE}` → `/services/{id}`

## BROWSER UAT

S1–S16 per Batch 2 spec; provider-blocked payment marked BLOCKED not FAIL

## STOP GATE

Batch 2 complete with Meetings list/editor + Services list/editor + landing regression
