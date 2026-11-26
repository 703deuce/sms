---
name: lab-engine-revideo
description: Revideo on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: Motion Canvas-style vector scenes rendered headless from Node, with video and audio in the scene graph; masks over footage, data-driven lists and counters.
attach_roles: stage
---

# Revideo

Status: installed: @revideo/* 0.11.0 + vite 5.4.21 in /opt/engines/js; not render-tested here.
**Pick it for** data-driven lists, rankings, stat runs, footage with animated masks, morphing shapes over footage, code-driven counters. **Why:** the crisp procedural vector feel of Motion Canvas with a real headless `renderVideo()`.

## Setup
```bash
# scene folder with src/project.ts: makeProject({scenes:[s], settings:{shared:{size:{x:854,y:480}}}}); ln -s /opt/engines/js/node_modules node_modules
```

## Review (stills at the change points, before any render)
```bash
# review: render a 1-frame range at each review time (check renderVideo option names in node_modules/@revideo/renderer typings first)
```

## Final render (once, after every scene is approved)
```bash
node -e "import('@revideo/renderer').then(({renderVideo})=>renderVideo({projectFile:'./src/project.ts',settings:{outFile:'S06.mp4',outDir:'./out',workers:1,puppeteer:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}}}))"
```
As a layer: opaque MP4 only (for alpha use the Motion Canvas image-sequence route or a browser-contract engine; never key out a flat colour). Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Untested here: check option names against the installed typings on first use and trim to the exact frame count (`-frames:v`).
- Detail and recipes: `reference.md`.
