# Blueprint 64 — Team Booking (`/appointments/team-pages`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-7 ABSORPTION GAPS

| Feature ID | Feature | Status |
|---|---|---|
| 4-13 | Scheduling groups | ABSORBED_CANONICAL_UI |
| 15-5 | Team booking pages CRUD | ABSORBED_CANONICAL_UI |
| 15-6 | Public team page | RUNTIME_UI_EFFECT |

## FIXES

- Removed hardcoded `bright-dental` slug — uses workspace slug from server
- Preview opens real `/team/[slug]/[pageSlug]` URL

## REMAINING GAPS

- Live embedded preview container (opens new tab today — acceptable)
- Collective vs customer-choice scheduling depth if backend expands
