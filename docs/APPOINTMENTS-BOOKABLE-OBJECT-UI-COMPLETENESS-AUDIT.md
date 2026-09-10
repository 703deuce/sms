# Bookable Object UI Completeness Audit (initial pass)

**Date:** 2026-09-10  
**Scope:** New canonical routes Meetings / Services / Classes / Workshops

## Classification legend

- **WORKING** — connected to API/runtime
- **READ_ONLY_BY_DESIGN** — display-only
- **PROVIDER_BLOCKED** — truthful blocked state
- **PLACEHOLDER** — must be 0 in production
- **BROKEN** — must be 0

## Meetings (`/appointments/meetings`)

| Element | Status |
|---------|--------|
| List panel | WORKING |
| Create meeting | WORKING |
| Kind picker | Removed (hidden) |
| Save | WORKING |
| Share/copy link | WORKING (existing StatusPanel) |

## Services (`/appointments/services`)

| Element | Status |
|---------|--------|
| List panel | WORKING |
| Create service | WORKING |
| Kind picker | Removed (hidden) |
| Advanced sections | WORKING (shared editor) |
| Categories link | WORKING where exposed |

## Classes (`/appointments/classes`)

| Element | Status |
|---------|--------|
| List | WORKING |
| Create class | WORKING |
| Name/description/capacity/staff/location | WORKING |
| Occurrence editor | READ_ONLY_BY_DESIGN (hint only; full schedule via calendar/API) |
| Waitlist / admission | Not on this page yet — lives in service-booking depth |

## Workshops (`/appointments/workshops`)

| Element | Status |
|---------|--------|
| List | WORKING |
| Create workshop | WORKING |
| metadata.kind | WORKING |
| Multi-session editor | Not yet specialized |

## Totals

| Classification | Count |
|----------------|-------|
| BROKEN | 0 |
| PLACEHOLDER | 0 |

## Follow-up

- Expand component contract rows per control
- Dedicated public workshops URL if product requires separation from classes page
- Full editor section absorption from generic hub (see editor matrix)
