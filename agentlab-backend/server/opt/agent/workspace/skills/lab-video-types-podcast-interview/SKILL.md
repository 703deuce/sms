---
name: lab-video-types-podcast-interview
description: Type playbook for Interview-led, podcast or panel films where people talking carry the story: the pro standards (Must, Should, Freedom) and the type checklist for review.
when_to_use: Attached only when the job's kind is this type (picked by the router model at the judgment step); named by lab-video-producer.
page_line: Interview-, podcast- or panel-led films: speaker framing in 9:16, reactions, speech edits, C1 checklist.
attach_roles: stage
---

# Type playbook: interview, podcast and panel films

Must = fails review if broken. Should = default; break it on purpose with one line in `log/job.md`. Freedom = open.
Full playbook (hook, structure, pacing, layout, captions, audio, transitions, mistakes) and sources: `reference.md`.

**Hook.** Open on the claim, question or most surprising line, with the speaker's face on screen. Say what it is about within 90 f [TT-CBP][ABCD][DESC-CLIPS].

**Must**
- Hook claim/question audible and on screen by 90 f.
- Each moment stands alone.
- Active speaker's eyes and mouth visible, never cropped by the frame edge, a mask or a graphic, and inside y 288–1248.
- All text inside the universal safe box (1.9).
- Captions accurate (names verified) and synced within ±2 f.
- Caption line height ≥ 75 px (33), ≤ 3 lines, contrast ≥ 4.5:1 (3:1 for large), never over a mouth.
- Phrase-caption events ≥ 25 f.
- No mid-word cuts; audio joins crossfaded; room tone under gaps.
- Meaning preserved; no frankenbites; reactions not moved to other questions.
- TP ≤ −1 dBTP; integrated loudness at −14 LUFS ±1.
- Full canvas at the delivery size (house default 480×854 for 9:16), 30 fps, BT.709, limited range; no borders or bars.

**Should**
- 30–60 s.
- Single speaker → stationary or smoothed Fill. Back-and-forth → split or stack. Big reactions → an L-cut to the listener.
- Gaps > 1 s shortened to about 0.2–0.6 s.
- Breaths at about −15 dB.
- Name tag 90–180 f when known.
- 1–2 emphasised words per caption.
- Music bed ducked 10–18 dB, or none.
- End on the payoff or reaction.

**Freedom**
- Caption type, animation and colour.
- Layout shapes and tile treatments, as long as faces stay whole.
- Palette and graphic language.
- Hook-title design.
- Whether to use music, SFX or B-roll.
- Loop construction.

### Type checklist, run with the all-types C0 (`lab-video-review`) on change-point stills before render: Podcast / interview / panel (C1)
- [ ] Claim or question heard and seen by 90 f; each moment stands alone.
- [ ] Active speaker's eyes and mouth visible, uncropped, unmasked, inside y 288–1248, on every sampled frame.
- [ ] Layout and speaker changes hold ≥ 30–45 f. The crop is stationary unless the subject moves; no jitter on a 0.1 s strip.
- [ ] Screen direction preserved in splits; no mirrored faces.
- [ ] Reaction cuts land after punchlines, not during them.
- [ ] Gaps > 1 s shortened, but not every pause removed.
- [ ] Name tags only for verified names, 90–180 f.
- [ ] Ends on the payoff or reaction.
