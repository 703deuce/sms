---
name: lab-video-edit
description: Finish stage of a film from scratch: editing standards (Murch, Dmytryk, continuity, speech edits, pacing, transitions, sync), layout and framing, cutting, joining engine clips to the voice in the one render, encode.
when_to_use: Opened at the finish stage (video-stage finish), after review has approved every change point.
page_line: Finish stage: editing standards, framing, cutting, joining engine clips to the voice, encode.
attach_roles: stage
---

# Editing and assembly (finish stage)

Editors cut for **emotion first, then story, then rhythm** (Murch). The voice is the spine: every cut, hit and
move sits on the narration clock. Commands, levels, music sources: `reference.md`.

## Editing principles (judgment, not checklists)
- **Frame for what matters on screen**: the face when someone is just talking; the map, document, product or data
  when that is the point. Never crop a face badly.
- **Graphics lift the edit and never cover it**: enough custom graphics to carry energy and meaning (too few is a
  failure); never over a face or the thing being shown; use empty space or a planned full-frame breakout.
- **One coherent look that moves**: one signature look as the backbone, varied with push/pull, parallax,
  punch-ins and breakouts; never one locked box for the whole film, never a pile of unrelated treatments.
- **Look at it like a viewer** on a phone: if it doesn't look right, it isn't right.
- **No hard-coding**: a lesson from one film is a reason, not a fixed rule for the next.

## Craft standards (Must; Should, Freedom and sources in `reference.md`)
- Cut priority (Murch): emotion > story > rhythm > eye-trace > 2D plane > 3D space; give them up from the bottom.
  A deliberate continuity break that serves emotion or story is allowed (log it).
- Every cut has a positive reason; when undecided cut long; cut in movement; substance before form (Dmytryk).
- Keep screen direction (180 degrees) and eyelines; never mirror-flip a face; same-subject cuts change angle
  >= 30 degrees or shot size, or are a deliberate jump.
- **Speech edits**: never cut inside a word, vowel or held consonant (M, N, S); cut in a pause or before a stop
  consonant; every audio join crossfaded 20-50 ms (no clicks); room tone under gaps, never digital silence.
- **Meaning preserved**: never splice words into something not said, drop a qualifier that flips meaning, or move a
  reaction onto another question.
- Straight cut is the default; dissolve = time passing, fade = section end; never a dissolve inside continuous
  time; each transition keeps one meaning through the film.
- Sync: lip sync <= 1 f early, <= 3 f late after any crop or retime; captions on their first audio frame.
- Should: J/L cuts ~30 f at scene joins; pauses shortened not deleted; vary shot length (accelerate into a peak,
  hold the release); enter late, leave early; montage cut to musical phrases.

- Cut where the thought lands (a blink, breath, look), not where the word ends; let an incoming shot settle 3-4
  frames before a reaction; hide cuts in motion or under a sharp sound; keep eye trace where the eye already is.
- Speed comes from information, not cut count; shots shorten into a peak and lengthen after it (waves, not a flat
  line); save the close-up for the line that earns it. Test a transition: if any other would do, cut it.
- End on the landing plus a short button; never on a word cut off by a fade.

## Layout, framing and graphics
- Decide the type of each moment, then frame for it: punch into the face only for a moment that is just a person
  talking; for a document, screen, map or product, frame so it is readable.
- Split or stacked boxes: one focused person -> punch in; two or more -> split or stack; faces never badly cropped
  (chin or forehead cut, eyes misplaced, jammed against a border).
- Text behind a subject is fine, but no object ever fully hides a key word or number.
- Keep the film's signature layout as the base and break out of it at key moments; replacing it wholesale looks cheap.
- Elements come and go with real movement; nothing software-looking stays on screen (a small brand bug may);
  fill a vertical frame when it is one person talking.
- Captions, titles and lower thirds stay separate layers; captions as an SRT/VTT file.

## Cutting
- Cut on the word that names the next thing, or on action. J/L-cuts at section seams and in/out of real footage
  with its own audio; hard cuts on big beats.
- Footage: the strongest 1.5-4 s, mid-action; natural sound can rise 0.5-1.5 s between VO lines.
- Pacing: hook fast (0.8-2 s shots), context slower (2-4 s), turn fastest, payoff holds 1.5-3 s; air after the hook
  and before the last line; end on picture plus a 1-2 s music tail.

## Joining engines
Same size, fps (30), yuv420p, SAR 1, no audio in segments; boundaries from `timing.json`; concat demuxer, then
mux the mix. An engine boundary is a motivated transition (whip, zoom-through, flash) with a whoosh.

## Sound
The mix comes from `lab-video-sound` (already checked in review); mux it, do not remix here.

## Encode and deliver
H.264 `-crf 26 -preset medium -maxrate 2.5M -bufsize 5M -pix_fmt yuv420p -movflags +faststart`, AAC 128k 48 kHz.
House size 854x480 (480x854 vertical) unless asked, plus the `*_480p.mp4` preview. Copy `research/sources.md` to
`out/sources.md`, then `review.py final` (technical only).
