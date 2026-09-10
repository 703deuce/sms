# Blueprint 59 — Shell / Setup / Global Search

## BATCH 8B-6 ABSORPTION GAPS

| Feature ID | Feature | Location | Backend | Status |
|---|---|---|---|---|
| 1-5 | Platform setup wizard | `/appointments/setup` | derived checklist | ALREADY_PRESENT |
| 1-6 | Global search | Overview header | `global-search.ts` | ABSORBED_CANONICAL_UI |
| 1-3 | Mobile nav | Shell | `appointments-nav.ts` | RUNTIME_UI_EFFECT |
| 1-4 | Progressive disclosure | Nav gating | `scheduling-modules.ts` | RUNTIME_UI_EFFECT |
| 1-7 | V1 launch nav gating | Shell | `v1-launch-nav.ts` | RUNTIME_UI_EFFECT |

## GLOBAL SEARCH

Connected to `/api/appointments/service-booking/global-search` with grouped results routing to canonical pages.

## SETUP

Completion derived from real types/settings objects — no independent boolean store.

## REMAINING GAPS

- Global search on additional shell headers beyond Overview (optional)
- Mobile bottom-nav parity QA (STATIC_PASS only)
