# Type playbook: interview, podcast and panel films (full detail)

Source labels in [BRACKETS] resolve in `/workspace/skills/lab-video-edit/craft-sources.md`.

**Hook (0–3 s).**
- Open on the claim, question or most surprising line, with the speaker's face on screen. Say what the clip is about within 90 f [TT-CBP][ABCD][DESC-CLIPS].
- Cold-opening the payoff and then backtracking is a sanctioned hook ("start at the end or in the middle of the climax") [TT-CA1][NBCU].

**Structure.**
- Self-contained: hook → minimal context → payoff/insight. It must make sense with no episode context [DESC-CLIPS][RIV].
- Pick moments that represent the show's brand, not clickbait [DESC-CLIPS].

**Pacing.**
- Tighten gaps over about 1 s (the Descript tool works from a threshold) toward 0.2–0.6 s. Keep pauses that land a point [DESC-GAPS][JAP-SPEECH][HSM-5].
- Turn breaths down, don't delete them all. Never strip every pause [JAP-SPEECH].
- Any layout or speaker change holds at least **1.0–1.5 s (30–45 f)** (house rule).
- Let strong moments play on the speaker's face before covering with anything [JAP-EDIT].

**Layout and framing (9:16).**
- **The pro tool vocabulary** [OPUS-LAYOUT][OPUS-BLOG]:
  - *Fill*: crop to the active speaker when one person talks.
  - *Split*: stack two speakers.
  - *Three/Four*: panels.
  - *Screenshare*: screen on top, speaker below.
  - *Gameplay*: about 30% speaker over 70% game.
  - Opus tells users to manually reframe segments where the auto reframe misses [OPUS-LAYOUT].
- **Face placement.** Eyes on the upper-third line, about **y 640 (284)**, with headroom shrinking as the shot tightens. Leave lead room on the side the speaker looks toward [JAP-FRAME]. On 9:16 faces belong in the top half, above the captions [BBC].
- **Stacks and splits inside the safe box.** The active speaker's eyes and mouth must sit in **y 288–1248**. With a 50/50 stack, the bottom tile's face lands under the app UI unless it sits in that tile's top third. Options:
  - a top-heavy split (larger active tile);
  - both tiles inside the safe band;
  - captions placed at the seam.
  This is derived from 1.9.
- **Reframing moving subjects.** AutoFlip's pro pattern [AUTOFLIP]:
  - Detect shots first and decide the camera path per shot.
  - Prefer **stationary** framing when the subject stays within a threshold region, like a tripod.
  - Use **panning** at constant speed, or **tracking**, only when the subject truly moves.
  - Smooth the path (AutoFlip fits a low-degree polynomial) rather than following each detection box, which jitters.
  - When required content won't fit, AutoFlip pads (letterbox or blur). On Instagram that risks the "borders" penalty, so prefer a split or a wider crop [AUTOFLIP][IG-RANK].
- **Must: no face cut off or masked.** No decorative window may crop a speaker's face. This is also the 1.9 rule.
- **Must: fill the canvas edge to edge.** Instagram deprioritises reels with borders [IG-RANK].

**Captions.**
- Verbatim, with proper nouns and show and guest names checked by hand. Auto transcripts need checking for names, technical terms and accents [HSM-8][SUBMAGIC].
- Sized and timed per 1.10. Lowest line ends at y ≤ 1248 (555). Never over a mouth.
- Short-form convention: a bold sans with an outline or shadow, ≤ 2 lines, kept off the bottom and right UI [SUBMAGIC] (tool vendor; convention, not standard).

**Motion graphics (what pros add)** [OPUS-BLOG][RIV]:
- a hook title;
- word-timed captions with emphasis;
- speaker name tags;
- light B-roll inserts tied to what is said;
- logo or branding.

Rules for them:
- **Name tags / lower thirds:** 3–6 s on screen (**90–180 f**). The rule of thumb is "read it twice" [SOM-L3]. Only when the name is known.
- **How much is too much:** one message at a time; don't obstruct the visuals [META-SZ][TT-CA1]. Graphics never take the screen from the speaker's face during the key line.

**Type and colour.** WCAG contrast. Caption family per the film's design. Grade skin on the skin-tone line, with no crushed blacks (1.13).

**Audio.**
- Speaker dialogue is the mix. Integrated level at −14 LUFS ±1, TP ≤ −1 dBTP.
- Music optional: ducked **10–18 dB** under speech, and none with vocals under speech [JAP-DUCK].
- Audio joins on pauses or plosives, with 20–50 ms crossfades [JAP-SPEECH].

**Transitions.** Hard cuts and layout changes. Never a dissolve inside a continuous exchange [HSM-3].

**Ending and loop.** End on the payoff line or the reaction to it. Don't trail into the next topic. NBC News moves a strong final moment to the front so the video "backtracks" to it, which loops cleanly [NBCU]. A loop is optional, and Shorts "engaged views" don't count loops [YT-AN].

**Length.** As briefed; for a social cut 15–60 s, up to 90 s when the story needs it [RIV][OPUS-BLOG].

**Amateur mistakes:**
- Moments that need outside context to make sense.
- Slow opens.
- Every pause stripped (robotic).
- Captions under the UI or over mouths.
- Mistranscribed names.
- Jittery crop that chases every head move.
- A speaker cut off or masked.
- Letterboxed "Fit" frames.
- Ping-pong cutting with no reactions.
- Music fighting words.
- A clip that changes the speaker's meaning.
