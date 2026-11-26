---
name: lab-engine-footage-fx
description: Footage-prep tools on real media: SAM 2 subject cut-outs (rembg and MediaPipe as CPU fallbacks), OpenCV tracking and flow, FFmpeg filtergraph effects, Natron node comps; results go into the scene as layers.
when_to_use: Attached at the build stage when this job's scenes/plan.json uses a footage-prep layer (cut-out, tracked callout, ramp, split screen, comp); named by lab-video-engines.
page_line: Footage prep on real clips: SAM 2 / rembg / MediaPipe cut-outs, OpenCV tracking, FFmpeg effects, Natron comps; outputs become scene layers.
attach_roles: stage
---

# Footage FX (prep real media; the result is a layer in the scene)

**These prepare real footage; the scene runtime composites it**, so every frame, footage included, is checked on a
scene still. FFmpeg here prepares media and does the final encode, not scene assembly. Nothing here replaces real
footage with something generated.

Pick the tool, then name its section in `scenes/plan.json` `"refs"` (printed at build; install paths, recipes, checks):
- `lab-engine-footage-fx/reference.md#13. SAM 2`: subject cut-out tracked through a clip (rembg, MediaPipe fallbacks)
- `...#14. OpenCV`: CSRT tracking -> `track.json` for pinned callouts, stabilise, optical flow
- `...#15. Natron`: node comps, keying, roto (headless not proven: fall back to FFmpeg + OpenCV)
- `...#16. FFmpeg`: grade, ramps, freezes, split screens, grain, light leaks, push-ins

## Rules
- Stack plate -> type (may sit behind the subject) -> subject cut-out -> FX; same frame count and fps for every layer.
- Blend in RGB; check a matte on 10 frames and an edge at 200%; smooth tracks before driving graphics.
- Slow motion only from real high-frame-rate sources; never duplicated frames.
