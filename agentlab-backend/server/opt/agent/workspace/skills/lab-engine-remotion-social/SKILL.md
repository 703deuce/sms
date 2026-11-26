---
name: lab-engine-remotion-social
description: Remotion (overlay type, and quick type-led social) on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Core engine, overlay only: word-synced kinetic type, lower thirds, counters, captions, beat-synced promos; carries alone only a quick type-led social short.
attach_roles: stage
---

# Remotion (overlay type, and quick type-led social)

Status: installed: remotion 4.0.528 in /opt/engines/js; craft guide /opt/engines/repos/claude-remotion-skill @ 1dcbe5e.
**Pick it for** kinetic typography and word-synced captions over the picture; promos, beat-synced edits, logo stings; a quick mostly-type social short. **Why:** React, frame-exact (`useCurrentFrame`), springs and stagger, ProRes 4444 / VP9 alpha; the craft guide's ten motion rules.

## Setup
```bash
mkdir -p rm/src rm/public && cd rm && ln -s /opt/engines/js/node_modules node_modules
cp -r /workspace/skills/lab-engine-remotion-social/template/src .   # tested index.ts, Root.tsx, FootageScene.tsx
cp /opt/engines/repos/claude-remotion-skill/remotion-motion-graphics/assets/theme.ts src/theme.ts   # set it from scenes/theme.json
```

## Review (stills at the change points, before any render)
```bash
npx remotion still src/index.ts <Comp> out/s_45.png --frame 45 --browser-executable=/usr/bin/chromium
```

## Final render (once, after every scene is approved)
```bash
npx remotion render src/index.ts <Comp> out/S01.mov --codec prores --prores-profile 4444 --pixel-format yuva444p10le --browser-executable=/usr/bin/chromium --concurrency 1
npx remotion render src/index.ts <Comp> out/S01.mp4 --crf 26 --muted --concurrency 1 --browser-executable=/usr/bin/chromium
```
As a layer: transparent type layer over the main picture. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Remotion decorates: never the main stage of a documentary or researched film.
- Everything is a function of `useCurrentFrame()`; `<OffthreadVideo>` for footage, never `<Video>`; always clamp and ease `interpolate`.
- Composition 854x480 (or 480x854), 30 fps, `durationInFrames = round((t1-t0)*30)` so segments match the narration clock.
- Free licence for individuals and teams up to 3; buy nothing. Craft guide: /opt/engines/repos/claude-remotion-skill/remotion-motion-graphics/SKILL.md.
- Detail and recipes: `reference.md`.
