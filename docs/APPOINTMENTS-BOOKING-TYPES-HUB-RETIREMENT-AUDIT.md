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

**NO** — Meetings/Services locked editors ship; Classes/Workshops use ClassSeries admin with core fields. Full editor specialization matrices and public smokes remain before retirement sign-off.
