---
name: lab-engine-dolly
description: Dolly (Remotion product/launch kit) on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Core engine: product, SaaS, app-demo, launch and ad films; real screen recordings in floating 3D windows and phones; four formats.
attach_roles: stage
---

# Dolly (Remotion product/launch kit)

Status: installed: source /opt/engines/repos/dolly @ a78a821 (new.sh runs npm install into the scene folder).
**Pick it for** SaaS or app demos, product launches, ads; app footage floating in 3D windows or phones; branded kinetic type. **Why:** 87 components and a camera kit (`tiltIn`, `pushThrough`, `orbit`), all four aspect formats with platform-safe layouts, a built-in `npm run check`.

## Setup
```bash
bash /opt/engines/repos/dolly/new.sh scenes/S02   # copies the starter and installs
# build scenes in src/scenes/, composition src/Video.tsx; set src/brand.ts and a NEW style in src/look.tsx (not one of the eight stock looks)
```

## Review (stills at the change points, before any render)
```bash
npx remotion still Sheet out/sheet.png --browser-executable=/usr/bin/chromium   # 1 frame/s sheet; plus `still <Comp> --frame N` at review times
```

## Final render (once, after every scene is approved)
```bash
npm run render   # or render:vertical | render:square | render:portrait
npx remotion render <Comp> out/S02.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le   # alpha layer
```
As a layer: ProRes 4444 alpha layer or the full product picture. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Replace the starter's Termary takes and logo in `public/`: they are not ours to ship.
- Live agent screen recording is Mac-only: use supplied recordings or code-drawn UI.
- Manual: /opt/engines/repos/dolly/SKILL.md; component catalog starter/src/library/CATALOG.md; references/{camera,your-footage,agendas,gotchas,recipes}.md.
- Detail and recipes: `reference.md`.
