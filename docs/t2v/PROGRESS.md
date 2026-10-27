# T2V build progress (`transovo-build`)

Last updated: 27 Oct 2026. **Billing/credits:** out of scope (§0.5). **M8 formal QA:** deferred per Rick.

Legend: **done** · **partial** · **not done**

## Milestones

| M | Status | Notes |
|---|--------|--------|
| M0–M7 | **done** | See prior rows in git history |
| M8 | **not done** | Browser QA matrix (Rick) |
| M9 | **done** | Templates gallery + preview video UI; `seed-t2v-template-previews.ts` for assets |

## Pages (SPEC §3)

| ID | Surface | Status |
|----|---------|--------|
| P1–P20 | **done** | P8 per-scene title/LT timing sliders; P10 brand at export; studio page serializable props only |

## Ops

| Item | Status |
|------|--------|
| `origin/master` | **ancestor of** `transovo-build` (`merge-base --is-ancestor`) |
| Music | ElevenLabs `MUSIC` job reuse (no stock library seed) |
| Code review batch | Critical + should-fix + listed minors addressed on branch |

## Notes

- Assemble skips brand bookends; composition export applies intro/outro (`script_composition_render.py`).
- Undo/redo persisted per draft in `localStorage`; storyboard/producer/template edits push history.
