---
name: lab-engine-gsap-svg
description: GSAP + SVG (typography and vector motion) on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: designer-grade type and vector motion: split/masked reveals, scramble, strokes drawing on, morphs, editorial lower thirds.
attach_roles: stage
browser_engine: true
---

# GSAP + SVG (typography and vector motion)

Status: installed: gsap 3.15.1 in /opt/engines/js (all plugins free: SplitText, DrawSVG, MorphSVG, ScrambleText, MotionPath); tested.
**Pick it for** per-character, word or line reveals, scramble/decode text, strokes drawing on, shape morphs, icons along paths, editorial lower thirds. **Why:** crisp, typographic, magazine-like; the main tool for typography variety.
**Browser engine:** follow `lab-engine-browser-contract` (window.__scene, seek(t), alpha, theme.json).

## Setup
```bash
cp /opt/engines/js/node_modules/gsap/dist/{gsap,SplitText,DrawSVGPlugin,MorphSVGPlugin,ScrambleTextPlugin}.min.js scenes/S03/lib/
# one gsap.timeline({paused:true}); seek: t => tl.seek(t, false); gsap.ticker.lagSmoothing(0)
# working example: /workspace/skills/lab-engine-gsap-svg/scene-example/index.html
```

## Review (stills at the change points, before any render)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S03 --still <times>
```

## Final render (once, after every scene is approved)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S03 --out scenes/S03/out/S03.mov --alpha
```
As a layer: type layer, often behind a cut-out subject. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Use local font files with @font-face; capture waits for document.fonts.ready.
- Detail and recipes: `reference.md`.
