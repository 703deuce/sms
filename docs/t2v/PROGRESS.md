# T2V build progress (`transovo-build`)

Last updated: 27 Oct 2026. **Billing/credits:** out of scope (§0.5). **M8 formal QA:** deferred per Rick.

Legend: **done** · **partial** · **not done**

## Milestones

| M | Status | Notes |
|---|--------|--------|
| M0 | **done** | Schema, jobs, storage, `FEATURE_T2V`, reserved `video` slug |
| M1 | **done** | TTS cache TS + worker, scene voice route |
| M2 | **done** | Create (idea/script/url/deck/**audio**), settings step 2, script review |
| M3 | **done** | Assemble → composition → editor handoff |
| M4 | **done** | Storyboard match, visuals panel (stock/upload/focal), Pexels photos |
| M5 | **done** | Worker stack + studio panels; export uses `musicTracks` + `audio_render` ducking |
| M6 | **done** | Producer chat, build progress + cancel, undo/redo, re-voice, stale banners |
| M7 | **done** | Drive, exports, voices settings, export popover |
| M8 | **not done** | Browser QA matrix (Rick) |
| M9 | **partial** | Templates gallery, clone, deck/AI jobs; optional template preview video assets |

## Pages (SPEC §3)

| ID | Surface | Status |
|----|---------|--------|
| P1 | Create | **done** |
| P2 | Settings step 2 | **done** |
| P3 | Studio §3.0 frame | **done** — rail + mobile rail, panel, preview transport, scene strip + transitions |
| P3a | Script review | **done** |
| P3b | Storyboard | **done** |
| P4 | Visuals | **done** — upload + focal crop modal |
| P5 | Voice | **done** |
| P6 | Music | **done** — ElevenLabs MUSIC job (reuse clipper), project history, upload, no-music |
| P7 | Captions | **done** |
| P8 | Text | **partial** — fixed default timings; full timing editor not built |
| P9 | Template | **done** |
| P10 | Brand | **partial** — template picker; worker reads `settings.brand` blob |
| P11 | Chat | **done** |
| P12 | Build progress | **done** |
| P13 | Export | **done** |
| P14 | Voice clone | **done** |
| P15 | Templates gallery | **done** |
| P16–P17 | Drive | **done** |
| P18 | Script editor | **done** |
| P19 | Exports | **done** |
| P20 | Voices settings | **done** |

## Ops

| Item | Status |
|------|--------|
| `scripts/seed-t2v-templates.ts` | **done** |
| Music | Per-project ElevenLabs generation via existing `MUSIC` job (no stock library seed) |
| `origin/master` merge | **pending** — see code-review pass |

## Remaining (non-billing, non-M8)

- P8 text timing editor; P10 brand template → `settings.brand` resolution
- M9 optional template preview videos
- Code-review hardening (assemble failure, SSRF, autosave revision, etc.) — in progress on `transovo-build`
