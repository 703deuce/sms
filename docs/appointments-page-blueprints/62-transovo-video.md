# Blueprint 62 — Transovo Video (runtime + settings)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## OWNERSHIP

| Surface | Route | Job |
|---|---|---|
| Settings default | `/settings/transovo-video` | Org-wide video defaults |
| Host runtime | `/video/rooms/[id]/host`, `/appointments/[id]/video/host` | Host join |
| Public join | `/video/[token]` | Customer join |
| Operational entry | Meetings → Upcoming | Join from list |

## BATCH 8B-7

| Feature ID | Status |
|---|---|
| 14-2 | RUNTIME_UI_EFFECT — host join from Upcoming |
| 14-3 | ALREADY_PRESENT — public token join |
| 14-6 | ABSORBED_CANONICAL_UI — settings linked under Settings → Meetings |

## REMAINING GAPS

- Recording/recap handoff messaging after meeting end (async processing states)
