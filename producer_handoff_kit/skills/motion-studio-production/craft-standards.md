# Craft standards for Motion Studio (film and clip jobs)

Researched 16 Nov 2026 from platform creator and ad guides, broadcaster subtitle and loudness standards, editing education and pro clip tools. Source labels in `[BRACKETS]` resolve to URLs at the bottom and in `sources.md`.

**How to read this.** These are the confines a trained editor works inside. They are not a look. Every visual choice (type family, palette, layout shape, motion grammar, texture) stays open unless a line below is marked **Must**.
- **Must**: a hard pro or platform standard. Breaking one is a QA fail.
- **Should**: a strong default. Break it on purpose and write one line in `log/job.md` saying why.
- **Freedom**: where creativity is open.

**Units.** Pixels are given for **1080×1920**, with the **480×854** value in brackets (× 0.444). Frames are at **30 fps** (1 frame = 33.3 ms; 15 f = 0.5 s; 90 f = 3 s). Where sources disagree, the range is given and the stricter value is used for the Must.

---

# PART 1. Universal fundamentals (every job)

## 1.1 What a cut has to do, in priority order (Murch's Rule of Six)
Murch ranks what a cut must satisfy: **1) emotion (51%), 2) story (23%), 3) rhythm (10%), 4) eye-trace (7%), 5) the two-dimensional plane of the screen (5%), 6) three-dimensional space of action (4%)**. When you can't satisfy all six, give them up from the bottom: "don't ever give up emotion before story", and so on [MURCH].
- In our pipeline this means a deliberate continuity break (a jump cut, a crossed line) is allowed when it serves emotion or story. QA should flag it, not auto-fail it.

## 1.2 Dmytryk's seven rules of cutting [DMYT]
1. Never make a cut without a positive reason.
2. When undecided about the exact frame, cut long rather than short.
3. Whenever possible, cut in movement.
4. Fresh material is preferable to stale.
5. Scenes should begin and end with continuing action.
6. Cut for proper values rather than proper matches: drama beats a perfect match.
7. Substance first, then form.

## 1.3 Continuity grammar
- **180-degree rule.** Keep the camera on one side of the line between two people, so A always looks one way and B the other. When you reframe a two-shot into a split or stack, keep each person facing the way they face in the source; never mirror-flip a face to "fix" a layout [JAP-FRAME][ADOBE-180].
- **Eyeline.** Gaze direction and height stay consistent across shot/reverse-shot. A subject who looks screen-left sits on the right third with lead room to the left [JAP-FRAME].
- **30-degree rule / jump cuts.** Cutting between two near-identical framings of the same subject reads as a jump. Change the angle by at least 30°, or change shot size clearly. Otherwise the jump is a deliberate style choice [WIKI-30][BBC-BITE].
  - *Clip application:* when you cut out words inside one camera angle, hide the seam with a real change: a punch-in or punch-out (different size), a layout change, a reaction shot or a B-roll insert. The other option is an intentional jump cut that matches the DNA [JAP-EDIT][HSM-8].
- **Cut on action.** Cut a few frames after a movement begins in the outgoing shot and pick it up slightly later in the incoming one. Some editors overlap the action by 1–2 frames [HSM-4]. Motion carries the eye across the cut [JAP-EDIT].
- **Motivated cuts.** Cut on a look, a sound, a movement or a story need. An unmotivated cut needs a purpose, such as surprise [HSM-3].
- **Match cuts / graphic matches.** Link two shots through shape, colour or composition (the bone-to-spacecraft cut). A *sound match* bridges two scenes through audio [HSM-3].

## 1.4 Conversations: split edits and reactions
- **J-cut:** the next shot's audio starts before its picture. **L-cut:** the outgoing audio continues under the next picture. "One second or so is plenty" (≈ **30 f**) [JAP-EDIT][ADOBE-JL][HSM-6].
- L-cuts are how B-roll and reactions are laid under a speaker. J-cuts pull the viewer into the next speaker or scene [JAP-EDIT][HSM-6].
- **Reaction shots.** Cutting only to whoever is talking ("ping-pong editing") feels mechanical. Reactions carry subtext, control pause length without breaking lip sync, and hide trims [HSM-6].
  - Cut to a reaction just **after** a punchline, not during it.
  - Don't cut away from a line the audience needs to watch being delivered [HSM-6].
- **Groups of 3+ people.** Pick the 2–3 people who drive the moment and treat the others as a chorus whose reactions punctuate key lines. Return to a wider frame from time to time to re-establish who sits where [HSM-6].
- **Overlaps.** Closing response gaps tightens pace, but keep the pauses that carry meaning [HSM-5][HSM-6].

## 1.5 Speech edits: never mid-word, keep it human
- **Must: never cut inside a word, a vowel, or a continuous consonant (M, N, S).** Cut in a pause or breath, or just before a stop consonant (P B T D K G), where the consonant's attack hides the join [JAP-SPEECH].
- **Must: no clicks.** Blend each audio join with a short crossfade of **20–50 ms** [JAP-SPEECH]. Lay room tone under gaps, never digital silence [JAP-SPEECH][HSM-6].
- **Pauses.** Shorten them; don't delete them.
  - Example from the lesson: a 2 s pause becomes **0.6 s (18 f)** [JAP-SPEECH].
  - Descript's word-gap tool detects gaps longer than a threshold you set and shortens them to a target you set; its example target is 200 ms (6 f) [DESC-GAPS]. Treat 200 ms as the floor for fast social clips, not a default for every gap.
  - Keep longer air after a line that needs to land [HSM-5].
