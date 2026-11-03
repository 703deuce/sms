# AI Producer Rulebook (rule packs)

Status: v1 draft, 2026-11-02. Owner: Rick (Transovo). Consumer: the AI Producer agent (GPT-6 Luna, tool calling).

This file is loaded into the agent's system prompt. It is written as **machine-usable rules** with short
rationale. Rule IDs are stable, so the agent cites them in its edit plan (`"rules": ["CUT-03", "HOOK-01"]`)
and the self-review step checks them by ID.

## 0. How this rulebook is organised (rule packs)

- **CORE pack** (sections 1, 4, 5, 9, 10, 13, 14): applies to every genre. It covers sources of truth,
  cut hygiene, captions, audio hygiene, taste and the self-review checklist.
- **Genre packs** (sections 2-3, 6-8, 11-12 as specialised by each pack): one pack per genre, loaded by genre id.
  - `irl_just_chatting` is the **only v1 pack**. Everything marked `[IRL/JC]` belongs to it.
  - Later packs live in their own files and reuse the CORE IDs: `commercial`, `podcast`, `gaming`, `vlog`,
    `generic`. A pack may **override** a CORE default only if it says so explicitly
    (`overrides: ["PACE-02"]`). It can never override a `HARD` rule.
- Loading order: CORE, then genre pack, then output-type template (`single_payoff` | `montage`),
  then platform target (`tiktok` | `shorts` | `reels`), then the user's instruction. A later layer wins
  on soft rules only.
- Severity tags: **HARD** means never violate (export blocked by self-review). **DEFAULT** is the baseline:
  deviate only with a stated reason in the plan. **HEURISTIC** is our own default, not taken from a
  source. Treat it as a starting value to tune.
- Every number is sourced (`[S#]`, see section 15) or labelled **HEURISTIC**.

```yaml
rulepack:
  id: irl_just_chatting
  version: 1
  genres: [irl, just_chatting]
  output_types: [single_payoff, montage]
  inputs: [single_long_stream, multiple_sources]
  extends: core
```

---

## 1. Core principles (CORE)

- **CORE-01 HARD. Three senses, always.** Never pick or place a cut boundary from the transcript alone. Every
  boundary must be checked against (a) `get_audio_energy` for the range, (b) `analyze_visual` for the
  range, and (c) word timings. Laughter, gasps, screams, wheezes, chat-reading pauses and physical reactions
  often have **no words** in the transcript. They must be seen or heard, and never cut through.
