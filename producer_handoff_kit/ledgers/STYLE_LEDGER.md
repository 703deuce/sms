# Motion Studio style ledger

**This GitHub file is the ONE shared ledger for every production bot (Rick, Nov 21).** Any of the production bots can get the next job, so the last 5 films means the last 5 made by *any* bot. Before planning, run `bash <skill-root>/scripts/ledger/ledger_pull.sh` (refreshes `/workspace/motion_jobs/STYLE_LEDGER.md` from master). After delivery, append your entry with `bash <skill-root>/scripts/ledger/ledger_append.sh <entry.md> <botName>` (pushes straight to master, retries on conflicts). Never keep entries only on a box.

Read the last 5–8 entries and every entry for the same customer before planning a production (SKILL.md, Director rules 5 and 5a). Search by customer with `rg -n "customer: <id>" STYLE_LEDGER.md`. Append one entry per delivered job. Newest at the bottom. Keep each entry short.

Format: `## <date> · <jobId or test folder> · <title>` then `- Customer: <customerId or projectId>` · style direction (if any) · concept · type · colour · layout/framing · transitions/texture · engine and layer mix.

**Variety fields (Rick, Nov 21, RULES_FROM_RICK §12).** Every new entry also adds one line: `- Variety: concept family <…> · claim device <… or none> · ground <dark/light/colour> · type formula <…> · edit mix <~% full-frame footage / ~% designed> · 3D/2.5D <what moments> · cut-outs <yes/no, where> · engines <list>`. Before planning, check the last 5 entries (plus same customer/subject) against these fields per §12.

**Families already used (Nov 16–21), don't repeat within 5 films:** paper/document/stamp/receipt/typewriter (Gunna Paper Trail, Midterms Riso Ballot, Keith Murray Lexicon, One Skill board-card, JD Lawrence script page, Diddy Receipts); broadcast/control-room (Kai Cenat ON AIR, Streamer Awards switcher); physical-object metaphor (vinyl, film slate, marquee, fogged glass, padlock); dot/counter data lattice (Headcount); claim devices: red allegation tags, strike-through, ALLEGEDLY stamps, tally lights.

## 2026-11-16 · motion_tests/gunna_social_30s_mixed · Did Gunna snitch? (30 s, 9:16)
- Concept: vertical news explainer
- Type: Anton display + Inter body; Instrument Serif on the HyperFrames card; bold kinetic captions
- Colour: near-black #0B0B0E, red #E5303B (allegation), gold #F2B544 (facts)
- Layout: single subjects full-frame with punch-ins; group/context footage in framed windows; headline top
- Transitions/texture: gold light sweeps at seams
- Engines: Claude Remotion ×10, Open 3D ×1 (courthouse), HyperFrames ×1 (witness-list card)

## 2026-11-16 · motion_tests/cowboys_49ers_30s · Cowboys vs 49ers highlight (30 s, 9:16)
- Concept: vertical broadcast highlight
- Type: Anton + Inter; Instrument Serif / Inter Tight on the HyperFrames card
- Colour: same #0B0B0E / #E5303B / #F2B544 base plus team red and navy
- Layout: wide plays in framed windows over a blurred fill; single players full-frame; live score bug
- Transitions/texture: yard counters, broadcast cuts
- Engines: Claude Remotion ×10, Open 3D ×1 (stadium aerial), HyperFrames ×1 (box score)

> Steer away next time: both entries share Anton + Inter, the same black/red/gold palette, framed windows over blurred fill, and the Remotion-heavy mix with one Open 3D and one HyperFrames shot.

