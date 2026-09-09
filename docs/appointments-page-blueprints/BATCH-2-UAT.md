# Batch 2 UAT — Meetings + Services

**Date:** 2026-09-09  
**Branch:** `cursor/meetings-focused-editor-709b`

## Meetings (M1–M6)

| Test | Result | Notes |
|------|--------|-------|
| M1 Create meeting | PASS | No archetype picker; `UAT Batch2 Discovery Call` saved |
| M2 Public booking | NOT RUN | Requires live booking workspace smoke |
| M3 Edit meeting | PASS | Prior `UAT Discovery Call` editable |
| M4 Meeting method | PASS | Method selectable in editor |
| M5 Mobile | PASS | List usable at 390px |
| M6 Keyboard | PASS | Visible focus on pilot controls |

## Services (S1–S16)

| Test | Result | Notes |
|------|--------|-------|
| S1 Create basic service | PASS | `UAT Batch2 Personal Training` 60 min |
| S2 Public booking | NOT RUN | Requires live booking smoke |
| S3 Multiple durations | PASS | Duration options UI in Scheduling section |
| S4 Add-on price/time | DEFERRED | Add-on selection UI present; public verify later |
| S5 Staff/location quick create | PASS | Context links preserve draft (sessionStorage) |
| S6 Rooms/equipment | PASS | Rooms & equipment section |
| S7 Intake | PASS | Intake form assignment UI |
| S8 Package context | DEFERRED | Commerce links only — Packages batch |
| S9 Member access | DEFERRED | Not on type form yet |
| S10 Policies | PASS | Cancel/reschedule in Policies section |
| S11 Terms | DEFERRED | Contracts batch |
| S12 Contract | DEFERRED | Contracts batch |
| S13 Processing phase | PASS | Service steps in advanced scheduling |
| S14 Edit | PASS | Reload persists |
| S15 Mobile | PASS | No horizontal overflow at 390px |
| S16 Keyboard | PASS | Core actions reachable |

## Regression

| Check | Result |
|-------|--------|
| Booking Types landing 4 cards | PASS |
| Generic editor for classes/workshops | Still at `/appointments/types/editor` |
| Meetings/services editor redirect | PASS |

## Backend gaps

- Per-service package eligibility assignment
- Per-service terms/contract template picker
- Member-only service access on type config
- In-editor quick-create drawers (links + draft preservation only)

## Transitional routes

- `/appointments/types/editor` — classes, workshops, legacy deep links
