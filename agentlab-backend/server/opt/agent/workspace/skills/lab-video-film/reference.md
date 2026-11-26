# Film pipeline: detail (from Motion Studio film-pipeline.md and SKILL.md section 6)

## Research
- Research ends when every on-screen and spoken fact is cited and every planned shot has media.
- Verify each fact once from a solid source; look for a second only if the first is weak or sources disagree.
  Keep source hedges ("a *reported* $6M deal"). Never drop cited information just because you doubt it.
- Script: short declarative sentences, one beat each; numbers spelled out in `spoken`, digits in `text`; a phrase is
  typed on screen or shown on a real document, never both; after the cold open, time only moves forward.
- `log/treatment.md`: one-sentence angle, anchor motif, world concept, scene list with intended engine per layer,
  music idea, which beats get real footage.

## Creative direction
- Three concepts; on a remake, pick a different one than the previous version.
- Visual DNA menu (starting points, never templates): retro/analog glitch, Swiss minimal, magazine, archival
  newspaper, neon/kinetic, data-noir, street/zine, and anything the subject suggests. Type treatments to rotate:
  masked line reveal, per-character stagger, scramble/decode, typewriter, outline-to-fill, variable-weight morph,
  condensed lockup, text behind subject (cut-out), kinetic path text, highlighter draw, 3D extruded, split-flap,
  counter digits. Download real font files into `assets/fonts/` and record them in the theme.
- Write `scenes/theme.json` once (palette, fonts, grain, vignette, grade, easing, safe areas) and map it into each
  engine: Cinematic `LOOK` dicts, Remotion `src/theme.ts`, browser engines CSS variables or `theme.js`, Manim a
  config block.

## Media sourcing
- Search for the specific person, place, date or object the line names; stock only for genuinely generic lines.
- Clips: download only the needed section plus padding (`yt-dlp --download-sections "*START-END"`); prefer sources
  without burned-in lower thirds; talking clips play their own audio (narration paused, music ducked).
- Code-drawn UI instead of screenshots for app interfaces; label recreations; quote only words really written.

## Narration
- Scratch voice: Cinematic `tts_say.py` with any free voice, to time the cut before the paid call.
- Final: ElevenLabs `tts` per take or whole script; `split_takes.py`, `build_narration.py` -> `audio/timing.json`.
- QA: `transcribe` the narration; word offsets vs timing within ~50 ms where exact sync matters.

## Scene build
- One folder per scene `scenes/<id>/` with its code; all times from word anchors, never typed seconds.
- Author at the output scale: hero zoom ~0.5-1.0 in Cinematic world units; labels >= 4.5% of frame height.
- Old items dim instead of vanishing; one hero per line.
- Overlays that should stay editable are separate alpha layers (ProRes 4444 `.mov`).
- Helpers: only for long films with many scenes (roughly over 60 s); each owns a contiguous block; the lead reviews
  every scene and both sides of each cut between blocks.

## Sound
- SFX: Cinematic `render.py --cues` + `build_sfx.py`, or cues placed by hand on the clock.
- Music cues: 1-4 story-driven mood cues, crossfaded at mood turns, ending on the last frame.
- Mix: `mix_soundtrack.py --project P --music <bed> --lufs -14` (sidechain duck, loudnorm, -1 dBTP). Keep stems
  (narration, music, sfx, footage audio) at master length if the user wants them.
