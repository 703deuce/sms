# Blueprint 60 — Meetings Upcoming (`/video`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-7 ABSORPTION GAPS

| Feature ID | Feature | Final Section | Backend | Status |
|---|---|---|---|---|
| 14-1 | Upcoming meetings list | Upcoming list | `/api/video/overview` | ABSORBED_CANONICAL_UI |
| 14-2 | Host video for appointment | Join → host room | transovo-video | RUNTIME_UI_EFFECT |
| 14-3 | Public video join | Customer `/video/[token]` | transovo-video | ALREADY_PRESENT |
| 14-8 | Teams auto-create | Appointment/upcoming status | `teams-meeting.ts` | RUNTIME_UI_EFFECT |
| 14-9 | Calendar meeting indicators | Calendar (prior batch) | meeting-indicators | ALREADY_PRESENT |

## AUDIT CORRECTIONS

| Feature ID | Correct destination |
|---|---|
| 14-6 | Settings → Meetings → Transovo Video (not Upcoming) |
| 14-7 | Settings → Meetings → AI Notetaker (not Upcoming) |
| 15-7 | `/appointments/polls` (not `/video`) |

## REMAINING GAPS

- Teams link state on Upcoming rows when Graph connection missing (PROVIDER_BLOCKED partial)
- Full upcoming filters (Today / This week / Host) — STILL_MISSING
- PUBLIC_WAVE_PENDING: customer join polish
