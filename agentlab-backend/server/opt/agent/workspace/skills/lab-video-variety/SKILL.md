---
name: lab-video-variety
description: Creative direction and variety for every film: three concepts, the visual DNA in scenes/theme.json, the user's style direction as the lane, the look ledger check, inventing the world; the mix (3+ engines, a 3D/2.5D moment, cut-outs, footage-led and designed stretches); the ledger entry after delivery.
when_to_use: Opened at the creative-direction stage (video-stage direction) and again at the build stage (video-stage build).
page_line: Direction and build: three concepts, visual DNA, style lane, ledger check, invent the world, the mix of engines/3D/cut-outs.
attach_roles: stage
---

# Creative direction and variety (direction, then again at build)

**Principle: reuse capabilities, never a look. Every film looks different from the last ones.** These are judgment
rules: if one truly does not fit a film, break it on purpose and write why in `log/job.md`.

## Creative direction (stage 2)
1. **Three concepts**, two or three lines each, inside the user's style direction (their lane; none given means
   choose freely). Pick the best fit for story, audience and request and say why; on a remake pick a different one.
2. **Invent the world**: what is this story physically made of (a map, the data, an evidence wall, a machine, the
   product UI, a city)? Geometry and scale, background/mid/foreground layers, palette (exact hex), type roles,
   grade, grain and vignette, camera grammar and transitions.
3. **Visual DNA** into `scenes/theme.json` and `research/treatment.md`: typography (never serif-plus-gold by
   default), colour and grade, framing, graphic style, text placement, transition grammar, pacing, camera, texture.
   Start from an archetype in `reference.md` if useful and change at least three of its axes.
4. **Ledger check** (below): if the look matches a recent or same-subject entry on type, layout and colour, change it
   now, unless the user asked for the same look or strict branding requires it.

## Ledger check (before locking the concept)
1. Read the last 5 entries of `/workspace/learned/video-ledger/LEDGER.md` (shared by every job) and every entry on the
   same subject. Steer away from them unless the user asks for the same look.
2. Within the last 5 films, never repeat a **concept family** (paper/stamp/typewriter/receipt "document" worlds
   included) or a **claim device**. Dark ground plus one accent: not more than 2 films in a row. A heavy display
   font plus monospace labels: at most every other film.
3. A second film on the same subject uses a new concept family and claim device.

## The mix in every film
- **At least 3 engines** across the layers, and one the previous film did not use; no film in a single engine.
  Rotate through the library over time. Subject engines when they fit
  (Manim for how-it-works, D3 for data, MapLibre or Cinematic `GeoMap` for maps).
- **One real 3D or 2.5D parallax moment** with camera movement (three.js, or cut-out layers in depth). 3D is an
  accent (depth, a 3D title, one or two standout moments), never the backbone; 2.5D parallax may carry more.
  It must be premium: real lighting and materials, soft shadows, depth of field, clean edges. If it doesn't hold
  up next to the real footage on a still, rework it or cut it.
- **Cut-out photos** on at least one beat (`lab-engine-footage-fx`), in parallax or collage.
- **Mixed edit modes**: some stretches footage-led (real clips full-frame, their own audio, no designed frame or
  chrome), others designed graphics. Neither covers the whole film.
- **Mixed media and texture when it fits**: collage, real scanned textures (fabric, concrete, film, print, paint),
  colourful or light grounds.
- An element from an earlier film may return only if switched (new material, motion, scale, engine or role).

## At build: check `scenes/plan.json` against the mix above before building scenes; fix the plan if it misses.

## After delivery: append one entry to the ledger
`date | title | subject | concept family | claim device | ground | type formula | edit mix (% footage vs designed) |
3D/2.5D moments | cut-outs | engines per layer | how it differs from the last 5`