- **Breaths.** Turn them down, don't cut them all out: about **−15 dB** is the suggested start. Over-editing (every breath and pause gone) makes speech sound robotic [JAP-SPEECH].
- **Fillers.** Cut the fillers that distract and keep the ones that carry thought. Some fillers keep a speaker's natural cadence; cut more, but don't over-edit [DESC-EDIT].
- **Heads and tails.** Leave **0.25–0.5 s (8–15 f)** of room tone before the first word and after the last [JAP-SPEECH].
- **Must: preserve meaning (ethics).**
  - Never splice words so someone appears to say something they didn't. Never cut a qualifier that flips the meaning [JAP-SPEECH].
  - Never move a reaction onto a question it wasn't answering [HSM-8].
  - Removing "ums" and condensing an answer is fine if the meaning stays the same [HSM-8].

## 1.6 Pacing and rhythm
- **Measured data:** the average shot length (ASL) of Hollywood films fell from about **10 s** (1930s–40s) to **under 4 s** after 2000. Shorter shots also carry more motion [CUTTING].
- **Illustrative ASL ranges** (editing course, not measured) [HSM-5]:

  | Material | Typical ASL |
  |---|---|
  | Contemporary drama | 4–7 s |
  | Action sequences | 1.5–3 s |
  | Music videos and trailers | 1–2 s |

- **Cut count is not pace.** Pace is how fast story and emotion arrive [HSM-5].
  - Accelerate (shorter shots) into a peak, then release on a held shot.
  - Hold a shot until its information is absorbed, then cut. Wide or text-heavy shots need longer; a simple close-up can be short.
  - Leave air after an important line.
  - "Enter late, leave early." Don't trim every shot evenly [HSM-5].
- **Montage to music.** Cut to the music's structure: phrases and accents. One beat lasts 60 ÷ BPM seconds. Vary the pattern and hold a key image across a phrase so it doesn't feel mechanical [HSM-7].
- **Vary shot length.** A row of identical 4 s shots feels mechanical [JAP-EDIT].

## 1.7 Transitions
- **The straight cut is the default.** It reads as "now and next" [HSM-3][JAP-EDIT].
- **Conventional meanings:**
  - Dissolve: time passing, a soft link, memory.
  - Fade to black: the end of a section or a bigger time jump.
  - Wipe: reads as dated unless it is the deliberate style [JAP-EDIT][HSM-3].
- **Don't** put a dissolve inside a continuous conversation: it implies time passed. A dissolve over a bad cut "is usually a slow bad cut"; fix it with a different take, a trim, a cutaway or sound instead [HSM-3].
- **Keep each transition's meaning consistent** through a film; that consistency is part of the Visual DNA's transition grammar [HSM-3].

## 1.8 Sync
- **Lip sync** (ITU-R BT.1359): viewers detect sound **+45 ms early** or **−125 ms late**. It becomes unacceptable past +90 / −185 ms [ITU-1359][HSM-9]. At 30 fps that means **≤1 frame early, ≤3 frames late**. After any crop or retime, audio and picture must stay frame-locked.
- **Caption in-time** is on the first frame of the audio, or within 1–2 frames of it [NFX-T].
- **Graphic hits** (a word slam, a counter): the skill's 0 to +200 ms after the word stays valid for design hits. It does not apply to captions.

## 1.9 Safe zones for 9:16 (where the app UI covers the picture)
Every platform publishes its zones for ads only, but organic posts get the same UI [META-RG][GADS-V].

