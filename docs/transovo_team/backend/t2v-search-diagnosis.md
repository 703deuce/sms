# T2V search diagnosis: why the first pick misses (PR #1194)

Sources (read-only, no URLs or keys):
- Prod DB, read-only: `autobuild` shots, queries, queriesTried and reimagineLog, plus `t2v_verify_job` results for the
  #1192 runs of sleep `t2v_cf976bf4…` and snow `t2v_2a61c079…`. Jobs ran 12:02–12:10 ET on 2026-11-14 (17:02–17:10 UTC in the DB).
- Free Pixabay video API probes, AND (`a+b`) and loose, run from the clips-worker host (`pixabay_probe.json`).
- After the fix: one cheap script-context LLM call per script with the new prompt, then the new literal searches run
  free on Pixabay with the new interleave order (`search_fix_probe2.json`).
- No paid T2V or Gemini runs.

## Mechanism findings (apply to every shot)
1. **One query fills all 8 slots.** The footage agent sorted by tag-overlap ratio, then query index, then provider
   rank. Ties went to query 1, so round 1 took all or nearly all its candidates from the planner's first query:
   - sleep sh4: 'evening routine' 7 + 'bedroom' 1
   - sleep sh12: 'phone charging' 8
   - snow sh16: 'outdoor grill' 8
   - snow sh5: 'medicine cabinet' 7
   - snow sh14: 'aa battery' 8

   The script-context showIdeas queries (4–5, which are long sentences) never contributed.
2. **The long showIdea queries can't match Pixabay tags.** Example: 'person following calm routine before bed'. Pixabay
   tags are 1–3 words, AND search returns 0, and loose OR returns noise.
3. **AND ('+') almost always returns 0–2 hits, so loose OR results dominate.** Loose results that match one tag word
   ('evening' → sunsets, 'teeth' → wolves, 'cabinet' → network racks) fill the list.
4. **Lead dedupe dropped the best clip (sleep sh12, below).** A clip that an earlier shot leads with was pushed after
   every other clip. With 8 slots it fell off the list entirely.
5. **Planner queries target the topic or the previous piece, not what the line shows.**
   - sleep sh15 searched 'closing curtains' / 'curtain drawing', which belong to the previous piece's action, for
     "adjust bedding".
   - snow sh16's 'outdoor grill' gets summer BBQ.

## Per shot

### sleep sh4: "and evening routine mark those dependable hours." → wind turbine (318540, 9)
- **Queries:**
  - planner: 'evening routine', 'bedtime routine', 'bedroom'
  - idea: 'A person following a calm routine before bed'
  - idea: 'A clock and an evening checklist beside a bedroom'
- **Round-1 candidates:** 39292 (8) and 318540 (9, the windmill). The rest were sunsets.
- **Probe:**
  - 'evening routine' AND gives 0. Loose: 318540 (sun, heaven, clouds, evening sky), 153976 (sunset), 143436 (yoga, routine).
  - 'bedtime routine' loose: yoga 143436/143440, 426 (girl walking in rain).
  - Literal phrasings work: 'setting alarm clock' gives 15629 (alarm, clock) and 21223/21222 (alarm clock, home).
    'woman reading bed lamp' gives 34473/34474 (reading, bed).
- **Verdict: query too abstract.** Literal footage exists and the query missed it.

### sleep sh12: "Charge your phone away from the pillow." → laptop window of 44081 (9)
- **Queries:** 'phone charging', 'phone dresser', 'charging phone', plus two long ideas. These are already fairly literal.
- **Probe:** 'phone charging' AND gives 6 hits. Five are animations (filtered out). The only live-action hit is
  **44082** (charge, power, mobile, smartphone, … phone, battery, cable), a full tag match, and the #1190 pick.
- **Round 1 (12:02 ET):** sc_10 ("set screens aside") ran the same query and led with 44082 (scored 2 there).
  sc_12's 8 candidates were 202987, 38084, 174003, 47743, 142641, 6590, 61298, 88686: all generic phone clips with
  partial matches. 44082 and 8501 were missing because the lead dedupe pushed sc_10's lead to the end and the 8 slots
  were already full.