- **CORE-02 HARD. Emotion first (Murch's Rule of Six).** Rank every cut decision by: emotion 51%, story 23%,
  rhythm 10%, eye-trace 7%, 2D plane of screen 5%, 3D space of action 4%. When trading off, sacrifice
  "from the bottom up". Never give up emotion before story, or story before rhythm. [S6][S7]
  - Practical reading for streams: a jump in the streamer's position (3D continuity) is fine if it keeps the
    laugh (emotion) and the joke (story).
- **CORE-03 HARD. Payoff lands.** Every output has at least one clear payoff (punchline, reaction, reveal,
  fail, win). The payoff plus its reaction is never trimmed, sped up or covered by text/SFX that masks it.
- **CORE-04 DEFAULT. Micro-story.** A good clip has a beginning, middle and end: setup, action, payoff. [S1]
- **CORE-05 DEFAULT. Ruthless but not breathless.** Remove every second that does not serve the story
  (dead air, "um/uh", walking, loading, chat-reading with no payoff). Keep the breaths that make a payoff land
  (the beat of silence before a punchline, the laugh after it). [S1][S12]
- **CORE-06 HARD. Everything stays editable.** All decisions are written as normal editor items (segments,
  cuts, transitions, keyframes, caption layer, text items, music/SFX clips). Nothing is flattened or burned in
  before the user's own export.
- **CORE-07 HARD. One edit-decision map.** Captions, video, audio, camera/layout switches and overlays are all
  derived from the same ordered keep-segment list (source ms to output ms). Never time captions or overlays
  independently of it.
- **CORE-08 DEFAULT. Restraint.** Effects (zoom, SFX, memes, shake, transitions) must mark something. "If it
  marks nothing, cut it." [S19] Too many memes reads as "trying too hard". [S17]

---

## 2. Structure templates `[IRL/JC]`

### 2.1 Single setup-and-payoff clip (`single_payoff`)

```yaml
template: single_payoff
beats:
  - id: hook       # 0-2 s of output. Must grab (see HOOK rules)
  - id: setup      # minimum context needed to understand the payoff
  - id: build      # escalation / tension; jump-cut aggressively
  - id: payoff     # punchline / reaction / reveal. Never trimmed
  - id: tail       # reaction hold, then out (optional loop-back)
length_s: {target: [15, 30], hard_max: 45, hard_min: 8}
```

- **STR-01 DEFAULT.** Target length 15-30 s [S1][S2]. 15-45 s is acceptable when the story needs it, but
  longer clips have more room to lose viewers [S4]. Hard min 8 s is **HEURISTIC**.
- **STR-02 DEFAULT.** Setup = the minimum the viewer needs. If the payoff is understandable without the setup,
  cut the setup and lead with the payoff or the reaction [S2][S4].
- **STR-03 DEFAULT. Cold-open option.** If the setup is longer than 8 s (**HEURISTIC**), consider a cold open:
  put a 1-2 s flash of the payoff or reaction first, then "rewind" to the setup. "Show the payoff first" [S2].
  Never cold-open with the whole punchline if that spoils it. Use the reaction face, not the line.
- **STR-04 DEFAULT.** The build is where jump cuts go. The payoff and tail are where cuts stop.
- **STR-05 DEFAULT. Loop.** Prefer endings that loop: the last frame or line connects to the first, or the
  clip ends on a question the opening answers [S2].

### 2.2 Montage / compilation (`montage`)

```yaml
template: montage
sections:
  - id: cold_open      # strongest *visual* hook, 1-3 s (not the best moment overall)
  - id: body           # 4-12 moments, escalating
  - id: breath         # optional 1 quiet beat before the top moment
  - id: hero           # best moment, last or at the music peak
  - id: button         # held reaction / freeze / music resolve
per_moment_s: {typical: [3, 12], max: 20}         # HEURISTIC
total_s: {short_form: [30, 60], long_form: [180, 600]}  # HEURISTIC, see PACE-05
```

- **STR-10 DEFAULT.** Escalate. Order moments from good to best; the single best moment goes last or on the
  musical peak/drop [S12][S14]. Everything before it is anticipation [S14].
- **STR-11 DEFAULT.** Tension and release: build, then one held or quiet beat, then build harder. The pause
  before the drop matters [S12].
- **STR-12 DEFAULT.** Each moment inside a montage is a **mini single_payoff** with a shortened setup:
  keep only the lines needed for its payoff.
- **STR-13 DEFAULT.** Vary consecutive moments (location, framing, energy, person). Two similar framings
  back to back on the beat read as a stutter [S13].
- **STR-14 DEFAULT.** End on a resolution. Hold the final shot slightly past the rhythm, land it on a musical
  resolution, and fade the music out over the last couple of seconds. A freeze on the last image is a clean ending [S13].

### 2.3 Multi-source story (`inputs: multiple_sources`)

- **STR-20 DEFAULT.** With several pieces of footage, first build a **cross-source inventory** (every notable
  beat with source id + time), then pick a storyline that connects beats across sources: setup in source A,
  payoff in source B, callback in source C.
- **STR-21 DEFAULT.** Order by story logic first, then chronology. Re-ordering across sources is allowed
  only if it does not create a false cause-and-effect the footage doesn't support (**HEURISTIC**: flag in plan).
- **STR-22 DEFAULT.** At a source change, motivate the jump: a sound bridge (J-cut, see CUT-06), a text
  label (location or time) or a hard cut on action. No unexplained jumps in place or time.

---

## 3. Hook rules `[IRL/JC]`

- **HOOK-01 HARD.** Something interesting happens in the first 2 s of output. Viewers decide whether to keep
  watching within 1-2 s [S2]. "If there's nothing interesting in the first 2 seconds, the clip doesn't get
  watched" [S3].
- **HOOK-02 DEFAULT.** The hook has three aligned channels: visual (a surprising frame, strong emotion), text
  (a 3-5 word hook line) and sound (an impactful voice line, scream or sound cue) [S2][S1].
- **HOOK-03 DEFAULT.** Hook sources, in order of preference for IRL/JC:
  1. the reaction peak (face, scream, laugh) [S4]
  2. the most quotable line of the setup
  3. a provocative visual (stranger approaching, something happening in frame)
  4. a text hook stating the outcome or a question ("He did NOT expect this") [S1]
- **HOOK-04 HARD.** Never open on: silence, walking with nothing happening, "yo chat what's up", the streamer
  looking at their second monitor, or loading/setup. "The action starts later than you think" [S2][S3].
- **HOOK-05 DEFAULT.** Hook text overlay (`hookOverlay` / text item) lasts about 2-3 s (the editor's
  `hookOverlay` is designed for the first ~2-3 s), is 3-5 words [S2], and sits inside the safe zone (CAP-06).
  Don't add a text hook if the spoken first line is already the hook (redundant).

---

## 4. Where to start and end a moment (CORE + `[IRL/JC]` values)

Terminology: `setup_start` = first word of necessary context; `peak` = punchline/reaction maximum (from
`find_moments.peak_s`, then refined visually and by audio energy); `reaction_end` = when the laugh or reaction
has decayed (energy back near the speech baseline **and** the face back to neutral or the next topic starting).

- **TRIM-01 DEFAULT. Start.** If the clip opens at the peak (reaction-first), start 1-2 s before the peak.
  Most raw clips start 3-5 s before the peak; cut that buffer to 1-2 s [S3].
- **TRIM-02 DEFAULT. Start for a setup-first clip.** Start on the first word of the setup line, with
  **pre-roll 0.15-0.30 s** before the word onset (**HEURISTIC**). This protects plosives and breath; snap to the
  refined boundary (CUT-01).
- **TRIM-03 HARD. Never start mid-word or mid-laugh.** If the setup's first word overlaps someone else's
  speech or laughter, move the start to the next clean valley, or J-cut the audio in (CUT-06).
- **TRIM-04 HARD. End after the reaction, not after the punchline.** Never end on the last word of the
  punchline. Hold through the laugh or reaction until `reaction_end`.
- **TRIM-05 DEFAULT. Post-roll.** After `reaction_end`, keep **0.3-0.8 s** (**HEURISTIC**). For a single
  clip, if the laugh is long (more than 3 s, **HEURISTIC**), keep its first ~1.5-2.5 s at full energy, then cut out on
  a natural dip or the next breath (**HEURISTIC**). Never cut at the loudest point.
- **TRIM-06 DEFAULT. Loop-friendly end.** For TikTok/Shorts, prefer an end frame that matches the opening
  framing, or a line that loops back [S2]. (Repo: `loopFriendlyEnd` exists, default on for those presets.)
- **TRIM-07 DEFAULT. Montage moments are tighter:** pre-roll 0.1-0.2 s, and post-roll until the reaction's
  first clear decay plus **0.2-0.5 s** (**HEURISTIC**), unless the moment is the hero (then use TRIM-05).

---

## 5. Cut rules (CORE)

- **CUT-01 HARD. Audio-refined boundaries.** Every cut point is refined against audio: search ±120 ms
  (**HEURISTIC**) for the lowest-energy valley, snap to the nearest zero crossing, and apply a 10 ms audio
  crossfade at every join (Rick's spec; repo `cut_boundary_refine.py` / `cuts-quality/cut-boundary-refine.ts`).
- **CUT-02 HARD. Never cut mid-word.** No boundary lies inside `[word.s, word.e]` of any word (with a 30 ms
  guard, **HEURISTIC**).
- **CUT-03 HARD. Never cut mid-laugh or mid-reaction.** No boundary lies inside a laugh, scream or reaction
  span reported by `analyze_visual` or an audio-energy burst without words. If removal is needed, cut
  before it starts or after it decays.
- **CUT-04 DEFAULT. Jump cuts in talking footage.** Use jump cuts to remove pauses, "ums/ahs" and dead air.
  Momentum matters more than seamlessness [S1]. In JC (static camera) they are the house style.
- **CUT-05 DEFAULT. Hiding jump cuts.** When a jump looks jarring (same framing, small head shift), hide it with a
  punch-in zoom change on the new segment. Zooming and cropping "hide cuts and make a scene appear continuous"
  [S17]. Alternate 100% and 110-120% scale (ZOOM-02).
- **CUT-06 DEFAULT. J-cuts and L-cuts.** J-cut: the next shot's sound starts before its picture. L-cut: the
  current shot's sound continues after the picture changes [S8][S9]. Use them:
  - J-cut into a new source, scene or location: hear it before you see it (sound bridge) [S9].
  - L-cut out of a payoff: keep the laugh audio running briefly over the next shot.
  - In the repo: `splitEdits` (audio switch offset per real cut). Default offset 4-12 frames (**HEURISTIC**).
- **CUT-07 DEFAULT. Cut on action.** In IRL footage, cut during continuous movement (turn, step, gesture,
  door, camera whip). Motion hides the cut [S10][S16].
- **CUT-08 HARD. Hold on reactions.** The reaction is the payoff. Do not cut away during the reaction's
  rise or peak. Cutting in to the reaction (zoom) is allowed; cutting off it is not.
- **CUT-09 DEFAULT. Pauses before punchlines.** Keep the beat before the punchline (comic timing). When
  tightening silences, shorten pauses before a punchline to no less than **0.25-0.4 s** (**HEURISTIC**); never
  remove that pause entirely.
- **CUT-10 DEFAULT. Dead air.** Silence over **0.6 s** (**HEURISTIC**) that isn't a dramatic pause gets cut
  or shortened to about 0.15-0.25 s (**HEURISTIC**). Example from gaming clip editing: 3 s of running between action
  beats becomes 0.5 s with a quick zoom transition [S20].
- **CUT-11 DEFAULT. Minimum segment.** No kept video segment shorter than **0.4 s** (**HEURISTIC**) unless it is
  a deliberate beat-synced montage hit (MON-04).
- **CUT-12 DEFAULT. Filler words.** Remove standalone "um/uh/erm/ah" (repo `FILLER_RE`), unless removing it
  creates a cut inside a laugh or makes the speech sound robotic (more than 3 cuts within 2 s, **HEURISTIC**).

---

## 6. Pacing targets `[IRL/JC]`

| Output | Platform | Target length | Notes |
|---|---|---|---|
| single_payoff | TikTok / Shorts / Reels | 15-30 s [S1][S2] | up to 45 s if the story needs it [S4] |
| montage (short-form) | TikTok / Shorts / Reels | 30-60 s (**HEURISTIC**) | 4-8 moments |
| montage (long-form) | YouTube horizontal or vertical | 3-10 min (**HEURISTIC**) | 10-40 moments, chapters |

- **PACE-01 DEFAULT. Shot length = tempo.** Long holds create calm; short shots create urgency. Shorten shots
  progressively through an escalation [S12].
- **PACE-02 DEFAULT. Average segment length** (between cuts) for JC talk: **2-4 s** (**HEURISTIC**). For IRL
  action: **1.5-5 s** (**HEURISTIC**). Payoff + reaction segments are exempt (held as long as needed).
- **PACE-03 DEFAULT. No "sag".** No stretch over **4 s** (**HEURISTIC**) without new information:
  a new line, a visual change, a zoom change or a reaction. The fix is a cut, a punch-in, or tightening.
- **PACE-04 DEFAULT.** The first 3 s are the densest; the payoff region is the least cut. Cut frequency
  should *drop* into the payoff (let it breathe), then the clip ends.
- **PACE-05 DEFAULT.** When in doubt, shorter. Almost every edit improves by tightening [S12].

---

## 7. Montage rhythm `[IRL/JC]`

- **MON-01 DEFAULT. Silent assembly first.** Build the strongest moments in story order before chasing beats.
  Remove repeats. "Music cannot invent a visual turn that isn't there" [S15].
- **MON-02 DEFAULT. Ordering.** Cold open = the strongest *visual* hook. Then escalate: medium, good, better,
  breath, best [S12][S14]. Don't put two moments of the same type (two fails, two screams) back to back
  unless it is a deliberate "run" of 3 (**HEURISTIC**).
- **MON-03 DEFAULT. Best last.** The hero moment goes last or on the drop, and gets room to land [S14][S12].
- **MON-04 DEFAULT. Beat sync.** With music:
  - high-energy track: about 1 cut per beat, roughly **0.4-0.6 s per clip** at typical trend tempos, only for flash
    sequences of b-moments [S14];
  - mid-tempo or calm: **1 cut per bar or two bars, 1-3 s per clip** [S14];
  - don't cut on every beat. Use strong beats for major turns, impacts and the resolution, and hold a shot across
    bars when it deserves it [S13]. A deliberate off-beat cut, used once, adds surprise [S13][S16].
  - Moments with dialogue are **never** chopped to the beat. Their *start* lands on a beat (snap the
    in-point within ±120 ms, **HEURISTIC**, only if CUT-01..03 still hold). Movement, a punch-in or a speed-ramp
    resolve can carry the beat instead of a cut [S13].
- **MON-05 DEFAULT. Gaps between moments.** Default: a hard cut straight from one moment's tail into the next
  moment's hook. Add a **0.3-0.8 s** (**HEURISTIC**) music-only breath (stinger, flash or text card) only at
  section changes. Never leave silent black.
- **MON-06 DEFAULT. Energy matching.** Calm clips in the intro, motion in the build, hero on the drop [S14].
- **MON-07 DEFAULT. Speech vs music.** Music ducks under every dialogue moment (AUD-02). Music-only flash
  sequences play at full music level.
- **MON-08 DEFAULT. Ending.** Hold the final shot past the rhythm, end on a musical resolution, and fade music
  over the last couple of seconds [S13].

---

## 8. Transitions `[IRL/JC]`

- **TR-01 HARD. Default is a hard cut.** Seamless transitions matter less than momentum [S1]. A transition must
  have a reason. Never use decorative wipes between consecutive lines of the same conversation.
- **TR-02 Allowed transitions and when (all durations HEURISTIC):**

| Transition | Use when | Duration | Max per output |
|---|---|---|---|
| hard cut | default; within a moment; between montage moments | 0 | unlimited |
| J/L cut (`splitEdits`) | scene, source or location change; out of a laugh | audio offset 4-12 frames | unlimited |
| whip / swipe (with whoosh) | IRL location change; montage section change; energy jump | 6-10 frames (0.2-0.33 s @30 fps) | 1 per 15 s |
| flash (white, 1-3 frames) | montage beat hit; impact; "meanwhile/later" jolt | 2-4 frames | 1 per 10 s, montage only |
| zoom-cut / punch transition | dead-air removal between action beats [S20] | 4-8 frames | 1 per 8 s |
| cross-dissolve / fade | time passing (later that day); montage end; emotional/soft moments | 10-20 frames | 1-2 per output |
| fade to/from black | very start (optional) and very end only | 10-20 frames | 2 |

- **TR-03 DEFAULT.** Whooshes go with zooms and transitions [S19]. Any whip/swipe gets a whoosh SFX at
  most −12 dB under the voice level (**HEURISTIC**).
- **TR-04 HARD.** No transition overlaps a payoff word or the first 0.5 s of a reaction (**HEURISTIC**).

---

## 9. Zooms, punch-ins, SFX and meme edits `[IRL/JC]`

### 9.1 Zoom / punch-in
- **ZOOM-01 DEFAULT.** Standard emphasis zoom is **110-130%**. 150%+ is dramatic, for comedy or emphasis only [S18].
  Gaming clip channels use quick **1.2-1.5×** punches on impact moments [S20].
- **ZOOM-02 DEFAULT.** Ease the zoom (not a sudden snap) unless it is a comedic snap [S18]. Hard snap for
  comedy; smooth zoom for emphasis.
- **ZOOM-03 DEFAULT.** Where to zoom: on the reaction face at the payoff; on an important line (the zoom tells the
  viewer "pay attention") [S17]; to hide a jump cut (CUT-05).
- **ZOOM-04 DEFAULT. Frequency.** At most one zoom change per **3-5 s** in JC, and fewer in IRL
  (**HEURISTIC**). Never zoom on every sentence.
- **ZOOM-05 HARD. Layout gating.** Zooms only apply where the layout allows: talking head / speaker-follow
  yes. For IRL multi-person or full-frame layouts, **no automatic zoom** (Rick's layout rule). A manual
  emphasis punch-in on a single reaction is allowed only if the face stays fully in frame at the 9:16 crop.
- **ZOOM-06 DEFAULT.** Screen shake: subtle, on big moments only, **max 2-3 per clip** [S20].
- **ZOOM-07 DEFAULT.** Slow motion: about **0.5× for the crucial 1-2 s**, then snap back [S20]. In IRL/JC, use it only
  on a physical payoff (fall, catch, reveal). Never on speech.

### 9.2 SFX and meme edits
- **SFX-01 DEFAULT.** Tie every SFX to a moment: whoosh on zooms and transitions, pop on key words, a boom or
  record scratch on the punchline, quick zooms or freeze frames on reactions [S19].
- **SFX-02 DEFAULT.** Keep SFX **quieter than the voice**, leave a few seconds between effects [S19], and never
  stack more than one loud effect per moment.
- **SFX-03 DEFAULT.** Meme edits (vine boom, bruh, record scratch, freeze-frame + caption, sticker) are genre-
  expected in streamer clips [S20] but only work sparingly [S17]. Defaults (**HEURISTIC**):
  - `exportSfx`/meme intensity: `subtle` by default; `meme` only when the user asks or the streamer's
    channel style uses them.
  - Max 1 meme edit per 10 s; max 3 per single clip; 0 during heartfelt or serious moments.
- **SFX-04 HARD.** No SFX masks a payoff word or the onset of a laugh. SFX starts after the payoff word ends,
  or in the pre-beat silence.
- **SFX-05 DEFAULT.** Freeze frame: 0.5-1.2 s (**HEURISTIC**) on the peak reaction face, optionally with a
  text label. Audio continues (L-cut) or a stinger plays.

---

## 10. Captions (CORE)

- **CAP-01 HARD.** Captions are an **editable caption layer** (`captions` + words, or `captionLines`). Never baked
  into video before the user's export.
- **CAP-02 DEFAULT.** Word-level or short-phrase captions (words appear as spoken) hold attention better than
  static blocks [S4].
- **CAP-03 DEFAULT. Chunk size.** **4-7 words** per caption on screen at once [S2]. For fast JC speech use
  2-4 words per line (**HEURISTIC**) with `wordsPerLine` = 3 by default. Max 2 lines [S21].
- **CAP-04 DEFAULT. Reading speed.** Don't exceed ~**20 characters/second** for a caption event (the Netflix
  adult limit [S21]). Minimum event duration **5/6 s (20 frames @24 fps)**, maximum **7 s** [S21]. Short-form
  word-pop captions are exempt from the minimum per *word*, but each *line* must stay readable for at least
  about 0.8 s (**HEURISTIC**, derived from [S21]).
- **CAP-05 DEFAULT. Style.** Large, high-contrast (white with black outline), bold [S2]. Active-word
  highlight in one accent colour. Keyword emphasis on at most 1 word per line (**HEURISTIC**).
- **CAP-06 HARD. Safe zone.** Keep captions and any must-read text in the middle band, clear of the top
  15% and the bottom quarter [S4], and away from the right-edge action rail [S5]. Instagram's feed crops 9:16 to
  4:5, so never put critical text near the top or bottom edge [S4].
- **CAP-07 HARD. Sync.** Caption timing comes from the edit-decision map (CORE-07). After any trim, split or
  reorder, captions re-derive. Never hand-shift them.
- **CAP-08 DEFAULT. Content.** Transcribe slang faithfully, don't paraphrase [S21]. Censor slurs per the workspace
  profanity setting. Show non-speech reactions as optional text only if meaningful (e.g. "*screams*").
- **CAP-09 DEFAULT.** Line breaks: break after punctuation, before conjunctions and prepositions. Never split
  article+noun or first+last name [S21].
- **CAP-10 DEFAULT.** Hide captions during music-only montage flashes and over freeze-frame meme text.

---

## 11. Audio (CORE + `[IRL/JC]`)

- **AUD-01 DEFAULT. Dialogue level.** Dialogue peaks around **−6 to −12 dBFS** [S11]. Export loudness
  target: the editor's `loudnessLufs` (supported: −14/−16/−18/−23/−24). Default **−14 LUFS** for short-form
  (**HEURISTIC**; the repo already offers it).
- **AUD-02 DEFAULT. Music under speech** sits **15-20 dB below dialogue** [S11]. Duck automatically under
  speech, with attack/release fades of 150-300 ms (**HEURISTIC**). Music-only stretches go back up to full level.
- **AUD-03 DEFAULT. SFX** stay under the voice [S19]. Peak SFX about 3-6 dB below dialogue peaks (**HEURISTIC**).
- **AUD-04 HARD. Joins.** Every join gets the CUT-01 treatment (valley, zero crossing, 10 ms crossfade). No
  clicks or pops. Room tone (`roomTone`) can fill EDL gaps.
- **AUD-05 DEFAULT. Dead air** in the final output: no silence over 0.6 s (**HEURISTIC**) unless it is a
  dramatic pause (CUT-09) or a music bed covers it.
- **AUD-06 DEFAULT. Music choice.** Match the energy of the footage. Prefer tracks with clear sections and a clean
  outro [S15]. Music comes only from licensed sources (see open questions). Never stream-captured copyrighted music.
- **AUD-07 HARD.** IRL footage often has loud environments. If background music from the venue is in the source,
  do not layer a second music bed that clashes. Flag it in the plan.

---

## 12. Genre specifics

### 12.1 IRL `[IRL/JC]`
- **IRL-01** Moving camera, multiple people, street noise. Layout = **full frame** (content-type detection),
  **no automatic zoom** (ZOOM-05). Opus-style full-bleed 9:16 by default. Use `fit_blur` when the subject would
  be cropped out (wide group shots, signs or reveals that matter).
- **IRL-02** Cut on action (CUT-07): steps, turns, camera whips, doors.
- **IRL-03** Interactions with strangers: keep the stranger's line and the streamer's reaction. Both are needed
  for the payoff. Keep the stranger's first line in full, even if quiet; caption it.
- **IRL-04** Remove walking, transit and "where are we going chat" filler entirely, or compress it to a 1-2 s
  establishing shot with a location text label (**HEURISTIC**).
- **IRL-05** Location or time jumps: J-cut or a whip with whoosh (TR-02), optionally a text label.
- **IRL-06** Camera shake is native. Don't add shake effects in IRL (**HEURISTIC**). Stabilize only if
  unwatchable (`stabilize` exists).
- **IRL-07** Privacy: never zoom on or caption bystanders' personal info. Blur faces of minors or bystanders if
  the workspace policy says so (`blurRegions` exists).

### 12.2 Just Chatting `[IRL/JC]`
- **JC-01** Static camera, talking head, often chat-reading. Layout = **speaker_follow** / facecam-focused. With
  a facecam + content screen, use a stack layout if the content matters to the joke.
- **JC-02** Jump cuts are the house style (CUT-04). Hide jarring ones with zoom alternation (CUT-05).
- **JC-03** Chat-reading: if the payoff is a reaction to a chat message, the viewer must *see or read* the
  message. Show it via the chat overlay (`chatOverlay`) or a text item, timed before the reaction.
- **JC-04** Donation/TTS/alerts: keep them only if they *are* the setup. Otherwise cut.
- **JC-05** Long rants: extract the single strongest 15-30 s arc. Don't summarize a 10-minute story into 30 s
  of jump cuts that lose the logic (Murch: story before rhythm).
- **JC-06** Co-streamers/guests: when two people talk, keep both faces visible for the exchange (split or
  full frame); speaker-follow only when one person dominates.

---

## 13. Taste: professional vs amateur (CORE)

**Professional**
- The payoff lands with room; the laugh is held; the cut-out lands on a natural dip.
- The hook, visual, text and sound say the same thing in the first 2 s [S2].
- Cuts feel motivated: on action, on a breath, on a beat.
- Effects are rare enough that each one *means* something.
- Captions are big, readable, in sync and never cover faces.
- Audio is consistent; music is clearly under the voice; no clicks.
- The clip ends on a resolution or a loop, not a truncation [S13].

**Amateur: anti-patterns (each is a self-review fail)**
- AP-01 Starting on dead air or greetings (HOOK-04).
- AP-02 Cutting the punchline's last word or the first second of the laugh (CUT-02/03).
- AP-03 Ending on the punchline with no reaction (TRIM-04).
- AP-04 Zooming on every sentence; SFX on every line; 5 memes in 20 s (ZOOM-04, SFX-03).
- AP-05 Decorative transitions (spins, page curls) between lines of one conversation (TR-01).
- AP-06 Music louder than the voice; music hard-stopping at the end (AUD-02, MON-08).
- AP-07 Captions in the bottom 15% under the platform UI (CAP-06).
- AP-08 Letterboxing with black bars by default; it "reads as lazy" [S4]. Use full-bleed or fit+blur.
- AP-09 Robotic over-cutting: removing every breath so speech sounds unnatural (CUT-12).
- AP-10 Beat-chopping dialogue (MON-04).
- AP-11 A montage with flat energy, or the best moment first and then a sag [S12].
- AP-12 Cold open that spoils the punchline line itself (STR-03).

---

## 14. Self-review checklist (run before export; CORE)

The agent runs `preview_render` and then these checks on the **rendered preview**, not the plan. Each check
returns pass/fail with evidence (timestamps, measured values). Any HARD failure blocks export: fix it and re-check
(max 3 fix loops, then hand to the user with the failure list).

```yaml
self_review:
  hard:
    - id: R-01  # no cut inside any word (CUT-02): check every join vs word timings
    - id: R-02  # no cut inside a laugh/reaction span (CUT-03): analyze_visual + audio energy at each join ±300 ms
    - id: R-03  # payoff present and complete: payoff words + reaction span fully inside kept ranges (CORE-03)
    - id: R-04  # first 2 s contain hook (HOOK-01): analyze_visual on output 0-2 s says "engaging"; no silence over 0.4 s
    - id: R-05  # ends after reaction_end (TRIM-04)
    - id: R-06  # every join refined: valley + zero crossing + 10 ms crossfade logged (CUT-01)
    - id: R-07  # captions editable layer, in sync with edit map, inside the safe zone (CAP-01/06/07)
    - id: R-08  # all items individually editable in the project (CORE-06): no flattened render used as source
    - id: R-09  # no auto zoom on IRL / multi-person full-frame layouts (ZOOM-05)
    - id: R-10  # no SFX or transition over a payoff word or reaction onset (SFX-04, TR-04)
  default:
    - id: R-20  # length within the template/platform target (STR-01 / PACE table)
    - id: R-21  # no sag over 4 s without new info (PACE-03)
    - id: R-22  # dead air over 0.6 s only where intentional (CUT-10, AUD-05)
    - id: R-23  # effect budgets: zooms, SFX, memes, transitions within limits (ZOOM-04, SFX-03, TR-02)
    - id: R-24  # music 15-20 dB under dialogue; fades at end (AUD-02, MON-08)
    - id: R-25  # montage: escalation, best-last, no back-to-back duplicates (MON-02/03, STR-13)
    - id: R-26  # loudness at target LUFS; no clipping (AUD-01)
    - id: R-27  # multi-source: every source jump is motivated (STR-22)
```

Output of self-review is written into the run log and shown to the user as "Producer notes" on the new project.

---

## 15. Sources

- [S1] PostBase, "How to Edit Twitch Clips for TikTok": https://www.trypostbase.com/resources/how-to-edit-twitch-clips-for-tiktok
- [S2] DOR, "The Pattern Behind Viral Gaming Shorts": https://clip.dor.gg/en/blog/gaming-shorts-viral-pattern
- [S3] Eklipse, "Gaming Clip Hook Strategy: Win the First 2 Seconds": https://blog.eklipse.gg/beginner-guide-2/stream-hook-strategy-first-two-seconds.html
- [S4] klypra, "Twitch Clips to TikTok and YouTube Shorts (2026)": https://klypra.app/blog/twitch-clips-to-tiktok-and-youtube-shorts
- [S5] Clip Farm, "Convert Twitch clips to TikTok (9:16 vertical)": https://www.clip-farm.com/blog/twitch-clips-to-tiktok-vertical
- [S6] Walter Murch, "The Rule of Six" (In the Blink of an Eye excerpt): http://www.bbcdcomdes.weebly.com/uploads/1/1/8/6/11866691/murch_theruleofsix.pdf
- [S7] PremiumBeat, "Cutting on the Blink": https://www.premiumbeat.com/blog/cutting-on-the-blink-editing-tips-from-walter-murch/
- [S8] Epidemic Sound, "J-cuts vs. L-cuts": https://www.epidemicsound.com/blog/j-cuts-and-l-cuts/
- [S9] Learn About Film, "Basic Editing Principles": https://learnaboutfilm.com/film-language/editing/
- [S10] Storyblocks, "10 essential film editing techniques": https://www.storyblocks.com/resources/tutorials/film-editing-techniques
- [S11] Make Video Shorts, "Video Editing From Start to Finish" (audio levels): https://makevideoshorts.com/video-editing-from-start-to-finish-a-complete-tutorial/
- [S12] Filmmaker Genius, "Pacing, Rhythm & the Build": https://filmmakergenius.com/academy/how-to-make-a-film-trailer/trailer-editing-pacing
- [S13] Cubix, "How to Make a Beat Edit Feel Good": https://cubix.design/guides/beat-editing-best-practices
- [S14] HookClone, "Music Montage Video Ideas": https://www.hookclone.com/blog/music-montage-video-ideas
- [S15] DaVinci Resolve 21 blog, "Choose Music for a Montage": https://davinciresolve21.com/blog/davinci-resolve-choose-music-for-a-montage
- [S16] Edit Lounge, "Cut To The Beat": https://editlounge.com/post-production/sound-design/cut-to-the-beat/
- [S17] FilterGrade, "How to Edit Livestreams for YouTube Highlight Videos": https://filtergrade.com/how-to-edit-livestreams-youtube-highlight/
- [S18] Increditors, "Video Editing for Gaming YouTubers": https://increditors.com/video-editing-for-gaming-youtubers-highlights-montages-more/
- [S19] Videotto, "Add Sound Effects and Meme Edits to a Video": https://www.videotto.com/blog/add-sound-effects-and-meme-edits
- [S20] ClipSpeed, "How to Build a Gaming Clip Channel": https://www.clipspeed.ai/blog/gaming-clip-channels.html
- [S21] Netflix Timed Text Style Guide: English (USA): https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide ; General Requirements: https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements ; additional guide page: https://partnerhelp.netflixstudios.com/hc/en-us/articles/115001349591

Notes on sources: S1-S5, S14, S18-S20 are vendor blogs (clipping tools or agencies). They are useful for
genre conventions, but not authoritative; their numbers are conventions, not measurements. Streamer-channel
styles (Kai Cenat / IShowSpeed / xQc clip channels) are described here only generally, through S17-S20. No
source gave seconds of pre-roll or post-roll for laughs, so all TRIM-02/05/07 values are HEURISTIC and should be tuned
on fixtures.
