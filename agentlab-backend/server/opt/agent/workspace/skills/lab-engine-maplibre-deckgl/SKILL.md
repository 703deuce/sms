---
name: lab-engine-maplibre-deckgl
description: MapLibre GL + deck.gl (real map flights) on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: real vector maps with 3D camera flights, extruded buildings, arcs between cities, moving trips, route lines drawing on.
attach_roles: stage
browser_engine: true
---

# MapLibre GL + deck.gl (real map flights)

Status: installed: maplibre-gl 6.x, deck.gl 9.x in /opt/engines/js; tiles need network at render time.
**Pick it for** real vector maps with pitch/bearing flights, extruded 3D buildings, terrain, arcs between cities, trips layers, heatmaps, route lines. **Why:** broadcast-news or Earth-style map flights with real geography (unlike Cinematic's printed-paper maps).
**Browser engine:** follow `lab-engine-browser-contract` (window.__scene, seek(t), alpha, theme.json).

## Setup
```bash
cp /opt/engines/js/node_modules/maplibre-gl/dist/{maplibre-gl.mjs,maplibre-gl-shared.mjs,maplibre-gl-worker.mjs,maplibre-gl.css} /opt/engines/js/node_modules/deck.gl/dist.min.js scenes/S11/lib/
# free keyless style: https://tiles.openfreemap.org/styles/liberty ; restyle layers to the film palette
# seek: map.jumpTo({...from t}); await new Promise(r => map.once("idle", r))
```

## Review (stills at the change points, before any render)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S11 --still <times>
```

## Final render (once, after every scene is approved)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S11 --out scenes/S11/out/S11.mp4
```
As a layer: opaque base plate; type and cut-outs go over it. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- `canvasContextAttributes: {preserveDrawingBuffer: true}` (v6 name), `interactive:false`, `fadeDuration:0`.
- Never ship the stock style.
- Detail and recipes: `reference.md`.
