# Generic Booking Types — Final Equivalence Audit

## Hub / chooser status

| Surface | Status |
|---------|--------|
| Sidebar Booking Types | **Removed** |
| `/appointments/types` | **Redirect** via `LegacyBookingTypesRedirect` |
| Archetype chooser in normal flow | **Hidden** (`hideKindPicker` on Meetings/Services) |
| `TypeEditorPanel` shared code | **Retained** — consumed by specialized routes |

## Unique functionality inventory

| Feature | Applies to | Canonical home | Absorbed? | Proof |
|---------|------------|----------------|-----------|-------|
| VoiceService list | Meeting, Service | `/appointments/meetings`, `/appointments/services` | YES | Filtered lists + locked kind |
| Type editor (all sections) | Meeting, Service | Same routes, `hideKindPicker` | YES | `meetings-client.tsx`, `services-client.tsx` |
| Create type button | All | Per-object Create | YES | No hub create |
| Class series admin | Class, Workshop | `/appointments/classes`, `/appointments/workshops` | YES | `ClassSeriesAdminConnected` |
| Occurrence scheduling | Class | Class editor Schedule tab | YES | `ClassSeriesOccurrencePanel` |
| Workshop date/time | Workshop | Workshop editor Date & time | YES | `ClassSeriesWorkshopSchedulePanel` |
| Public class enrollment | Class | `/book/[slug]/classes` | YES | Kind-filtered API |
| Public workshop registration | Workshop | `/book/[slug]/workshops` | YES | Dedicated route + labels |
| Deep link `?id=` on types | All | Kind-specific route | YES | `LegacyBookingTypesRedirect` |
| Categories (service) | Service | Service editor | YES | Unchanged advanced sections |
| Generic kind picker | — | — | N/A | Intentionally removed from UX |

## UNIQUE_REQUIRED_FUNCTIONALITY remaining

| Item | Blocker |
|------|---------|
| Package/membership multi-select on Class/Workshop | Metadata fields exist; UI uses commerce-at-checkout note |
| Full waitlist promotion E2E | Editor configures; runtime cert pending |
| Browser save/reload proof all four | Not run in cloud agent this pass |

**Count for retirement:** 0 **unique hub-only** features; 3 **equivalence proof** gaps (not hub features).

## Deep-link behavior

```
/appointments/types           → /appointments/services
/appointments/types?id={uuid} → resolve kind → /appointments/{meetings|services|classes|workshops}?id=
```

ClassSeries IDs on generic types route: falls through to services if not VoiceService (ClassSeries uses dedicated admin routes).

## READY_TO_RETIRE_GENERIC_BOOKING_TYPES

**NO** — structural absorption complete; browser equivalence proof and commerce picker depth pending.

When **YES**:

- Generic hub stays absent from nav
- `/appointments/types` continues intelligent redirect
- Specialized four-object pages are authoritative
- Shared `TypeEditorPanel` / `VoiceService` / `ClassSeries` code remains
