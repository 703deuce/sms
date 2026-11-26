---
name: lab-video-motion
description: Motion craft at the build stage of a film from scratch: camera language (2.5D), motion principles, media frames, kinetic type and data, transitions, pacing.
when_to_use: Opened at the build stage of a film from scratch (video-stage build).
page_line: Build stage: motion craft (camera, depth, easing, media frames, kinetic type, counters, transitions, pacing).
attach_roles: stage
---

# Motion-graphics craft (build stage)

**The main engine's world carries the picture; Remotion is only for type and small overlays on top.**

Premium doc motion = **one designed space, a camera that travels it, and every hit on a spoken word**. Viewers look
at the biggest, brightest or fastest thing: stage one hero at a time. Snippets and sources: `reference.md`.

## Camera language (2.5D)
- Build a **world**, not slides: a large canvas (board, desk, map, dark UI wall, starfield) with items placed in
  clusters per section. The camera moves between clusters; avoid hard cuts except on big beats.
- **Push in** (zoom 1.0 -> 1.15-1.4 over the line) = attention, tension, "look at this". **Pull back** = context,
  connection, ending. **Lateral truck** = time passing or a list. **Whip** (0.3-0.6 s, motion blur + whoosh) =
  jump between clusters. Lean roll 1-2 deg and let it drift; land on a hero ~0.3 s after it appears.
- **Parallax:** 3+ depth layers (far texture 0.2-0.4x, mid items 1x, near particles/dust/blur 1.3-1.8x camera
  speed). Soft drop shadows under every card/frame (offset grows with depth). Never reveal layer edges.
- Hold rate: a new camera key every 0.6-3 s; never fully static for > 2 s.

## Motion principles (apply to every element)
- **Easing always**: ease-out for entrances, ease-in for exits, ease-in-out for camera. No linear moves except
  continuous drift.
- **Anticipation** (2-4 frame counter-move) before big hits; **overshoot + settle** (spring) on landings;
  **stagger** related elements 2-4 frames (overlapping action) instead of moving them together.
- **Hierarchy**: one hero per line; others dim to 40-60% or blur. Size/brightness/motion = importance.

## Media frames (every photo and clip)
- Photos and clips in designed stretches live in a themed container that fits the world (polaroid + pin + tape,
  film strip, torn clipping, dark app window with title bar, TV/monitor, evidence bag, phone screen).
- At its hero moment a frame fills **40-70% of frame height**; clips then push through to full screen (RETURN)
  and pull back out. Footage-led stretches play full-frame with no container.
- Credit line for news/archival footage (small, bottom-left, title-safe).

## Kinetic type and data
- Type enters **on the hit word** (from timing.json), holds still while read (>= 0.3 s per word, min ~1.2 s),
  exits fast (0.15-0.3 s). Animate by word or line, not letter-by-letter, for anything to be read.
- Size: on-screen labels >= 4.5% of frame height (>= 22 px at 480p), key words 10-20%. Condensed bold caps or a
  serif for titles; mono for data. Max 2 families. Keep inside title-safe (5% inset each side).
- **Counters** roll from a meaningful start to the value over 0.6-1.2 s, ease-out, with tick SFX; units and
  source line under the number. Charts draw on along their axis.
- Accents: highlighter swipe, marker circle, underline, stamp slam on the verdict/turn word.

## Transitions
Prefer motivated moves: camera whip, zoom-through a frame, match-move (exit direction = entry direction), light
flash 2-4 frames on a big beat, glitch only for digital topics. No stock wipes/cross-dissolves between graphics.

## Pacing
A new visual event every 1.5-3 s; a bigger change at each section; one breath (0.5-1 s hold) after the hook and
before the payoff. Busiest moment = the turn, quietest = the last line.

Per scene, write the camera move, hero, hit word -> graphic and SFX into `scenes/plan.json` (`lab-video-engines`).
