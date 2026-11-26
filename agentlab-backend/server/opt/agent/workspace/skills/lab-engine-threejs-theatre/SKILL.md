---
name: lab-engine-threejs-theatre
description: three.js + Theatre.js (motion-design 3D) on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: keyframed motion-design 3D: extruded titles, photo planes in depth, turntables, light sweeps, DOF and bloom; the usual 3D/2.5D accent.
attach_roles: stage
browser_engine: true
---

# three.js + Theatre.js (motion-design 3D)

Status: installed: three r187, @theatre/core+studio 0.7.2, postprocessing 6.x in /opt/engines/js (WebGL via SwiftShader, tested).
**Pick it for** a camera easing through 3D type, photo cards floating in depth, product or object turntables, depth-of-field reveals, bloom; 2.5D parallax of cut-out layers. **Why:** glossy cinematic 2.5D/3D motion design (different from Open 3D's procedural worlds).
**Browser engine:** follow `lab-engine-browser-contract` (window.__scene, seek(t), alpha, theme.json).

## Setup
```bash
cp /opt/engines/js/node_modules/three/build/three.module.js /opt/engines/js/node_modules/three/build/three.core.js scenes/S07/lib/   # r187 splits the build; use an import map
# copy only the examples/jsm, @theatre/core/dist and postprocessing/build files you import
# working example: /workspace/skills/lab-engine-threejs-theatre/example/index.html
```

## Review (stills at the change points, before any render)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S07 --still <times>
```

## Final render (once, after every scene is approved)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S07 --out scenes/S07/out/S07.mov --alpha
```
As a layer: 3D type or objects over footage (alpha renderer, clear alpha 0); a light sweep as its own additive layer. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Renderer: `{alpha:true, antialias:true, preserveDrawingBuffer:true}`; real lights, soft shadows and DOF or it looks cheap.
- Keyframes without the Studio UI: author in code with `studio.transaction`, export `theatre-state.json`, load only @theatre/core in the render page.
- Detail and recipes: `reference.md`.
