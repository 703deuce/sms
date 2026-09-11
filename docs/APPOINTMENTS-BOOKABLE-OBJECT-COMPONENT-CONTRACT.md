# Bookable Object Component Contract (exhaustive)

**Status:** EXHAUSTIVE for Class/Workshop editors; Meeting/Service reference `TypeEditorPanel` + advanced sections  
**Date:** 2026-09-10

## Legend

| SAVE BEHAVIOR | Meaning |
|---------------|---------|
| IMMEDIATE | Own API call (occurrences) |
| ON_SAVE | Parent Save changes button |
| READ_ONLY | Display only |

| Classification | Meaning |
|----------------|---------|
| CONNECTED_AND_WORKING | Persists and reloads |
| READ_ONLY_BY_DESIGN | Intentional display |
| PROVIDER_BLOCKED_WITH_TRUTHFUL_STATE | Blocked with honest copy |

---

## Class — General

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | General |
| COMPONENT | Name |
| CONTROL TYPE | text input |
| USER JOB | Identify the class |
| DEFAULT | empty |
| VISIBLE WHEN | always |
| ENABLED WHEN | always |
| REQUIRED | yes |
| VALIDATION | non-empty trim |
| ERROR MESSAGE | Name is required |
| READ SOURCE | `ClassSeries.name` |
| WRITE TARGET | POST `/api/appointments/service-booking/classes` |
| API | `upsertClassSeries` |
| DATABASE | `class_series.name` |
| SAVE BEHAVIOR | ON_SAVE |
| DIRTY STATE | form state until save |
| PUBLIC CONSEQUENCE | Class list title on `/book/{slug}/classes` |
| PERMISSIONS | `appointments.write` |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | General |
| COMPONENT | Description |
| CONTROL TYPE | textarea |
| READ SOURCE | `ClassSeries.description` |
| WRITE TARGET | same POST body `description` |
| DATABASE | `class_series.description` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | General |
| COMPONENT | Visibility |
| CONTROL TYPE | select (public/hidden) |
| READ SOURCE | `metadata.visibility` |
| WRITE TARGET | `metadata.visibility` |
| DATABASE | `class_series.metadata` JSON |
| SAVE BEHAVIOR | ON_SAVE |
| PUBLIC CONSEQUENCE | hidden series excluded from public filter when enforced |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | General |
| COMPONENT | Status (active/inactive) |
| CONTROL TYPE | select |
| READ SOURCE | `ClassSeries.active` |
| WRITE TARGET | `active` boolean |
| DATABASE | `class_series.active` |
| SAVE BEHAVIOR | ON_SAVE |
| PUBLIC CONSEQUENCE | inactive excluded from public API |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | General |
| COMPONENT | Image URL |
| CONTROL TYPE | url input |
| READ SOURCE | `metadata.imageUrl` |
| WRITE TARGET | `metadata.imageUrl` |
| DATABASE | `class_series.metadata` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

---

## Class — Schedule (`ClassSeriesOccurrencePanel`)

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Schedule |
| COMPONENT | Occurrence date |
| CONTROL TYPE | date input |
| USER JOB | Set session date |
| REQUIRED | yes (with time) |
| READ SOURCE | — |
| WRITE TARGET | POST `action: occurrences` |
| API | `generateClassOccurrences` |
| DATABASE | `class_occurrences.starts_at`, `ends_at` |
| SAVE BEHAVIOR | IMMEDIATE |
| PUBLIC CONSEQUENCE | Appears on public class occurrence list |
| TEST | FOUR-07 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Schedule |
| COMPONENT | Start time |
| CONTROL TYPE | time input |
| WRITE TARGET | combined into `startsAt` ISO |
| SAVE BEHAVIOR | IMMEDIATE |
| TEST | FOUR-07 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Schedule |
| COMPONENT | Duration (minutes) |
| CONTROL TYPE | number |
| DEFAULT | 60 |
| WRITE TARGET | `endsAt` computed |
| TEST | FOUR-07 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Schedule |
| COMPONENT | Add occurrence |
| CONTROL TYPE | button |
| WRITE TARGET | `action: occurrences` |
| TEST | FOUR-07 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Schedule |
| COMPONENT | Weekly recurrence — start date |
| CONTROL TYPE | date |
| VISIBLE WHEN | `showWeeklyRecurrence=true` |
| TEST | FOUR-08 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Schedule |
| COMPONENT | Weekly recurrence — weekdays |
| CONTROL TYPE | toggle button group |
| TEST | FOUR-08 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Schedule |
| COMPONENT | Generate weekly schedule |
| CONTROL TYPE | button |
| WRITE TARGET | bulk `action: occurrences` |
| TEST | FOUR-08 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Schedule |
| COMPONENT | Occurrence table |
| CONTROL TYPE | semantic table |
| READ SOURCE | `action: list_occurrences` |
| API | `listOccurrencesForSeries` |
| TEST | FOUR-07 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Schedule |
| COMPONENT | Cancel occurrence |
| CONTROL TYPE | button per row |
| WRITE TARGET | `action: cancel_occurrence` |
| API | `cancelClassOccurrence` |
| DATABASE | `class_occurrences.status=cancelled` |
| TEST | FOUR-07 |

