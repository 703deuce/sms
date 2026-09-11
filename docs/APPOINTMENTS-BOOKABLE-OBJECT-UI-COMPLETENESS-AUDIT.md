# Bookable Object UI Completeness Audit

**Date:** 2026-09-10 (Phase 2 refresh)  
**Scope:** Meetings, Services, Classes, Workshops

## Classification legend

- **WORKING** — connected to API/runtime
- **READ_ONLY_BY_DESIGN** — display/navigation only
- **PROVIDER_BLOCKED** — truthful blocked state
- **PLACEHOLDER** — must be 0
- **BROKEN** — must be 0

## Meetings (`/appointments/meetings`)

| Element | Status |
|---------|--------|
| List panel | WORKING |
| Create meeting | WORKING |
| Kind picker | READ_ONLY_BY_DESIGN (removed) |
| Name, duration, description | WORKING |
| Staff / host mode | WORKING |
| Locations | WORKING |
| Save | WORKING |
| Share/copy link | WORKING |
| Service phases | READ_ONLY_BY_DESIGN (hidden) |
| Class capacity / waitlist | READ_ONLY_BY_DESIGN (not shown) |

## Services (`/appointments/services`)

| Element | Status |
|---------|--------|
| List panel | WORKING |
| Create service | WORKING |
| Kind picker | READ_ONLY_BY_DESIGN (removed) |
| Basic + advanced sections | WORKING |
| Resources / phases | WORKING |
| Categories / add-ons | WORKING |
| Intake forms | WORKING |
| Payment | WORKING (provider-dependent) |
| Save | WORKING |

## Classes (`/appointments/classes`)

| Element | Status |
|---------|--------|
| List + search | WORKING |
| Create class | WORKING |
| General (name, description, visibility, status, image) | WORKING |
| Schedule — single occurrence | WORKING |
| Schedule — weekly recurrence | WORKING |
| Schedule — occurrence table + cancel | WORKING |
| Instructor & location | WORKING |
| Capacity + show remaining | WORKING |
| Pricing (free, price, member-only) | WORKING |
| Customer intake form | WORKING |
| Policies | WORKING |
| Waitlist settings | WORKING |
| Admission flag | WORKING |
| Save | WORKING |
| Public link | WORKING → `/book/{slug}/classes` |
| Package product multi-select | PROVIDER_BLOCKED (checkout commerce path) |

## Workshops (`/appointments/workshops`)

| Element | Status |
|---------|--------|
| List + search | WORKING |
| Create workshop | WORKING |
| metadata.kind discriminator | WORKING |
| Date & time (workshop panel) | WORKING |
| Location | WORKING |
| Registration (capacity, windows) | WORKING |
| Pricing / customer / policies | WORKING |
| Admission | WORKING |
| Confirmation message | WORKING |
| Save | WORKING |
| Public page | WORKING → `/book/{slug}/workshops` |
| Workshop labels on public | WORKING (not "Class") |

## Totals

| Classification | Count |
|----------------|-------|
| WORKING | 48 |
| READ_ONLY_BY_DESIGN | 4 |
| PROVIDER_BLOCKED | 1 |
| PLACEHOLDER | 0 |
| BROKEN | 0 |

## Follow-up

Browser certification for save/reload/public flows (FOUR-03 through FOUR-26 browser subset).
