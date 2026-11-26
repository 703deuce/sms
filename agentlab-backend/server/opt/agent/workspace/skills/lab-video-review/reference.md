# Review: detail (from the Motion Studio qa.md and review pages, adapted)

## Why before render
Films that passed every contract check still looked like slideshows. Rendering to look costs time and then forces a
second render. Everything visual is judged on stills of the built scenes; the one render afterwards only gets
technical checks.

## Still recipes per engine
- Cinematic Skill: `render.py --project P --probe t1,t2 --size 854x480` (PNG per time in `out/probe/`); a move:
  `--strip t0:t1:n` (contact strip) then `--probe` the moments. Never `--out` before approval (that encodes video).
- Browser engines (GSAP, PixiJS, p5, D3, three.js, MapLibre, Lottie, Rive, Skia): `capture.mjs --still t1,t2`.
- Remotion: `npx remotion still src/index.ts <Comp> out/s.png --frame <n> --browser-executable=/usr/bin/chromium`.
- Manim: `manim -s -r 854,480 scene.py Name` (last frame); drive motion from one `ValueTracker` and support an
  env var such as `FREEZE_T=<t>` to save an exact mid-move frame.
- Footage prep (cutouts, tracking, FFmpeg): check the result inside the scene still, plus a matte at 200%.
- Phone check: look at a 480-px-wide copy of the key stills.
- Word-sync check: stills in 0.1 s steps from -0.4 s to +0.8 s around a hit word.

## Checklist detail (the failure each item catches)
- Scale: a world authored too large is filmed at a tiny zoom and every title goes faint. Fix the world scale, never
  scale the final video.
- Titles: every planned typed line appears, on its word, fully on frame, with contrast.
- Camera: two identical keys = a static camera nobody chose. Travel between clusters, push after hits, drift on holds.
- Empty frames: "a photograph on a basic background". Ask: paused here, does it read as a designed shot of this story?
- Photos: cut one after another with no world and no camera = the slideshow look.
- Plan vs build: something planned but missing is a discrepancy: build it, or change the plan and log why.
- Sync: captions within +/-2 frames of their word; lip-sync at most 1 frame early or 3 late; graphic hits later than
  +300 ms fail.
- Spotlight follows the camera; no dark frame where the focus stayed behind.
- Safe areas: 9:16 at 1080x1920: text, logos, captions inside x 120-888, y 288-1248 (at 480x854: x 53-395, y 128-555).
- Footage seams: the push ends on the clip's first frame and the pull starts on its last; no fade-to-black dips
  inside segments; clip audio at the voice level.
- Layers: alpha files really transparent (`ffprobe -show_entries stream=pix_fmt` shows `yuva*`); every layer the
  scene's exact frame count; mattes don't flicker across a motion strip; type behind a subject stays legible.
- Retention: the first frame works with the sound off and matches the promise; the open question is planted and paid
  off; no dead air; it ends on the payoff with no goodbye.

## Sound targets (checked on the mix before render)
-14 LUFS integrated (+/-1), true peak <= -1 dBTP; music >= 18 dB under speech; SFX no louder than the voice; voice
pace about 115-130 words per minute; audio length = video length within one frame.

## After the single render (technical only)
Decodes without errors; duration within +/-10% of the target (fix the script, not the playback speed); exact
resolution for the aspect; 30 fps CFR; H.264 yuv420p, `+faststart`, AAC; audio present. Optional extra: frame count
equals the plan. No look checks or look warnings after the render.


---

# Craft standards: delivery encoding (detail and sources)

**Must** = a hard pro or platform standard; breaking one fails review. **Should** = a strong default; break it on
purpose and write one line in `log/job.md` saying why. **Freedom** = where creativity is open: every visual choice
(type family, palette, layout shape, motion grammar, texture) stays open unless a line is marked Must.
Units: pixels for 1080x1920 with the 480x854 value in brackets (x 0.444); frames at 30 fps (1 f = 33.3 ms).
Source labels in [BRACKETS] resolve in `/workspace/skills/lab-video-edit/craft-sources.md`.

## 1.14 Delivery encoding and platform quality signals
- **YouTube's recommended upload bitrate** for 1080p at 24/25/30 fps SDR is **8 Mbps** video (about 60 MB per minute), H.264 High profile, closed GOP of half the frame rate, 4:2:0 [YT-ENC].
- **TikTok** In-Feed: 9:16 at ≥ 540×960 and ≥ **516 kbps** [TT-SPEC]. Its creative guide asks for at least 720p [TT-CBP].
- **Instagram** shows fewer reels that are **low-resolution, watermarked, muted, have borders, are mostly text, or were already posted** [IG-RANK]. **Must:** fill the whole 1080×1920 canvas, with no letterbox or pillarbox bars and no static frame borders.


---

# Craft checklist for all types (C0), applied on the change-point stills before render

**Must** = a hard pro or platform standard; breaking one fails review. **Should** = a strong default; break it on
purpose and write one line in `log/job.md` saying why. **Freedom** = where creativity is open: every visual choice
(type family, palette, layout shape, motion grammar, texture) stays open unless a line is marked Must.
Units: pixels for 1080x1920 with the 480x854 value in brackets (x 0.444); frames at 30 fps (1 f = 33.3 ms).
Source labels in [BRACKETS] resolve in `/workspace/skills/lab-video-edit/craft-sources.md`.

Run on full-size browser stills during building (review before any render). Overlay the universal safe box (1.9) on the stills: `x 120–888, y 288–1248, lower-right column x ≤ 780 below y 780`.

### All types (C0)
- [ ] Every scene uses the film's one design system; both sides of every cut match in type, colour, motion and components.
- [ ] All text, logos and captions inside the universal safe box on every sampled frame.
- [ ] No letterbox or pillarbox bars or static borders; the full canvas is used.
- [ ] Framing serves the content: faces never badly cropped (chin or forehead cut, eyes misplaced, jammed against a border), and what the person shows stays readable.
- [ ] Key words and numbers readable on every still; text may sit behind a subject but no object fully hides key text.
- [ ] Real clips play with their own audio where it makes sense, then cut back; not voiceover the whole time.
- [ ] Text contrast ≥ 4.5:1 (or ≥ 3:1 for large text) against its local background, checked on the 3 worst frames.
- [ ] Label cap height ≥ 40 px (18). Caption line height ≥ 75 px (33).
- [ ] Captions:
  - [ ] verbatim and accurate, with names checked;
  - [ ] in-time within ±2 f of the audio;
  - [ ] events ≥ 25 f and ≤ 210 f;
  - [ ] gaps of 2 f or ≥ 15 f;
  - [ ] ≤ 3 lines;
  - [ ] breaks follow 1.10;
  - [ ] never over a mouth.
- [ ] No audio edit inside a word. Every join crossfaded (no clicks on a 200% waveform zoom). Room tone under gaps.
- [ ] Lip sync within +1 / −3 f after every crop or retime.
- [ ] Integrated loudness at −14 LUFS ±1; TP ≤ −1 dBTP; dialogue intelligible on a phone speaker.
- [ ] Music under speech ducked ≥ 10 dB (≥ 20 dB with vocals); ramps 200–500 ms in, 600–1500 ms out.
- [ ] No dissolve inside continuous time. Transitions are used with consistent meaning.
- [ ] Colour:
  - [ ] skin near the skin-tone line;
  - [ ] no flat crushed or clipped waveform lines on faces;
  - [ ] 8-bit RGB and luma inside 5–246;
  - [ ] tagged BT.709, limited range.
- [ ] Meaning preserved in every edited quote.