---

## Class — Instructor & location

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Instructor & location |
| COMPONENT | Instructor / staff |
| CONTROL TYPE | select |
| READ SOURCE | workspace staff from `/api/appointments/settings` |
| WRITE TARGET | `staffId` |
| DATABASE | `class_series.staff_id` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Instructor & location |
| COMPONENT | Location |
| CONTROL TYPE | select |
| WRITE TARGET | `locationId` |
| DATABASE | `class_series.location_id` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Instructor & location |
| COMPONENT | Timezone |
| CONTROL TYPE | text |
| WRITE TARGET | `metadata.timezone` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

---

## Class — Capacity

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Capacity |
| COMPONENT | Maximum capacity |
| CONTROL TYPE | number min 1 |
| READ SOURCE | `ClassSeries.capacity` |
| WRITE TARGET | `capacity` |
| DATABASE | `class_series.capacity` |
| SAVE BEHAVIOR | ON_SAVE |
| PUBLIC CONSEQUENCE | `remaining` on public API |
| RUNTIME | `assertOccurrenceCapacity` on enroll |
| TEST | FOUR-09 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Capacity |
| COMPONENT | Show remaining spots |
| CONTROL TYPE | checkbox |
| WRITE TARGET | `metadata.showRemainingSpots` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

---

## Class — Pricing & access

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Pricing & access |
| COMPONENT | Free |
| CONTROL TYPE | checkbox |
| WRITE TARGET | `metadata.isFree`, `metadata.priceCents` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Pricing & access |
| COMPONENT | Price (USD) |
| CONTROL TYPE | number |
| VISIBLE WHEN | `!isFree` |
| WRITE TARGET | `metadata.priceCents` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Pricing & access |
| COMPONENT | Members only |
| CONTROL TYPE | checkbox |
| WRITE TARGET | `metadata.memberOnly` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

---

## Class — Customer information

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Customer information |
| COMPONENT | Intake form |
| CONTROL TYPE | select |
| READ SOURCE | `/api/appointments/service-booking/intake-forms` |
| WRITE TARGET | `metadata.intakeFormId` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

---

## Class — Policies

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Policies |
| COMPONENT | Cancellation policy |
| CONTROL TYPE | textarea |
| WRITE TARGET | `metadata.cancellationPolicy` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Policies |
| COMPONENT | Terms URL |
| CONTROL TYPE | url input |
| WRITE TARGET | `metadata.termsUrl` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-06 |

---

## Class — Waitlist

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Waitlist |
| COMPONENT | Enable waitlist |
| CONTROL TYPE | checkbox |
| WRITE TARGET | `metadata.waitlistEnabled` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-11 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Waitlist |
| COMPONENT | Auto-promote |
| CONTROL TYPE | checkbox |
| VISIBLE WHEN | waitlist enabled |
| WRITE TARGET | `metadata.waitlistAutoPromote` |
| TEST | FOUR-11 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Waitlist |
| COMPONENT | Offer expires (hours) |
| CONTROL TYPE | number |
| VISIBLE WHEN | waitlist enabled |
| WRITE TARGET | `metadata.waitlistOfferExpiresHours` |
| TEST | FOUR-11 |

---

## Class — Admission

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Admission |
| COMPONENT | Enable check-in / ticket tracking |
| CONTROL TYPE | checkbox |
| WRITE TARGET | `metadata.admissionEnabled` |
| SAVE BEHAVIOR | ON_SAVE |
| TEST | FOUR-12 |

---

## Class — Global actions

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Editor chrome |
| COMPONENT | Save changes / Create class |
| CONTROL TYPE | button |
| WRITE TARGET | POST classes API (default upsert) |
| TEST | FOUR-06 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Class |
| SECTION | Editor chrome |
| COMPONENT | Public page link |
| CONTROL TYPE | link |
| TARGET | `/book/{slug}/classes` |
| READ_ONLY_BY_DESIGN | navigation only |
| TEST | FOUR-10 |

