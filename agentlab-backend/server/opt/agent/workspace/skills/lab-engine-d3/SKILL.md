---
name: lab-engine-d3
description: D3.js (data as graphics, animated with GSAP) on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: real data as graphics: bar races, line charts drawing on, scatter swarms, networks, d3-geo projections, timelines.
attach_roles: stage
browser_engine: true
---

# D3.js (data as graphics, animated with GSAP)

Status: installed: d3 7.9 + gsap in /opt/engines/js.
**Pick it for** bar races, line charts drawing on, scatter swarms, force networks, map projections (d3-geo), timelines, stat comparison bars. **Why:** editorial data journalism: precise, information-dense, credible.
**Browser engine:** follow `lab-engine-browser-contract` (window.__scene, seek(t), alpha, theme.json).

## Setup
```bash
cp /opt/engines/js/node_modules/d3/dist/d3.min.js /opt/engines/js/node_modules/gsap/dist/gsap.min.js scenes/S10/lib/
# no d3 transitions (timer-driven): compute each frame from t with scales and a paused GSAP timeline
```

## Review (stills at the change points, before any render)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S10 --still <times>
```

## Final render (once, after every scene is approved)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S10 --out scenes/S10/out/S10.mov --alpha
```
As a layer: transparent chart over a plate. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Every number from research/facts.md with its source on screen.
- Detail and recipes: `reference.md`.
