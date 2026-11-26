---
name: lab-engine-cinematic
description: How to use the Cinematic Skill engine (Python): voice -> timing clock, a 2.5D world of prints/cards/maps/counters/stamps with one moving camera, SFX cues, mix, render flags. Any topic.
when_to_use: Attached at the voice/timing stage and, when scenes/plan.json picks it, at the build stage (by video-stage); named by lab-video-engines.
page_line: Main engine page: voice and timing clock, and the picture of any real production (one designed world, one moving camera, maps, prints, counters).
attach_roles: stage
---

# Cinematic Skill engine

**This is the main engine: it carries the picture of any real production.** Remotion only adds type and
small overlays on top. Footage lives in this world: it enters from a print and returns to it.

`CS=/opt/engines/repos/cinematic-skill/skills/cinematic-film` (Python, MIT). It renders a designed wall/desk/
map world with a continuous spline camera, spotlight, motion blur, grain, and auto SFX cues on every item. It
**cannot play video** itself: footage enters by RETURN (`reference.md#Footage RETURN`). Item table, camera rules, full snippets: `reference.md`
(and `$CS/references/film.md`). Unattended runs: **skip the upstream "Gate" approvals**; review stills yourself.

## Voice and the shared clock (voice stage)
```bash
cd $CS/scripts && P=/workspace/jobs/<job>/film
python3 new_project.py $P --title "<Title>"              # script.json, photos.json, scene.py template
# write script.json (lab-video-story), then ElevenLabs per take -> WAV (voice from lab-video-voice):
python3 tts_say.py --project $P --cmd 'tts "$(cat {txt})" -o {out}.mp3 --voice <id> --speed 0.85 >/dev/null && ffmpeg -v error -y -i {out}.mp3 {out}'
python3 split_takes.py --project $P && python3 build_narration.py --project $P --tail 1.5
```
`$P/audio/timing.json` (segments id/start/end) and `audio/narration.m4a` are now the clock for **every** engine.
Fix a line with flagged split by `audio/overrides.json` or re-record that take (`--only T02`).

## Assets
- Photos: `fetch_commons.py search "<words>"`, add `{"id":"P01","kind":"photo","commons":"File:..."}` or
  `{"id":"P02","kind":"photo","url":"...","credit":"...","license":"..."}` (or `"file"` already in
  `assets/photos/`) to photos.json, then `fetch_commons.py get --project $P` and
  `prep_assets.py --project $P --grade natural` (bw/sepia for archive stories).
- Maps: `map.json` + `make_map.py --project $P`, then `GeoMap(doc.map("us"), K)`.

## scene.py essentials (tested documentary example: `/workspace/skills/lab-engine-cinematic/example_scene.py`)
- `L(i)` line start, `E(i)` line end, `W(i,"word")` when a spoken word lands. Units: 4K px at zoom 1.
- Clusters per section, ~one print width apart; `film.shot(t, x, y, zoom, rot)` every 0.6-3 s; push in
  0.5 -> 0.9 -> 1.2 on the hero, pull back 0.2-0.35, whip 0.8-1.2 s between clusters, land 0.3 s after an item.
- Items: `Print`, `PaperDoc`, `Card`, `BigText`, `Counter`, `Stamp`, `PenMark`, `StringLine`, `FilmFrame`,
  `GeoMap`, `MapPin`, `Route`, `DotField`, `Ledger`, `Chalk`. Every item takes `t_out`, `z`, `sfx=False`.
- Looks: `wall` (true stories), `slate` (politics/business/court), `charcoal` (colour photos lead), `paper`,
  `studio` (products/explainers), `blueprint` (science), `night` (tech/space). One accent colour.
- Spotlight the hero: `film.focus(t, x, y, radius, strength)`.

## Review and render (854x480 unless asked otherwise)
```bash
python3 render.py --project $P --probe 1.5,4,7.5 --size 854x480          # stills -> $P/out/probe/, look at all
python3 render.py --project $P --strip 9:11:8 --size 854x480              # a camera move as a contact sheet
python3 render.py --project $P --size 854x480 --workers 1 --crf 26 --t0 0 --t1 9.4 --out out/seg01.mp4
python3 render.py --project $P --cues && python3 build_sfx.py --project $P   # sfx_cues.json -> audio/sfx.wav
python3 mix_soundtrack.py --project $P --music music/bed.mp3 --lufs -14    # -> audio/mix.m4a (ducked)
```
Speed at 854x480: ~16 fps per worker (30 s film ~ 1 min). A segment for a mixed film is `--t0/--t1` on the
same timeline (no `--audio`); the editor (lab-video-edit) joins segments and muxes `audio/mix.m4a`.
