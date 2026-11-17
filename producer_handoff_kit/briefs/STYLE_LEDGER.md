# Motion Studio style ledger

Read the last 5–8 entries and every entry for the same customer before planning a production (SKILL.md, Director rules 5 and 5a). Search by customer with `rg -n "customer: <id>" STYLE_LEDGER.md`. Append one entry per delivered job. Newest at the bottom. Keep each entry short.

Format: `## <date> · <jobId or test folder> · <title>` then `- Customer: <customerId or projectId>` · style direction (if any) · concept · type · colour · layout/framing · transitions/texture · engine and layer mix.

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

## 2026-11-16 · caf_9cc3e6cb-4579-430c-8169-9d2e5d50cc51 · tonights_conversation_10min (clip pack, 3 × 9:16)
- Customer: proj_cf42768f02e84875bb47c79f05061164 · no style direction · live panel talk show with audience mic
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
