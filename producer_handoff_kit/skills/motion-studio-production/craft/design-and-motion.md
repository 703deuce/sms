# Design and motion: framing, design system, graphics, animation, integration, captions

All graphics are custom for this video. There are no templates, no pre-made packs and no canned graphics.

## 1. Frame (reframing customer footage)

**Frame for what the viewer needs to see right now.** That's the face for pure talking and podcasts, and the board, screen, product or demo when that's the point. Answer it per section, not once per video.
- *Judge:* on each still, ask whether you can see what they're pointing at, writing or clicking. Is the face whole, with the eyes near the upper third, a little headroom, and look room in the direction they face?
- *Pros:* zoom toward the region being written or the control being used, hold through the action, then return to enough context to stay oriented.
- *Trap:* face tracking on a whiteboard, so you see the face but only 20% of the board (our whiteboard test).
- When a face sits in a box, split or crop, don't crop it badly: eyes near the upper third, chin and forehead intact. `face_frame.py` is an optional helper; your eye decides. Whether the shot should be face-led at all is the content decision above.

**Make room for the graphic in the frame itself.** Offset the subject to one side to create a clean area for a coming graphic, instead of centring the subject and then covering them.

**Design the eye position across cuts.** Keep the subject in the same screen area across a cut unless moving the eye is the point.

**Know the reframe limit.** Punching in costs resolution. Decide how far this source can go before it turns soft, and spend that headroom where it counts.

**Recompose for each aspect, don't just crop.** The 9:16 and 16:9 versions of a moment often need different framing and graphic placement. A centre crop that halves the whiteboard is the novice version.

**The signature layout is the base.** Keep the film's main layout as its backbone and vary it at key moments with push and pull, punch-ins, full-frame moments, breakouts, and elements that come and go. Never remove it wholesale, and never lock one framed box on screen for the whole video (Willie revision lesson).

## 2. A design system for this film (write it before building)

**Creative decision first (Rick, Nov 19; top rule, every job).** Every job starts with a creative decision about what is best for this edit. Look at what you're editing (its content, purpose, audience, material and feel) and decide the creative idea that will make it the best version of itself, then carry that idea through the design, type, motion, transitions, pacing and sound. The look depends on what you're editing; that is the creative part. Do it on every job, consistently. Never mail it in with a generic look. The design system below is how that idea becomes concrete.

Put 5–8 lines in `log/job.md`:
- **Type:** one family with a range of weights, or two at most (display + workhorse), chosen for this film's voice. Give the reason.
- **Type scale:** a deliberate ratio between title, label, data and lower third. Random sizes collapse hierarchy.
- **Palette:** sampled from the corrected or graded footage, plus one accent that contrasts with skin and background, reserved for what matters (`color-and-style.md` §4).
- **Grid:** built around where the subject sits, the platform UI safe area and the empty space in the shot. It is not a fixed layout.
- **Motion personality:** for example, firm, well-damped settles for a serious piece, or bounce and overshoot for a playful one.
- **Sound vocabulary** for graphic moves (`sound.md` §3).
- Check it against `/workspace/motion_jobs/STYLE_LEDGER.md` so every film looks different.

Within the film, the same kind of information always looks the same (one style for every stat, every name, every chapter title). Across films, the system changes.

## 3. What every graphic is for

**The test: does it explain, emphasize or orient?** Explain means showing what can't be filmed (a process, data, a map, a rebuilt diagram). Emphasize means a key number or word. Orient means who this is, where we are, which chapter. If it does none of these, it's decoration, and decoration competes with the subject.
- **Visual anchors first.** Graphics show what the footage can't. They don't repeat what it already shows.
- **Enough to lift the edit.** A premium edit carries energy with diagrams, kinetic keywords, numbers that land, and titles and transitions with real movement. The whiteboard test had too few.
- **Density follows rhythm.** Alternate graphic-heavy and calm sections like any other dynamics. Plot them across the film with the shot lengths (`editing.md` §4).
- **Time each graphic to a beat.** It enters on the word it supports, a cut or a music hit, and leaves when its job is done. A visual hit lands 0 to +200 ms after its word (`../qa.md` sync). Don't let it arrive on the frame where the face does something important.
- **Common formats done well:**
  - **Lower thirds:** small and quiet, placed against the subject's look room, up long enough to read twice.
  - **Data:** one idea per graphic, labelled directly, built in the order of the argument, with honest scales and the key number largest.
  - **Maps:** start from a place the viewer knows, move with purpose, styled to the film.
  - **Kinetic type:** only the load-bearing words, following the rhythm of the speech.
  - **Callouts:** point at the real thing (the line on the board, the button) and track with it, never covering it.
- An opening title should carry this film's idea, not just its name.

## 4. Where graphics go

