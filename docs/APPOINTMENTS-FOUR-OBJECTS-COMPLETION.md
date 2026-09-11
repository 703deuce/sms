# Appointments Four Bookable Objects — Completion Pass

**Date:** 2026-09-10  
**Branch:** `cursor/booking-four-objects-ia-709b`  
**Phase:** Booking IA Phase 2 — Classes + Workshops completion

## Locked IA (unchanged)

```
BOOKING
├── Meetings      → /appointments/meetings
├── Services      → /appointments/services
├── Classes       → /appointments/classes
└── Workshops     → /appointments/workshops
```

Booking Types is **not** in normal navigation. Generic hub redirects via `LegacyBookingTypesRedirect`.

## Shared backend (preserved)

| Customer object | Backend model | Discriminator |
|-----------------|---------------|---------------|
| Meeting | `VoiceService` | `bookingTypeKind: MEETING` |
| Service | `VoiceService` | `bookingTypeKind: SERVICE` |
| Class | `ClassSeries` + `ClassOccurrence` | `metadata.kind: class` |
| Workshop | `ClassSeries` + `ClassOccurrence` | `metadata.kind: workshop` |

No four separate databases. UX separation only.

## This pass — delivered

### Classes editor (`ClassSeriesAdminConnected`, `offeringKind=class`)

| Section | Status |
|---------|--------|
| General | WORKING — name, description, visibility, status, image |
| Schedule | WORKING — occurrence panel, weekly recurrence generator |
| Instructor & location | WORKING — staff, location, timezone |
| Capacity | WORKING — max capacity, show remaining spots |
| Pricing & access | WORKING — free, price, member-only |
| Customer information | WORKING — intake form selector |
| Policies | WORKING — cancellation, terms URL |
| Waitlist | WORKING — enable, auto-promote, offer expiry |
| Admission | WORKING — check-in/ticket flag + ops guidance |

### Workshops editor (`offeringKind=workshop`)

| Section | Status |
|---------|--------|
| General | WORKING |
| Date & time | WORKING — workshop schedule panel (no weekly recurrence default) |
| Location | WORKING — staff, location, timezone |
| Registration | WORKING — capacity, opens/closes |
| Pricing & access | WORKING |
| Customer information | WORKING |
| Policies & documents | WORKING |
| Admission | WORKING |
| Confirmation | WORKING — confirmation message |

### Public surfaces

| Object | Admin public link | Customer route |
|--------|-------------------|----------------|
| Class | `/book/{slug}/classes` | Workshop-independent labels; API filters `kind=class` |
| Workshop | `/book/{slug}/workshops` | Workshop labels; API filters `kind=workshop` |

### Backend

- `listOccurrencesForSeries`, `cancelClassOccurrence`, `updateClassOccurrence`
- `assertOccurrenceCapacity` before `enrollInClass`
- `loadPublicGroupOfferings(workspaceId, offeringKind)` — shared public loader

## Meetings / Services (regression)

- Kind picker hidden on both (`hideKindPicker: true`)
- Full `TypeEditorPanel` depth preserved for Services
- Meeting editor does not expose class capacity, waitlist, workshop registration

## Retirement gate

```
READY_TO_RETIRE_GENERIC_BOOKING_TYPES = NO
```

### Remaining blockers

1. **Browser smokes** — FOUR-03, 05, 10–12, 16–18, 23, 25, 26 not executed in this environment
2. **Package/membership pickers** — pricing section references canonical commerce; multi-select product IDs not yet wired in Class/Workshop UI
3. **Live capacity E2E** — server assertion exists; three-customer browser proof pending
4. **Waitlist runtime integration** — editor configures metadata; promotion flow needs live cert
5. **Admission QR/ticket** — flag + guidance; full ticket UI post-registration not on editor
6. **Contextual create** — staff/location/forms from editors not re-verified in browser this pass

## Next step to YES

Run focused browser cert with `DEV_AUTH_BYPASS=1`, complete FOUR-03 through FOUR-26, confirm `UNIQUE_REQUIRED_FUNCTIONALITY = 0` in generic equivalence audit.