---

## Workshop — sections (shared implementation, workshop copy)

Workshop uses `ClassSeriesAdminConnected` with `WORKSHOP_EDITOR_SECTIONS`. Controls mirror Class where applicable with these differences:

| SECTION | Workshop-specific |
|---------|-------------------|
| Date & time | `ClassSeriesWorkshopSchedulePanel`, `showWeeklyRecurrence=false` |
| Registration | Capacity + registration opens/closes on same tab |
| Confirmation | `metadata.confirmationMessage` |
| Public | `/book/{slug}/workshops`, labels "Workshop", "Register" |

All Workshop General, Location, Pricing, Customer, Policies, Admission controls use the same READ/WRITE paths as Class with `metadata.kind: workshop`.

| FIELD | VALUE |
|-------|-------|
| OBJECT | Workshop |
| SECTION | Date & time |
| COMPONENT | Add session (single) |
| CONTROL TYPE | date/time/duration + Add occurrence |
| SAVE BEHAVIOR | IMMEDIATE |
| TEST | FOUR-14 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Workshop |
| SECTION | Registration |
| COMPONENT | Maximum capacity |
| WRITE TARGET | `ClassSeries.capacity` |
| TEST | FOUR-17 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Workshop |
| SECTION | Registration |
| COMPONENT | Registration opens / closes |
| CONTROL TYPE | datetime-local |
| WRITE TARGET | `metadata.registrationOpensAt`, `registrationClosesAt` |
| TEST | FOUR-13 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Workshop |
| SECTION | Confirmation |
| COMPONENT | Confirmation message |
| CONTROL TYPE | textarea |
| WRITE TARGET | `metadata.confirmationMessage` |
| PUBLIC CONSEQUENCE | Post-registration copy when surfaced |
| TEST | FOUR-16 |

| FIELD | VALUE |
|-------|-------|
| OBJECT | Workshop |
| SECTION | Public |
| COMPONENT | Workshop list/register |
| READ SOURCE | `loadPublicGroupOfferings(workspaceId, "workshop")` |
| API | GET `/api/public/book/{slug}/workshops` |
| TEST | FOUR-15, FOUR-16 |

---

## Meeting — `TypeEditorPanel` (`hideKindPicker=true`)

| SECTION | Key controls | READ/WRITE | NOT SHOWN |
|---------|--------------|------------|-----------|
| Basic details | Name, duration, color, description | `/api/appointments/types` → `VoiceService` | Kind picker |
| Staff | Host mode, staff multi-select | `config.staffAssignment`, `staffIds` | Service phases |
| Locations | Location mode, locations | `config.locationMode`, `locationIds` | Class capacity |
| Publishing | Active, visibility, slug | type config | Waitlist |
| Video / Notetaker | Meeting-only integrations | config flags | Workshop registration |
| Advanced | Buffers, limits per `editorDefaultsForBookingTypeKind(MEETING)` | config JSON | — |

**Classification:** CONNECTED_AND_WORKING (shared editor, locked kind)  
**TEST:** FOUR-02, FOUR-03

---

## Service — `TypeEditorPanel` (`hideKindPicker=true`)

| SECTION | Key controls | READ/WRITE |
|---------|--------------|------------|
| Basic details | Name, duration, description | `VoiceService` |
| Staff | Assignments, phases staff | config |
| Resources | `TypeResourcesSection` | resource links |
| Service phases | `TypeServicePhasesSection` | phase config |
| Categories | `TypeCategoriesSection` | category IDs |
| Add-ons | `TypeAddOnsSection` | add-on IDs |
| Intake forms | `TypeIntakeFormsSection` | form IDs |
| Payment | Provider-connected payment | config |
| Advanced | Full service depth | `TypeAdvancedSections` |

**NOT SHOWN:** Class capacity, waitlist, workshop registration  
**TEST:** FOUR-04, FOUR-05

---

## Component totals

| Classification | Count |
|----------------|-------|
| CONNECTED_AND_WORKING | 52 |
| READ_ONLY_BY_DESIGN | 4 |
| PROVIDER_BLOCKED_WITH_TRUTHFUL_STATE | 0 |
| PLACEHOLDER | 0 |
| NO_OP | 0 |
| UNPERSISTED | 0 |
| MOCK | 0 |
| BROKEN | 0 |

**Total documented components:** 56
