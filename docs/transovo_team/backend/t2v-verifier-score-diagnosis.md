# T2V verifier: why scores stay at 6-9 when `seen` contradicts the line (diagnosis, #1192 @ 33350ddc)

Author: Backend Engineer, Sat Nov 14 2026, ~12:45 PM ET.
Evidence:
- The actual verify jobs of the live reruns, read with a read-only DB query. That's 6 snow jobs and 6 sleep jobs from 17:02Z on: the payload shots the worker received and every evaluated candidate's seen, fit_reason, score, matches and subjectVisible. The output is at `/workspace/test/t2v_1192_snow/verify_jobs_readonly.json`. It has no URLs, keys or secrets.
- The worker prompt and parser on master (`worker/clips_worker/t2v/verify_stock.py`, line numbers below are master 33350ddc).
- The web pick code (`new-app/lib/server/t2v/pipeline/t2v-no-repeat.ts`).

## Bottom line
- **No code raises or invents a score.** The parser takes the model's integer as-is, and no max, default, clamp or best-available path lifts a 0-4 to 5 or more on the web side.
- **The 6-9 scores are the model's own.** The prompt lets it pass a clip on whole-script, theme or category relevance and on "another way of showing the moment". The anchors reward exactly that. The one sentence that says "metaphor = 4 or lower" is outweighed by the rubric and the context.
- **The model's own literal-depiction signals (`seen`, `subject_visible`) are not tied to the score.** They are marked "information only".
- **Split-sentence context did arrive.** Every snow and sleep payload has `sentence`, `prevNarration` and `nextNarration`, and sh14 got the alarms sentence. The model judged against other script lines anyway.

## The cases (actual verifier output, live run)
| Line (scene) | Clip | score | subjectVisible | seen (model) | fit_reason (model) |
|---|---|---|---|---|---|
| "where everyone can find them if travel becomes difficult." (snow sc_5; sentence "Keep needed medicines close, where everyone can find them…") | 5457 | **7** | true | "A row of intravenous drip bags is hanging in a medical setting…" | "The clip shows medical equipment which **relates to** medicines, fitting the context of the line." |
| "and replace weak batteries." (snow sc_14; sentence "Test smoke and carbon monoxide alarms, and replace weak batteries.") | 8501 | **6** | **false** | "A hand places a smartphone onto a wireless charging stand… battery charging icon." | "…aligns with the instruction to **prepare backup batteries and charge devices** before a storm." That's script lines 20/21, not this line. |
| same clip for "flashlights, and spare batteries." (sc_3) | 8501 | 8 | true | same | "…directly **supports the script's reference to power supplies** like batteries." |
| "flashlights, and spare batteries." (sc_3) | 144635 | **9** | true | "A person is walking… at twilight, holding a bright handheld flashlight…" | "…directly illustrates the line…" |
| "and never bring an outdoor grill inside for heat." (sc_16, winter-storm video) | 346604 | **9** | true | "…grilling… on a charcoal grill in a sunny, grassy area." | "…demonstrates safe outdoor grilling, which directly **supports** the warning…" |
| "and seal gaps before temperatures drop." (sc_7) | 7954 | **9** | true | "A hand uses a cloth to wipe down a dark, dusty glass or window pane…" | "…illustrates the process of **preparing a window area before sealing**…" |
| same clip for "Feel for drafts around windows and doors," (sc_6) | 7954 | 3 | false | "…wipe or clean a dark, textured surface…" | "…unclear what they are doing…" |
| "gather drinking water, shelf-stable food," (sc_2) | 5629 | 9 | true | "…scrub the inside of a glass jar under a running kitchen faucet." | "…showing someone interacting with a container to hold water **fits this perfectly**." |
| "may need insulation…" (sc_10) | 43629 | 9 | true | "…grey industrial metal wheel valve… factory-like environment." | "…depicts a type of pipe fitting, which **aligns perfectly with the script's reference** to exposed pipes…" |
| "…and plan to check on neighbors…" (sc_20) | 47743 | 9 | true | "…hands holding and using a smartphone, scrolling…" | "…directly **supports the line about charging phones**…" That's the PREVIOUS line. |
| "Make the bedroom dark, quiet, and comfortably cool." (sleep sc_13) | 111281 | **8** | true | "…hands turning the pages of an old book on a wooden table in a dimly lit room… a lit candle…" | "…a calm, quiet evening activity **suitable for the bedroom atmosphere**, aligning well with the **transition toward sleep**." |

In every case `seen` is an accurate literal description. The fit_reason then bridges it to the line, the theme, the category or a different line, using the words "relates to", "supports", "aligns with", "suitable for", "the script's reference".

## Concrete causes (file:line, master 33350ddc)
1. **The prompt asks for whole-video relevance and says the line explicitly isn't the only bar.**
   - `verify_stock.py:77-78` "decide whether an experienced editor would put it under ONE line of THIS video".
   - `:82` "Read the script first so you understand the video and this moment in it."
   - `:93` "judge the fit of what you wrote in seen against this line **and the whole script**."
   - `:103` "score: 0-10 for **THIS spot in THIS video**."
   - The full 8000-char script (SCRIPT_BLOCK `:120-122`) comes BEFORE the line. The model treats "fits the script" as fitting, so it scores clips against lines 19-21 or the theme (sc_14, sc_20, sc_3, sc_10).