## 2026-11-16 · motion_tests/gunna_social_30s_v3 · Did Gunna snitch? The Paper Trail (30 s, 9:16 remake)
- Concept: riso tabloid dossier, rumor vs the record (picked over "Group Chat" neon feed and "Tape Rewind" VHS)
- Type: Fraunces 900 italic (SOFT/WONK) display set behind cutouts + Space Mono Bold labels; typewriter, highlighter draw, stamps, counter
- Colour: newsprint #EFE9DC, ink #141414, riso blue #1F4FD8 (claims, duotone), fluoro yellow #F5E50A (on record, halftone)
- Layout: asymmetric collage, vertical right-margin folio, no top header; singles = colour rembg cutouts with blue offset shadow and type behind; groups = duotone torn-paper clippings with tape
- Transitions/texture: page pushes (slideup/left/right) in gbrp, blue page flood ending; paper fibre, p5 halftone, light grain
- Engines: every scene p5 (paper/halftone) + GSAP (type) + FFmpeg (duotone, pushes, grain) via capture.mjs; rembg cutouts S01/S03/S04/S06/S07; D3 witness grid S05. No Remotion/Cinematic/HyperFrames/Open 3D/Dolly.
> Steer away next time: light paper field, Fraunces + Space Mono, blue/yellow riso, torn clippings and stamps.

## 2026-11-16 · motion_tests/chase_outage_30s · Chase outage: Still Loading (30 s, 9:16, same-day news)
- Concept: "Still Loading" glass & ice — a frozen signal; the loading ring is the motif (login spinner → 4,500 gauge → unclosed end ring). Picked over "Error 503" terminal and "Queue at the Branch" street doc.
- Type: Syne ExtraBold (wide display, outline→fill, char stagger, auto-fit) + DM Mono (status rail, decode clocks, sources) + Manrope (posts, quotes)
- Colour: midnight #050B1A → navy #0B1C44, ice #EAF3FF, electric blue #2F7BFF, signal orange #FF6B1A; footage graded cold
- Layout: frosted-glass panes tilted in 3D for every real shot, mid-frame left stacks, vertical left status rail with live ET clock + pulsing status dot, no top header; real app screenshot springs out of a 3D phone
- Transitions/texture: pixelize / hlslice / zoomin / hrslice xfades in gbrp, one hard cut; Pixi data particles that stream then freeze; glass glints, bloom, light grain, vignette
- Engines: three.js S01–S02 (phone + footage pane + camera); PixiJS plate (KawaseBlur bloom) under every scene; GSAP/SplitText/SVG S01–S07; FFmpeg grade/xfade/grain. No Remotion/Cinematic/HyperFrames/Open 3D/p5/D3.
> Steer away next time: dark navy glass panes, Syne + DM Mono, blue/orange, left status rail, loading-ring motif.

## 2026-11-16 · caf_<id>-4579-430c-8169-9d2e5d50cc51 · tonights_conversation_10min (clip pack, 3 × 9:16)
- Customer: proj_<id> · no style direction · live panel talk show with audience mic
- Concept: "Velvet Arches" talk-show lounge luxe (picked over "Hot Mic" and "Church Program")
- Type: Bodoni Moda italic 800-900 (titles, emphasis words, big-word hit, tally numerals) + Bricolage Grotesque 600-800 (captions, kicker, tabs)
- Colour: wine #3B0A1E→#1A050E field, emerald #13785A glow/pills, cream #F4EAD8, champagne #D9B77E hairlines; light grain; source lifted (gamma .82)
- Layout: footage in arch-topped windows with double champagne hairline; punch-in arch for single faces; keyhole stacked tiles for pairs; 16:9 window in arch over blurred fill for wide; header kicker+title, caption band below tiles
- Per clip: h1 emerald pill captions + Audience/Kitty tabs + "accept a scrap." big word; h2 champagne pop captions + her/me balance graphic; h3 caps dim-to-bright captions + challenge tally ×1–×7
- Transitions: arch iris open; source hard cuts; layout swaps only on shot cuts
- Engines: MediaPipe face detection + OpenCV/numpy compositor; GSAP+SVG via capture.mjs (alpha ProRes); FFmpeg grade/overlay/loudnorm. No Remotion/Cinematic/HyperFrames/Open 3D/p5/Pixi.
> Steer away next time: wine/emerald/cream, Bodoni italic + Bricolage, arch windows.

