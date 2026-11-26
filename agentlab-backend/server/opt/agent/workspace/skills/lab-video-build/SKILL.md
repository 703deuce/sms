---
name: lab-video-build
description: Build stage of a film from scratch: one design system per film, components built once, helpers only for long films, authoring scale and safe areas, the camera as a journey, frames full of meaning, footage RETURN, alpha overlay layers, layer records.
when_to_use: Opened at the build stage of a film from scratch (video-stage build), with the picked engine pages.
page_line: Build stage: per-film design system, components once, scale and safe areas, camera journey, footage RETURN, alpha layers.
attach_roles: stage
---

# Design (stage 5; `video-stage build` then opens the engine pages)

**Design this film's system once, then build every scene from it.** Keep the mix the plan set at direction (3+
engines, a 3D/2.5D moment, cut-outs); don't drop it while building. Review each scene on stills as it is ready
(`lab-video-review` recipes); no clip or draft renders.

1. **Design system** in `design/system.md` + shared components in `design/components/`: type roles, colour and
   grade, grid, the components this concept needs, engine per layer, timing map from `audio/words.json`. Designed
   fresh for every film; reuse happens only inside a film. Port `scenes/theme.json` into each engine.
   Type: one family with a weight range, or two at most, with a deliberate size ratio (title, label, data, lower
   third); palette with one accent reserved for what matters; a motion personality that fits the tone; a sound
   vocabulary for graphic moves. The same kind of information always looks the same within the film.
2. **Components once**: build each, check it on a still, then build scenes from them with beat-specific touches.
3. **Helpers only when they truly save time** (many scenes, roughly films over ~60 s): up to 4, each owning a
   contiguous block, briefed with the system path, its lines, word anchors, assets and engines, these rules, stills
   only. You review every scene and both sides of every cut between blocks.
4. One folder per scene `scenes/<id>/` with its code and a `README.md` (exact re-render command). All times derive
   from word anchors, never typed seconds.
5. **Author at the scale you film**: Cinematic hero zoom ~0.5-1.0 world units, wides not below ~0.3 for more than a
   beat; labels >= 40 px cap height at 1080 (>= 18 at 480), text inside the safe area (`lab-video-text`). Safe areas
   protect from app UI only; they don't make a spot safe over the person.
6. **The camera is a journey**: Cinematic `film.shot()` keys on word anchors every 0.5-2 s with velocity through
   keys and whips between clusters; other engines use an equivalent camera or parallax move. A hold is a choice.
7. **Fill the frame with meaning**: a hero, context and depth layers; old items dim instead of vanishing; photos live
   in the world and enter with a designed move.
8. **Footage RETURN** by default: push into the print holding the clip's first frame, play it full-frame, pull back
   out on its last frame; a hard cut when the story wants it. Footage-led stretches play full-frame with no frame.
8b. **Every graphic explains, emphasizes or orients**, or it is decoration competing with the subject. Density
   follows the rhythm (graphic-heavy and calm stretches alternate); the opening title carries the film's idea, not
   just its name; data: one idea per graphic, labelled directly, honest scales, key number largest; maps start from
   a place the viewer knows; callouts point at and track the real thing. Recompose each aspect; never centre-crop.
9. **Layers**: composite inside the scene runtime (`lab-engine-browser-contract`). Overlays that should stay editable
   (titles, lower thirds, captions-as-graphics) are separate alpha layers (ProRes 4444 `.mov` or VP9 `yuva420p`
   `.webm`); baking is a last resort, noted with the reason.
10. Record every scene's `engine` and `layers[]` (engine, role, file) in `scenes/plan.json` as you build.
