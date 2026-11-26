---
name: lab-video-text
description: Titles, captions and on-screen text for a made-from-scratch video: safe zones (9:16 platform UI), caption quality, size, line breaks, reading rate and timing, type and colour legibility (contrast).
when_to_use: Load at the titles, captions and graphics stage of a video job (scene plan and build), named by lab-video-producer.
page_line: Titles, captions and graphics, every film with on-screen text: safe box, caption size/breaks/timing, reading rate, contrast.
attach_roles: stage
---

# Titles, captions and on-screen text

Must = fails review if broken. Should = default; break it on purpose with one line in `log/job.md`. Freedom = open.
Full standards, platform zone tables and sources: `reference.md`. Pixels at 1080x1920 (480x854 in brackets).

## Must
- **Safe box (9:16)** for all text, logos, captions and the active speaker's eyes and mouth: x 120-888 (53-395),
  y 288-1248 (128-555); below y 780 (347) the right edge moves in to x 780 (347). 16:9: titles inside 90% title-safe.
- **Readable on everything behind it**: contrast >= 4.5:1 (>= 3:1 for large text) against the local background,
  measured on the actual frame; over moving video add an outline, shadow or box. Thin display fonts need more.
- Label cap height >= 40 px (18); caption line height >= 75 px (33), font ~3.5% of height.
- **Captions** (an SRT/VTT file, or on screen when asked): verbatim and accurate (names checked by hand), in-time on
  the first audio frame (+/-2 f), complete, never over a mouth or other on-screen text, <= 3 lines (9:16).
- Caption events 25-210 f; gaps 2 f or >= 15 f; word-by-word styles keep each phrase >= 25 f and move the highlight.
- Line breaks never split article/noun, adjective/noun, first/last name, pronoun/verb or verb/auxiliary.
- Added text overlays readable at <= 180 wpm / 20 characters per second (~0.3 s per word) unless also spoken.
- Graphic hits land 0 to +200 ms after their word.

- **Placement**: find genuinely empty space inside the safe area (a safe zone is not empty space: on 9:16 the
  middle band is often the person); otherwise reframe, shrink or split, put the type behind the subject, or make a
  planned full-frame breakout. Step stills through the whole hold (a lean can swing the subject into it).
- Text animates in, **holds still while it must be read**, animates out; never animate type while it is read.

## Should
- ~18-22 characters per caption line inside the 9:16 safe width (measure the real string); one sentence per caption.
- Emphasise at most 1-2 words per caption; one message per card; don't obstruct the visuals.
- Sans-serif for captions; keep to the film's declared type roles (display, label, body).
- Brand colours and logo as supers when there is a brand.
- Hierarchy passes the squint test (grayscale: one thing reads first); line spacing ~120-145%, caps +5-12% tracking,
  hand-kern display pairs; real quotes, dashes, x and minus; no single word alone on a last line.
- Small moves 200-400 ms on shaped curves; one motion idea per moment; cascade elements a few frames apart.

## Freedom
Type family, caption style and animation, colour, title design, layout of cards.