1. Pause on a still and ask what the subject is and what is already busy.
2. Find a region that is genuinely empty and inside the platform's safe area. On Reels, Meta keeps the top 14%, bottom 35% and 6% each side clear ([Meta](https://www.facebook.com/business/help/980593475366490)); exact pixels are in `../qa.md` §2 item 9 and `../craft-standards.md` §1.9. A safe zone is not the same as empty space: on vertical, the middle band is often the person's body.
3. Place the graphic there, readable, with a gutter between type and subject. If there's no empty region, reframe, shrink or split the graphic, put it **behind the subject** (§6), or make a **planned full-frame breakout** that takes the frame for a beat and hands it back.
4. Step stills through the whole hold. A hand, a pan or a lean may swing the subject into the graphic later.
5. Never stack layout pieces on top of each other or let them fight. If it doesn't look right, it isn't right.

## 5. Typography and animation

- **Hierarchy:** one thing is read first. To test it, squint at the frame in grayscale and see what pops ([School of Motion](https://schoolofmotion.com/blog/fundamental-composition-rules-for-designers)). Value contrast does more than hue.
- **Grouping:** things that are close read as one group, things that look alike read as related, and things that move together read as one unit. A label floating between two things belongs to neither ([NN/g](https://www.nngroup.com/articles/principles-visual-design/)).
- **Spacing:** line spacing about 120–145%. All caps get about 5–12% extra tracking. Display type needs tighter tracking and hand kerning on pairs like AV, To and LT ([Butterick](https://practicaltypography.com/summary-of-key-rules.html)).
- **Real characters:** curly quotes, real dashes, real × and −.
- **Break lines by meaning.** Never leave a single word alone on the last line.
- **Separation over footage:** a backing shape, scrim, shadow or stroke, or placement in a calm area. Contrast at least 4.5:1, or 3:1 for large text ([WCAG 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)). Minimum sizes are in `../qa.md` (cap height ≥ 40 px at 1080p, readable on the 480 px copy).
- **Reading time:** about 0.3 s per word as a floor ([BBC](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/)), counted while the text is motionless. Animate in, hold still, animate out. Never animate type while it must be read.
- **Moves:** 200–400 ms for small moves ([Material 3 tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs)). That's the move, not the on-screen life. Use shaped ease curves, never linear.
- **Personality:** anticipation, overshoot and follow-through in proportion to the tone. Cascade elements a few frames apart, because everything landing on one frame feels like a preset.
- **One motion idea per moment.** Don't scale, rotate, blur and colour-shift at once.
- **Match the cut's energy.** A floaty graphic in a fast section feels wrong.
- **Exits matter as much as entrances.**

## 6. Integrate graphics into the shot

- **Behind the subject.** Segment the person (SAM 2, or the rembg/MediaPipe fallbacks in `../engine-library.md`) so big type or shapes sit between the background and the person. That is the pro way to go bold without covering them. Check the matte edges on stills at hair and hands.
- **Stuck to the world.** Track callouts and screen replacements to the footage (OpenCV tracking). If they slide, the illusion breaks.
- **Same image quality.** Give graphics the footage's grain, slight softness and light direction, and grade their whites and blacks into the look (`color-and-style.md` §4). Crisp vector edges over soft footage give the composite away.
- **Depth:** graphics can live on the foreground, subject or background layer. Choose on purpose.

## 7. Captions (always a separate file or track)

- **Line length:** about 42 characters per line on landscape and 2 lines at most ([Netflix](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide)). On 9:16, plan for about 18–22 characters per line inside the safe width, and up to 3 lines (BBC; measure the real string width, `../craft-standards.md` §1.10).
- **Reading speed:** ≤ 20 characters per second for adults (17 for children), and 160–180 wpm (BBC). For verbatim speech, follow the speech, and split events rather than cut words.
- **Break by sense,** at clause boundaries, with a bottom-heavy pyramid when breaking.
- **Snap caption changes to nearby picture cuts** so a caption doesn't hang across a cut by a frame or two. Captions start within ±2 frames of their word (`../qa.md`).
- **Accuracy:** spell names, numbers and terms against what is on screen and the customer's materials. Add speaker IDs or sound cues only where they matter for meaning.
- Any added on-screen text (titles, stats) is a graphic layer, not a caption, and follows §5.

## 8. Novice vs pro
| Novice | Pro |
|---|---|
| Template look, the same every video | A design system built for this film from its footage |
| Graphic centred over the subject | Empty space, behind the subject, or a planned breakout |
| Many competing focal points | One focal point, and the squint test passes |
| Text animating while you read | Animate in, hold still, animate out |
| Everything lands on one frame, linear | Shaped curves, cascades, overshoot that suits the tone |
| Flat graphics floating on footage | Tracked, grained and graded into the shot |
| Kinetic text of every word | Emphasis only on load-bearing words |
| Centre crop to vertical | Recomposed vertical with intent |
