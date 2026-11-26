---
name: lab-engine-lottie
description: Lottie / dotLottie on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: After Effects-style vector accents: icon pops, shape bursts, arrows, underlines, scribbles; small layers, not whole scenes.
attach_roles: stage
browser_engine: true
---

# Lottie / dotLottie

Status: installed: lottie-web 5.13 + @lottiefiles/dotlottie-web in /opt/engines/js.
**Pick it for** animated icons, shape bursts, arrows, underlines, scribbles, emoji-style accents; simple Lottie JSON can be written by hand. **Why:** motion-designer accents timed to a hit word.
**Browser engine:** follow `lab-engine-browser-contract` (window.__scene, seek(t), alpha, theme.json).

## Setup
```bash
cp /opt/engines/js/node_modules/lottie-web/build/player/lottie.min.js scenes/S13/lib/
# renderer "svg", autoplay false; seek: anim.goToAndStop(min(t*anim.frameRate, totalFrames-1), true)
```

## Review (stills at the change points, before any render)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S13 --still <times>
```

## Final render (once, after every scene is approved)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S13 --out scenes/S13/out/S13.mov --alpha
```
As a layer: natively transparent accent layer. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Recolour the JSON to the film palette before use.
- Detail and recipes: `reference.md`.
