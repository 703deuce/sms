# Bookable Object Editor Matrix

## VoiceService editors (Meetings / Services)

| Section | Meeting | Service | Implementation |
|---------|---------|---------|----------------|
| Kind picker | Hidden | Hidden | `hideKindPicker` on `TypeEditorPanel` |
| Basic details | Yes | Yes | Shared `TypeEditorPanel` |
| Staff / hosts | Yes | Yes | Shared |
| Payment | Optional/light | Full | Shared advanced sections |
| Resources / phases | Hidden by focus | Yes | `editorDefaultsForBookingTypeKind` |
| Class capacity | No | No | `bookingTypeKind !== CLASS` on locked pages |
| Categories | No | Yes | Service advanced |

**Runtime:** `upsertAppointmentType` → `voice_services` via `/api/appointments/types`

## ClassSeries editors (Classes / Workshops)

| Section | Class | Workshop | API field |
|---------|-------|----------|-----------|
| General (name, description) | Yes | Yes | `name`, `description` |
| Capacity | Yes | Yes | `capacity` |
| Instructor / location | Yes | Yes | `staffId`, `locationId` |
| Schedule / occurrences | Read hint | Date TBD in UI | `class_occurrences` |
| Offering discriminator | `metadata.kind: class` | `metadata.kind: workshop` | `class_series.metadata` |

**Runtime:** `upsertClassSeries` → `/api/appointments/service-booking/classes`

## Public consequences

| Admin control | Public surface |
|---------------|----------------|
| Service duration | `/book/[slug]/[serviceId]` slot length |
| Meeting host mode | Host resolution on public booking |
| Class capacity | `/book/[slug]/classes` remaining spots |
| Workshop metadata | Filtered workshop list (admin); public classes page until dedicated workshops URL |