| Platform (source) | Top | Bottom | Left | Right |
|---|---|---|---|---|
| **TikTok In-Feed** (official template, measured by us from TikTok's PNG) [TT-SZ] | 240 (107) | 660 (293) | 120 (53) | 120 (53) above y≈790; **300 (133)** from y≈790 down |
| **Instagram/Facebook Reels** (Meta Ads Guide: 14% / 35% / 6%) [META-RG] | 269 (120) | 672 (299) | 65 (29) | 65 (29); the button rail cuts deeper bottom-right from y≈1150 (secondary measure: 227 px) [CADENUS] |
| **YouTube Shorts** (Google vertical-ad diagram; secondary readings of it) [GADS-V][SOCIALYNC] | 288 (128) | 672 (299) | 48 (21) | 192 (85) |

- **Disagreement.** A measure of the organic Shorts UI gives 309 top / 380 bottom / 49 sides [KREATLI], against 288 / 672 / 48–192 from Google's ad diagram. We use the strictest values.
- Reels ads that carry a disclaimer should leave the bottom **40%** clear [META-SZ].
- TikTok: the safe area depends on ad-caption length and add-ons, so longer captions push the bottom UI higher [TT-SPEC][TT-SPEC-SEC].

**Universal safe box (Must for all text, logos, captions, and the eyes and mouth of the active speaker):**
- **x 120–888 (53–395), y 288–1248 (128–555)**.
- Below **y 780 (347)**, the right edge moves in to **x 780 (347)** for TikTok's button column.
- That leaves 768 px (341) of width up top and 660 px (293) in the lower half.
- Faces of non-active people and B-roll may extend past it. Text may not.
- **BBC's 9:16 subtitle region** (central 75% vertically, region bottom ≤ 87.5% = y 1680) is designed for an **online player without app UI** [BBC]. On social feeds the platform zones above are stricter and win.

## 1.10 Captions and on-screen subtitles
**Quality (FCC and DCMP).** Captions must be:
- **accurate:** they match the spoken words;
- **synchronous:** timed with the speech and readable at speed;
- **complete:** start to end;
- **properly placed:** they don't block important visuals, overlap each other or run off the frame [FCC][DCMP].
- Errorless is the goal, and the meaning and intent are preserved [DCMP].
- Netflix: don't paraphrase, and transcribe slang and dialect accurately [NFX-EN].

**Size (BBC, 9:16):**
- Line height **3.9–4.5% of video height = 75–86 px (33–38)**. Font size is about **3.5% of height ≈ 67 px (30)** [BBC].
- Short-form creators often go bigger for 1–3-word captions [SUBMAGIC]. That's fine; the BBC size is the floor.
- The skill's ≥40 px cap height for labels still applies to non-caption text.

**Lines and length:**
- BBC: up to **3 lines** for 9:16, and one complete sentence per subtitle where possible. About **25 characters** fit across 90% of a 9:16 frame [BBC].
- Netflix: 2 lines max for landscape, 42 characters per line; keep to one line unless it doesn't fit; prefer a bottom-heavy pyramid when breaking [NFX-G][NFX-EN].
- Inside our universal safe width (768 px), plan on roughly **18–22 characters per line** at the BBC size. This is derived; measure the real string width.

**Where to break lines.** Break after punctuation, or before a conjunction or preposition. Never separate:
- article from noun, or adjective from noun;
- a first name from a last name;
- a subject pronoun from its verb;
- a verb from its auxiliary or negation [NFX-G].

**Reading rate:**
- BBC: 160–180 wpm, about **0.3 s per word** (≈ 9 f per word) [BBC].
- Netflix: ≤ **20 characters per second** for adults [NFX-EN].
- Disagreement: TikTok's ad guide recommends "5–10 words per second" of on-screen text [TT-CBP]. That is far faster than either broadcaster. For verbatim speech captions, follow the speech; for added text overlays, use the broadcaster rates as the readable ceiling.

**Timing (Netflix, converted to 30 fps)** [NFX-G][NFX-T]:
- Minimum event **5/6 s = 25 f**; maximum **7 s = 210 f**.
- In-time on the first audio frame (±1–2 f).
- When no caption follows, hold the out-time about **15 f** past the end of speech.
- Gaps between captions are either **2 f** or ≥ **15 f**, never 3–14 f. Close the short ones by "chaining."
- Snap to a shot change when the speech starts or ends within 15 f of it, keeping 2 f clear of the cut.
- Cross a cut only when the speech itself crosses it.

**Word-by-word ("karaoke") styles.** Keep each *phrase group* on screen for ≥ 25 f and move the highlight per word. Never flash single words for less than 25 f as separate events. This applies the Netflix minimum to that style.

**Emphasis:**
- BBC allows caps for a stressed word, used sparingly [BBC].
- *Should:* emphasise at most 1–2 words per caption.

**Position:**
- Captions must not cover a speaker's mouth or on-screen text [BBC][NFX-G].
- On 9:16 they sit "a little higher up" than on landscape, still in the lower part, because faces live in the top half [BBC]. On social that means their lowest line ends at or above **y 1248 (555)**.

**Contrast.** White text on black is the broadcast default [BBC]. Over moving video, use an outline, shadow or box so contrast stays ≥ **4.5:1** for normal text and **≥ 3:1** for large text (WCAG AA) [WCAG][SUBMAGIC].

## 1.11 Typography and colour for legibility
- **Must:** every text element must stay readable against everything behind it. Contrast is **≥ 4.5:1**, or **≥ 3:1** for large text, against the local background, measured on the actual frame [WCAG].
- Thin, unusual or display fonts may need more contrast than the threshold [WCAG].
- Meta: use "a modern, clean font in a large enough type size and a contrasting hue." Don't obstruct the visuals, and don't communicate too many messages at once [META-SZ].
- Captions: sans-serif is the broadcast and streaming default because simple shapes survive small sizes, compression and outlines. A serif can work for short, large lines [SUBMAGIC][NFX-EN].
- **Font count.** No authoritative numeric rule was found. Keep to the DNA's declared type roles (display, label, body), per the skill.
- **Brand consistency.** Google's ABCD: use brand colours and logo as supers. Integrating the logo into the story lifts ad recall [ABCD].

## 1.12 Audio: loudness, dialogue, music, SFX

| Target | Integrated | True peak | Source |
|---|---|---|---|
| Broadcast, Europe (EBU R128) | −23.0 LUFS (±0.2 LU in post) | ≤ −1 dBTP | [EBU-R128] |
| US broadcast (ATSC A/85, CALM Act) | −24 LKFS | — | [HSM-9] |
| Streaming speech (AES TD1008) | **−18 LUFS** speech, music −16; keep above −20 | ≤ −1 dBTP | [AES] |
| Apple Podcasts | −16 LKFS ±1 | ≤ −1 dBFS | [APPLE-POD] |
| Spotify playback normalisation | −14 LUFS (default) | 1 dB headroom kept | [SPOT] |
| YouTube, TikTok, Instagram | **not published.** YouTube is widely measured near −14 but unconfirmed | — | — |

- **Must:** true peak ≤ **−1 dBTP**. Every published spec agrees.
- **Must:** an integrated level inside the skill's own window. Social platforms publish nothing, so the skill's −14 to −15 LUFS is defensible. It sits louder than AES's speech recommendation and in line with Spotify-style −14.
- **Dialogue first.** Test the mix on a phone speaker; if you have to strain, duck deeper [JAP-DUCK].
- **Music under speech (ducking):**
  - A typical duck is **10–18 dB**; radio-spot practice puts music **15–20 dB** under the voice.
  - By music type: sparse **10–12 dB**, busy with drums **15–18 dB**, **music with singing ≥ 20 dB**, or avoid it under speech entirely [JAP-DUCK].
  - Ramps: in **200–500 ms**, out **600–1500 ms**. The music is already down when the first word lands [JAP-DUCK].
- **SFX** stay under the voice. That's the skill's existing rule (≤ +0 dB over the speech median, off the stressed syllable), and it agrees with the dialogue-first principle.
- **Sports and actuality natural sound.** NFL Films and ESPN prioritise authentic crowd and field sound, cleaned and timed to the current play [VARIETY-NFL].

## 1.13 Colour and grade basics
- **Order of work:** correct exposure and white balance first, then protect skin, then apply the creative look [HSM-CINE].
- **Skin.** On the vectorscope, skin of every ethnicity falls near the **skin-tone line (I-line)** between red and yellow. Skin varies mostly in brightness and saturation, not hue [HSM-CINE].
- **Rec.709 starting targets** (not rules) [HSM-CINE]:
  - Light skin 60–70%, medium 45–60%, darker 30–45%.
  - Diffuse white 85–95%, middle grey 40–45%.
  - Deep shadows with detail 5–15%.
- **Don't crush blacks or clip whites.** A flat line along the bottom or top of the waveform means detail is lost. Expose each person's skin for detail [HSM-CINE].
- **Legal range (8-bit).** Nominal 16–235. EBU R103 lets RGB and luma use the "preferred" 5–246 range; outside that is a gamut error [EBU-R103].
- **Must for delivery:** tag SDR as **BT.709** primaries, transfer and matrix, in **limited** range. YouTube assumes BT.709 when tags are missing and converts full range to limited [YT-ENC].

## 1.14 Delivery encoding and platform quality signals
- **YouTube's recommended upload bitrate** for 1080p at 24/25/30 fps SDR is **8 Mbps** video (about 60 MB per minute), H.264 High profile, closed GOP of half the frame rate, 4:2:0 [YT-ENC].
- **TikTok** In-Feed: 9:16 at ≥ 540×960 and ≥ **516 kbps** [TT-SPEC]. Its creative guide asks for at least 720p [TT-CBP].
- **Instagram** shows fewer reels that are **low-resolution, watermarked, muted, have borders, are mostly text, or were already posted** [IG-RANK]. **Must:** fill the whole 1080×1920 canvas, with no letterbox or pillarbox bars and no static frame borders.

## 1.15 Hooks and retention: what the platforms say
- **TikTok:**
  - Introduce your proposition in the **first 3 s (90 f)** and prioritise the hook in the first **6 s** [TT-CBP]. The Creator Academy says to hook within the first 5 s [TT-CA1].
  - Hook techniques it lists include teasing the end result and starting at the climax, then backtracking [TT-CA1]. Use drop-off analytics to find where viewers leave [TT-CA2].
  - Structure: Freytag's pyramid. "Motivation, obstacle, punchline." One key message at a time [TT-CA1].
- **YouTube Shorts.** Studio's **"Stayed to watch"** is the share of viewers who watch past a Short's opening seconds. "Engaged views" exclude loops [YT-AN][YT-SH]. The Shorts upload flow offers feedback on a video's "hook, pacing, and more" [YT-SH].
- **Instagram Reels.** Instagram predicts how likely you are to "watch a reel all the way through", reshare it and like it [IG-RANK]. Reels up to **3 min** are eligible for recommendation [IG-3MIN].
- **Google ABCD** [ABCD]:
  - Use tight framing on people or product at the open, with **more than two shots in the first 5 s (150 f)**.
  - If the video has people, open on them, ideally speaking to the viewer.
  - Introduce the brand within 5 s.

## 1.16 Lengths at a glance

| Context | Range | Source |
|---|---|---|
| YouTube Shorts | up to 3 min | [YT-SH] |
| Instagram Reels | up to 3 min, recommendation-eligible | [IG-3MIN] |
| TikTok in-feed ads | 21–34 s recommended (5–60 s) | [TT-SPEC-SEC], secondary |
| Podcast clips | 15–60 s (Riverside); Opus length presets run from under 30 s to 60–90 s | [RIV][OPUS-BLOG] |
| Vertical news (Reuters) | 25 s – 1.5 min; NBC: about a 5-line script for a 25 s video | [REUTERS-V][NBCU] |
| Marketing (Wistia) | <1 min awareness (52% average engagement); 1–5 min explain/demo | [WISTIA] |

---

# PART 2. Standards by video type

## 2.1 Podcast, interview and panel clips for social (top priority)

**Hook (0–3 s).**
- Open on the claim, question or most surprising line, with the speaker's face on screen. Say what the clip is about within 90 f [TT-CBP][ABCD][DESC-CLIPS].
- Cold-opening the payoff and then backtracking is a sanctioned hook ("start at the end or in the middle of the climax") [TT-CA1][NBCU].

**Structure.**
- Self-contained: hook → minimal context → payoff/insight. It must make sense with no episode context [DESC-CLIPS][RIV].
- Pick moments that represent the show's brand, not clickbait [DESC-CLIPS].

**Pacing.**
- Tighten gaps over about 1 s (the Descript tool works from a threshold) toward 0.2–0.6 s. Keep pauses that land a point [DESC-GAPS][JAP-SPEECH][HSM-5].
- Turn breaths down, don't delete them all. Never strip every pause [JAP-SPEECH].
- Any layout or speaker change holds at least **1.0–1.5 s (30–45 f)** (skill rule).
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
- **Must: no face cut off or masked.** No decorative window may crop a speaker's face. This is Rick's keyhole lesson, and it is also the 1.9 rule.
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

**Type and colour.** WCAG contrast. Caption family per DNA. Grade skin on the skin-tone line, with no crushed blacks (1.13).

**Audio.**
- Speaker dialogue is the mix. Integrated level inside the skill window, TP ≤ −1 dBTP.
- Music optional: ducked **10–18 dB** under speech, and none with vocals under speech [JAP-DUCK].
- Audio joins on pauses or plosives, with 20–50 ms crossfades [JAP-SPEECH].

**Transitions.** Hard cuts and layout changes. Never a dissolve inside a continuous exchange [HSM-3].

**Ending and loop.** End on the payoff line or the reaction to it. Don't trail into the next topic. NBC News moves a strong final moment to the front so the video "backtracks" to it, which loops cleanly [NBCU]. A loop is optional, and Shorts "engaged views" don't count loops [YT-AN].

**Length.** 15–60 s by default (30 and 60 are our job targets); up to 90 s when the story needs it, which Opus offers as a preset [RIV][OPUS-BLOG].

**Amateur mistakes:**
- Context-dependent clips.
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

**Must**
- Hook claim/question audible and on screen by 90 f.
- The clip stands alone.
- Active speaker's eyes and mouth visible, never cropped by the frame edge, a mask or a graphic, and inside y 288–1248.
- All text inside the universal safe box (1.9).
- Captions accurate (names verified) and synced within ±2 f.
- Caption line height ≥ 75 px (33), ≤ 3 lines, contrast ≥ 4.5:1 (3:1 for large), never over a mouth.
- Phrase-caption events ≥ 25 f.
- No mid-word cuts; audio joins crossfaded; room tone under gaps.
- Meaning preserved; no frankenbites; reactions not moved to other questions.
- TP ≤ −1 dBTP; integrated loudness inside the skill window.
- Full-canvas 1080×1920 at 30 fps, BT.709, limited range; no borders or bars.

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

## 2.2 Short vertical news and explainers (15–60 s)

**Hook.** The news itself in the first line and first frame: what happened, to whom. The proposition lands by 90 f [TT-CBP]. NBC News stresses getting to the point fast [NBCU].

**Structure.**
- The "three C's": **concise, casual, context** [NBCU].
  - About a **5-line script for a 25 s** text-on-screen video.
  - Keep the visuals, interviews and script aligned.
- Typical structure: what happened → why it matters / who's affected → the key fact or quote → what's next or the status as of a time.
- Reuters vertical runs **25 s – 1.5 min**, mostly captioned [REUTERS-V].

**Pacing.** Fast information rate with a varied rhythm. Hold any shot or card that carries a number or a quote long enough to read it at BBC rates (≈ 0.3 s/word).

**Layout.** Real footage at full bleed. Text cards and pull-quotes inside the safe box. Burned-in source lower-thirds avoided or covered (skill).

**Captions.** On by default: most mobile viewers can't hear. Reuters vertical video is mostly captioned [REUTERS-V]. Verbatim for quotes, and quotes only when really said (skill).

**Motion graphics.**
- A dateline or "as of" stamp. Source attribution on screen for every claim.
- Numbers on screen when they're spoken (skill).
- Maps or charts only when the line calls for one.
- One message per card [META-SZ].

**Audio.** Narration or a source voice leads. Music is low or absent; never vocals under narration [JAP-DUCK].

**Transitions.** Cuts. Supercuts and montages are acceptable news styles [NBCU].

**Ending.** The latest status, with an "as of" time. Loop-friendly endings are allowed [NBCU].

**Mistakes:**
- Burying the news.
- Unverified claims.
- Text cards too fast to read.
- Logo-first intros instead of the news (hook fast) [TT-CA1][TT-CBP].

**Must**
- What happened, stated in the first 90 f.
- Every on-screen fact sourced; hedges kept.
- "As of" time stamped on developing stories.
- Captions or text on screen for every spoken line.
- Text inside the safe box; readable at ≤ 180 wpm / 20 cps.
- TP ≤ −1 dBTP.

**Should**
- 25–60 s, with a 5-line script per 25 s.
- One idea per card.
- Native-feeling vertical footage.
- A loop or "backtrack" structure when the best moment is at the end.

**Freedom**
- Card design and type.
- How footage is staged (glass panels, prints, full bleed).
- Music choice and texture.

## 2.3 Sports highlights

*Sources here are thinner than for the other types; most rules come from editing fundamentals.*

**Hook.** Open on the decisive play or its biggest moment, then rewind to how it happened. This is the sanctioned "start at the climax" hook [TT-CA1].

**Structure.** Stakes → the build compressed → the decisive action expanded → the reaction or celebration held. This is the acceleration-and-release shape [HSM-5].

**Pacing.**
- Cut in movement, every time possible [DMYT][HSM-4].
- Action-sequence ASL is roughly 1.5–3 s [HSM-5].
- Speed up through resets; hold the payoff.
- Montage cuts follow the music's phrases and accents [HSM-7].

**Layout (9:16).**
- Track the ball or ball carrier, not a face. Use motion follow.
- Prefer stationary framing unless the play moves [AUTOFLIP].
- Keep the action and the ball inside the safe box when it matters.

**Continuity.** Keep screen direction (the 180° rule) so the attack direction never flips between angles. [JAP-FRAME][ADOBE-180]. If you must cross, show the move on camera (common practice; no specific source).

**Captions and graphics.**
- Score bug or clock only when it tells the story. Player name tags 90–180 f [SOM-L3].
- Replays: one purposeful replay from a different angle or slower. (Practice reported by blogs; no primary source found.)

**Audio.** Natural sound (crowd, impact, whistle) is the soul; NFL Films cleans and times crowd sound to the play [VARIETY-NFL]. Under a music montage, duck the music under commentary 10–18 dB [JAP-DUCK].

**Slow motion.** Only from real high-frame-rate sources. 60 fps played at 30 fps is 50% speed. Never fake slow motion with frame duplication; QA checks for duplicate frames during motion.

**Mistakes:**
- Starting at the beginning of a play with no stakes.
- Cutting away before the reaction.
- Flipped screen direction.
- Crop losing the ball.
- Graphics over the action.

**Must**
- Screen direction is consistent, or the crossing is motivated.
- The ball/subject stays in frame through tracked crops.
- Text inside the safe box.
- No duplicated-frame fake slow motion.
- TP ≤ −1 dBTP.

**Should**
- Open on the climax or stakes.
- Cut on motion.
- Hold the reaction.
- Natural sound up at peaks.
- Montage cut to musical phrases.

**Freedom**
- Broadcast-package look or not.
- Score-bug style.
- Speed ramps.
- Music genre.

## 2.4 Short documentaries (1–3 min)

**Hook.** The most compelling image or line first; the first 5 s decide whether anyone keeps watching [JAP-EDIT]. For YouTube, people on screen early and more than two shots in the first 5 s [ABCD].

**Structure.**
- Build the **radio cut** first: arrange the story from sound bites and narration only, and check it with your eyes closed [JAP-EDIT].
- Work from a paper edit and string-outs [HSM-8].
- A dramatic arc (Freytag-style rise, climax, resolution) [TT-CA1].

**Pacing.**
- Alternate intense and reflective passages [HSM-5].
- B-roll shows exactly what the line describes, never generic filler [JAP-FRAME].
- Show the speaker's face for the first few seconds of each bite before covering with B-roll [JAP-EDIT].

**Interviews.** Cover internal cuts with B-roll or cutaways [HSM-8][JAP-FRAME]. Otherwise use a deliberate, visible jump. Keep the meaning (1.5 ethics).

**Layout.** 16:9 docs: titles inside SMPTE title-safe (90%), action inside 93% [SMPTE-SEC]. 9:16 docs: the universal safe box.

**Captions.** Subtitles to Netflix/BBC rules (1.10). Names in lower thirds held 90–180 f [SOM-L3].

**Audio.**
- Music goes in last, under the narration, ducked [JAP-EDIT][JAP-DUCK].
- Room tone continuity [HSM-6].

**Transitions.** Cuts within scenes. Dissolves or fades only for time jumps and section breaks, used consistently [HSM-3].

**Grade.** Skin on the skin-tone line; no crushed blacks; archive matched to the grade (1.13).

**Ending.** A composed final image or line that resolves the arc.

**Mistakes:**
- Picking music first and cutting to it.
- Generic B-roll.
- A narration-only slideshow.
- No J/L cuts anywhere, so every scene change lands as a hard bump [JAP-EDIT].
- Frankenbites.

**Must**
- The story works as audio alone.
- Every interview edit covered, or a deliberate jump.
- Speaker's face seen before their voice plays over B-roll.
- No meaning-changing edits.
- No black or silent holes.
- Safe areas for the aspect.
- TP ≤ −1 dBTP.

**Should**
- J/L cuts at most scene joins (about 30 f).
- A strongest-bite open.
- Alternating tempo.
- Lower thirds 90–180 f.

**Freedom**
- World design, camera grammar, archive treatment, score.

## 2.5 Music and celebrity culture explainers
**Hook.** A recognisable face or sound in the first 90 f. People on screen early help [ABCD].

**Structure.** Same as 2.4, plus a timeline spine (dates on screen when spoken, per the skill).

**Pacing.** Cut to the song's structure: phrases, downbeats, accents. Hold a key image across a phrase [HSM-7]. One beat = 60 ÷ BPM s; at 96 BPM a beat is 0.625 s ≈ 19 f [HSM-7].

**Audio.**
- **Must:** song vocals never sit under narration. Duck a vocal track 20 dB or more, cut to an instrumental section, or pause the narration while the hook plays [JAP-DUCK].
- Music inserts enter and leave on phrase boundaries (skill RETURN rule).

**Captions.** Lyrics shown only when they are the point. Speech captions per 1.10.

**Graphics.** Names, dates, chart or stream numbers on screen with sources (skill facts table).

**Mistakes:**
- Talking over a vocal.
- Cutting mid-bar.
- Unsourced gossip as fact.
- AI images presented as real people (skill honesty rule).

**Must**
- No vocals under speech, or duck ≥ 20 dB.
- Inserts on phrase boundaries.
- Facts sourced and hedged.
- Safe box; TP ≤ −1 dBTP.

**Should**
- Montages cut to musical phrases.
- A recognisable face or sound by 90 f.

**Freedom**
- Era-specific art direction, type and colour.

## 2.6 Product and brand explainers
**Hook.** Tight framing of people or product at the open. More than two shots in the first 5 s. Brand or product introduced within 5 s [ABCD]. TikTok: proposition in the first 3 s [TT-CBP].

**Structure.**
- Hook → unique selling points → a clear, specific CTA ("visit site," "sign up") [TT-CBP][ABCD].
- A simple, focused, tangible message works across the funnel [ABCD].
- Put the most important information in the first half [WISTIA].

**Pacing.** Short and dense. <1 min for social; 1–5 min for demos [WISTIA].

**Layout.** Product and UI legible at phone scale, inside the safe box. Don't hard-code a CTA button where the platform draws its own (the bottom safe-zone margin) [TT-SZ][META-RG].

**Captions and graphics.**
- Design for silent viewing: the CTA and the offer both **audible and visible** [ABCD].
- Logo as a super or integrated into the story [ABCD].

**Audio.** A brand mention by someone on screen beats plain voice-over [ABCD]. Music ducked under the VO.

**Mistakes:**
- A logo-first slow intro.
- A vague CTA.
- UI too small to read.
- Text over the platform CTA zone.
- Too many messages [META-SZ].

**Must**
- Product or brand by 150 f.
- A specific CTA, both seen and heard.
- All text and UI readable (contrast, ≥ 40 px cap height labels) and inside the safe box.
- TP ≤ −1 dBTP.

**Should**
- Under 60 s for social.
- People on screen.
- One message.
- Key info in the first half.

**Freedom**
- 3D or app-window staging, type, palette, music, mascot or character.

## 2.7 Other kinds the skill lists
These map onto the types above.
- **True crime, history, biography:** 2.4.
  - Hedges kept; recreations labelled (skill honesty rule).
  - No frankenbites [HSM-8].
- **Data story:** 2.4 plus 2.2. Every on-screen number sourced; hold data cards until read (≈ 0.3 s/word); one data point per card.
- **Explainer / tutorial:** 2.2 plus 2.6.
  - Tease the end result first, then show the process [TT-CA1].
  - Wistia: 1–5 min for education [WISTIA].
- **SaaS demo, launch/ad, promo, logo sting:** 2.6.
- **Social short / kinetic type:** 2.2 caption and safe-zone rules. Text overlays capped at BBC/Netflix reading rates unless the words are also spoken.

---

# PART 3. Pre-delivery craft checklists (add to QA)
Run on decoded frames at 1080×1920 **and** on the 480 px copy. Overlay the universal safe box (1.9) on the contact sheet: `x 120–888, y 288–1248, lower-right column x ≤ 780 below y 780`.

### All types (C0)
- [ ] All text, logos and captions inside the universal safe box on every sampled frame.
- [ ] No letterbox or pillarbox bars or static borders; the full canvas is used.
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
- [ ] Integrated loudness inside the skill window; TP ≤ −1 dBTP; dialogue intelligible on a phone speaker.
- [ ] Music under speech ducked ≥ 10 dB (≥ 20 dB with vocals); ramps 200–500 ms in, 600–1500 ms out.
- [ ] No dissolve inside continuous time. Transitions are used with consistent meaning.
- [ ] Colour:
  - [ ] skin near the skin-tone line;
  - [ ] no flat crushed or clipped waveform lines on faces;
  - [ ] 8-bit RGB and luma inside 5–246;
  - [ ] tagged BT.709, limited range.
- [ ] Meaning preserved in every edited quote.

### Podcast / interview / panel (C1)
- [ ] Claim or question heard and seen by 90 f; the clip stands alone without the episode.
- [ ] Active speaker's eyes and mouth visible, uncropped, unmasked, inside y 288–1248, on every sampled frame.
- [ ] Layout and speaker changes hold ≥ 30–45 f. The crop is stationary unless the subject moves; no jitter on a 0.1 s strip.
- [ ] Screen direction preserved in splits; no mirrored faces.
- [ ] Reaction cuts land after punchlines, not during them.
- [ ] Gaps > 1 s shortened, but not every pause removed.
- [ ] Name tags only for verified names, 90–180 f.
- [ ] Ends on the payoff or reaction.

### News / explainer (C2)
- [ ] What happened, stated by 90 f.
- [ ] Every on-screen fact has a source; developing stories carry an "as of" time.
- [ ] Every card readable at ≤ 180 wpm / 20 cps.

### Sports (C3)
- [ ] Screen direction is consistent.
- [ ] The ball or subject stays in the crop.
- [ ] Slow motion comes only from high-frame-rate sources (mpdecimate shows no duplicates during motion).
- [ ] The reaction is held. Graphics stay off the action.

### Documentary (C4)
- [ ] Radio cut makes sense with picture off.
- [ ] Each speaker's face is shown before their voice plays over B-roll.
- [ ] B-roll matches the words.
- [ ] No black or silent holes.
- [ ] Title-safe (16:9: 90%) or the safe box (9:16).

### Music / culture (C5)
- [ ] No sung vocal under narration (or ducked ≥ 20 dB).
- [ ] Inserts on phrase boundaries.
- [ ] Dates and figures are on screen and sourced.

### Product / brand (C6)
- [ ] Brand or product by 150 f.
- [ ] More than two shots in the first 5 s.
- [ ] The CTA is specific, seen and heard.
- [ ] UI and text are readable on the 480 px copy, outside the platform CTA zone.

---

## Source URLs (labels used above)
- [MURCH] https://stavry.github.io/docs/in-the-blink-of-an-eye.pdf (Murch, *In the Blink of an Eye*, Rule of Six section)
- [DMYT] https://www.nyfa.edu/student-resources/what-you-can-learn-from-edward-dmytryks-7-rules-of-cutting/ · https://www.provideocoalition.com/seven_rules_for_film_and_video_editors/
- [CUTTING] https://jordandelong.com/pubs/2011/QuickerFasterDarker.pdf (Cutting, DeLong & Brunick, *Quicker, faster, darker*, i-Perception 2011)
- [HSM-3] https://www.hsmuniversity.org/us/course/film-220-film-editing/lesson-3-cuts-transitions-and-timecode
- [HSM-4] https://www.hsmuniversity.org/us/course/film-220-film-editing/lesson-4-continuity-editing-in-practice
- [HSM-5] https://www.hsmuniversity.org/us/course/film-220-film-editing/lesson-5-rhythm-pacing-and-timing
- [HSM-6] https://www.hsmuniversity.org/us/course/film-220-film-editing/lesson-6-editing-dialogue-scenes
- [HSM-7] https://www.hsmuniversity.org/us/course/film-220-film-editing/lesson-7-montage-parallel-action-and-non-linear-structure
- [HSM-8] https://www.hsmuniversity.org/us/course/film-220-film-editing/lesson-8-editing-documentary-and-unscripted-material
- [HSM-9] https://www.hsmuniversity.org/us/course/film-220-film-editing/lesson-9-sound-editing-for-picture-editors
- [HSM-CINE] https://hsmuniversity.org/us/course/cine-202-exposure-dynamic-range-and-image-pipelines/lesson-3-waveforms-histograms-and-vectorscopes
- [JAP-FRAME] https://jeffapierson.com/journal_tools/training/09-video-production/05-framing-and-coverage.html
- [JAP-EDIT] https://jeffapierson.com/journal_tools/training/09-video-production/06-editing-on-a-timeline.html
- [JAP-SPEECH] https://jeffapierson.com/journal_tools/training/08-audio-production/03-editing-speech.html
- [JAP-DUCK] https://jeffapierson.com/journal_tools/training/08-audio-production/05-music-beds-and-ducking.html
- [ADOBE-180] https://www.adobe.com/creativecloud/video/discover/what-is-the-180-degree-rule.html
- [ADOBE-JL] https://www.adobe.com/creativecloud/video/post-production/cuts-in-film/l-and-j-cut.html
- [WIKI-30] https://en.wikipedia.org/wiki/30-degree_rule
- [BBC-BITE] https://www.bbc.co.uk/bitesize/guides/zxdmmnb/revision/1
- [ITU-1359] https://www.itu.int/rec/R-REC-BT.1359-1-199811-I/en
- [NFX-G] https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements
- [NFX-EN] https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide
- [NFX-T] https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines
- [BBC] https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/ (Subtitle Guidelines v1.2.5)
- [FCC] https://www.fcc.gov/consumers/guides/closed-captioning-television
- [DCMP] https://dcmp.org/learn/599-captioning-key---elements-of-quality-captioning
- [WCAG] https://www.w3.org/TR/WCAG22/ · https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- [TT-SZ] https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads?lang=en (In-Feed Standard safe-zone PNG, measured by us)
- [TT-SPEC] same page (specs, caption length moves the safe zone)
- [TT-CBP] https://ads.tiktok.com/help/article/creative-best-practices?lang=en
- [TT-CA1] https://www.tiktok.com/creator-academy/en/article/captivating-content-with-great-storytelling
- [TT-CA2] https://www.tiktok.com/creator-academy/article/Understanding-and-engaging-with-your-audience
- [TT-SPEC-SEC] https://www.tt123.com/adshelp/BWbJqYof (secondary mirror of TikTok ads help)
- [META-RG] https://www.facebook.com/business/ads-guide/update/image/instagram-reels
- [META-SZ] https://tl-ph.facebook.com/business/help/980593475366490
- [IG-RANK] https://about.instagram.com/blog/announcements/instagram-ranking-explained
- [IG-3MIN] https://creators.instagram.com/blog/the-latest-with-instagram?locale=en_US
- [GADS-V] https://support.google.com/google-ads/answer/9128498?hl=en
- [YT-SH] https://support.google.com/youtube/answer/10059070
- [YT-AN] https://support.google.com/youtube/answer/12220281
- [YT-ENC] https://support.google.com/youtube/answer/1722171
- [ABCD] https://services.google.com/fh/files/misc/youtube_google_abcd_reference_guide_en.pdf
- [AES] https://aes.org/wp-content/uploads/2026/10/20210924_TD1008_v3.13.pdf
- [EBU-R128] https://tech.ebu.ch/docs/tech/tech3343v4_1.pdf
- [EBU-R103] https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r103v2_0.pdf
- [APPLE-POD] https://podcasters.apple.com/support/893-audio-requirements
- [SPOT] https://support.spotify.com/us/artists/article/loudness-normalization/
- [AUTOFLIP] https://opensource.googleblog.com/2020/02/autoflip-open-source-framework-for.html
- [OPUS-LAYOUT] https://help.opus.pro/docs/article/layout-and-reframing
- [OPUS-BLOG] https://www.opus.pro/blog/how-to-edit-podcast-shorts-like-a-pro-using-opus-clip-pc-mac
- [RIV] https://riverside.com/blog/podcast-clips
- [DESC-CLIPS] https://www.descript.com/blog/article/how-to-choose-clips-for-social-media
- [DESC-EDIT] https://www.descript.com/blog/article/podcast-editing-tips
- [DESC-GAPS] https://help.descript.com/script-editing/shorten-word-gaps
- [SUBMAGIC] https://www.submagic.co/blog/best-font-for-subtitle
- [SOM-L3] https://schoolofmotion.com/blog/sports-lower-thirds
- [REUTERS-V] https://reutersagency.com/vertical-video
- [NBCU] https://nbcuacademy.com/tiktok-social-media/
- [WISTIA] https://wistia.com/blog/optimal-video-length
- [VARIETY-NFL] https://variety.com/2020/tv/news/nfl-crowd-sounds-tv-football-espn-1234779352/
- [SMPTE-SEC] https://postproduction.studio/en/tools/safe-areas (secondary summary of SMPTE ST 2046-1)
- [CADENUS] https://cadenus.io/resources/blog/instagram-safe-zone/ (secondary measure of Meta's template)
- [SOCIALYNC] https://www.socialync.io/tools/safe-zones/youtube-shorts (secondary reading of Google's diagram)
- [KREATLI] https://kreatli.com/safe-zone-checker/youtube-safe-zone-checker (secondary; organic Shorts UI)
