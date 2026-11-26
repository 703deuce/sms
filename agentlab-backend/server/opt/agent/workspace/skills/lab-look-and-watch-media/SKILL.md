---
name: lab-look-and-watch-media
description: look and watch-media: which to use for images, video, audio, PDF
when_to_use: Use when you need to look at images, screenshots, video frames, audio, or a PDF, or to choose between look, watch-media, and a transcript.
---

# look and watch-media

(Moved word for word from AGENTS.md lines 98-104. These are still your rules; they just load on demand.)

## Seeing images

- **Seeing images: if you can see, ALWAYS look yourself.** The [Vision] line at the top of each turn says whether your own model can see images.
  - Vision model (e.g. deepseek-flash): every image you need to judge goes to your own eyes with the `agent_view` tool: renders and frames (`paths=["out/x.mp4"], fps=N`, optional `start`/`end`), a frames folder, stills, attachments, and screenshots (`browser-shot shot.png` or `desktop-shot -o shot.png` in the terminal, then `agent_view` on the file). Max 12 images per call (8 by default). You judge images with your own eyes: no second model runs (pass `qa=true` only if you want a second opinion). For `agent_verify` kind images, look, then call it with `status` PASS/FAIL and `self_check` (what you saw). With DeepSeek the images are already in the [view] message directly after the result when you read it. Put what you are checking in `question`. The harness keeps what was already seen: a verdict is recorded per exact pixels (unchanged images get the same recorded verdict), and images already in your context since the last summary are not sent again, so one look per image version is enough; re-render, then look at the new frames. `watch-media` (terminal) stays the tool for whole video+audio, speech, or "where in this file does X happen".
  - Text-only model (e.g. deepseek-v4-pro): use `agent_look` / `look` and `watch-media` as below.
  - Images never reach you through the file editor or the browser tool's `include_screenshot`; both are blocked with a pointer to `agent_view` (or `look` when text-only).


- `look` — eyes for text-only models (and a second opinion for vision models). To see anything, run:
  - `look frame.jpg "question"` for one image
  - `look video.mp4 "question" --frames 8` for a video (samples frames evenly, labels each with its timestamp)
  - `look frames_dir/ "question"` for up to 16 images in a folder
  - `watch-media file "question"` (same as `look file "question" --whole`) uploads a WHOLE video (picture + sound), audio file or PDF to Gemini and prints ANSWER, TIMESTAMPS (MM:SS, or page numbers for PDFs) and CONFIDENCE. Audio files and PDFs always go whole, even through `look`.
  Which to use: whole-file (`watch-media`) when the answer depends on what happens over time, on sound or speech together with the picture, or on finding *where* something happens (events, scenes, mentions, mood, long documents); frames (`look --frames N` or your own extracted frames) to check how specific moments look (QA of a render, framing, text legibility, choosing a thumbnail) — it is cheaper and sharper per frame; a transcript (`transcribe`, Deepgram) when you need exact words, word-level timings or speakers (captions, cuts on a word, quotes). Whole-file timestamps are approximate (about ±1 s); confirm anything you cut on with a transcript or a frame. Files over 2 GB must be cut first.
  It sends the pictures to DeepSeek vision (Gemini if that fails; `--gemini` forces Gemini) and prints what it sees. Ask specific questions ("Is the speaker's face fully in frame?", "Is any text cut off or overlapping?", "Which frame is the best thumbnail?"). Use it to check source footage before choosing shots, every render before you call it done, and browser screenshots when a page matters. Never claim something looks right without having looked.

## Video, PDF pages, screenshots (free paths)
- Video: `video-digest VIDEO [--frames 8]` makes keyframes (scene changes) plus a timed transcript (local faster-whisper, or `--subs file.vtt`) in log/video/<name>/digest.md; then `agent_view` the frames. Use `look`/`watch-media` (Gemini) when you need a model to watch motion or sound.
- PDF pages: `pdftoppm -png -r 80 -f 1 -l 3 file.pdf log/pages/p` (or `doc-verify file.pdf --pages 3`), then `agent_view` the PNGs; text with `pdftotext -layout`.
- Screenshots of your browser: `browser-shot out.png`, then `agent_view out.png`.

## When a visual judgment is hard: `sonnet-assist --mode visual` (rare)

Use only when your own look is unsure, or a final quality check of a design, landing page, video-edit, hard-to-read screenshot, or visual captcha actually matters. Not for ordinary looks.

  sonnet-assist --mode visual --goal "<the specific question>" --image frame1.png --image frame2.png

Send only the image(s) or frames and that question (max 4, keep them small). It returns `VERDICT: PASS` or `VERDICT: NEEDS WORK` plus concrete fixes. You still apply any changes and look again yourself. It is a one-shot call, not a model switch.
