# Page Blueprint — Booking Types Landing

**Status:** FINAL — Batch 1 implemented  
**Batch:** 1 (first implementation blueprint)  
**Directive:** `docs/TRANSOVO-APPOINTMENTS-FINAL-PAGE-MANIFEST-IA-DIRECTIVE.md`  
**Branch:** `cursor/booking-types-landing-709b`

---

```
PAGE: Booking Types Landing
ROUTE: /appointments/types (canonical landing; mega-editor moved to child routes)
CLASSIFICATION: SPLIT — landing + per-segment lists + transitional editor
PRIMARY USER: Business owner / scheduler admin
PRIMARY USER JOB: Understand what customers can book and open the right workflow to create or manage it
PRIMARY QUESTION: "What can customers book?"
```

## Page identity

| Field | Value |
|-------|-------|
| User-facing name | Booking Types |
| Supporting text | Choose what customers can schedule with your business. |
| Art direction reference | `/appointments/overview` (typography, color, card restraint — **not** dashboard layout) |

## Workshops & Events — domain audit (Batch 1 decision)

**Question:** Is there a separate EVENT/WORKSHOP backend model?

**Finding:**

- No distinct `WORKSHOP` or `EVENT` value in `bookingTypeKind` (`MEETING` \| `SERVICE` \| `CLASS` only).
- CLASS runtime already supports group capacity, occurrences, waitlists, and event-admission tickets.
- Reusing CLASS for workshops/events matches user direction: **shared scheduling engine, separate customer-facing UI segment**.

**Implementation (smallest coherent architecture):**

- Added optional `classPresentation` on `AppointmentTypeConfig`: `recurring_class` \| `workshop_event`.
- **Classes** segment = `bookingTypeKind: CLASS` + `classPresentation` unset or `recurring_class` (legacy CLASS records default here).
- **Workshops & Events** segment = `bookingTypeKind: CLASS` + `classPresentation: workshop_event`.
- Default config on create: workshops disable recurring, higher default capacity; classes enable recurring.
- **No new scheduling engine.** Editor remains transitional; focused Workshop/Event editor is a later batch.

## Route strategy

| Segment | List route | Create route | Editor (transitional) |
|---------|------------|--------------|------------------------|
| Meetings | `/appointments/types/meetings` | `…/editor?segment=meetings&create=1` | `…/editor?segment=meetings&id=` |
| Services | `/appointments/types/services` | `…/editor?segment=services&create=1` | `…/editor?segment=services&id=` |
| Classes | `/appointments/types/classes` | `…/editor?segment=classes&create=1` | `…/editor?segment=classes&id=` |
| Workshops & Events | `/appointments/types/workshops` | `…/editor?segment=workshops&create=1` | `…/editor?segment=workshops&id=` |

- Canonical landing: `/appointments/types` (unchanged URL — least disruptive).
- Legacy mega-editor: replaced at landing; full editor UI preserved at `/appointments/types/editor` with segment filter.
- Deep links to `?id=` on editor continue to work.

## Page sections (implemented)

1. **Page header** — H1 Booking Types + helper line
2. **Four type cards** — Meetings, Services, Classes, Workshops & Events (no enum labels)
3. **Per-card actions** — Create (primary) + View (secondary, always visible)
4. **Per-card status** — real counts from `GET /api/appointments/types` or empty copy ("No meetings yet")
5. **Optional summary** — "Your booking types" when any active types exist (secondary; not a combined table)
6. **Discoverability footnote** — link to Packages & Sales (not on primary chooser)

**Explicitly omitted from landing:** Programs, Packages, Memberships, Resources, Policies, global "+ New booking type" archetype picker.

## Components

| File | Role |
|------|------|
| `src/lib/appointments/booking-types-segments.ts` | Segment definitions, filtering, defaults |
| `src/components/appointments/booking-types/booking-types-landing-connected.tsx` | Landing page |
| `src/components/appointments/booking-types/booking-types-type-card.tsx` | Type card |
| `src/components/appointments/booking-types/booking-types-kind-list-connected.tsx` | Per-segment list (transitional) |
| `src/components/appointments/booking-types/booking-types-editor-client.tsx` | Editor shell + back link |
| `src/features/appointments/kimi/appointment-types/appointment-types-connected.tsx` | Segment-aware transitional editor |

## Preservation

- Global shell, Home, Calendar, Contacts, Messages — unchanged
- `classPresentation` is additive; existing CLASS/MEETING/SERVICE records unchanged and categorized correctly
- No Meeting/Service/Class/Workshop **focused editor** rebuild in this batch

## Browser UAT checklist

| Test | Criteria | Result |
|------|----------|--------|
| 1 Discovery | Four cards visible with copy; no archetype enum | **PASS** |
| 2 Existing objects | Counts + View → filtered lists | **PASS** |
| 3 Create entry | Create opens segment-scoped editor, not archetype picker | **PASS** |
| 4 Mobile | Single column, no horizontal scroll | **PASS** |
| 5 Keyboard | Actions reachable, visible focus | **PASS** |

Evidence: `/opt/cursor/artifacts/screenshots/booking-types-landing-desktop-after.png`, `booking-types-landing-mobile-after.png`, `booking-types-meetings-list.png`, `booking-types-create-meeting-editor.png`, `appointments-overview-art-direction.png`

## Implementation gate

- [x] Screenshot baseline captured (before: legacy mega-editor at `/appointments/types`)
- [x] Overview art-direction reference captured
- [x] Classification in `APPOINTMENTS-PAGE-CLASSIFICATION-MANIFEST.md`
- [x] Workshops & Events domain decision documented (CLASS + `classPresentation`)
- [x] Landing + routes implemented
- [x] Desktop UAT pass
- [x] Mobile UAT pass
- [x] Keyboard UAT pass

## Next batch

**02 — Meetings list + editor** (`docs/appointments-page-blueprints/02-meetings-list-editor.md` — to be drafted). Simplest focused editor; reference for split editors.

---

*Batch 1 stops here. Do not implement Meeting/Service/Class/Workshop focused editors until Batch 2+.*
