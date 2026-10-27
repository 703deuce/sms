# T2V build progress (`transovo-build`)

Last updated: 27 Oct 2026. **Billing/credits:** out of scope (§0.5 SPEC). **M8 manual QA:** deferred per Rick.

Legend: **done** · **partial** · **not done** (excludes billing & formal M8 browser QA)

## Milestones

| M | Status | Notes |
|---|--------|--------|
| M0 | **done** | Schema, `sourceKind`, `FEATURE_T2V`, job types incl. M9, reserved `video` slug, stock via active storage driver |
| M1 | **done** | `elevenlabs-tts.ts`, `voice-cache.ts`, scene voice route; worker `elevenlabs_tts.py` + `voice_cache.py` (hash from TS only) |
| M2 | **partial** | P1/P2 create, script review, URL extract; **audio** upload → transcript path not wired in create UI |
| M3 | **done** | `T2V_ASSEMBLE`, internal assembled → composition, editor handoff, stable word ids |
| M4 | **partial** | Storyboard match, replace media dialog, Pexels photos; **not** full P4 panel (crop/focal, uploads tab, infinite scroll) |
| M5 | **partial** | Worker stack landed; studio rail: voice, music, captions, text, brand, templates |
| M6 | **partial** | Producer API, P12 overlay/cancel, undo/redo, stale banners; **not** tool-call confirm cards |
| M7 | **done** | Drive list/filter, exports composition rows, settings voices, studio export popover |
| M8 | **not done** | Formal browser QA matrix deferred until Rick |
| M9 | **partial** | Templates gallery + `seed-t2v-templates.ts`, deck extract worker, clone+consent, scene AI jobs, Pexels photos; **not** full template preview video / AI video aspect matrix |

## Pages (SPEC §3)

| ID | Route / surface | Status |
|----|-----------------|--------|
| P1 | `/app/clips/video/new` create | **partial** — tabs, deck poll; missing audio tab body |
| P2 | Settings step 2 | **partial** — audience/tone; not full platform/brand pickers |
| P3 | Studio shell | **partial** — rail + storyboard; not full §3.0 frame/preview strip |
| P3a | Script review | **partial** — edit scenes; missing rewrite chips / generating skeleton |
| P3b | Storyboard | **partial** — grid, match, build, stale badges |
| P4 | Replace media / Visuals | **partial** — dialog w/ stock grid + AI tabs |
| P5 | Voice picker | **partial** — settings + studio Voice tab |
| P6 | Music | **partial** — mood/volume/duck panel (no library browse) |
| P7 | Captions | **partial** — preset picker tab |
| P8 | Text titles/LT | **partial** — per-scene title/LT editor |
| P9 | Template in studio | **partial** — apply from studio tab + gallery |
| P10 | Brand tab | **partial** — brand template picker |
| P11 | Chat | **partial** — Magic Box panel + producer API |
| P12 | Build progress | **partial** — overlay + poll; stage checklist simplified |
| P13 | Export | **done** — popover + stale banner |
| P14 | Voice clone modal | **done** |
| P15 | Templates gallery | **partial** — list/filter; preview modal basic |
| P16–P17 | Drive list / new card | **done** |
| P18 | Script editor handoff | **partial** — link + stale banner on `/script` |
| P19 | Exports page | **done** |
| P20 | Settings voices | **done** (no usage/billing) |

## Worker jobs

| Job | Status |
|-----|--------|
| `T2V_ASSEMBLE` | **done** |
| `T2V_EXTRACT_DECK` | **done** (`pypdf`, `python-pptx`) |
| `T2V_VOICE_CLONE` | **done** |
| `T2V_SCENE_AI_IMAGE` / `T2V_SCENE_AI_VIDEO` | **done** (Kie poll) |

## Ops

| Item | Status |
|------|--------|
| `npx tsx new-app/scripts/seed-t2v-templates.ts` | **done** (run manually against DB) |
| PR #786–#790 stack on `transovo-build` | **done** |
| `origin/master` @ 5851e0189 merged | **done** |

## Remaining build (non-test, non-billing)

1. P6 music library / generate; P4 uploads + crop/focal modal  
2. Full §3.0 preview stage + scene strip  
4. M2 audio source; M8 when Rick approves  
5. Template preview assets (optional thumb/video keys)
