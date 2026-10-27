# Transovo AI CLIPPER + STREAMER: best-in-class reference study

Prepared for Rick James by Grok Bot on Mon Oct 26, 2026 (ET).
Companion files:
- UI layout spec: `docs/clips/clipper/clipper-streamer-ui-layouts.md`
- Screenshots (not in repo): `coolify-server:/opt/transovo-refs/clipper-refs/<tool>/`
- **Phase 2 gate:** do not start clipper/streamer BIC work until Descript milestones **M4.1–M17** are complete.
- **Diarization (Transovo):** primary is **Deepgram Nova-3 with diarization** (already in production). Do not add pyannote unless integration tests show Nova-3 diarization is insufficient.

Research rules followed: public pages, help centers, pricing pages and marketing images only. Nothing was signed up for, and no repo, server or account was touched.

The "Transovo" column comes from the existing plans in `/workspace/plan/clipping_build_plan.md` (milestones M0–M18) and `/workspace/plan/streamer_build_spec.md` (milestones S0–S15). It shows what is planned, not what is shipped. Build status was not checked because the server was off-limits.

## 0. Market snapshot (Oct 2026)

| Tool | What it is now | Price (USD/mo, monthly billing unless noted) | Source |
|---|---|---|---|
| **OpusClip** | Benchmark long-to-short clipper. Models: ClipAnything (multimodal) and ClipBasic. 7 auto layouts, virality score, brand templates, scheduler, XML export, API/MCP | Free $0 · Starter $15 · Pro $29 · Business custom | opus.pro/pricing, help.opus.pro |
| **Klap** | Link-in clipper. "AI Reframe 2" classifies screen zones (webcam, gameplay, screen share) and builds split, PiP, gaming and 3–4 grid layouts. 52 languages, publishing, API/MCP/Zapier | Basic $14 (100 clips) · Pro $39 (300) · Pro+ $94 (1000), billed yearly | klap.app, klap.app/tools/long-video-to-short-video-converter |
| **Vizard** | Clipper plus text-based editor and agent, caption translation, AI emojis and B-roll, scheduling (6 social accounts on Creator, 20 on Business), 4K export on Creator | Free (60 credits, 720p) · Creator $29 ($14.5 yearly) · Business $39 ($19.5 yearly) | vizard.ai, help.vizard.ai |
| **Submagic** | Caption-first editor plus Magic Clips. Auto zoom, B-roll, SFX, music, transitions; 123 languages | Starter $19 · Pro $39 · Business $69 (yearly $12/$23/$41); API $0.10–0.23/min | submagic.co |
| **Descript** | Full editor with "Create clips" (1–20 clips, 10 s–5 min, layout packs, topic prompt). Each clip gets a rating and a "why". Automatic Multicam picks the active speaker | Part of Descript plans | help.descript.com/repurpose/create-clips-from-your-content, Descript changelog v91 |
| **Munch** | Has pivoted to "Munch Studio" (social marketing for businesses); no longer a clipping benchmark | – | getmunch.com |
| **StreamLadder** | Streamer clip editor (facecam/gameplay layouts) plus ClipGPT VOD clipping (0–100 score, ≤30 clips per stream, "clip that" voice markers), Content Publisher | Free · Starter $15 · Creator $27 (ClipGPT) · Pro $39 (4K60, X posting, team workspaces); yearly = 10× monthly | streamladder.com/blog/streamladder-upgraded-subscription-plans; saashunter.si (pricing checked Oct 14, 2026) |
| **Eklipse** | Streamer auto-highlights (3,000+ games). Gameplay Intelligence: game events + separated voice/game audio + action density + continuity + chat velocity. Live Clipping (CoD beta), Content Agent autopilot, Studio, Publisher | Premium $24.99 · Premium Pro $39.99 | eklipse.gg, eklipse.gg/help/* |
| **Medal** | Windows desktop recorder with a replay buffer; per-game auto-clipping events; developer auto-clipping API | Free core; Medal+ | medal.tv/auto-clipping |
| **Sizzle** | Links Twitch/YouTube; filters by kills, knockdowns, headshots and wins; "Universal AI" for other games; vertical export, mashups | Not captured | sizzle.gg |
| **Powder** | Shut down (powder.gg redirects to a farewell Google Doc) | – | powder.gg |
| **Twitch native** | Clips now save in both landscape and portrait (Full or Stacked). **Auto Clips (invite-only alpha)** auto-creates, captions, titles and publishes; "Twitch, clip that" captures the last 60 s; clips are ready within about 30 min. API: Create Clip (live, with duration and title) and Clip-from-VOD (open beta, 5–60 s) | Free | help.twitch.tv/s/article/auto-clips, help.twitch.tv/s/article/how-to-use-clips, dev.twitch.tv/docs/api/clips, discuss.dev.twitch.com/t/64492 |
| **Streamer.bot** | Local automation. "Twitch › Create Clip" sub-action (5–60 s) fired by chat commands or hype-word triggers with cooldowns | Free | docs.streamer.bot/api/sub-actions/twitch/channel/create-clip |

**Main takeaway**
- On talking-head content, the top tools compete on four things:
  1. **Picking good moments**, with an explainable score.
  2. **Layout intelligence**: split, 3–4 grids, screen share and gameplay layouts chosen automatically per scene, and overridable per segment.
  3. **Caption and motion polish**: keyword color, emojis, zooms, B-roll, SFX.
  4. **One-click distribution**: scheduling across platforms.
- On streamer content they compete on:
  1. **Multi-signal highlight detection**: chat velocity, voice-versus-game audio, game events, viewer clips.
  2. **Auto facecam/gameplay framing**.
  3. **Time-to-clip**: Eklipse Live Clipping, and Twitch Auto Clips at about 30 min.
- Twitch itself now gives away portrait clips and alpha auto-clips. That raises the bar: Transovo must beat "free and native" on quality and control.

Legend: ✓ = has it · ~ = partial or basic · ✗ = no · ? = not verified.
Transovo column: **Plan Mx/Sx** = in the build plan · **Proto** = exists in the speakercrop prototype · **✗** = not planned.
Priority:
- **P0** = needed to be credible as best in class.
- **P1** = strong differentiator, needed soon after.
- **P2** = nice to have.

## 1. Feature matrix: CLIPPER

### 1.1 Moment detection, scoring, hooks, titles

| Feature | Opus | Klap | Vizard | Submagic | Descript | Transovo | Pri |
|---|---|---|---|---|---|---|---|
| Transcript-LLM moment picking | ✓ ClipBasic | ✓ | ✓ | ✓ | ✓ | Plan M4 (gpt-6-luna) | P0 |
| Multimodal picking (visual + audio + sentiment, non-talking video) | ✓ ClipAnything | ~ | ~ | ? | ? | Plan M8 (Gemini vision shortlist) | P0 |
| Natural-language prompt ("moments about pricing") | ✓ | ? | ✓ | ? | ✓ topic/goal | Plan M2/M4 | P0 |
| Genre / narrative templates (podcast, sports, vlog…) | ✓ | ✗ | ✓ templates | ✗ | layout packs | ✗ | P1 |
| Clip-length buckets (Auto, <30 s … 10–15 min) | ✓ 8 buckets | ~ | ✓ multi-select | ? | ✓ 10 s–5 min | Plan M2 | P0 |
| Processing timeframe slider (clip only part of the source) | ✓ "credit saver" | ✗ | ? | ✗ | ✗ | Plan (rangeStart/End) | P1 |
| Score 0–99/100 | ✓ | ✓ | ✓ | ✓ | ✓ rating | Plan M4 | P0 |
| Sub-scores with reasons (Hook/Flow/Value/Trend letter grades) | ✓ | ✗ | ✗ | ✗ | ✓ "why selected" | Plan M4 (hook/flow/value numbers) | P0 – add **Trend** and plain-language **why** |
| Thumbs up/down that hides a clip; reject and replace | ✓ dislike hides | ? | ? | ? | ✓ reject/replace | ✗ | P1 |
| Clip count scaled to source (Klap ~5 per min of short video) | ✓ | ✓ | ✓ | ✓ 20+ | 1–20 | Plan (≤20, ~1 per 3 min) | P1 – allow up to 50 on long sources |
| AI hook (title overlay at clip start) | ✓ AI hook + auto headline | ✓ | ✓ | ✓ AI hook title | ~ | ~ (LLM returns hook score, no overlay) | P0 |
| Generated title, description and hashtags per platform | ✓ | ✓ | ✓ | ✓ | ~ | ~ (title only) | P0 |
| Clip "variety" (different edit styles from one source) | ~ templates | ~ | ✓ templates | ~ | ✓ layout packs | ✗ | P1 |
| Source length limit | 10 h | ? | ? | 2–30 min per plan | – | Plan 3 h clipper / 12 h streamer | P1 |
| Speed / ETA | ClipAnything 20–40 min; others "minutes" | "~30 s" for 10+ clips (marketing) | minutes | minutes | minutes | about 35–40 s per source min on 8 cores (prototype README) | P0 – show a live ETA |

### 1.2 Reframe, auto layouts, multi-person tracking

| Feature | Opus | Klap | Vizard | Submagic | Descript | StreamLadder | Transovo | Pri |
|---|---|---|---|---|---|---|---|---|
| Single speaker follow (smooth, moving speaker) | ✓ Moving Speaker Tracking | ✓ | ✓ | ✓ | ✓ multicam | ~ | Proto (2-speaker speakercrop) | P0 |
| 2-up split (both visible, emphasis by talker) | ✓ Split (only if both in frame together) | ✓ | ✓ | ✓ (marketing image: side-by-side split) | ✓ | ✓ side-by-side | ✗ (the plan rejects split: "Why not split-screen?") | **P0 – reverse that call; offer both** |
| 3-person and 4-person grids | ✓ Three / Four | ✓ | ? | ? | ✓ custom layouts | ✗ | ✗ | **P0** |
| Gameplay + facecam stack (cam box detected) | ✓ Gameplay (30/70) | ✓ Gaming | ? | ✗ | ✗ | ✓ manual boxes + auto-detect | Plan S7 (40/60 default) | P0 |
| Screen share + speaker | ✓ Screenshare (screen top, speaker bottom) | ✓ Screencast | ✓ (Zoom side-by-side) | ✗ | ✓ | ✗ | ✗ | P0 |
| Picture-in-picture | ✓ B-roll PIP | ✓ | ? | ✗ | ✓ | ✓ | ✗ | P1 |
| Fit (letterbox with blurred pad, 4:3 or 1:1 crop) | ✓ | ✓ | ✓ | ? | ✓ | ✓ | Plan ("Fit with blur") | P0 |
| AI picks the layout **per scene/segment** inside one clip | ✓ ("applicable auto layouts" multi-select) | ✓ | ~ | ✗ | ✓ | ✗ | ✗ | **P0** |
| Per-segment layout override on the timeline (multi-select segments) | ✓ | ✓ per clip | ✓ split + crop | ✗ | ✓ | ✗ | Plan M6 (per-shot "Focus on A/B/Both") | P0 |
| Manual crop per segment (drag box) | ✓ X / double-click | ✓ | ✓ | ✓ | ✓ | ✓ | Plan M6 | P0 |
| Click-to-track any subject (objects, animals) | ✓ Tracker | ✓ saliency | ✗ | ✗ | ✗ | ✗ | Plan M8 (subject follow) | P1 |
| Pin first speaker in the top slot | ✓ option | ? | ✗ | ✗ | ? | – | ✗ | P1 |
| 3–5 people with persistent identity (re-ID across shots/cams) | ~ (who-speaks-most ranks slots) | ~ | ✗ (help doc admits wrong-person failures) | ✗ | ✓ multicam (separate feeds) | ✗ | ✗ (prototype = 2 people) | **P0** |
| Wrong-speaker protection (min shot length, hysteresis, backchannel ignore) | ✓ smooth shifting | ? | ✗ | ? | ✓ | – | Proto (HYST, LEAD, MIN_SEG, EASE) | P0 |
| Diarization-backed speaker colors in captions | ✓ Business | ✗ | ✗ | ✗ | ✓ | – | Plan (2 colors) | P1 – up to 5 |
| Aspect outputs 9:16 / 1:1 / 16:9 / 4:5 | 9:16, 1:1, 16:9 | ✓ | 9:16, 1:1 | ✓ | ✓ | 9:16, 16:9, 1:1 | 9:16 (+16:9 thumbs) | P0 – add 1:1, 4:5, 16:9 |

### 1.3 Captions, emphasis, motion, B-roll, music

| Feature | Opus | Klap | Vizard | Submagic | Descript | StreamLadder | Transovo | Pri |
|---|---|---|---|---|---|---|---|---|
| Animated word-by-word presets | ✓ | ✓ | ✓ | ✓ (largest library) | ✓ | ✓ | Plan M7 (10 presets) | P0 |
| Full style control (font, size, color, stroke, shadow, case, position drag) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Plan M7 | P0 |
| AI keyword highlight (second, third color) | ✓ 2 colors | ✓ | ✓ | ✓ | ~ | ~ | Plan M7 | P0 |
| AI emojis above captions | ✓ | ✓ | ✓ | ✓ animated + sound | ✗ | stickers | ✗ | **P0** |
| Caption translation | ✓ | 52 languages | 100+ | 123 | ✓ | 90+ | Plan M13 (dub) | P1 |
| Auto-censor swear words (bleep + mask) | ✓ | ? | ? | ? | ? | ✓ | ✗ | P1 |
| Filler and pause removal | ✓ (slider) | ? | ✓ | ✓ Auto cut | ✓ | ✓ silence | Plan M6 | P0 |
| **Auto zoom / punch-in on emphasis** | ~ (transition zooms) | ? | ? | ✓ Auto Zoom | ✓ | ✓ zoom effects | ✗ | **P0** |
| Auto transitions between cuts (6 effects) | ✓ | ? | ? | ✓ | ✓ smart transitions | ✓ | ✗ | P1 |
| Stock B-roll auto-placed | ✓ Pexels | ? | ✓ | ✓ | ✓ | GIFs | Plan M9 (Pixabay) | P0 |
| AI-generated B-roll | ✓ (Pro 50/day) | ✗ | ✗ | ✗ | ✓ | ✗ | Plan M9 (Kie/Wan) | P1 |
| B-roll framing Fill / PIP / Split | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | P1 |
| Background music (library or AI) with ducking | ✓ | ? | ✓ | ✓ | ✓ | ✓ | Plan M10 (ElevenLabs) | P1 |
| Sound effects on keywords | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | Plan M10 | P1 |
| Text overlays and section headlines | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | P1 |
| Speech enhance (noise/echo) | ✓ | ✗ | ✗ | ✓ clean audio | ✓ Studio Sound | ✗ | ✗ | P1 |
| AI voice-over / dub | ✓ | ✗ | ✓ | ✓ translator | ✓ | ✓ TTS | Plan M13 | P2 |
| Eye contact | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | P2 |

### 1.4 Editor UX, brand, export, publishing, pricing

| Feature | Opus | Klap | Vizard | Submagic | Descript | StreamLadder | Transovo | Pri |
|---|---|---|---|---|---|---|---|---|
| Transcript-based trim (delete words = cut) | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Plan M6 | P0 |
| Extend a clip beyond its AI boundaries / "add a section" from the full transcript | ✓ | ? | ✓ | ? | ✓ | ✗ | ~ (trim only) | P0 |
| Timeline with per-segment layout labels, waveform, text track | ✓ | ~ | ✓ | ~ | ✓ | ✓ | Plan M6 (lanes) | P0 |
| Undo/redo, autosave, keyboard shortcuts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Plan M6 | P0 |
| Brand templates (logo, CTA, intro/outro, fonts, layouts, captions) | ✓ (Pro: 4) | ✓ presets | ✓ | ✓ (10 on Business) | ✓ layout packs | ✓ templates with "save with" toggles | Plan M14 (1 template) | P0 – several templates |
| Brand vocabulary (custom spellings for ASR) | ✓ | ? | ? | ? | ✓ | ✗ | ✗ | P1 |
| AI chat editor ("make it 30 s…") | ✓ (agent) | ✗ | ✓ Vizard Agent | ✗ | ✓ Underlord | ✗ | Plan M11 (AI Producer) | P1 |
| Export 1080p / 4K / 60 fps | 1080p (4K Business) | ✓ | 4K Creator | 4K60 Business | ✓ | 4K60 Pro | 720p/1080p | P1 – add 60 fps and 4K |
| Bulk export, SRT, XML (Premiere/DaVinci) | ✓ | ? | ✓ | ? | ✓ | ✗ | Plan M5 (SRT) | P1 – add XML |
| Direct publish (TikTok, YT Shorts, IG Reels, LinkedIn, X, FB) | ✓ | ✓ | ✓ (6/20 accounts) | ✓ | ✓ | ✓ (X on Pro) | ✗ (decided: download only in v1) | **P0 for best in class** |
| Scheduler and calendar (bulk, interval) | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | Later | P0 |
| Team seats and editor workspaces | ✓ | ✓ | ✓ $5/seat | ✓ | ✓ | ✓ Pro | Later | P2 |
| API / MCP | ✓ | ✓ API, MCP, Zapier, Make, n8n | ✓ | ✓ API | ✗ | ✗ | ✗ | P2 |
| Storage and retention | 3 days free; 100 GB Pro | ? | 3 days free | ? | – | – | Plan (expiresAt) | – |

## 2. Feature matrix: STREAMER

| Feature | Eklipse | StreamLadder | Medal | Sizzle | Twitch native | Opus/Klap | Streamer.bot | Transovo | Pri |
|---|---|---|---|---|---|---|---|---|---|
| Connect channel; auto-detect stream end; auto-pull VOD | ✓ Twitch, Kick, YT, FB | ✓ Twitch, Kick (Auto Pilot "soon") | – (local) | ✓ Twitch, YT | ✓ | ✗ (Opus: YT VOD after 10 min–12 h) | – | Plan S13 (Twitch EventSub), S14 (Kick webhooks) | P0 |
| Paste VOD / clip URL | ✓ | ✓ Twitch, Kick, YT, Trovo | ✗ | ✓ | – | ✓ | – | Plan S1 | P0 |
| **Clips while still live** | ✓ Live Clipping (CoD beta, Premium) | ✗ | ✓ (local replay buffer) | ✗ | ✓ Auto Clips ~30 min after | ✗ | ✓ via Create Clip | ✗ (decided: no live capture) | P1 – see §4.6 for a ToS-safe near-live path |
| Chat velocity / emote-spike signal | ✓ | ? | ✗ | ✗ | ? | ✗ | ✓ (keyword triggers) | Plan S5 (VOD chat replay), S13/S14 live chat capture | P0 |
| Viewer-clip density signal ("N viewers clipped this") | ? | ? | ✗ | ✗ | ✓ | ✗ | ✗ | Plan S6 | P0 |
| Voice vs game audio separation (yelling during a quiet menu ≠ hype) | ✓ Gameplay Intelligence | ? | ✗ | ✗ | ? | ✗ | ✗ | ✗ (loudness only, S4) | **P0** |
| Game-event detection (kill feed, wins, knockdowns) | ✓ 100+ games, per genre | ✗ | ✓ per game | ✓ | ✗ | ✗ | ✗ | ✗ | P1 (top 5 games first) |
| Action density and continuity (merge streaks into one clip) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | P1 |
| Variable clip length sized to the moment (5–40 s) | ✓ | ~ | ✓ | ✓ trim | 60 s | ✓ | 5–60 s | Plan S4 | P0 |
| Voice command ("clip that") as a marker | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | P1 (transcript keyword scan is cheap) |
| Facecam auto-detect + stacked 9:16 | ✓ AI Edit keeps HUD, killfeed and facecam in frame | ✓ | ✗ | ✓ vertical | ✓ Stacked portrait | ✓ Klap Gaming, Opus Gameplay | ✗ | Plan S7 | P0 |
| Draw/adjust boxes, per-channel layout presets | ? | ✓ custom layouts, saved | – | ✗ | ✓ edit portrait | ✓ | – | Plan S8 | P0 |
| HUD-element keep (killfeed, minimap as a third panel) | ✓ | ✓ (game UI area option) | – | ✗ | ✗ | ✗ | – | ✗ | P1 |
| Approval queue (clips wait for OK, then post) | ✓ Content Agent | ✓ | – | ✗ | ✓ (alpha auto-publishes) | – | – | ~ (results grid; no queue states) | P0 |
| Auto-publish and schedule | ✓ Publisher + Posting Companion | ✓ Content Publisher | ✓ share | ✗ | ✓ | ✓ | – | ✗ (out of scope) | P0 for best in class |
| Montage / compilation | ✓ | ✓ MontageMaker | ✓ | ✓ mashups | ✗ | ✗ | – | Plan S10 | P1 |
| Notifications (email, in-app, Discord) | ✓ email | ? | ✓ | ? | – | ✓ email | ✓ Discord | Plan S11 (in-app + email) | P0 – add Discord webhook |
| Mobile app | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | – | ✗ | P2 |
| Hype timeline graph with markers | ? | ✓ (score bar with emoji markers, ClipGPT art) | – | – | – | – | – | Plan S4 | P0 |
| Chat overlay rendered in the clip | ? | ✗ | – | ✗ | ✗ | – | – | Plan S9 (text emotes) | P2 |

## 3. Plain-language gap list: top 20 that matter most

1. **Track 3–5 people and remember who is who.** Today's prototype handles 2. Opus, Klap and Descript handle groups, and Vizard openly admits failures. Re-ID (face fingerprints) is what makes a 4-person podcast work.
2. **Split-screen and grid layouts.** The plan says "why not split-screen?", but every leader ships 2-up, 3-up and 4-up. Offer speaker-follow **and** split/grid, chosen per scene.
3. **The AI chooses a layout per scene inside one clip.** For example: follow the speaker, go to a 2-up during a back-and-forth, go to a grid on group laughter, go to screen share when slides appear. Opus does this from a multi-select of allowed layouts.
4. **Calmer, smarter speaker switching.**
   - Minimum shot length, and ignore "yeah/mhm" backchannels.
   - Cut slightly before the new speaker starts.
   - Use a 2-up for overlapping talk.
   - Pan smoothly with a deadzone instead of jittering.
5. **Screen-share layout and screen detection.** Webinars and Zoom calls are a big market. Klap and Opus detect the screen region automatically.
6. **Per-segment layout editing on the timeline.** Select segments, pick a layout or a person, drag the crop. This is the main fix-it tool when the AI is wrong.
7. **Explainable scores.**
   - Hook / Flow / Value / Trend grades plus a one-line "why this clip". Descript and Opus do this.
   - Thumbs down hides the clip and feeds tuning.
8. **Hook title overlay plus per-platform titles, descriptions and hashtags.** Every competitor writes these. Transovo only scores the hook.
9. **Auto zoom / punch-ins on emphasis words, and auto transitions.** This is Submagic's signature look. It makes static podcasts feel edited.
10. **AI emojis and keyword highlight colors in captions.** Standard everywhere (Opus, Klap, Vizard, Submagic).
11. **Direct publishing and a scheduler/calendar** (TikTok, YT Shorts, IG Reels, X, LinkedIn). Every leader has it. "Download only" will read as unfinished.
12. **Voice-versus-game-audio separation for streamer hype.** Yelling during a quiet lobby isn't a highlight. Eklipse separates the voice, game and background audio to avoid this false positive.
13. **Clips while the streamer is still live (near-live).** Eklipse does this live; Twitch Auto Clips is ready about 30 min after. This is possible without recording the stream (see §4.6).
14. **Approval queue with auto-post** for the streamer: clips land as "Needs review → Approved → Scheduled → Posted".
15. **Game-event detection** for the top games: kill feed, victory screens. Start with Fortnite, Valorant, CoD/Warzone, Apex and CS2 (OCR plus template matching).
16. **HUD-aware gaming layouts.** Keep the killfeed/minimap as a third panel, plus a facecam + gameplay stack with a seam caption.
17. **More output shapes and quality.** Add 1:1, 4:5 and 16:9, 60 fps, and 4K on the top plan. Competitors charge for these, so they can drive upgrades.
18. **Multiple brand templates** with "save with" toggles (StreamLadder) and an "applicable auto layouts" list (Opus). Add intro/outro and brand vocabulary.
19. **Speed you can see.** A live ETA and progressive results (the first clips appear while the rest render), on GPU when the queue is long. ClipAnything takes 20–40 min, so being faster is a selling point.
20. **Clip variety and AI chat editing.** Several style templates per run (e.g. "Bold Pop + zooms", "Clean + B-roll", "Split debate"), so 20 clips don't all look identical. The AI Producer chat is already planned; ship it.

## 4. Technical notes: how the leaders probably do the hard parts (and what to build)

Vendors don't publish their internals. Everything below is inferred from their docs (signals named by Vizard, Opus and Eklipse) and from the public state of the art. Accuracy figures come from the cited papers. All cost figures are **estimates to verify** with a benchmark run.

### 4.1 Pipeline (per project)

```
source ─► proxy 720p/30 + 16 kHz audio
        ├─► ASR (faster-whisper large-v3 on GPU, or medium.en int8 on CPU) → words.json
        ├─► diarization (pyannote community-1, or Deepgram Nova-3 diarize) → speaker turns
        ├─► shot boundaries (TransNetV2 or PySceneDetect AdaptiveDetector) → shots[]
        └─► moment picking (LLM on transcript + scene/vision shortlist) → candidate windows
for each candidate window (+3 s context each side):
        face detect (SCRFD/YuNet) every 2–3 frames ─► ByteTrack/BoT-SORT tracklets per shot
        ─► ArcFace embedding per tracklet ─► cluster across shots → global person IDs P1..P5
        ─► Light-ASD speaking prob per face-track frame
        ─► fuse ASD × diarization (map diar speakers to person IDs)
        ─► "director" (Viterbi over layout states with switch costs) → segments[{t0,t1,layout,slots}]
        ─► camera smoothing per slot (deadzone + critically-damped spring / One-Euro)
        ─► crop.json v2 → preview render (ffmpeg) / editor
```

### 4.2 Active speaker detection (ASD)

| Model | AVA-ActiveSpeaker mAP | Params / FLOPs | Notes |
|---|---|---|---|
| TalkNet (2021) | 92.3 | 15.7 M / 1.5 G | Well known, code public; heavier |
| Light-ASD (CVPR 2023) | 94.1 | **1.0 M / 0.6 G** | Best fit for CPU; github.com/Junhua-Liao/Light-ASD |
| LoCoNet (2023) | 95.2 | 34.3 M / 4.9 G | Best accuracy; GPU |
| Streaming transformer (arXiv 2409.09018) | – | 32 ms/frame on a Xeon CPU, 352 ms latency | Reference design for near-live use |

Sources: CVPR 2023 Light-ASD paper (openaccess.thecvf.com) and its comparison table; LR-ASD (IJCV 2025).

**Recommendation**
- Use **Light-ASD** as the default on both CPU and GPU. Add LoCoNet on Modal for a "Max quality" toggle later.
- Feed it the 112×112 grayscale mouth/face crops from the tracker, plus MFCCs.
- Use the output only as a *probability*. The director makes the decision.

### 4.3 Face detection, tracking, re-ID (3–5 people)

- **Detect:**
  - CPU: SCRFD-2.5G (InsightFace) or YuNet (already in the prototype) at a 640 px long side, every 2nd–3rd frame. Interpolate with the tracker in between.
  - Add YOLO11n person boxes so people seen from behind or in profile keep a slot.
- **Track:**
  - **ByteTrack** links boxes within a shot, using low-score boxes to survive occlusion.
  - **BoT-SORT** adds camera-motion compensation. Use it for handheld or vlog footage.
  - Reset trackers at each shot boundary.
- **Re-ID:**
  - Embed each tracklet with **ArcFace** (InsightFace `w600k_r50` on GPU; the MobileFaceNet `w600k_mbf` on CPU) on the 3–5 sharpest frontal crops, then average.
  - Cluster tracklets across the whole clip with agglomerative clustering (cosine distance threshold ≈0.4, tune it). This gives stable IDs P1..Pn even across multicam cuts and close-ups.
  - Keep a gallery per project so P2 is the same person in every clip. Optionally let the user name them ("Rick").
- **Map diarization to faces:**
  - For each diarization speaker S and person P, score the overlap of S's turns with P's high-ASD frames.
  - Use Hungarian assignment.
  - If a speaker never matches, they are **off-screen**: keep the last layout, or show a wide shot.
- **Why this beats a 2-person heuristic:**
  - Identity survives camera cuts.
  - Slot order stays stable (it doesn't swap left/right each shot).
  - Captions can color by person.
  - "Pin first speaker" (Opus) becomes trivial.

### 4.4 The "director": stop wrong-speaker switches

Run a Viterbi/HMM over 10 Hz frames.

States:
- `close(Pi)`
- `two_up(Pi,Pj)`
- `grid3`, `grid4`
- `wide/fit`
- `screen+cam(Pi)`
- `game+cam`

Emission score per state:
- ASD probability of the featured people.
- Diarization agreement.
- Face visibility and size.
- Content-type classifier (screen / game / talking).

Transition costs and rules:
- **Switch penalty** of about 1.5 s of evidence. **Minimum shot length** 1.5 s for close shots and 3 s for 2-up and grids.
- **Lead:** cut 150–250 ms *before* the new speaker's first word, the way a human editor does.
- **Backchannel filter:** turns under 0.8 s, or matching a list ("yeah", "right", "mhm", laughter), never trigger a cut.
- **Overlap:** two people talking within 1.5 s of each other for at least 3 s gives `two_up`. Three or more distinct speakers in a 6 s window gives a grid (only if the brand template allows grids).
- **Reaction shots** (optional style): after a punchline, cut to the listener with the biggest smile or laugh signal for 0.8–1.2 s.

Camera movement inside a slot:
- Deadzone of 15–20% of crop width.
- Critically-damped spring or One-Euro filter.
- Pan speed cap of about 0.15 frame-widths per second.
- No movement while a cut is happening.
- A "locked-off" style (static per shot) is offered as an option.

Learnable later: the rules can be tuned from user overrides. Every timeline override is a labeled example.

### 4.5 Webcam/facecam box detection (streamer) and screen-share detection

1. Sample 60 frames across the VOD at 640 px.
2. Per pixel, compute the **temporal variance** and the **edge persistence**:
   - A cam overlay has a stable rectangular border (persistent Canny/Hough lines ≥60% of frames).
   - Inside it there is a face and low-to-mid motion.
   - Gameplay has high, global motion and HUD elements that don't move.
3. Candidate rectangles come from persistent line intersections (also handle rounded corners and frames with a 1–6 px border inset).
4. Score each rectangle by:
   - a face being present (≥50% of frames),
   - an aspect ratio near 4:3 or 16:9,
   - an area of 3–35% of the frame,
   - its variance profile.
5. If confidence is below 0.6, fall back to Gemini on 3 frames. If there is still no box, use a gameplay-only layout.
6. **HUD detection** (for the keep-killfeed layout): find small regions whose pixels change but whose borders and icons don't. A temporal median of edges reveals them. OCR of kill-feed text with PaddleOCR (CPU) on the top-right ROI gives game events for the top titles.
7. **Screen share:**
   - The screen region has large areas of static text-like texture (high edge density, low temporal variance, few faces).
   - The speaker tile is small and has a face.
   - Use the same rectangle finder and classify it as screen versus cam.

This matches the existing S7 design, with temporal variance and HUD/screen classes added.

### 4.6 Near-live streamer clipping without recording the stream (ToS-safe)

The current scope forbids live HLS capture, so the near-live path has to work differently:
- **Signals while live, using official APIs only:**
  - Twitch EventSub `channel.chat.message`.
  - Kick webhook `chat.message.sent` (KickDevDocs; signature verified with Kick's public key).
  - Viewer clip creation (polling Twitch Get Clips).
  - Stream status (`stream.online` / `stream.offline`, Kick `livestream.status.updated`).
- **Mark hype in real time:**
  - A chat-velocity z-score over a 10 s window against a 5 min rolling baseline, with emote weights (KEKW, LUL, POG, "W", "LMAO", "clip it").
  - Viewer-clip bursts.
  - A "clip that" command in chat.
- **Create the clip on the platform, using an official endpoint:**
  - On the user's own channel (OAuth `clips:edit`), call **Twitch Create Clip** with `duration` (or Clip-from-VOD with `vod_offset`, 5–60 s).
  - Download it through the official clips download endpoint, then run the normal layout/caption render.
  - This gives a 9:16 captioned clip **minutes** after the moment, with no stream recording.
- **Longer context:** after `stream.offline`, run the full VOD analysis (S2/S4) and merge it with the live markers. Live markers become strong priors.
- **Kick:** no public clip-create API was found. Use live chat markers plus a VOD pull after the stream ends.

### 4.7 Shot boundaries

- **TransNetV2** (an ML model, robust to dissolves) runs on 48×27 frames. It is cheap on GPU and acceptable on CPU (estimated 5–10 min CPU per source hour).
- **PySceneDetect AdaptiveDetector** on 320 px frames is a few minutes per hour on CPU and good enough for hard cuts.
- Use PySceneDetect first and TransNetV2 for multicam podcasts.

### 4.8 Diarization choice

| Option | Speed / cost | Notes |
|---|---|---|
| **Deepgram Nova-3 pre-recorded** with diarize | **$0.0043/min ≈ $0.26 per hour** PAYG (diarization included) | Fastest to ship; ASR included. It is a paid per-minute API, which conflicts with plan rule 8, so Rick needs to decide |
| pyannote **community-1** (4.0), self-hosted | ~31 s per audio hour on H100; RTF ≈0.8 on an M2 Pro CPU | Free weights. Too slow to run over a whole long VOD on a 4-core CPU; fine on clip windows or on a Modal GPU |
| pyannote 3.1 | Similar; older | Fallback |

**Recommendation:** pyannote community-1 on Modal, run on whole sources together with ASR. On CPU, run it only on candidate windows plus context.

### 4.9 CPU vs GPU feasibility and cost per hour of source video

Assumptions:
- A 60-min 1080p podcast or VOD.
- 12 clips × 45 s = 9 clip-minutes to track and render.
- Modal list prices (modal.com/pricing, Oct 2026): L4 $0.000222/s ≈ **$0.80/h**, T4 $0.59/h, A10 $1.10/h, CPU $0.047/core-h.
- Estimates. Check them against a benchmark.

| Stage | 4-core CPU server (today) | Modal L4 |
|---|---|---|
| ASR | medium.en int8: ~30–40 min (prototype: 13–20 s/min on 8 cores) | large-v3 batched: ~2 min |
| Diarization | windows only: ~10 min | full: ~2–3 min |
| Shot detection | ~3–8 min | <1 min |
| Detect + track + re-ID + Light-ASD on 9 clip-minutes (+context) | ~6–10 min | ~1–2 min |
| Same on the *whole* hour (needed for per-scene layout search and ClipAnything) | ~40–60 min | ~4–6 min |
| Render 12 × 45 s 1080×1920 (x264 veryfast vs NVENC) | ~8–12 min | ~2 min |
| Cold start + idle tail | – | ~2.5 min |
| **Total wall time** | **~60–80 min (≈ real time; queue grows past 1 job/h)** | **~10–15 min** |
| **Marginal cost** | $0 (server already paid) | **≈ $0.13–0.20 per source hour** (+CPU/mem pennies) |

**Verdict**
- **Run multi-person tracking, ASR and diarization on Modal by default, with the local CPU as fallback.**
- At about $0.15 per source hour, the $30/mo Starter credit covers about 150–200 source hours a month. Above that, the cost is still under 2% of a $29 plan.
- A bigger CPU box (16 cores, about $80–150/mo) gives a ~4× speedup but scales poorly. Parallel CPU renders help only the render stage.
- Keep Light-ASD + YuNet + ByteTrack runnable on CPU, so the product degrades gracefully if Modal is down.

### 4.10 Quality bar and eval set (so "best in class" is measurable)

- Build a 40-clip eval set: 10 × 2-person podcasts, 10 × 3–5-person panels/podcasts (multicam and wide), 10 × streamer facecam/gameplay, 10 × screen share/webinar.
- Metrics:
  - **wrong-speaker seconds %** (target <3%)
  - **cuts per minute** (target 4–10 for talk content)
  - **face cut-off frames %** (target <1%)
  - **layout-appropriate %**, judged by a human (target ≥90%)
  - **time to first clip** (target <5 min on GPU for a 1 h source)
- Compare against Opus Free outputs of the same public videos. Compare by viewing only; no account is needed for that.

## 5. Sources (fetched Oct 25–26, 2026)

- OpusClip help (22+ articles), index at https://help.opus.pro/llms.txt. Key pages:
  - layout-and-reframing, apply-the-layouts, how-to-manually-reframe-content, subject-tracking, how-to-enable-face-tracking
  - virality-score, captions-and-emojis, ai-emojis-keywords, add-transition-effects, ai-broll
  - bulk-scheduler, schedule-clips, how-to-use-clipanything, select-clip-length, how-to-add-a-brand-template, uploading-live-streams
  - Local copies in `clipper-research/opus/`.
- OpusClip pricing: https://www.opus.pro/pricing
- Klap: https://klap.app ; https://klap.app/tools/long-video-to-short-video-converter ; https://klap.app/pricing ; https://clippingnet.com/ai-clipping-tools/klap-ai/
- Vizard: https://vizard.ai ; https://vizard.ai/pricing ; https://help.vizard.ai/en/articles/14671161 (wrong-person framing) ; https://help.vizard.ai/en/articles/9188600 (clip preferences)
- Submagic: https://www.submagic.co/features/magic-clips ; https://www.submagic.co/pricing
- Descript: https://help.descript.com/repurpose/create-clips-from-your-content ; https://descript.canny.io/changelog/descript-season-6-release-version-91
- StreamLadder:
  - https://www.streamladder.com/clip-editor ; /clip-editor/custom-layouts ; /clipgpt
  - https://www.streamladder.com/blog/streamladder-upgraded-subscription-plans
  - https://guides.streamladder.com/en/articles/19-how-to-create-a-template
  - https://saashunter.si/tools/streamladder/pricing
- Eklipse: https://eklipse.gg ; https://eklipse.gg/help/what-is-live-clipping/ ; /help/how-does-eklipse-automatically-create-clips/ ; /help/how-gameplay-intelligence-picks-moments/ ; /help/are-there-any-stream-layout-best-practices-…/
- Medal: https://medal.tv/auto-clipping ; https://medal.tv/developer/auto-clipping
- Sizzle: https://sizzle.gg
- Powder: https://powder.gg (redirects to the shutdown note)
- Twitch:
  - https://help.twitch.tv/s/article/auto-clips ; https://help.twitch.tv/s/article/how-to-use-clips
  - https://dev.twitch.tv/docs/api/clips/ ; https://discuss.dev.twitch.com/t/introducing-clip-api-improvements-and-clip-from-vod-in-open-beta/64492
- Kick: https://github.com/KickEngineering/KickDevDocs (events/event-types.md, webhook-security.md) ; https://docs.kick.com
- Streamer.bot: https://docs.streamer.bot/api/sub-actions/twitch/channel/create-clip
- ASD papers: Light-ASD (CVPR 2023, openaccess.thecvf.com), LR-ASD (IJCV 2025), arXiv 2409.09018
- pyannote: https://github.com/pyannote/pyannote-audio ; benchmarks at https://foxnosetech.github.io/diarize/benchmarks/
- Deepgram pricing: https://deepgram.com/pricing
- Modal pricing: https://modal.com/pricing
- Building blocks (repos):
  - ByteTrack (github.com/ifzhang/ByteTrack), BoT-SORT (github.com/NirAharon/BoT-SORT)
  - InsightFace/ArcFace/SCRFD (github.com/deepinsight/insightface)
  - TransNetV2 (github.com/soCzech/TransNetV2), PySceneDetect (scenedetect.com)
  - TalkNet (github.com/TaoRuijie/TalkNet-ASD), LoCoNet (github.com/SJTUwxz/LoCoNet_ASD)
