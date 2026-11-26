---
name: lab-engine-manim
description: Manim Community 0.22.1 on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: maths and logic explainers: growing graphs, number lines, geometric transforms, step diagrams, stat visuals.
attach_roles: stage
---

# Manim Community 0.22.1

Status: installed: manim 0.22.1 (system python, `manim` on PATH); tested; no LaTeX.
**Pick it for** plotted graphs that grow, number lines, geometric transforms, step-by-step diagrams, probability and stat visuals. **Why:** the precise dark-field look of objects transforming into each other.

## Setup
```bash
# drive all motion from one ValueTracker clock; when env MS_FREEZE_T is set, set the clock to it and end the scene
# working example: /workspace/skills/lab-engine-manim/example/bars_manim.py
```

## Review (stills at the change points, before any render)
```bash
MS_FREEZE_T=1.2 manim render -s -r 854,480 scene.py Name   # PNG of the exact frame (repeat per review time)
```

## Final render (once, after every scene is approved)
```bash
manim render --fps 30 -r 854,480 scene.py Name -o S08.mp4
manim render --fps 30 -r 854,480 --transparent --format mov scene.py Name   # alpha layer
```
As a layer: alpha graph over footage or a background. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- No LaTeX: `MathTex`/`Tex`/`BarChart` labels fail; use `Text`, `MarkupText`, `DecimalNumber` and draw bars with `Rectangle`.
- `-r` is width,height. Output lands in media/videos/...; move it to scenes/<id>/out/.
- Detail and recipes: `reference.md`.