2. **The text and the rubric anchors pull against each other.**
   - The text says metaphor or loose association means 4 or lower (`:95-96`).
   - But `:85-86` "a clip that shows the moment in a **different but natural way scores well**".
   - And the anchor `:103-104` "7-8 = clearly works… (it shows what the line is about, literally **or from another angle of the same moment**)".
   - The model files "wiping a window before sealing", "a container to hold water" and "calm evening activity for the bedroom" under "another angle of the same moment" and anchors them at 7-9. The 3-4 anchor "loosely on topic but wrong for this moment" is weaker than "natural alternative depiction", so category matches land at 7 (IV bags).
3. **The "moment" field widens the line.**
   - SCRIPT_BLOCK `:126` "What this moment means in the video". The moments are thematic, for example sc_3 "…lighting and **backup power** for flashlights", sleep sc_13 "making the bedroom itself **suitable for sleep**…".
   - The model scores against that wider moment, not the words of the line.
4. **Setting is explicitly handed to the model as optional.**
   - `:86-87` "Decide yourself what matters for this line - the script, not a rule, tells you whether the place, light, season or people matter here."
   - The model decides the summer barbecue's setting doesn't matter (sc_16: 9). This came from removing the hand-written rules, which was right, but the sentence reads as permission to ignore a viewer's reaction to the setting.
5. **Literal-depiction signals are disconnected from the score.**
   - `subject_visible` is "information only" (`:109`, parsed at `:523`, comment `:520`). sc_14 had subjectVisible=false and still scored 6, which is the web "usable" tier (≥5, `t2v-no-repeat.ts` tierList).
   - `seen` is required but nothing ties the score to it.
   - `:522` `"score": int(v.get("score") or 0)` is the only score handling: no cap from these signals.
6. **fit_reason is generated before score** (propertyOrdering `:73`: … "fit_reason", "score"). The model writes the bridging argument first, then scores to match it. That ordering helps rationalisation once fit_reason is allowed to argue relevance.
7. **Perception limits, a separate issue: a near-black or blurry clip read as clear.**
   - The clip is downscaled to 360p at 4 fps (`_mute_and_shrink`), sent at `mediaResolution: MEDIA_RESOLUTION_LOW` with `videoMetadata.fps: 1` (`_gemini_watch`).
   - For 144635 (VQ: a near-black treeline with a pin-prick of light) the model reported "a bright handheld flashlight", lighting 6. For 7954 (VQ: an unreadable blurry wipe) it reported "a dark, dusty glass or window pane".
   - `seen` itself is wrong here. A fit cap can't fix a wrong `seen`. Asking whether a viewer can make out the thing for most of the clip helps only partly. Raising media resolution or fps costs more and is a separate decision for John.

## Ruled out
- **Post-processing that raises scores:** none in the worker (`:522`, no clamp or max) or the web (`toPick`/`evToPick` copy `score`; the spare and finisher re-check only replaces it with the re-check's own score). The worker's `best_available` (≥3) is never placed by the web (`t2v-no-repeat.ts` "A worker best_available pick is never taken directly").
- **Missing context:** every live payload carried `script` (hasScript true), `videoUnderstanding`, `sentence` (the full sentence for split pieces, e.g. sc_14 "Test smoke and carbon monoxide alarms, and replace weak batteries."), `prevNarration`, `nextNarration`, `moment` and `subject`. Context arrived. The model was told to weigh the whole script equally with the line, and did.
- **Line vs whole-script weighting:** the model does see the line (`This line (spoken over this shot)`), but `:93`/`:103` make the whole script co-equal, and the fit_reasons show it picking the best-matching line in the script instead.

## Fix that follows from this (implemented in the follow-up PR)
- **The score comes from a literal-depiction judgment, enforced in code:**
  - New fields, in this order: `line_shows` (the concrete thing or action THIS line is about, from the line inside its full sentence; the whole script and the moment are context only), `seen`, then `depicts` (yes/partly/no: would a viewer watching this video immediately see `line_shows` in this clip, for most of it).
  - Then `fit_reason`, then `score`.
  - Code caps the score: no → at most 4, partly → at most 6. `matches` is forced false below 7. `rawScore` is kept.
- **The rubric anchors are rewritten so they agree with the text.** 7-10 only when depicts = yes. "Another angle" is limited to the same `line_shows` filmed differently. Matches on the theme, the category or another line are misses.
- **Wording changes:**
  - The whole script is context: it tells the setting and story a viewer expects, and never makes a clip fit a line it doesn't show.
  - The "moment" field is labelled context only.
  - The "setting optional" sentence is replaced by the viewer's own reaction ("would this look out of place to a viewer of this video"), with no season, time or topic rules.
- **The same `line_shows`/`depicts` plus code cap applies to the text re-check for borrowed clips.**
- All the cases above are used only as test fixtures (mocked model answers), never as prompt text.
