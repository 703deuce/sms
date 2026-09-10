# Bookable Object Component Contract (seed)

Full mechanical audit is incremental. This seed documents high-traffic controls implemented in this pass.

## Service — Duration (Scheduling)

| Field | Value |
|-------|-------|
| OBJECT | Service |
| SECTION | Basic details |
| COMPONENT | Duration |
| CONTROL TYPE | number input |
| READ PATH | `VoiceService.durationMinutes` via `/api/appointments/types` |
| WRITE PATH | PATCH/POST `/api/appointments/types` → `buildSavePayload` |
| VALIDATION | positive integer; name required on save |
| PUBLIC CONSEQUENCE | slot generation uses duration |
| TEST | change → save → reload → public slot length |

## Meeting — Host mode

| Field | Value |
|-------|-------|
| OBJECT | Meeting |
| SECTION | Staff |
| VISIBLE WHEN | `lockedKind=MEETING` only (Services page filters list) |
| READ/WRITE | `config.staffAssignment`, `staffIds` |
| PUBLIC CONSEQUENCE | host resolution on booking |

## Class — Maximum capacity

| Field | Value |
|-------|-------|
| OBJECT | Class |
| SECTION | General |
| COMPONENT | Maximum capacity |
| READ/WRITE | `ClassSeries.capacity` via classes API |
| PUBLIC CONSEQUENCE | enrollment cap on `/book/[slug]/classes` |
| RUNTIME | atomic enrollment in `enrollInClass` |

## Workshop — Offering kind

| Field | Value |
|-------|-------|
| OBJECT | Workshop |
| COMPONENT | metadata discriminator |
| WRITE | `metadata: { kind: "workshop" }` on create/save |
| READ | `resolveClassSeriesOfferingKind(metadata)` |

## Buttons — Create meeting/service/class/workshop

| ACTION | ROUTE | RESULT |
|--------|-------|--------|
| Create meeting | `/appointments/meetings` | Opens editor, `bookingTypeKind=MEETING`, no picker |
| Create service | `/appointments/services` | Opens editor, `bookingTypeKind=SERVICE`, no picker |
| Create class | `/appointments/classes` | Opens ClassSeries form, `metadata.kind=class` |
| Create workshop | `/appointments/workshops` | Opens ClassSeries form, `metadata.kind=workshop` |

See `docs/APPOINTMENTS-BOOKABLE-OBJECT-UI-COMPLETENESS-AUDIT.md` for interactive element classification.
