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
| M5 | **done** | Worker M5 stack + studio Audio/Styles/Brand/Text/Captions |
| M6 | **done** | Producer chat, build progress + cancel, undo/redo, re-voice, stale banners |
| M7 | **done** | Drive, exports, voices settings, export popover |
| M8 | **not done** | Browser QA matrix (Rick) |
| M9 | **partial** | Templates gallery, clone, deck/AI jobs, music library + seed script; template preview video assets optional |

## Pages (SPEC §3)

| ID | Surface | Status |
|----|---------|--------|
| P1 | Create | **done** |
| P2 | Settings step 2 | **done** |
| P3 | Studio §3.0 frame | **done** — rail, panel, preview, scene strip |
| P3a | Script review | **done** — rewrite chips, generating skeleton |
| P3b | Storyboard | **done** — via studio story panel + strip |
| P4 | Visuals | **done** |
| P5 | Voice | **done** — Audio tab |
| P6 | Music | **done** — library + generate API |
| P7 | Captions | **done** — Styles tab |
| P8 | Text | **done** |
| P9 | Template | **done** — Styles tab |
| P10 | Brand | **done** |
| P11 | Chat | **done** |
| P12 | Build progress | **done** — stage checklist |
| P13 | Export | **done** |
| P14 | Voice clone | **done** |
| P15 | Templates gallery | **done** |
| P16–P17 | Drive | **done** |
| P18 | Script editor | **done** — stale banner |
| P19 | Exports | **done** |
| P20 | Voices settings | **done** |

## Ops

| Item | Status |
|------|--------|
| `scripts/seed-t2v-templates.ts` | **done** |
| `scripts/seed-t2v-music.ts` | **done** (run with `T2V_MUSIC_SEED_WORKSPACE_ID`) |
| `origin/master` merged | **done** |

## Remaining (non-billing, non-M8)

- M9: optional template preview video keys; AI video aspect polish if worker gaps found
- Mobile bottom rail / bottom sheet (§3.0 &lt;1024) — **partial** (responsive flex; not full editor-mobile-rail parity)
