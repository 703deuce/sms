# Page Blueprint — Booking Types Landing

**Status:** DRAFT — implement only after browser inspection + screenshot baseline  
**Batch:** 1 (first implementation blueprint)  
**Directive:** `docs/TRANSOVO-APPOINTMENTS-FINAL-PAGE-MANIFEST-IA-DIRECTIVE.md`

---

```
PAGE: Booking Types Landing
ROUTE: /appointments/types (landing replaces mega-editor as default view)
CLASSIFICATION: SPLIT (entry surface) — current editor becomes child routes
PRIMARY USER: Business owner / scheduler admin
PRIMARY USER JOB: Understand what customers can book and open the right workflow to create or manage it
```

## Source feature rows

From `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md` §2:

- Booking types list & editor
- Archetypes MEETING / SERVICE / CLASS (split presentation)
- Display order (per archetype lists)
- Workshops & Events (new presentation — may map to CLASS variant or distinct kind)

## Existing UI to preserve

- Reuse list/table components from current `/appointments/types` where they fit per-archetype lists
- Reuse `BookingTypeKindPicker` **concepts** but **not** as inline radio on one editor — use as landing cards instead
- Do **not** restyle `/appointments/overview`, Calendar, or Contacts

## Existing components to reuse

- `src/components/appointments/kimi-ui/appointment-types/*` (selective)
- Appointments shell + local nav from `appointments-nav.ts`
- Overview-connected typography tokens / card patterns (art direction only)

## Primary action

Create the right booking type (context-dependent card: Create meeting / Create service / etc.)

## Secondary actions

- View all of one kind
- Link to Booking Pages, Availability, Staff (contextual help links — not primary nav duplication)

## Local nav

None at landing level. Each archetype list/editor gets its own local nav when drilled in.

## Page sections (landing) in order

1. **Page header** — H1: Booking Types · short helper: "What can customers book?"
2. **Four choice cards** (not enum labels as primary text):
   - **Meetings** — calls, consultations, demos, interviews, virtual meetings
   - **Services** — one-on-one provider work (salon, tutoring, repair, etc.)
   - **Classes** — multiple customers, same scheduled session
   - **Workshops & Events** — registrations for limited-run group events
3. **Per-card actions:** View · Create
4. **Optional compact summary** — counts per kind (only if real data; no mock zeros)
5. **Discoverability strip** — links to Packages & Sales, Booking Pages (trial discoverability standard)

## Table/list fields

Landing itself: no master table. Each "View" goes to archetype list with columns:

| Meetings | Services | Classes | Workshops & Events |
|----------|----------|---------|-------------------|
| Name | Name | Name | Name |
| Duration | Duration | Schedule summary | Date/time |
| Hosts | Staff | Instructor | Location |
| Status | Status | Capacity | Registration cap |
| Actions | Actions | Actions | Actions |

## Drawers / modals

- None on landing. Quick-create happens on archetype editors, not landing.

## Empty states (per archetype list)

Example (Services):

> **Create your first service**  
> Services are one-on-one appointments with a provider — massage, tutoring, consulting, and more.  
> [ Create service ]

## Loading / error / success

- Skeleton cards on landing load
- Per-list skeleton rows
- Error with retry on failed counts/lists

## Dependencies

- `GET /api/appointments/types` filtered by `bookingTypeKind` (or equivalent)
- Nav update deferred until child list routes exist

## Contextual create actions

Landing only routes to create flows — does not host full editors.

## Public/portal counterpart

Public book `/book/[slug]` — unchanged; landing is admin-only.

## Responsive behavior

- Four cards: 1 col mobile → 2 col tablet → 4 col desktop
- Touch targets per interaction standards

## Accessibility

- Cards are keyboard-focusable; each action reachable
- Headings hierarchy: H1 page · H2 card titles
- Do not use color alone for status

## Backend already present

- `bookingTypeKind` on type config
- Types CRUD APIs
- `editorDefaultsForBookingTypeKind()` in `booking-type-kind.ts`

## Backend gaps

- Workshops & Events may need kind enum or mapping decision (document before editor blueprint)
- Aggregated counts endpoint optional (can derive client-side from types list)

## Browser UAT

- Owner opens Booking Types → sees four clear choices without reading docs
- Create meeting → lands in **meeting-only** editor (not generic form)
- View services → list shows only services
- Returning from create preserves landing context

## Old routes to merge/retire

- Default `/appointments/types` mega-editor → split to `/appointments/types/meetings`, `/services`, `/classes`, `/events` (exact paths TBD in editor blueprints)
- `/appointments/classes` admin tab shell → merge into Classes archetype home

## Art direction notes

- Inspect `/appointments/overview` for typography, card radius, shadow restraint, button hierarchy
- **Do not** use overview dashboard grid on this page — use choice cards + optional summary only
- Match overview **tone**, not overview **layout**

## Implementation gate

- [ ] Screenshot: current types page
- [ ] Screenshot: overview reference
- [ ] Classification signed off in `APPOINTMENTS-PAGE-CLASSIFICATION-MANIFEST.md`
- [ ] Product confirms Workshops & Events vs Class relationship
- [ ] Then code

---

*Next blueprint after approval: 02-meetings-list-editor.md*