- **Round 2:** 44081, a sibling clip whose window showed only the laptop, scored 9.
- **Verdict: the footage exists and the query found it, but our own ordering (lead dedupe plus the 8-slot cap) dropped
  it.** Pixabay's ranking was not the cause.
- **This is the item-7 sh12 loss.** It is fixed generally: a clip led by an earlier shot now just can't lead again;
  it stays in the list.

### sleep sh15: "and adjust bedding until the space feels restful." → dog (262181, 5)
- **Queries:**
  - planner: 'closing curtains', 'bedroom bedding', 'curtain drawing'
  - ideas: 'Someone smoothing pillows and arranging bedding', 'Fresh bedding arranged neatly in a calm bedroom'
- **Round 1:** 363408 scored 9 (curtains, then rejected) plus noise. In later rounds 151297 (woman waking in bed) scored
  4 and 262181 (dog) scored 5.
- **Probe:**
  - 'bedroom bedding' AND gives 44 hits, led by 729 (sleeping man, alarm clock).
  - 'making bed' loose returns a guitarist (139), a glass blower (3612) and chopping (11606).
  - 'fluffing pillow' gives 729, 109373 (feathers) and 224421 (alarm, pillow, bed).
  - 'woman making bed' gives 151297/151295 (woman waking in bed).
- **Verdict: queries aimed at the wrong action (the previous piece's curtains).** Literal bedding-arranging footage
  is scarce on Pixabay. The best literal options are 42966 (messy bed, pillow) and 224421 (pillow, bed); otherwise a
  photo or AI shot is needed.

### sleep sh21: "without rushing or watching the clock." → teddy photo
- **Queries:** 'settling into bed', 'bedroom clock', 'sleep routine', plus ideas. queriesTried grew to 17 across rounds.
- **Probe:**
  - 'settling bed' AND gives 0. Loose: 151297/151295 (woman in bed).
  - 'woman lying in bed' gives 729 and 151297.
  - 'alarm clock bedside' gives 15629/21223.
- **Verdict: abstract line, partial literal footage exists** (34473 and 34474 reached 9 in rounds 1–2). The teddy
  photo was a checker and selection problem, handled by items 1–3.

### snow sh5: "where everyone can find them if travel becomes difficult." (medicines) → 5457 (7) in round 3
- **Queries:** 'medicine cabinet', 'home supplies', 'winter preparation', plus long ideas. Later tries: 'labeled pill
  bottles', 'medicine shelf', 'bathroom shelf' …
- **Probe:**
  - 'medicine cabinet' AND gives 0. Loose: 21617 (blood cells), 14900 (network cabinet), 40353 (doctor, lab).
  - 'pill organizer' gives 38220 (antibiotics, pill) and 9085 (agenda).
  - 'first aid kit' gives daisies and a swing.
  - 'pills shelf' gives 38220 and bookshelves.
- **Verdict: nothing literal on Pixabay video.** The photo or AI path is the right outcome. The queries were also
  partly abstract ('winter preparation', 'home supplies').

### snow sh14: "and replace weak batteries." → 8501 (charger, 6), later 4728
- **Queries:** 'alarm battery replacement', 'AA battery', 'smoke detector', plus ideas.
- **Probe:**
  - 'aa battery' gives 22200 (Mexican pyramids, tagged battery), 8501 (charger) and 3722 (plush gorilla).
  - 'smoke detector' gives smoke and volcanoes.
  - 'smoke alarm' gives 8872 (firefighters).
  - 'replacing battery' and 'battery change' return the same noise.
- **Verdict: nothing literal on Pixabay video.** Photo or AI is needed.

### snow sh16: "and never bring an outdoor grill inside for heat." → summer BBQ (346604, 9)
- **Queries:** 'outdoor grill', 'backyard grill', 'grill safety', plus ideas (an indoor heater, warm blankets).
- **Probe:**
  - 'outdoor grill' AND gives 20 hits, all summer BBQ (1645 "bbq, grilling, …, summer", 11632, 16373).
  - 'grill snow' and 'snow covered grill' give burgers (199545) and snow landscapes.
  - 'barbecue winter' AND gives 88187/88182 (fireplace barbecue, coal).
- **Verdict: footage of the literal subject exists, but not in the video's setting.** Pixabay has no snowy grill. The
  queries never carry the setting even where it would be visible. The line's advised action (keep the grill outside,
  heat safely indoors) is better shown by a safe-heating shot or a photo.

