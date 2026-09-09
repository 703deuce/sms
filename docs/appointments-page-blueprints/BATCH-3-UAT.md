# Batch 3 UAT — Classes + Workshops & Events

**Branch:** `cursor/classes-workshops-batch3-709b`  
**Date:** 2026-09-09  
**Environment:** `localhost:3000` with `DEV_AUTH_BYPASS=1`

## Surfaces shipped

| # | Surface | Route | Status |
|---|---------|-------|--------|
| 1 | Classes list | `/appointments/types/classes` | PASS |
| 2 | Class editor | `/appointments/types/classes/new`, `[id]` | PASS |
| 3 | Class occurrence detail | `/appointments/classes/occurrences/[id]` | PASS |
| 4 | Workshops & Events list | `/appointments/types/workshops` | PASS |
| 5 | Workshop/Event editor | `/appointments/types/workshops/new`, `[id]` | PASS |

## Browser UAT — Classes

| ID | Test | Result | Notes |
|----|------|--------|-------|
| C1 | Create class | PASS | UAT Morning Yoga saved; 12 upcoming sessions generated |
| C2 | Public enrollment | UAT_PENDING | Public booking flow not run in this session |
| C3 | Capacity | UAT_PENDING | Requires multi-enrollment smoke |
| C4 | Capacity display | UAT_PENDING | UI present; public verification pending |
| C5 | Waitlist | UAT_PENDING | Toggle present; runtime offer flow not exercised |
| C6 | Party size | UAT_PENDING | Add-attendee modal has party size field |
| C7 | Occurrence edit | UAT_PENDING | Edit session modal present; not exercised |
| C8 | Manual attendee | UAT_PENDING | Add attendee modal + contact search wired |
| C9 | Check-in | UAT_PENDING | Check-in uses existing class-check-in API |
| C10 | Package/membership | UAT_PENDING | Contextual links only (no full management) |
| C11 | Mobile | PASS | List/editor/occurrence render at narrow width (spot check) |
| C12 | Keyboard | PASS | Core buttons and form fields keyboard reachable (spot check) |

## Browser UAT — Workshops & Events

| ID | Test | Result | Notes |
|----|------|--------|-------|
| E1 | Create event | UAT_PENDING | Editor loads; save not exercised in this session |
| E2 | Public registration | UAT_PENDING | — |
| E3 | Capacity | UAT_PENDING | — |
| E4 | Event vs class presentation | PASS | Class editor shows weekly recurrence; workshop editor shows single date + hint |
| E5 | Check-in / ticket | UAT_PENDING | Shared occurrence detail; QR ticket runtime deferred |
| E6 | Mobile | PASS | Spot check |
| E7 | Keyboard | PASS | Spot check |

## Cross-regression

| Check | Result |
|-------|--------|
| Booking Types landing | PASS — Classes and Workshops segments present |
| Legacy CLASS records (no classPresentation) | PASS — default to Classes segment |
| Focused routes replace transitional editor links | PASS — createHref updated |
| No duplicate Event backend | PASS — `bookingTypeKind: CLASS` + `classPresentation` only |
| Transitional `/appointments/types/editor` redirects | PASS — classes/workshops redirect to focused routes |

## Backend gaps discovered

- Occurrence regeneration on schedule edit: only generates on **new** series (prevents duplicate rows on every save); full series reschedule UX deferred
- Capacity enforcement before enroll: depends on existing `enrollInClass` runtime — friendly over-capacity messaging not yet verified end-to-end
- Per-type package/membership assignment: contextual links only
- Admission QR / seat maps: progressive disclosure; no dedicated ticket UI in this batch
- Public booking links point to `/book/{slug}/classes` hub (not per-type deep link)

## Evidence

- `batch3-classes-list.webp` — Classes list with UAT Morning Yoga
- `batch3-class-editor.webp` — Class editor sections
- `batch3-workshop-editor.webp` — Workshop editor (single date)
- `batch3-occurrence-detail.webp` — Occurrence operational page
