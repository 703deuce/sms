# Script editor UI gap audit (vs `descript/ui-layouts.md` + `PROGRESS.md`)

**Audited:** 2026-10-27 · **Web SHA:** `3f7c1171f` · **Spec:** `docs/clips/descript/ui-layouts.md` §0–§27.

Legend: **OK** shipped · **PARTIAL** UI exists, spec gaps remain · **STUB** placeholder · **MISSING** not built · **LATER** spec defers · **OTHER** owned by parallel agent (see `SCRIPT-EDITOR-BUILD.md`).

| § | Area | Status | Notes |
|---|------|--------|-------|
| 1 | Home / Drive | OTHER | Parallel agent |
| 2 | New project & import | OTHER | Parallel agent |
| 3 | Editor shell | PARTIAL | Top bar, rail, timeline, storyboard OK; missing View menu (§3.4), app menu (§3.5), playback speed menu, centre transport play/record cluster, top-bar VU popover, breadcrumb Library path, collaborator stack |
| 4 | Script selection / context | PARTIAL | Toolbar + context menu OK; missing highlight colours, regenerate/Overdub, write mode ring |
| 5 | Filler / gap review bar | OK | Find modes + review bar |
| 6 | Captions panel | PARTIAL | Presets OK; missing animation grid, keyword rules UI depth |
| 7 | Properties (scene/layer/effects) | PARTIAL | Aspect/captions/volume OK; EQ/Compressor/Reverb **LATER** per §13.7 |
| 8 | Scenes & storyboard | PARTIAL | Scenes strip + storyboard panel; drag-reorder markers on canvas **PARTIAL** |
| 9 | Layouts & packs | PARTIAL | Layout picker + packs list; Smart Fill / remix **MISSING** |
| 10 | Canvas layers | STUB | Overlays/elements panel; waveform/progress bar layers **MISSING** |
| 11 | Media & stock | PARTIAL | B-roll attach; stock search **STUB** |
| 12 | Music & SFX | OK | Generate + lane; stock browse **PARTIAL** |
| 13 | Studio Sound / auto-level / room tone / VU | PARTIAL | Studio Sound + auto-level + room tone **OK**; VU on preview + transport **PARTIAL** (no timeline dB lane); EQ **LATER** |
| 14 | Markers & chapters | PARTIAL | `#`, list, AI chapters **OK**; drag ruler markers **PARTIAL** |
| 15 | AI tools | PARTIAL | Clean-up tools wired to LLM/jobs; Underlord/AI Producer chat **LATER**; Look good / Write / Clips categories **MISSING** |
| 16 | Comments | PARTIAL | Panel + pins; @mentions **PARTIAL** |
| 17 | Share & publish | OTHER | Parallel agent (web publish in export **OK**) |
| 18 | Export popover | PARTIAL | Video/audio/srt/vtt/transcript tabs; missing GIF/Timeline tabs, batch clips, YouTube/Captivate destinations, soft subtitle mux (**open**), export disabled while transcribing |
| 19 | Version history | PARTIAL | Panel OK; filter “major only” **MISSING** |
| 20 | Settings modal | PARTIAL | Editor settings modal; full app settings **OTHER** |
| 21–25 | Recording / Rooms | PARTIAL | Editor recorder bar + teleprompter; LiveKit rooms **M14–M16** |
| 26 | Multicam sequence | PARTIAL | Auto multicam scenes **OK**; multitrack sync UI **MISSING** |
| 27 | Project panel | PARTIAL | Compositions list **OK**; files/import PDF **OTHER** |

## Export reliability (open → fixed in this pass)

| Issue | Severity | Fix |
|-------|----------|-----|
| Audio/Subtitles tabs called video export (`exportKind: video`) | **P0** | Pass `audio` / `srt` / `vtt` from popover |
| `burnCaptions` ignored on worker | **P0** | Apply `settings.burnCaptions` → `edits.captions.enabled` |
| No cancel during export | **P1** | DELETE render route + Cancel in UI |
| Subtitle format select uncontrolled | **P1** | Controlled `subtitleFormat` state |
| `includeSubtitleTrack` not muxed into MP4 | **P2** | Still sidecar-only via srt/vtt export; soft subs **TODO** |
| Orphan QUEUED render without job | **P2** | Re-enqueue on new export attempt (existing logic) |

## Next fixes (item 2 queue — stop if InVideo/Pictory spec lands)

1. Export: disable while project `transcribing` + tooltip (§18.3)
2. View menu + playback speed (§3.3–3.4)
3. Transcript export: real word list from bootstrap (not placeholder MD)
4. Include subtitle track: mux `mov_text` or deliver `.srt` alongside MP4
5. GIF / FCPXML export tabs (**LATER** unless owner promotes)

**Not started:** text-to-video (InVideo/Pictory) — waiting on owner spec.
