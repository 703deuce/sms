---
name: lab-engine-open-3d
description: Open 3D Skills (procedural three.js worlds) on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Core engine: cinematic procedural 3D environments, landmarks, machines, exploded product views, camera flights with real lighting.
attach_roles: stage
---

# Open 3D Skills (procedural three.js worlds)

Status: installed: source /opt/engines/repos/open-3d-skills @ 53beb89 (python deps playwright, pillow, numpy, opencv present).
**Pick it for** buildings, landmarks, vehicles, machines, landscapes, product reveals, camera flights; how-it-works exploded or x-ray views with labelled parts. **Why:** procedural three.js with real lighting and proportion; frame-exact recording; `exploded-view` for staged explodes with leader-line labels.

## Setup
```bash
O=/opt/engines/repos/open-3d-skills/skills
cp -r $O/threejs-scene/assets/starter scenes/S04/site   # keep env.js/kit.js/main.js, write a new scene.js from real dimensions in metres
# drive the camera with window.__recordFrame = t => {...} behind ?record=1, and set window.__ready
```

## Review (stills at the change points, before any render)
```bash
python3 $O/frame-capture/scripts/serve.py scenes/S04/site --port 8xxx &   # never python -m http.server
# open the page, call window.__recordFrame(t) at each review time and screenshot (or wrap it in the browser contract and use capture.mjs --still)
```

## Final render (once, after every scene is approved)
```bash
python3 $O/frame-capture/scripts/record.py http://127.0.0.1:8xxx/?record=1 scenes/S04/out/S04.mp4 --seconds 12 --fps 30 --size 854x480 --ready "window.__ready === true"
```
As a layer: opaque plate or, with an alpha renderer, a subject layer. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Not Blender: keep geometry procedural and lit; real lighting and soft shadows or it looks cheap.
- `motion-assets`, `alpha-cutout`, `scroll-film`, `cursor-rig` expect paid image/video generation: skip them unless paid generation is planned and logged.
- Recording is CPU-heavy (SwiftShader): keep 3D shots short; kill the server afterwards.
- Manuals: $O/<skill>/SKILL.md (threejs-scene + references/{geometry,lighting,shaders,performance}.md, exploded-view, frame-capture).
- Detail and recipes: `reference.md`.
