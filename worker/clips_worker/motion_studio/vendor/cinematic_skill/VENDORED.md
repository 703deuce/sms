# Vendored: Cinematic Skill (cinematic-film engine)

- Upstream: https://github.com/Moh4696/cinematic-skill
- Commit: `bf435561c6203f90f971300efe952b68b5ec3417` (2026-11-09)
- Licence: MIT (see `LICENSE`, Copyright (c) 2026 exploraX). Kept verbatim.
- Files: `skills/cinematic-film/scripts/{engine.py, build_sfx.py, mix_soundtrack.py, make_beats.py, render.py}`, unmodified.
- Used by `clips_worker/motion_studio/core/*` (Transovo Studio Part 1). Upstream fonts (`get_fonts.py`) and
  Piper voices (`tts_say.py`) are deliberately NOT vendored: product narration is ElevenLabs only (D28), and
  fonts come from the worker image's pinned OFL bundle (SEC-2 licence review pending, ST-ENG-002).
