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
| General (visibility, image) | Yes | Yes | `metadata` JSON |
| Schedule / occurrences | Yes — `ClassSeriesOccurrencePanel` | Yes — workshop panel (no weekly default) | `class_occurrences` |
| Pricing & access | Yes | Yes | `metadata.priceCents`, `isFree`, `memberOnly` |
| Customer information | Yes | Yes | `metadata.intakeFormId` |
| Policies | Yes | Yes | `metadata.cancellationPolicy`, `termsUrl` |
| Waitlist | Yes | — | `metadata.waitlist*` |
| Admission | Yes | Yes | `metadata.admissionEnabled` |
| Confirmation | — | Yes | `metadata.confirmationMessage` |
| Offering discriminator | `metadata.kind: class` | `metadata.kind: workshop` | `class_series.metadata` |

**Runtime:** `upsertClassSeries` → `/api/appointments/service-booking/classes`  
**Occurrences:** `generateClassOccurrences`, `listOccurrencesForSeries`, `cancelClassOccurrence`  
**Capacity:** `assertOccurrenceCapacity` in `enrollInClass`

## Public consequences

| Admin control | Public surface |
|---------------|----------------|
| Service duration | `/book/[slug]/[serviceId]` slot length |
| Meeting host mode | Host resolution on public booking |
| Class capacity | `/book/[slug]/classes` remaining spots (kind=class filter) |
| Workshop registration | `/book/[slug]/workshops` (kind=workshop filter, Workshop labels) |
