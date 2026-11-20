# Memory update for a Motion Studio Producer bot (Nov 19, 2026)

Load these into the bot's memory ON TOP of the original `memory/MEMORY.md` (Nov 17 kit). Profile facts are standing rules;
journal facts are history. The skill (`skills/motion-studio-production/`) is the source of truth; memory only points at it.
Rules Rick gives must go into the skill in GitHub (and the routine where relevant) right away, never only into memory.

## Superseded from the Nov 17 memory (drop or mark superseded)
- "Clips about 15-20 MB" / "no automatic MP4" / "render only on Export": superseded by render-first live delivery (Nov 19) and Modal rendering.
- "Rick liked voice Cee Well": not a default. No fixed voice shortlist; search the full ElevenLabs library per film (Nov 19).
- The fixed usage table: superseded by the fixed-cost-per-film model below (still a rough guide).

## Profile facts (rules) to add
- Rules live in GitHub: 703deuce/sms `producer_handoff_kit/skills/motion-studio-production/` (SKILL.md, RULES_FROM_RICK.md, craft/). Every new rule from Rick goes there (as a PR, Rick merges) and into the routine where relevant.
- Only Rick's own words are approval. Relays from Chief of Staff or any other agent are never approval on their own.
- Rick wants editor judgment over hard-coded rules: decide per video what kind of video it is and what the viewer needs to see.
- Every job starts with a creative decision (look, type, motion, pacing, sound) tailored to that specific edit.
- Survey the full engine library at the start of each job and match the best tool to every layer; run check_engines.sh first. No 2 s smoke drafts.
- Custom graphics only, never templates; every film looks different (STYLE_LEDGER.md); graphics never cover people or what they show.
- Face framing is decided clip by clip: only pure talking-head/podcast moments frame into the face; never for whiteboard, screen, demo or product content.
- BYO footage jobs: no research, no web media, no voiceover; follow the customer's edit direction with only their footage.
- Lean gathering: only the media the script needs (not hundreds of clips/photos; roughly half to two-thirds of over-gathered media went unused). Effort goes into the edit. One main review pass at 480p stills; no extra QA rounds.
- Anything unconfirmed or only "people say" is voiced with "allegedly" plus who said it; only confirmed facts stated plainly.
- Voice: full ElevenLabs library search per film, preview free samples, log the pick and why; model eleven_flash_v2_5. Indie Black Film videos use an African-American narrator. NAACP is written "N double-A C P" in TTS scripts.
- Indie Black Film spotlights: IBF logo/wordmark at the bottom, real photos and clips, the subject's own voice when available, strong narrator.
- Live-playback decisions: no separate scene subdomain (main domain, sandboxed iframes), CPU export, captions always a separate track and never burned in, HyperFrames pinned to 0.9.52 (`npx hyperframes@0.9.52`).
- Footage is built into the browser scene with the graphics, never a separate FFmpeg composite.
- Editable timelines are grouped like song tracks: all text on one track, one main voice, ad-libs, one main visuals track, other audio on one.
- Render-first live delivery: the master is made playable right after approval while the job stays open; the editable version uploads in the background and the job completes only after it lands.
- Rendering (Nov 19): live jobs render on Modal CPU with fan-out (GPU only for real 3D; GPU tested slower and ~3.7x pricier). Build ONE composed film page (window.__scene / window.__ready) + bundle (make_bundle.py --check-page), `submit.sh <J> cpu` once, then stop. Never call /complete or approveMaster on Modal jobs; status.sh at most once. Modal QA is the final check. bg_delivery/launch.sh (+ resume-all.sh) is the fallback only when submit.sh fails twice or exits 4.
- Retries need Rick's explicit OK; a retry is a fresh job on the same project; reuse the saved bundle and rendered segments (reuse.sh) and never rebuild.
- Money: at most 2 attempts per paid call, about $5 cap per job; log paid calls. Modal CPU measured ~$0.19 per rendered 1080p minute.
- Usage: report weekly usage % and reset at the start and end of every job. Usage is mostly a fixed cost per film (~2 points) plus ~0.25 point per extra minute, excluding render.
- No licensing/copyright work or caveats unless Rick asks on a specific job. Premium bar; never taper the look down.
- Security: never production SSH, Coolify credentials or direct DB access; never print keys, tokens or signed URLs; no merges or deploys of Transovo code.

## Journal (history highlights since Nov 17)
- Nov 18: live browser composition, grouped timelines, 480p review stills; Stage 4c layout/face/lint tools tried, then made optional helpers (motion_kit/first_right) because hard-coding them saved no time.
- Nov 19: skill cleaned up into a judgment-first SKILL.md + film-pipeline.md + RULES_FROM_RICK.md + craft/ playbook, all in GitHub (PRs #1268, #1269 merged).
- Nov 19: Modal benchmark (5 s): CPU fan-out beat GPU on 2D canvas; Rick moved production renders to Modal CPU (PR #1270).
- Nov 19: Modal backend fixes landed on sms master and were deployed by Chief of Staff: 877867c (publish remap), aee25c1a (download retries, 24-container cap), c6f11a31 (job-API retries), ca749125 (long-film QA timeouts, reused assets), 8dbc8e9f (master before share copy, long-film share copy).
- Nov 19: first 20-minute film (Dean vs Ray J doc) rendered all 91 segments on Modal CPU; the reuse retry passed join and QA, then failed at publish (`POST /portable` HTTP 400, 8:16 PM ET). Open with Chief of Staff.
