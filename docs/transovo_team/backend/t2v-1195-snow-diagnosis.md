# Snow #1195 rerun: why 1 of 22 lines was accepted (read-only diagnosis), Sat Nov 14 2026, ~4:40 PM ET

Run `t2v_2a61c079bbc740678c4818ff2960da0b`, live 05ac1600 (#1195 + #1197), clean slate (`--from-footage --no-incumbents`).
Data:
- The prod DB `t2v_drafts.document.autobuild` (shots/line_shows, queriesTried, verifyHistory, reimagineLog, budget hits).
- The 4 snow verify jobs' payloads in `clip_jobs`.
- `t2v_clip_descriptions` (405 cached blind observations, all Pixabay).
- Worker `[t2v:verify:candidate|static|artifact|rejudge]` lines since 3:45 PM ET: 520 checks over search_0/1/2 and reimagine step 1.

Nothing was changed. URLs are redacted.

## The numbers
- 520 checks: depicts **no 508**, partly 7, yes 3, error 2.
- **raw score 0 on 455 of 520** (88%). Only 10 checks scored 5 or more.
- This is not the caps' doing. The caps lowered a contender's score once (109879, raw 8 → 3, and its line was accepted through other clips anyway). Static marked 67 clips, but 54 of them had raw 0 already.
- Events are fine: 518/520 were blind with 1–4 events in the window. Rejudges (21) never flipped a verdict. Two errors: 248105 `'candidates'` (a Gemini response without candidates) and one `preview_too_large`.
- Budget: search_2 sent 73 and **dropped 95** candidates. The photo round was skipped twice (72 dropped each time). Reimagine step 1 (18 lines, 54 ideas, 108 checks) scored 0 on almost every candidate.

## Classification (22 lines)
| class | lines | count |
|---|---|---|
| accepted | L11 (faucet, 10) | 1 |
| **(a) search: no candidate shows the line** | L1, L3, L5 (+e), L6, L7, L10, L13, L14, L15, L17 | 10 |
| (a)+(b) | L0, L8, L9 | 3 |
| **(b) observation shows it (or part), pass 2 says no/partly: compound or over-specific line_shows** | L2, L12, L16, L18, L19, L20, L21 (+c) | 7 |
| (b)+(c) | L4 (pill capsules: raw 3 "no", plus a false production cap) | 1 |
| (c) caps as the main cause | none (but see below) | 0 |
| (d) window/events | none (2 single errors) | 0 |
| (e) budget | L5 (#1194's right clip was a photo, and the photo round was skipped); 95 stock candidates dropped | partial |

### (a) Search: 455 zero-score checks are junk from single-word tag matches
- Examples: "smoke alarm" → smoke on black and an alarm clock; "pipe insulation" → ocean waves and a pipe pouring water; "clearing drain" → a washing machine; "generator safety" → a boat; "winter preparation" → wind turbines, a tornado and coots.
- Cause: `searchQuery` (`new-app/lib/server/t2v/pipeline/t2v-footage-agent.ts:160-178`) keeps any hit whose tags overlap **one** query word (`r.overlap >= 1`). `interleaveQueries` then fills the 8 slots with those partial matches once the full matches run out.
- So for lines that Pixabay barely covers, the verifier checks 8 unrelated clips per round. The budget goes on junk (search_2 dropped 95, and the photo round never ran), and reimagine searches the same way and gets the same junk.

### (b) Fixed line_shows are compound or over-specific, and "partly" is capped at 6 < 7
Pass 2 judges against the fixed line_shows exactly, and "partly = shows only part of line_shows" (SCORE_PROMPT step 4). With `DEPICTS_CAP partly = 6` and `ACCEPT_SCORE = 7`, a line_shows that joins two things can never be accepted with a clip that shows one of them. These are the snow lines:
- L19 "A vehicle is parked safely **and** a phone is charging": 44082 (a hand plugs a charger into a phone; VQ rated #1194's equivalent pick a 2) got partly 6 because there was "no parked vehicle".
- L20 "A backup battery is charged **and** a neighbor check-in is planned": the same phone-charging clips got partly 5.
- L2 "A phone displays a weather forecast **beside** drinking water and pantry food being gathered": phone-forecast clips got "no".
- L21 "Snow falls outside a prepared, stocked home **as** local guidance is checked": 49443 (snow over houses) got partly 6.
- L8 "Curtains are closed **and** the thermostat is set", L17 "Gutters and drains are cleared **and** outdoor items secured", L18 "A shovel **and** ice melt are kept ready near an entry". On L18, 157204 (a shovel in snow, picked up) got "no" because it showed "actively shoveling rather than keeping within reach".
- Over-specific: L4 "Needed medicines are **placed together for easy access**" (narration: "Keep needed medicines close,"). 377600, a pile of capsules (VQ rated #1194's capsules a 2), got "no".
- L12 "A faucet runs at **a small, steady trickle**": three dripping taps got "no" ("dripping rather than a steady trickle").
- L16 "Safe indoor warmth comes from the home's heating system, **not a grill**": 42014 and 112514 (a hand turning a radiator valve, the advised alternative; VQ rated #1194's L8 valve a 2) got "no", with the fit_reason "rather than demonstrating the safety warning". Naming the warned-against thing inside line_shows confuses pass 2.
- L0: the scene-setting line "Before the first flakes arrive, small checks can make a winter storm easier…" became the specific action "A homeowner checks supplies". #1194's snowy-houses opener (VQ 2) could no longer pass.
About 10 of 22 snow line_shows are compound ("and", "beside", "as", "not …"). The prompt that writes them is `SCRIPT_CONTEXT_SYSTEM` (lineShows bullet, `t2v-script-context.ts:27-32`). For this frozen plan they were written once at 3:46 PM ET (`line_shows_fixed:22_model`).

### (c) Caps: two generic false fires, small effect in this run
1. **"studio lighting" triggers the production cap.**
   - `_PRODUCTION_WORDS` (`verify_stock.py:448-451`) contains `studio (?:light|lights|lighting|equipment)`, and `norm_artifacts` runs it over the WHOLE observation, including each event's `lighting` field.
   - Pass 1 writes "Bright, even studio lighting" for any clean product shot.
   - **29 of the 39 production caps came only from that lighting phrase.** 4 came from the model, and only 6 had real green-screen or studio-gear notes.
   - Hit: 377600 capsules (raw 3 → capped) and 109879 faucet (raw 8 → 3).
   - This is not a snow-specific bias, but it hits the product/still-life clips that snow's household lines depend on.
2. **Slow snowfall is read as static or frozen.**
   - `_motion` / `_frozen_spans` work on 64x36 grey frames, and `STATIC_DIFF = 1.5` (`verify_stock.py:760`). Small flakes nearly disappear at that size.
   - 142579 (snow falling on pines, motion 1.37), 49443 (snow over houses, 1.48; partly 6 on L21) and 151424 were marked static. 2346 (snow falling past a gate) was marked frozen for 9.25 s.
   - This is the one snow-footage bias, and in this run it only touched L0/L21 contenders that had already failed on (b).
- **No near-black false fires on white or snow scenes:** none of the 31 `dark` flags was a snow, white or bright scene.

### (d) Windows and events
- No systematic problem. Windows sit inside the events, and pass 2's window snapped to events. 2 entries had no events (errors).

### (e) Budget
- The stock cap (250 checks) was spent on junk (a). search_2 dropped 95 candidates, and the photo round was skipped both times it was reached.
- #1194's L5 (a pill-organizer photo) and its other still photos could not come back.
- Reimagine is not budget-starved (108/240 used), but its searches return the same junk as (a).

## Compared with #1194 snow (VQ review)
- VQ rated only **5 snow lines fully right (2)** in #1194: L0 snowy houses, L4 capsules, L5 pill-organizer photo, L8 radiator valve, L19 phone plug. 13 were rated 1 and 4 rated 0. So #1195's verdict of "the rest fail" mostly agrees with VQ.
- What #1195 lost is exactly those five:
  - L4 and L19 to (b) (and (c) for L4).
  - L8 to (a)+(b): the valve clips 42014/112514 were only found by L16's "radiator heating" queries, not by L8's compound curtains+thermostat line_shows and queries.
  - L5 to (e).
  - L0 to the reframed line_shows (b).
- Most of the 1s in #1194 were clips the #1194 verifier accepted against its own shifting line_shows. #1195 correctly refuses them, and that alone accounts for the drop from about 23/44 to 1 accepted.

## Recommendation (smallest, generic, keeps "a viewer immediately understands")
1. **line_shows: one shot, one thing** (`new-app/lib/server/t2v/pipeline/t2v-script-context.ts:27-32`, the lineShows bullet; the frozen-plan path `t2vLineShowsOnce` uses the same `SCRIPT_CONTEXT_SYSTEM`).
   - Add: "lineShows is what ONE shot shows: one visible thing and its action. When the line lists several things, name the one this line is mainly about (the first or most visible); never join two with and/beside/as/while. Describe only the advised action, never the warned-against thing."
   - No topic words. The bar is unchanged: depicts must still be "yes" for THAT thing, and partly stays capped at 6.
   - Expected recoveries: L2, L4, L8, L12, L16, L18, L19, L20, L21 (about 5–8 lines have a "yes"-able clip already among their candidates: 44082, 8501, 377600, 42014/112514, 157204, 49443, the dripping taps).
2. **Production backstop only on gear words in `notes`** (`verify_stock.py:448-459`).
   - Drop `studio lighting` from `_PRODUCTION_WORDS` (keep green/blue screen, chroma key, studio lights/equipment *in shot*, light stands, softbox, crew, clapperboard, boom mic).
   - Call `norm_artifacts` with the observation's `notes` (plus `visible`) instead of the whole text with `lighting`.
   - This is a one-line regex change plus one call-site change, and it removes 29/39 false caps.
3. Next, not the smallest:
   - In `searchQuery` (`t2v-footage-agent.ts:176`), keep a partial match only when it hits the query's **last word** (the object noun the script-context prompt puts there), not any word. That is generic and cuts most of the 88% junk, which frees budget for the photo round (e) and reimagine.
   - For snowfall, compute `_motion` / `_frozen_spans` on a larger grey frame (e.g. 160x90; this is local ffmpeg, not the model feed), or lower `FROZEN_DIFF` for fine texture. Verify on 142579/49443/2346 first.

Rerun with 1+2. **Caveat:** `t2vLineShowsOnce` (`t2v-script-context.ts:108-109`) only writes line_shows for shots that have NONE, and the frozen shots now keep this run's line_shows. A rerun needs the reset tool to drop `shots[].lineShows` (e.g. a `--rewrite-line-shows` flag), or the new prompt never applies. The cost stays the same or lower, because there are fewer partly re-checks.

## Per line (top 3 checks by raw score)
### L0 `sc_0_l8czrf`: **a+b**
- narration: Before the first flakes arrive, small checks can make a winter storm easier to manage.
- line_shows: **A homeowner checks supplies before snow arrives.**
- queries (first 12 of 20 tried): storm checklist, checking supplies, winter preparation, snow forecast, snowy front door, homeowner packing supplies, person checking pantry, hands organizing provisions, checking pantry shelves, homeowner checking cupboard, winter gear by doorway, homeowner checks pantry
- checks: 26 (26 unique clips); depicts {'no': 26}; raw 0: 19

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 329674 | A person wearing a black jacket and a blue hat walks away from the camera along a snow-covered wooden bridge. The bridge | 1.27–8.72 | no | 3/3 | none | The clip shows someone walking on a bridge in the snow, which does not depict the act of a homeowner checking supplies. |
| 257399 | The camera pans slowly across a forest landscape filled with pine and deciduous trees covered in frost and light snow. | 0.77–8.22 | no | 2/2 | none | The clip shows a winter forest landscape but fails to show any homeowner checking supplies as required by the script. |
| 205625 | A high-voltage power transmission tower stands against a sky with moving clouds. | 0.27–7.72 | no | 2/2 | none | The footage shows a utility tower and not a homeowner checking supplies as required by the script. |

### L1 `sc_1_wpnczz`: **a**
- narration: A warm, prepared home begins with noticing what could fail when roads and power are disrupted.
- line_shows: **A person reviews a home emergency kit.**
- queries (first 12 of 20 tried): emergency kit, supply checklist, power outage, winter supplies, home window inspection, person opening first aid kit, hands checking emergency bag, family sorting survival supplies, opening emergency backpack, checking first aid supplies, emergency kit contents, homeowner checks breaker
- checks: 26 (26 unique clips); depicts {'no': 26}; raw 0: 24

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 1426 | A person with dreadlocks leans toward three burning candles on a window sill and begins to blow on them. | 0.0–7.89 | no | 2/2 | none | The clip shows someone blowing out candles rather than someone reviewing a home emergency kit as required by the script. |
| 43459 | A young woman is sitting on a couch and writing in a book with a pen. She is focused on the task throughout the observed | 0.56–8.45 | no | 2/2 | none | The footage shows a woman writing in a book rather than reviewing a home emergency kit as required by the script. |
| 224206 | The observed events show a burning building and firefighters actively working to put out the fire, which is unrelated to | 2.56–10.45 | no | 0/0 | none | The footage shows emergency services responding to a fire, which does not depict a person reviewing a home emergency kit. |

### L2 `sc_2_90wacy`: **b (compound)**
- narration: Start with the forecast, then gather drinking water, shelf-stable food,
- line_shows: **A phone displays a weather forecast beside drinking water and pantry food being gathered.**
- queries (first 12 of 20 tried): weather forecast, bottled water, canned food, storm supplies, phone weather, person checking forecast phone, hands filling water bottles, gathering canned groceries, weather app water bottles, forecast beside groceries, packing bottled water food, winter forecast groceries
- checks: 26 (26 unique clips); depicts {'no': 26}; raw 0: 22

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 31960 | The camera pans across a freezer and food shelf display in a convenience store. These shelves contain various food items | 27.04–31.96 | no | 3/3 | none | The clip shows general convenience store shelves, but it does not show a weather forecast or the act of gathering emergency food supplies as |
| 38084 | A person uses a smartphone to scroll through content. No food or water supplies are visible in the frame. | 1.54–6.46 | no | 2/2 | none | The footage shows only a person scrolling on a phone and fails to show the essential drinking water and pantry food mentioned in the require |
| 202987 | A person uses a smartphone to type. No food or water supplies are visible in the clip. | 5.04–9.96 | no | 2/2 | none | The clip shows only a person typing on a phone and fails to depict gathering food or water supplies. |

### L3 `sc_3_0dwlux`: **a**
- narration: flashlights, and spare batteries.
- line_shows: **Flashlights and spare batteries are gathered together.**
- queries (first 12 of 20 tried): flashlight batteries, spare batteries, torch batteries, emergency flashlight, battery supply, hands arranging flashlights, aa batteries beside flashlight, person loading battery drawer, flashlight battery set, batteries on table, portable lantern batteries, testing flashlight batteries
- checks: 26 (26 unique clips); depicts {'no': 26}; raw 0: 22

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 8501 | A smartphone is placed on a wireless charging stand and begins to show a charging icon and battery percentage. | 13.25–15.75 | no | 2/2 | frozen | The footage shows a smartphone charging, which does not depict the act of gathering flashlights and spare batteries. |
| 200941 | The observed events consistently show a person in a dark, hood-covered outfit holding a flashlight in very dark, blue-ti | 12.75–15.25 | no | 1/1 | dark | The footage shows a person exploring in the dark rather than the organized collection of supplies like flashlights and spare batteries. |
| 144635 | The observation reports the video is very dark, showing only silhouetted figures with a flashlight beam at night. The ob | 5.25–7.75 | no | 1/1 | dark | The footage is too dark and abstract to show the specific items of flashlights and spare batteries as required. |

### L4 `sc_4_y4o5bj`: **b+c**
- narration: Keep needed medicines close,
- line_shows: **Needed medicines are placed together for easy access.**
- queries (first 12 of 20 tried): medicine bottles, prescription medicine, medication organiser, pill bottles, medicine bottle, hands sorting medications, person arranging pills, prescription packets on table, organizing medicine packets, sorting pill organizer, medicine on bedside table, prescription bottles container
- checks: 26 (26 unique clips); depicts {'no': 25, None: 1}; raw 0: 24

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 377600 | A collection of assorted medication capsules and white tablets is shown in a small pile. The camera performs a slow pan  | 1.42–3.58 | no | 3/3 | production | The footage shows a pile of pills but does not depict them being kept together in an accessible, organized, or household-ready way as sugges |
| 28538 | Three workers in blue uniforms and hairnets are engaged in a labor-intensive task involving a large metal mixing machine | 2.92–5.08 | no | 0/0 | production | The footage shows industrial food or pharmaceutical manufacturing workers rather than the requested scene of keeping household medicines acc |
| 33267 | The clip shows microscopic green virus-like particles and an elongated cell-like structure floating in a fluid medium. | 0.42–2.58 | no | 0/0 | none | The clip shows a microscopic biological simulation, which does not depict the required human-scale scene of medicines being organized. |

### L5 `sc_5_7iuvh3`: **a+e**
- narration: where everyone can find them if travel becomes difficult.
- line_shows: **Medicines are kept in a known, accessible home location.**
- queries (first 12 of 20 tried): medicine cabinet, medicine box, prescription storage, medication drawer, home supplies, family finding medicine shelf, open bathroom storage cabinet, labeled medicine shelf, medicine shelf home, taking medicine from cupboard, organized pill storage, family finds medicine shelf
- checks: 26 (26 unique clips); depicts {'no': 26}; raw 0: 24

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 49813 | A healthcare professional wearing blue gloves is seen writing notes on a clipboard in a medical setting. | 3.6–8.4 | no | 2/2 | none | The footage shows a clinical medical setting rather than household medicine storage as required by the script. |
| 105686 | The clip shows an effervescent tablet falling into a glass of water and then slowly dissolving, creating bubbles. | 20.59–25.4 | no | 1/1 | production | The clip shows medicine dissolving in water rather than medicine storage or accessibility. |
| 21617 | The footage displays microscopic views of blood cells floating through a bloodstream. | 18.59–23.4 | no | 0/0 | none | The clip shows biological blood cells, which is completely unrelated to the topic of accessible medicine storage in a home. |

### L6 `sc_6_ziq2e6`: **a**
- narration: Feel for drafts around windows and doors,
- line_shows: **A draft is checked around a window or door.**
- queries (first 12 of 20 tried): window draft, door draft, air leak, window seal, home insulation, hand checking window frame, person inspecting door edge, candle near window frame, checking window for cold, hand near door seal, curtain moving by window, checking door for drafts
- checks: 26 (26 unique clips); depicts {'no': 26}; raw 0: 23

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| img_4912858 (photo) idea | A glass thermometer mounted on a frosted window pane shows a temperature between 1 and 2 degrees. The image is slightly  | 0.0–12.0 | no | 3/3 | none | The image shows a thermometer measuring temperature, not a person inspecting or checking for drafts around a window or door as required. |
| 11293 | A wooden window frame is shown as the camera tilts upward to reveal the top section. | 1.2–4.8 | no | 2/2 | production | The clip shows a window frame but fails to show anyone checking for drafts as required by the script. |
| 39292 | A man walks towards a window covered by closed white curtains in a room with dim lighting. | 0.0–3.6 | no | 2/2 | none | The clip shows a person approaching a window to open curtains rather than checking for drafts around windows and doors. |

### L7 `sc_7_err6lu`: **a**
- narration: and seal gaps before temperatures drop.
- line_shows: **A window or door gap is sealed against drafts.**
- queries (first 12 of 20 tried): weatherstripping door, sealing window, draft stopper, window insulation, weatherstripping window, installing door seal, hands applying caulk window, foam tape window frame, installing foam door strip, caulking door frame, sealing window with tape, applying door weatherstrip
- checks: 26 (26 unique clips); depicts {'no': 26}; raw 0: 25

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 20458 | A static shot shows an old rustic wooden barn door with metal sliding tracks against a blurred forest background. | 0.81–4.19 | no | 1/1 | none | The clip shows a barn door, not a window or door being sealed against drafts. |
| 28236 | The entire clip depicts rain falling on a car windshield. | 5.81–9.19 | no | 0/0 | dark | The footage shows rain on a car windshield instead of the act of sealing a window or door gap. |
| 217379 | The clip shows rain drops trickling down a window pane from inside a home looking out. | 0.81–4.19 | no | 0/0 | none | The clip shows rain on a window rather than the action of sealing a window or door gap. |

### L8 `sc_8_focq4l`: **a+b (compound)**
- narration: Close curtains and set the thermostat to a steady, comfortable temperature throughout the storm.
- line_shows: **Curtains are closed and the thermostat is set steadily.**
- queries (first 12 of 20 tried): closing curtains, setting thermostat, adjusting heating, window curtains, thermostat adjustment, hand drawing curtains closed, person turning thermostat dial, living room curtains shut, closing window blinds, thermostat on wall, adjusting room temperature, living room closed curtains thermostat
- checks: 26 (26 unique clips); depicts {'no': 26}; raw 0: 24

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 39292 | A person walks toward closed curtains, reaches out, and pulls them open. The curtains are now open with daylight visible | 0.0–7.01 | no | 2/2 | none | The footage shows the opposite of closing curtains, as the person opens them to the daylight. |
| 122354 | The curtains are hanging in front of a window and swaying in a breeze throughout the duration of the clip. Curtains are  | 7.0–14.0 | no | 2/2 | none | The curtains are shown swaying in an open window, failing to depict the instruction to close them. |
| 128321 | The clip shows a white curtain blowing in the wind on an outdoor terrace, which contradicts the requirement to show clos | 2.0–9.0 | no | 0/0 | none | The footage shows curtains blowing outdoors on a terrace, which is the opposite of a closed, static curtain inside a house meant to retain h |

### L9 `sc_9_i74txm`: **a (+b)**
- narration: Exposed pipes in cold spaces
- line_shows: **An exposed pipe is visible in a cold space.**
- queries (first 12 of 20 tried): exposed pipes, basement plumbing, unheated pipes, garage pipes, basement water pipes, pipes beneath house, plumbing in crawlspace, water pipes utility room, pipes in basement ceiling, garage plumbing pipes, copper pipes cellar, basement ceiling water pipes
- checks: 26 (26 unique clips); depicts {'no': 26}; raw 0: 25

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 115 | The footage shows a close-up of a faucet dripping water into a sink in dim indoor lighting. The drip occurs continuously | 5.7–8.3 | no | 2/2 | none | The clip shows a dripping faucet, which is related to plumbing, but it is not an exposed household pipe in a cold space. |
| 190323 | A black pipe is shown with water flowing continuously out of it. | 4.7–7.3 | no | 0/0 | none | The footage shows a pipe leaking or flowing with water, which describes an active leak rather than the exposed household pipes mentioned in  |
| 41826 | The observed events exclusively describe construction site activities, including workers using a cement truck and concre | 6.7–9.3 | no | 0/0 | none | The observed footage shows construction work on a foundation rather than exposed household pipes. |

### L10 `sc_10_6gn1eq`: **a**
- narration: may need insulation before freezing weather arrives.
- line_shows: **Pipe insulation is fitted around exposed plumbing.**
- queries (first 12 of 20 tried): pipe insulation, wrapping pipes, foam pipe cover, insulating plumbing, insulating pipes, foam sleeves on pipes, hands fitting pipe foam, insulating basement plumbing, foam pipe sleeve, wrapping pipe insulation, insulated water pipes, foam sleeves basement pipe
- checks: 25 (25 unique clips); depicts {'no': 25}; raw 0: 24

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| img_1103725 (photo) idea | The image shows an industrial piping system with white-painted metal pipes, metal supports, and a control panel, but doe | 0.0–12.0 | no | 2/2 | none | The image depicts an industrial facility rather than the household foam pipe insulation installation required for this step. |
| 201766 | The observed events only show ocean waves crashing on a beach. None of the footage shows plumbing or pipe insulation. | 7.04–10.96 | no | 0/0 | none | The footage shows a beach landscape and ocean waves, which is completely unrelated to the topic of pipe insulation. |
| 190323 | The clip shows water flowing steadily from a black pipe. The footage is captured in natural daylight with a slightly blu | 4.04–7.96 | no | 0/0 | none | The clip shows water flowing from a pipe rather than the process of fitting pipe insulation as required by the script. |

### L11 `sc_11_x9xx46`: **ACCEPTED**
- narration: If freezing becomes a concern,
- line_shows: **A faucet is checked as freezing conditions approach.**
- queries (first 12 of 14 tried): faucet winter, freeze warning, cold weather plumbing, kitchen tap, winter weather alert, phone winter freeze warning, checking freezing weather forecast, cold snap forecast phone, outdoor thermometer freezing, home thermometer below zero, freezing temperature house exterior, frost house winter morning
- checks: 9 (9 unique clips); depicts {'yes': 3, 'no': 6}; raw 0: 6

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 109878 | A stainless steel kitchen faucet is shown with water flowing steadily from its nozzle. | 2.2–4.8 | yes | 10/10 | none | The clip clearly shows a faucet with water running, which matches the visual requirement for checking a tap during freezing conditions. |
| 109881 | A modern kitchen faucet is turned on, and a steady stream of water begins to flow into the sink. | 1.2–3.8 | yes | 10/10 | none | The clip shows the exact action of turning on a faucet, which is the necessary step for preventing frozen pipes as described in the script. |
| 109879 | A person's hands place a glass under a kitchen faucet, and water flows from the faucet into the glass. | 3.7–6.3 | yes | 8/3 | production | The footage clearly demonstrates a faucet dispensing water, which aligns perfectly with the guidance to let water flow to prevent freezing. |

### L12 `sc_12_1qko85`: **b**
- narration: let a small amount of water flow and follow local guidance.
- line_shows: **A faucet runs at a small, steady trickle.**
- queries (first 12 of 11 tried): dripping faucet, running tap, water trickle, winter faucet, running faucet, faucet flowing thin stream, slow running kitchen tap, water streaming from faucet, faucet thin stream, tap running gently, water flowing from spout
- checks: 19 (19 unique clips); depicts {'no': 19}; raw 0: 11

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 2805 | A white plastic water tap is shown in a dimly lit indoor setting. Water is seen dripping from the tap in a downward moti | 0.0–5.69 | no | 3/3 | frozen | The clip shows a dripping tap instead of the required steady, flowing stream of water advised for preventing frozen pipes. |
| 115 | The footage shows a faucet with water dripping from it in a steady, intermittent fashion. | 4.15–9.84 | no | 3/3 | none | The footage shows water dripping from a faucet rather than a small, steady trickle of water as requested. |
| 9517 | A faucet is shown with water dripping from it in a downward motion. | 0.0–5.69 | no | 3/3 | none | The clip shows water dripping rather than a small, steady trickle as required by the script. |

### L13 `sc_13_gqral5`: **a**
- narration: Test smoke and carbon monoxide alarms,
- line_shows: **Smoke and carbon monoxide alarms are tested.**
- queries (first 12 of 20 tried): smoke alarm, carbon monoxide alarm, testing detector, alarm test, smoke alarm test, pressing detector button, hand testing ceiling alarm, testing household safety sensor, pressing smoke detector, testing ceiling sensor, alarm test button, carbon monoxide detector button
- checks: 25 (25 unique clips); depicts {'no': 25}; raw 0: 25

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 15629 | A green analog alarm clock rests on books against a yellow background. The second hand moves continuously around the fac | 3.98–7.03 | no | 0/0 | production | The clip shows an alarm clock, not a smoke or carbon monoxide detector being tested as required by the script. |
| 262188 | A researcher wearing blue gloves works with a petri dish under a microscope in a laboratory setting. | 5.47–8.52 | no | 0/0 | none | The footage shows laboratory research and a petri dish, which is entirely unrelated to testing smoke and carbon monoxide alarms. |
| 3068 | The observed events describe only smoke on a black background. | 3.48–6.53 | no | 0/0 | dark | The clip shows only smoke effects and does not show smoke or carbon monoxide alarms. |

### L14 `sc_14_fjcvg1`: **a**
- narration: and replace weak batteries.
- line_shows: **A weak alarm battery is replaced with a fresh one.**
- queries (first 12 of 20 tried): alarm battery, smoke detector battery, changing batteries, fresh battery, alarm battery replacement, opening smoke detector cover, inserting battery detector, hands replacing alarm cell, changing detector cell, fresh battery smoke alarm, battery compartment alarm, smoke alarm fresh battery
- checks: 25 (25 unique clips); depicts {'no': 25}; raw 0: 25

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 3068 | The clip shows smoke against a black background throughout the entire duration. | 3.75–6.25 | no | 0/0 | dark | The clip shows only smoke and does not contain any action related to replacing batteries. |
| 15629 | A green analog alarm clock sits on a pile of books against a yellow background, with the second hand ticking continuousl | 4.25–6.75 | no | 0/0 | production | The clip shows an alarm clock, but it does not show the required action of replacing a weak battery in a smoke or carbon monoxide alarm. |
| 22200 | The observed clip features people in traditional Aztec-style costumes playing drums in an outdoor public space. At no po | 9.25–11.75 | no | 0/0 | none | The clip shows an Aztec drumming performance, which is completely unrelated to the technical action of replacing a smoke alarm battery. |

### L15 `sc_15_rvt49q`: **a**
- narration: Keep generators outdoors, far from windows,
- line_shows: **A generator operates outdoors at a safe distance from the house.**
- queries (first 12 of 20 tried): outdoor generator, portable generator, generator outside, generator safety, generator positioned safely outdoors away windows, generator beside house, generator on outdoor patio, portable generator in yard, generator on lawn, generator beside garage, portable generator driveway, generator distant from house
- checks: 25 (25 unique clips); depicts {'no': 25}; raw 0: 25

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 202987 | The observation shows a person's hands holding a smartphone and typing on the screen. | 5.97–9.02 | no | 0/0 | none | The footage shows a person typing on a smartphone, which is unrelated to the generator placement described in the line. |
| 14028 | The observed footage shows a boat on a lake, which is unrelated to the generator safety advice. | 9.47–12.52 | no | 0/0 | none | The footage shows a boat on a lake and does not show an outdoor generator as required for this line. |
| 39183 | A man wearing a bicycle helmet is riding a bicycle at night, seen from a perspective with forward motion. | 1.48–4.53 | no | 0/0 | none | The clip shows a man riding a bicycle at night, which is completely unrelated to the required subject of outdoor generator placement. |

### L16 `sc_16_3bqrs5`: **b**
- narration: and never bring an outdoor grill inside for heat.
- line_shows: **Safe indoor warmth comes from the home's heating system, not a grill.**
- queries (first 12 of 20 tried): home heating, radiator heating, indoor thermostat, safe heater, outdoor grill, radiator warming living room, person adjusting home heater, electric space heater indoors, grill outside house, barbecue on patio, outdoor grill beside home, central heating floor vent
- checks: 25 (25 unique clips); depicts {'no': 25}; raw 0: 23

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 42014 | A hand adjusts the dial of a radiator valve from a low setting to a higher setting. | 3.6–8.4 | no | 3/3 | none | The clip shows someone operating a radiator, which is a method of heating, rather than demonstrating the safety warning against using an out |
| 112514 | A hand is shown repeatedly adjusting a white radiator thermostat knob. | 0.1–4.9 | no | 2/2 | none | The clip shows the adjustment of a radiator dial, which is a method of heating control, but does not address the warning about the misuse of |
| 263586 | The video shows a metal camp stove with a fire burning inside it and a pot on top. No other objects or people are presen | 5.1–9.91 | no | 0/0 | none | The clip shows an outdoor grill being used, which is the exact behavior the script is warning against, rather than safe indoor heating. |

### L17 `sc_17_7xjtdo`: **a (compound)**
- narration: Clear gutters and drains, secure loose outdoor items,
- line_shows: **Gutters and drains are cleared and outdoor items secured.**
- queries (first 12 of 20 tried): cleaning gutters, clearing drain, securing furniture, outdoor items, gutter cleaning, hands removing gutter leaves, clearing leaves storm drain, tying down patio furniture, scooping leaves from gutter, clearing blocked downspout, tying patio chairs, homeowner cleaning gutter
- checks: 25 (25 unique clips); depicts {'no': 24, None: 1}; raw 0: 24

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 30704 | The observed events show the interior of a washing machine with clothes rotating inside the drum. | 0.98–5.02 | no | 0/0 | none | The clip shows a washing machine with laundry, which is completely unrelated to clearing gutters or securing outdoor items. |
| 73977 | The observed footage shows water flowing continuously from a metal pipe in a downward motion. | 5.48–9.52 | no | 0/0 | dark | The footage shows water flowing from a pipe, which does not depict clearing gutters or securing outdoor items. |
| 64295 | An excavator is shown clearing a large fallen tree trunk from a river and moving it to a grassy bank. | 8.48–12.52 | no | 0/0 | none | The clip shows heavy construction machinery clearing a river, which is unrelated to clearing gutters or securing outdoor residential items. |

### L18 `sc_18_omvv33`: **b**
- narration: and bring shovels and ice melt within reach.
- line_shows: **A shovel and ice melt are kept ready near an entry.**
- queries (first 12 of 20 tried): snow shovel, ice melt, road salt, winter tools, shovel ice melt placed near entrance, shovel beside front steps, salt bag by doorway, snow shovel entryway, shovel salt by doorway, ice melt container entry, snow shovel in garage, carrying snow shovel ice melt
- checks: 25 (25 unique clips); depicts {'no': 25}; raw 0: 23

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 157204 | Between 0.0 and 3.0 seconds, a metal shovel handle is stuck in the snow. From 3.0 to 4.4 seconds, a person picks up the  | 0.0–4.37 | no | 3/3 | none | The clip shows someone actively shoveling snow rather than keeping tools within reach as preparations before the storm. |
| img_3229747 (photo) idea | A person in camouflage gear and a beanie is on a ladder clearing snow off a cabin roof. | 0.0–12.0 | no | 1/1 | none | The footage shows someone clearing snow from a roof instead of gathering and readying snow shovels and ice melt as requested. |
| 7951 | The observation shows ice crystals melting in a dim, dark environment. | 29.32–33.69 | no | 0/0 | dark | The footage shows melting ice crystals, which does not depict shovels or ice melt tools. |

### L19 `sc_19_yxz4i7`: **b (compound)**
- narration: Park vehicles safely, charge phones
- line_shows: **A vehicle is parked safely and a phone is charging.**
- queries (first 12 of 11 tried): charging phone, parked car, phone charger, winter parking, power bank, car parked in driveway, phone plugged into charger, charging phone beside parked car, car parked garage phone charging, charging phone on kitchen counter, parked vehicle home driveway
- checks: 19 (19 unique clips); depicts {'partly': 3, 'no': 16}; raw 0: 10

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 44082 | A hand approaches a smartphone on a wooden surface with a charging cable, plugs it in, and the screen turns on to indica | 3.2–5.8 | partly | 6/6 | none | The clip shows a phone being charged but does not include the required shot of a parked vehicle. |
| 8501 | A hand places a black smartphone onto a wireless charging stand on a desk. The phone remains stationary on the stand. | 2.7–5.3 | partly | 6/6 | none | The clip shows the smartphone being charged, but it does not show the parked vehicle mentioned in the line. |
| 38084 | A person with manicured red nails holds a silver smartphone and scrolls on the screen with their thumb. The phone remain | 2.7–5.3 | partly | 5/5 | none | The clip shows a person using a smartphone but does not show the phone actively charging as requested in the line. |

### L20 `sc_20_io7ejp`: **b (compound)**
- narration: and backup batteries, and plan to check on neighbors who may need help.
- line_shows: **A backup battery is charged and a neighbor check-in is planned.**
- queries (first 12 of 11 tried): backup battery, power bank, neighbor check, phone power bank, charging phone, charging portable battery, neighbor talking at doorway, person checking on elderly neighbor, charging portable power bank, neighbor at front door, visiting elderly neighbor home
- checks: 19 (19 unique clips); depicts {'no': 17, 'partly': 2}; raw 0: 16

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 44082 | A hand connects a charging cable to a smartphone lying on a wooden table, and the screen turns on to display the chargin | 1.21–7.79 | partly | 5/5 | none | The clip shows the charging of a smartphone, which is part of the required line, but it lacks the neighbor check-in aspect. |
| 8501 | A hand places a smartphone onto a wireless charging stand. The phone remains on the stand and the screen displays a char | 11.71–18.29 | partly | 5/5 | frozen | The clip shows the smartphone being charged, but it fails to depict the required neighbor check-in aspect of the line. |
| 202987 | A person is shown holding a smartphone in their hands. The individual is typing on the touchscreen keyboard with their t | 4.21–10.79 | no | 3/3 | none | The clip shows someone typing on a phone, but it does not depict charging a backup battery or planning to check on a neighbor as required by |

### L21 `sc_21_xb0ljs`: **b (compound) + c (static on snowfall)**
- narration: As snow begins to fall, the home is stocked, protected, and ready. Finish preparations early, then follow local emergenc
- line_shows: **Snow falls outside a prepared, stocked home as local guidance is checked.**
- queries (first 12 of 11 tried): snowfall home, snow outside, emergency update, storm supplies, snowy home, snow falling past house window, stocked pantry in home, person checking local alert phone, snowy house porch supplies, snow falling outside kitchen window, checking weather alert indoors
- checks: 19 (19 unique clips); depicts {'no': 17, 'partly': 2}; raw 0: 11

| clip | observation (pass 1, summarised) | window | depicts | raw/score | artifacts | fit_reason |
|---|---|---|---|---|---|---|
| 49443 | The footage shows a landscape with houses in the distance and snow-covered trees while snow falls steadily. | 1.96–13.04 | partly | 6/6 | none | The shot depicts snowfall over a landscape with houses, but lacks the specific detail of checking local guidance as requested in the line. |
| 255532 | The clip shows an aerial view of a town and neighborhood covered in snow, including a harbor and a mountain range in the | 4.46–15.54 | partly | 5/5 | none | While the clip shows a snowy, prepared-looking neighborhood, it does not depict actual snowfall or someone checking emergency guidance. |
| 2346 | A wooden gate is closed in a snowy environment. Snow is falling throughout the duration of the clip. | 8.96–20.04 | no | 3/3 | frozen | The footage shows a snowy scene with a gate but does not show a home or the specific actions described in the script. |