## 2026-11-16 · Rick (test) · Keith Murray 2-min doc · "The Lexicon"
- Look: dark pine/deep-green dictionary page, bone text, lime highlighter swipes, brick rubber stamps; Big Shoulders Display/Text + Spectral serif
- Layout: low-res archive as bordered plates on the page with dictionary entries (headword·pronunciation·senses) in left column; full-bleed punch-ins for single faces (MediaPipe); groups uncropped; right-edge year tabs '93–'23
- Transitions: cuts; pine page-turn wipe at chapters; one dissolve into 2023
- Engines: three.js (open/close page), GSAP+SVG/HTML overlays, D3 chart ladder, rembg cutout, MediaPipe face crop, FFmpeg grade/composite, numpy score/SFX
> Steer away next time: pine/lime/bone, dictionary-entry device, Big Shoulders + Spectral.

## 2026-11-16 · motion_tests/phil_blount_30s · Phil Blount: Pressed in the 203 (30 s, 9:16)
- Customer: Rick (test) · no style direction · picked over "Elm City Night Shift" (sodium streetlight/CB radio) and "City Hall Seal" (proclamation)
- Concept: his own label as a record pressing: NGMC vinyl with tonearm + VU ring, real 2018 covers dealt as sleeves, catalog tags A1–A8, year ticker
- Type: Unbounded Black chrome gradient fill + 18 px magenta extrude + sheen sweep (masked line rise); Sora ExtraBold left-aligned captions, active word magenta, magenta quote bar on Phil's own bites; JetBrains Mono Bold catalog tags typed into magenta bars
- Colour: jet #08080B, hot magenta #FF2D87, chrome, plum #2A0A1C; footage contrasty with magenta-lifted shadows; plates blurred + plum
- Layout: full-bleed face-tracked footage (faces upper third), LOWER type stack (tag y762, hero y836, captions y1100–1240), graphics in the upper half; no top header, no side rail, no windows/masks
- Transitions/texture: hard beat cuts, 6-frame magenta exposure flashes on chapter cuts, record spins in; fine grain + vignette
- Engines: MediaPipe + OpenCV crops (all footage), PixiJS S04 record + S06 sleeves (alpha), Skia CanvasKit full type layer (first production use), FFmpeg grade/composite/grain, numpy 88 BPM score + SFX. No three.js/GSAP/D3/rembg/Remotion/HyperFrames/Cinematic.
> Steer away next time: chrome + magenta on jet, Unbounded + Sora + JetBrains Mono, lower type stack with catalog tags, vinyl/record motif.

## 2026-11-17 · msaj_<id> · Ray J and the apology: "The Retraction" (31 s, 16:9, 854x480)
- Customer: msp_<id> · style "cinematic" · picked over "Split Screens" tale-of-the-tape and "Courtroom Sketch"
- Concept: letterboxed docu-thriller; each claim becomes a serif line later struck through in ultraviolet (strike line = motif); chapter index in top bar, source/credit line in bottom bar
- Type: Newsreader 500 italic (hero lines, quotes) + Archivo 800 expanded caps (labels, stamps, counter, REJECTED) + IBM Plex Mono (bar metadata, footage captions)
- Colour: graphite #0E0F12, bone #EDE8DF, ultraviolet #7B5CFF; footage desaturated .72 / contrast 1.08
- Layout: 2.37:1 letterbox inside 16:9; single faces full frame; two people as side-by-side framed panels (left) + serif claim column (right); vertical source in a framed window; right-side stat column ($20M, 2012 moved left to keep the face whole)
- Transitions/texture: hard cuts, one ultraviolet wipe, 6-frame violet flash on a jump cut, fade out; fine grain + vignette; slow push-ins
- Engines: Remotion (all 7 scenes, composition/type/footage), FFmpeg (conform, grain, assembly, loudness), numpy score/SFX. No GSAP/p5/three/Pixi/Skia/MediaPipe/HyperFrames/Cinematic.
> Steer away next time: ultraviolet on graphite, Newsreader + Archivo + Plex Mono, letterbox-bar metadata, strike-through motif.

