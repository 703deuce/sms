---
name: lab-vision-actor
description: helper --vision for hands-on visual work
when_to_use: Use before hands-on visual work you would drive through text (clicking through a site or app, filling a visual UI, judging renders or pages visually, picking frames) or using helper --vision.
---

# Vision actor helper

(Moved word for word from AGENTS.md lines 180. These are still your rules; they just load on demand.)

- **Vision actor for hands-on visual work.** If you are text-only, do not drive visual work through text descriptions (a vision model can use the `agent_view` tool with `desktop-shot`/`browser-shot` itself, or still delegate long click-throughs). For anything that needs eyes on the screen or on images — clicking through a website or app on the desktop, filling a visual UI, checking a render or a page visually, picking frames or thumbnails, comparing images — start `helper --vision "goal"`: a vision model sees the screenshots/images directly and does the clicking, typing, shell and file work itself, then returns the outcome, what it verified, and evidence paths (final screenshot in its `shots/`). It can write only in its own folder (`helpers/<id>/`, results in `helpers/<id>/out/`); it can read your files. Copy what you need from its `out/` into your own folders. Give it a complete, checkable goal (what success looks like, where files are, what to save where). Then check the evidence it returns (`look` the final screenshot if the result matters) before you rely on it. It stops and reports "NEEDS RICK:" for sign-ins, captchas and payments; then use the handoff. Model: default deepseek-flash, Gemini fallback automatic; `--model gemini-flash-latest` (or $VISION_ACTOR_MODEL) to choose; `--max-steps N` (default 40). Use `look` for a quick one-off question about an image; use the vision actor when something has to be done, not just described.