## Summary table
| shot | query too abstract | exists but missed | ranking/tags buried | nothing literal |
|---|---|---|---|---|
| sleep sh4 | **yes** | yes (alarm clock, reading in bed) | loose 'evening' → sunsets | |
| sleep sh12 | no | **yes: found, then dropped by our lead dedupe** | (ours, not Pixabay's) | |
| sleep sh15 | wrong action (curtains) | scarce | 'making bed' loose noise | mostly |
| sleep sh21 | yes | partial (34473/34474, 729) | | |
| snow sh5 | partly | | | **yes** |
| snow sh14 | no | | battery tags on unrelated clips | **yes** |
| snow sh16 | setting missing | subject yes, setting no | | snowy grill: yes |

## Fix (B), all generic
1. **lineShows and literal searches from the script-context pass.** Each line gets `lineShows`: what a viewer should
   literally see for the line's meaning, read within its full sentence. It shows the advised action rather than the
   thing to stop, and one concrete everyday example when the line is abstract. Each line also gets 4 `searches`:
   short Pixabay-style queries (usually 2 words) naming the object plus its action or place, as different literal
   phrasings.
   - The searches go first in shot.queries. Planner queries follow. Long sentence ideas are no longer searched.
   - lineShows is passed to the checker as context only, so the search and the checker share a target.
2. **Every query gets a turn.** Full tag matches come first, round-robin across queries, then partial matches the same
   way.
3. **A clip an earlier shot leads with stays in the list**; it just can't lead again.
4. **Rewriter and reimagine query prompts** ask for literal 2–3 word subject-plus-action queries of lineShows. "Broader
   B-roll that still fits" was removed.
5. **Generic pre-filter (measured, not adopted).** Requiring overlap ≥ min(2, query words) on the new searches left 0
   candidates for sh4, sh15, sh5 and sh16, and 1 for sh12 and sh14. That is too strict, and when nothing literal
   exists, the photo/AI paths need the reviewer's rejections to trigger. The existing ≥1 filter stays, and full matches
   now lead across all queries.

### Measured on the diagnosis cases (new prompt, one LLM call per script, free Pixabay)
- **sleep sh12:**
  - lineShows: "A phone charging on a surface away from the bed."
  - searches: 'charging phone', 'phone on dresser', 'mobile charging', 'phone charger'
  - top 8: **44082 first** (full match), then 202987, 38084, 174003, 142641, 47743, 736, 8501
- **sleep sh21:**
  - searches: 'settling into bed', 'relaxing in bed', 'sleeping calmly', 'bedtime routine'
  - full matches lead: 233390, 140274 (bed, cozy, relaxing; reached 9 in the reimagine round of the real run),
    127621, 42966
- **sleep sh4:**
  - lineShows is still a bit generic ("an evening habit that signals bedtime, such as preparing for bed")
  - searches: 'bedtime routine', 'brushing teeth', 'preparing bed', 'night routine'
  - Pixabay noise (wolves for 'teeth'); no improvement, even with the "one concrete example" clause in the
    prompt. An abstract line remains the weak case; its fallback is the reimagine and photo rounds.
- **sleep sh15:**
  - searches: 'adjusting bedding', 'making bed', 'arranging pillows', 'smoothing duvet'
  - All partial-match noise. It no longer targets the curtains, but there is nothing literal on Pixabay.
- **snow sh5, sh14, sh16:**
  - literal searches such as 'medicine cabinet', 'pill organiser', 'smoke alarm battery', 'changing alarm battery',
    'home radiator', 'indoor heater'
  - Still only noise: nothing literal exists. The photo/AI paths must carry these.
- **Overall:** the search now finds the literal clip when one exists (sh12, sh21). Where none exists (sh5, sh14,
  sh16, mostly sh15), better wording can't help, and the stricter checker (items 1–3) keeps noise from passing as a 9.