## 2026-11-17 · motion_tests/kai_cenat_reggie_2min · Kai Cenat vs Reggie: "ON AIR → ON RECORD" (130 s, 16:9, 1080p)
- Customer: Rick (internal test) · steer "professional, not minimal" · picked over "Court-docket dossier" (too close to Gunna/Ray J) and "Signal vs Noise" (kept as the Pixi chat-field plate)
- Concept: a broadcast void of floating live feeds; a tally pill top-left changes state LIVE (red) → ON RECORD (cyan) → IRL (bone) → ROUND 2 · PENDING; a D3 timeline spine at the bottom walks SEP 27…NOV 8 → NEXT
- Type: Anybody variable (wdth 50→90–130 width-morph on every hot word, wght 900) + Geist Mono (UI/timecode/tags) + Geist (card body)
- Colour: void #0A0A0C, smoke #15161A, bone #F2EFE9, tally red #FF3B2F, signal cyan #59E0FF; footage sat .86 / con 1.06, cool shadows, warm highlights; mono cutouts with coloured type behind them; scanline + halftone texture
- Layout: layered FootageScene (blurred backplate, drifting giant outline word, tilted box with pulsing corner brackets, rail with source TC and RMS meter, two-tier kinetic type with hot word ×1.75 and bar wipe); vertical sources in tall windows with giant type beside them; 3D C&D paper on the right with type on the left
- Transitions: whoosh cuts; 3–5 frame RGB-split + noise + flash glitch at chapter cuts; RETURN print-to-full-frame into IRL; hard cut to black on a sub hit
- Engines: three.js (feed-wall corridor, C&D paper with CanvasTexture), GSAP + SplitText (all type), D3 (spine, 12-month ring, counters), PixiJS (chat field, 6M particle swarm), CSS 3D (phone, X-post card), rembg, MediaPipe, FFmpeg, numpy score/SFX, faster-whisper
> Steer away next time: tally-pill state motif, timeline spine, red/cyan on void, Anybody width-morph + Geist Mono, corner-bracket footage boxes with RMS meters.

## 2026-11-18 · msaj_<id> · customer msp_<id>
- Title: A punchy 10-second TikTok/YouTube Shorts style explainer on the 2026 US midterms (10 s, 9:16, 480x854)
- Style direction: automatic · Concept: "Riso Ballot" (risograph print ballot sheet)
- visualDna: Anton display caps + DM Mono labels; ink #0C1033 / cobalt #1F3BFF / vermilion #FF4A2B on paper #F1EDE2; riso duotone footage with misregistered type; halftone dot fields; seismograph tape motif; framed footage windows with offset shadow; split-screen collision ending
- Engines/layers: S1 FFmpeg riso duotone footage + p5.js halftone/seismograph + editable type; S2 footage window + D3 parliament chart + p5.js tape; S3 footage window + D3 435-seat waffle; S4 D3 Texas map (us-atlas) + photo print + p5.js halftone burst; S5 split footage + p5.js seam + big type; all via headless-browser capture, layered editable package
> Steer away next time: riso duotone + misregistered Anton, seismograph tape, paper/cobalt/vermilion palette.

## 2026-11-18 · motion_jobs/ibf_willie_bam_johnson_60s · Willie "The Bam" Johnson: IBF Spotlight 01 "THE SLATE" (62 s, 9:16, 1080x1920)
- Customer: Rick (Indie Black Film, direct request) · picked over kung-fu title cards and belt-rank ladder
- Concept: his life as a film slate; ROLL 01–05 chalk labels, a 3D clapperboard claps at ACTION / NOW / end tag; framed footage window with sprocket rails
- Type: Saira Extra Condensed Black hero words + Zilla Slab SemiBold Italic credits + Saira Stencil One roll labels/chalk
- Colour: lacquer #0B0A08, saffron #F2A20C, rice paper #EFE6D2, chalk #F7F3EA; warm footage (sat .92/con 1.06)
- Layout: roll label top band, 880x700 window, hero type on the window's lower scrim, credit below, persistent IBF wordmark bug bottom-left
- Transitions/texture: hard cuts, clapper + 2-frame chalk flash, saffron film-burn into NOW; grain, gate weave, dust, scrolling sprockets
- Engines: three.js (clapper, dust), GSAP+DOM/SVG (type), Canvas 2D footage from face_frame/YuNet crops, FFmpeg, numpy taiko/pluck score
> Steer away next time: film-slate/clapper motif, saffron on lacquer, Saira Extra Condensed + Zilla Slab + Stencil, sprocket rails.

