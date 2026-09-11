# Booking Types Hub — Retirement Audit

## Old hub

| Item | Route | Status |
|------|-------|--------|
| Booking Types list/editor | `/appointments/types` | **Redirect** → `/appointments/services` or kind-specific route via `?id=` |
| Generic archetype picker | `BookingTypeKindPicker` in `TypeEditorPanel` | **Hidden** on Meetings/Services |
| Classes under types | `/appointments/types/classes` | **N/A on master** — canonical `/appointments/classes` |
| Events under types | `/appointments/types/events` | **N/A on master** — canonical `/appointments/workshops` |

## Updated internal links

- Overview setup → `/appointments/services`
- Settings search → Meetings/Services/Classes/Workshops entries
- Meeting Polls breadcrumb → Services
- Policies copy → Services

## Remaining references (acceptable)

- API `/api/appointments/types` — shared CRUD for `VoiceService` rows (internal name unchanged)
- Browser cert scripts — legacy paths until cert matrix updated

## Unique hub functionality absorbed

| Hub feature | Canonical home |
|-------------|----------------|
| VoiceService type list | Meetings / Services (filtered) |
| Type editor | Meetings / Services (locked kind) |
| Class series admin | Classes / Workshops |
| Create type | Per-object Create buttons |

## READY_TO_RETIRE_GENERIC_BOOKING_TYPES

**NO** — Structural absorption complete (four editors, occurrence scheduling, dedicated workshop public route). Browser save/reload/public smokes and live waitlist/admission cert remain.

### Remaining blockers (exact)

1. Browser smokes FOUR-02–05, 10–12, 16–18, 23, 25–26
2. Live three-customer capacity proof (FOUR-09 server logic present)
3. Package/membership multi-select on Class/Workshop editor (commerce at checkout only today)
