# Appointments Meetings — Component Connection Matrix

**Route:** `/appointments/meetings`  
**Date:** 2026-09-10  
**Visual authority:** Black + teal (`appointments-pilot-tokens.css`, `--appt-brand-accent: #147d74`, `--appt-brand-primary: #1f2329`)

## Design tokens used

| Token | Value / role |
|-------|----------------|
| `--appt-surface-muted` | 60% neutral page canvas |
| `--appt-brand-primary` | 30% structural dark typography/surfaces |
| `--appt-brand-accent` | 10% teal CTA, selection, focus |
| `--appt-state-success/warning/error` | Semantic status (not teal) |

## Connection matrix (representative controls)

| SECTION | COMPONENT | CONTROL | READ SOURCE | WRITE TARGET | API | RUNTIME |
|---------|-----------|---------|-------------|--------------|-----|---------|
| List | Meeting row | select | `GET /api/appointments/types` | navigation | types API | — |
| List | + New meeting | link | — | `/appointments/meetings/new` | — | — |
| Header | Save changes | button | form state | `PATCH /api/appointments/types/:id` | types API | public catalog |
| Header | View booking page | button | workspace slug + id | window.open | settings | public `/book/:slug/:id` |
| Header | Copy link | button | booking URL | clipboard | — | — |
| Header | Duplicate | menu | form | `POST /api/appointments/types` | types API | new type row |
| Header | Activate/Deactivate | menu | `enabled` | `PATCH` | types API | public visibility |
| Overview | Name | input | `VoiceService.name` | form → save | types API | public title |
| Overview | Description | textarea | `config.description` | form → save | types API | public description |
| Overview | Duration | input | `durationMinutes` | form → save | types API | slot length |
| Availability | Schedule | select | `namedScheduleId` | form → save | settings.schedules | slot engine |
| Availability | Min notice / horizon | input | config fields | form → save | types API | slot filtering |
| Hosts | Assignment mode | radio | `staffAssignment` | form → save | types API | host routing |
| Hosts | Staff pool | chips | `staffIds` | form → save | settings.staff | assignment |
| Method | Location/video | select | `config.location` | form → save | types API | join URL / location |
| Method | Transovo Video | panel | video config | form → save | video integration | `VideoMeeting` |
| Questions | Builder rows | inputs | `bookingQuestions` | form → save | types API | public intake |
| Rules | Cancellation/reschedule | select | policies | form → save | types API | cancel/reschedule |
| Advanced | Payment | select | `payment.mode` | form → save | merchant status | checkout |
| Advanced | Confirmation | inputs | confirmation fields | form → save | types API | done step |
| Wizard | 4 steps | wizard | draft state | `POST /api/appointments/types` | types API | creates `VoiceService` MEETING |

## Button inventory

| Control | Status |
|---------|--------|
| New meeting | WORKING |
| Save changes | WORKING (dirty-gated) |
| View booking page | WORKING (when slug + id) |
| Copy link | WORKING |
| Duplicate | WORKING |
| Deactivate/Activate | WORKING |
| Overview Edit links | WORKING (section nav) |
| Manage availability | WORKING (link `/appointments/availability`) |
| Manage reminders | WORKING (link `/appointments/automations`) |
| Wizard Create | WORKING |
| Add question | WORKING |

## Known gaps (browser certification pending)

- Full persistence reload proof across all six sections
- Public booking end-to-end with questions readback
- Provider connect flows (Google/Zoom) — PROVIDER_BLOCKED without integration fixture
- Screenshot QA set (`01-meetings-empty` … `11-meetings-mobile`)