## 2026-11-18 · motion_jobs/test_whiteboard_01 · One Skill / Marker Studio (127 s, 9:16, 1080x1920)
- Customer: Rick (internal test, never publish) · standing whiteboard talking-head, professional social edit
- Concept: "ONE SKILL / Marker Studio" — paper board-card that rebuilds the whiteboard argument (flow → skill stack → red X's), with kinetic type, lower-third, section titles, stat punch-outs, and a board close-up
- Type: Teko (display / kinetic / numerals) + Outfit (labels, lower-third, body)
- Colour: ink #10110F, paper #F3F0E7, cream, marker blue #1F4BFF, money green #17A34A, strike #FF3D2E, amber #F0C400; persistent small ONE SKILL bug
- Layout: full-height 9:16 face follow (YuNet, X-only pan, 1.78×); one signature paper card mid-frame that evolves; breakouts for hook, L3, billboard type, TRAFFIC board punch-out, 20/30/50 rate cards, close
- Transitions/texture: hard picture cuts on phrase boundaries; 40 ms audio edge fades; GSAP card/type in/out; no software chrome
- Engines: custom HTML/CSS/GSAP scene in headless Chrome, YuNet face crop, FFmpeg mezzanine + chunk concat, numpy 96 BPM ducked bed, loudnorm −14 LUFS. No Remotion/three.js/Pixi/D3/p5.
> Steer away next time: Teko + Outfit, ink/paper/marker-blue/money-green, evolving paper board-card, ONE SKILL bug.

## 2026-11-19 · motion_tests/abff97_30s · ABFF97: Now Showing (31.5 s, 9:16, 1080x1920)
- Customer: Rick (Indie Black Film, hand-made test, not published) · news story: ABFF launches the ABFF97 theatrical distribution initiative
- Concept: "NOW SHOWING": a cinema marquee letterboard with bulbs. Festival applause turns into a dead marquee ("never reach a theater"), the bulbs come back on, and it ends with ABFF97 on the marquee above a lit AMC screen
- Type: League Gothic on 3D flip tiles + Fraunces Italic labels
- Colour: velvet #0B0507, ivory tiles #F3ECDF, crimson #E3263F, warm bulb amber; small centred "— Indie • BLACK FILM —" wordmark held for the whole film
- Layout: full-bleed graded footage and plates with designed pushes; one marquee board per beat; the bite plays on a screening-room screen (homography plus audience occluder, projector beam and dust); lobby-card lower third; a city bill board
- Engines: GSAP + CSS 3D tiles, Canvas 2D (footage sequences, bulbs, beam, matrix3d screen mapping), puppeteer capture, FFmpeg, numpy score/SFX, ElevenLabs flash v2.5 (Odom)
> Steer away next time: marquee letter tiles, bulb chases, velvet/ivory/crimson, League Gothic + Fraunces Italic, screen-in-auditorium bite.
- 2026-11-19 v2 re-cut (same film): narration recast to Yusuf Hakeem Kiser (nJvj5shg2xu1GKGxqfkE, African-American male narrator); wordmark moved to 82.6% H; hook and "BREAKING OUT" boards re-framed so no tile covers a person. Look unchanged.

## 2026-11-19 · motion_tests/jd_lawrence_5min · CAST OF ONE: The JD Lawrence Story (5:07, 16:9, 1920x1080)
- Customer: Rick (Indie Black Film, hand test for usage measurement, not published) · documentary, ties in to IBF "One on One with JD Lawrence" (Nov 24)
- Concept: "CAST OF ONE": his life told in screenplay grammar. Courier sluglines per chapter (EXT. AMITYVILLE…, INT. THEATER — NIGHT), character cues on each role (ROLE 01…, SCOOTER (a rapper)), a cream script page whose typewriter stutters (I— I— I), a growing cast list "ROLE NN …… JD LAWRENCE" that counts to 72
- Type: Big Shoulders Display 800–900 (hero words/numbers) + Courier Prime (sluglines, cues, cast list, credits)
- Colour: stage black #0B0B0C, script cream #F1EADB, tungsten amber #FFB547, dramedy teal #2FA39B, ink #17130E; warm-neutral grade, stage haze pools
- Layout: full-bleed 16:9 footage with type on the empty side behind gradient scrims; tilted cream-bordered "print" cards on a hazy stage for low-res/archival sources with type beside them; record montage in an amber-framed window with a live counter + cast list; fake-3D photo-album page flip; bug bottom-right ("INDIE" amber Courier over "BLACK FILM")
- Transitions/texture: hard cuts on phrases, typed sluglines with carriage-return ding, accelerating 14-cut montage into a white-flash 72 slam; grain, haze, vignette
- Engines: Canvas 2D throughout (custom eases, typing engine, album flip), puppeteer capture (resumable 300-frame segments), FFmpeg, numpy procedural piano score + typewriter SFX, faster-whisper, ElevenLabs flash v2.5 (Joshua – Powerful and Warm)
> Steer away next time: screenplay/Courier sluglines and character cues, cast-list counter, script page, Big Shoulders + Courier Prime, amber-on-stage-black with haze.

## 2026-11-19 · msaj_7eede2b4-beaf-497b-ad14-7ec5c7d4bfc5 · THE UNLOCK: GTA VI Launch Day (60 s, 16:9, 854x480)
- Customer: workspace ws_1 / project msp_93b3357b079c4e508ea7e51f605a908e · news/culture launch-day report: hype, critics, sales, fan reaction and backlash for Grand Theft Auto VI
- Concept: "THE UNLOCK": thirteen years of waiting released in one day. Giant Unbounded numerals are the spine (13 / 90 / 99 / $2.36B / 54.5%), hard 12-degree diagonal slash wipes and slanted photo panels, a padlock that opens on "unlocked"; the "BUT" turn flips the palette to cold cyan static with a live FPS-drop chart, then resolves back to sunset on the Metacritic cliffhanger
- Type: Unbounded 800-900 (numerals, titles) + Bricolage Grotesque (labels, sources)
- Colour: indigo #12062B, hot magenta #FF2E88, tangerine #FFB347, cyan #2DE2E6, bone #FFF4E6; footage graded duotone-hot (indigo shadows, magenta-to-tangerine mids), cold teal for the turn; no persistent chrome
- Layout: full-frame trailer footage with type in the bottom band or on a scrim, slanted triple photo panels for the Miami queue, split verdict bar 54.5/45.5, quote card for the fan line
- Engines: Canvas 2D single-page film (custom eases, count-ups, RGB split, scanlines, keyed grain), atlas frame packs (ffmpeg), numpy procedural synth score + SFX, ElevenLabs flash v2.5 (Desmond - Trailer & Ad), faster-whisper not used
> Steer away next time: slash/diagonal wipes + slanted panels, giant gradient numerals in Unbounded, magenta-tangerine-cyan sunset duotone, padlock/unlock motif, split-bar verdict.

## 2026-11-20 · msaj_5630bfc9-bb2d-4f00-8777-8920740dfa65 · THE HEADCOUNT: Streamers and Viewbotting (60 s, 16:9, 854x480)
- Customer: workspace ws_1 / project msp_04d8db8d6a78478da1837e5c04f6a16a · explainer/exposé: what viewbotting is, why it hurts streaming and viewers, real cases (QueenGloriaRP, Nick White), current Twitch/Kick crackdowns
- Concept: "THE HEADCOUNT": a live viewer count made visible as a lattice of dots; real viewers are filled mint dots, bots are hollow ghost rings that flood in, get flagged tomato and purged. A giant counter opens ("12,847" then "0 actually watching") and closes the film; hero moments = ghost wave, rankings climb with a #N numeral, 1-in-10 grid, scan-line purge
- Type: Syne 800 (headlines, numerals) + Martian Mono (counter labels, tags, sources)
- Colour: graphite-navy #0A0F18, mint #3DFFC0, ghost slate #6F7F96, white #F3F6FA, tomato #FF5B35 (exposed/banned only); footage cool-graded with a halftone dot edge-fade; transitions = dot-lattice iris (staggered radial dot growth); no persistent chrome
- Engines: Canvas 2D single-page film (custom eases, dot lattice, frame-keyed grain), atlas frame packs (ffmpeg), numpy SFX + ElevenLabs Music (2 cues) mix, ElevenLabs flash v2.5 (Roxy - Bold, Elegant and Captivating), faster-whisper for transcript check of the Nick White clip; Modal CPU fan-out render
> Steer away next time: dot-lattice/halftone-dot motif and dot-iris transitions, giant wide Syne numerals + Martian Mono tags, graphite + mint + tomato palette, real-vs-ghost crowd metaphor, rank-climb list.

## 2026-11-20 · msaj_9b841a11-996d-4bbc-bec0-1328cf844e77 · THE WRONG CAMERA: What Went Wrong at the Streamer Awards (60 s, 16:9, 854x480)
- Customer: workspace ws_1 / project msp_78524a397758416999bb81d4afb51d4a · news/culture breakdown: 2025 production backlash, QTCinderella's tearful stream, 2026 nominee/voting/length/red-carpet complaints
- Concept: "THE WRONG CAMERA": the film is a broadcast switcher. Test-pattern open, a viewfinder that hunts a silhouette stage and locks onto the wrong person, yellow chyron slabs for names, a tally light that goes red as claims land, an "ON AIR" light that closes the film
- Type: Antonio 700 (headlines, numerals) + Chivo 800 (labels, sources)
- Colour: studio black #0C0C10, control-room cobalt #2A3CFF, chyron yellow #FFD60A, tally red #FF2E3B, bone #F4F1EA, steel #8A93A8; photos and clip graded cobalt-shadow monitor look with scanlines; no persistent chrome
- Layout/transitions: full-frame QT clip with scrim, nominee slats + giant 0 numeral, photo cards with yellow chyron, vote bars, analog clock, red-carpet perspective runner; transitions = venetian-blind shutter (cobalt slats, yellow edge)
- Engines: Canvas 2D single-page film (custom eases, shutter transitions, keyed grain), atlas frame packs (ffmpeg), numpy SFX + ElevenLabs Music (2 cues) mix, ElevenLabs flash v2.5 (James - Conversational, Energetic, Punchy), faster-whisper timing check; self-hosted CPU fan-out render
> Steer away next time: test-pattern/color-bar broadcast-switcher world, shutter/venetian-blind wipes, Antonio + Chivo, cobalt + chyron-yellow + tally-red, viewfinder brackets, yellow name slabs, red-carpet runner, analog clock.

## 2026-11-20 · msaj_fef36425-0c83-4639-9f81-8ddd1f8d3895 · MULTISYLLABIC: The Keith Murray Story (120 s, 16:9, 854x480)
- Customer: workspace ws_1 / project msp_93fb33d2906744c780e6641775e2e3db · music biography: Keith Murray (Def Squad rapper) career from Central Islip to Lord of the Metaphor
- Concept: "MULTISYLLABIC": his complex multi-syllable flow as a marked-up rhyme sheet; word/syllable chips are chained by hand-drawn highlighter arcs; each chapter is a bold flat colour field (no dark grounds); real freestyle audio opens and closes the film
- Type: Bowlby One (hero) + Space Mono Bold (chips, tags)
- Colour: chartreuse #C8F23C, coral #FF5A4D, cream #FFF4DD, sky #8FD3FF, plum ink #2B1030 (type only), gold seal #FFC83D; photos and footage graded plum-coral-cream tritone; sticker cards with flat offset shadows; ruled-paper lines; transitions = expanding ring wipe with highlighter edge that floods the next colour field
- Engines: Canvas 2D single-page film (custom eases, arcs, chips, tritone grade), atlas frame packs (ffmpeg), numpy SFX + ElevenLabs Music (2 cues) mix, ElevenLabs flash v2.5 (Black Jack - Deep, Smooth & Commanding), faster-whisper check; self-hosted CPU fan-out render
> Steer away next time: flat bright colour-field + sticker-card look, highlighter arcs/chips, ring-flood wipes, Bowlby One + Space Mono, chartreuse + coral + cream + sky palette, vinyl/calendar/timeline motifs.

## 2026-11-20 · msaj_13af4dbf-6d3a-4378-a815-1ecbf3a5f47e · THE GLASS: Bloodhound Lil Jeff, his death (60 s, 16:9, 854x480)
- Customer: workspace ws_1 / project msp_df813b3b07d941f9bcfde6680746bb77 · short respectful memorial/news documentary on Chicago drill rapper Bloodhound Lil Jeff (Jeffery Lamar Harris), killed June 8, 2024
- Concept: "THE GLASS": everything is seen through a rain-streaked, fogged window at dusk. Fog dissolves are the transitions, defocus pulses on clip cuts, real vertical phone clips sit in glass panels over their own blurred backdrops, and the date and name are etched into the condensation (open "06 · 08 · 24", close "JEFFERY LAMAR HARRIS 2002 — 2024")
- Type: Gloock (headlines, numerals) + Familjen Grotesk 600-700 (labels)
- Colour: dusk slate #8E9BB2→#212B3A, fog #C8CFD6, bone #F3F0E8, sky #9DB6CE, rose #D2495A (hedge/accent only); footage graded cool, desaturated, soft halation; rain drops, bokeh, vignette, frame-keyed grain
- Engines: Canvas 2D single-page film (fog mask field, defocus, etch masks, drops), atlas frame packs (ffmpeg), numpy SFX + ElevenLabs Music (2 cues, score, no drums), ElevenLabs flash v2.5 (Declan - Serious & Straightforward), faster-whisper clip-audio check; self-hosted CPU fan-out render
> Steer away next time: fogged-glass/rain-on-window world, fog-dissolve + defocus transitions, etched-in-condensation text, Gloock + Familjen Grotesk, dusk slate + fog grey + bone + rose, vertical phone clip in glass panel over blurred backdrop, analog clock/street-sign cards.

## 2026-11-21 · msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e · THE RECEIPTS: Diddy v. Ray J (30 s, 16:9, 854x480)
- Concept: THE RECEIPTS. Thermal-receipt world: oxblood room, cream paper slips that print line by line, red stamps that thud (REPORTEDLY/CLAIMED/ALLEGEDLY), taped prints holding real clips and duotone photos, perforated tear-band wipes, ghost outlined dates.
- Type: Dela Gothic One (hero lines, stamps) + Courier Prime Bold/Regular (receipt print).
- Colour: oxblood #1A0709, cream #F0E6CF, stamp red #C4281E, brass #D9A441, ink #22120F.
- Layout: slip top-hung on one side, taped print on the other; end card = two prints flanking a final-statement slip.
- Engines: Canvas-2D page (deterministic seek), JPEG atlas footage packs, ffmpeg conform.
- Steer away next time: paper/receipt slips, stamps, cream-on-oxblood, tear-band wipes.
- Variety: concept family paper/document/stamp · claim device REPORTEDLY/CLAIMED/ALLEGEDLY stamps · ground dark (oxblood) · type formula display + mono (Dela Gothic + Courier Prime) · edit mix mostly designed (footage in taped prints) · 3D/2.5D none · cut-outs no · engines Canvas 2D only
