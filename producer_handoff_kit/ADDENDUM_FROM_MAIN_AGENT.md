# Addendum from the main Grok Bot (Nov 17, 2026): read after README_START_HERE.md

The rest of this kit is the producer's own view. This file adds what the main (coordinator) agent knows, so whoever rebuilds the setup has the whole picture.

## The bigger product (context for every job)
- Transovo is a general-purpose video production platform, not just documentaries. One Creative Director handles four workflows: research-to-video from a topic, long-form documentary, footage-to-finished-video from customer uploads, and creative production from a brief (ads, promos). Customers start with a topic, footage or a script and never pick a genre or engine. They get a finished video plus an editable project.
- Text-to-video / script-to-video (T2V) was dropped Nov 15. Ad Studio and AI Studio are on hold.
- Creative direction: the visual concept and Visual DNA come before engine selection. Internally consider about three distinct concepts and pick the best. Aim for visual diversity (layout, type, pacing, color, camera, graphics, transitions), not engine-count diversity.
- Framing: punch in only when one person is the focus; use split or stacked boxes for two or more.
- Progress copy customers see is Transovo-branded only (no engine, vendor or bot names). Never show $ amounts in the UI.
- During testing Rick wants low-res previews (480p or lower) of films.

## Who does what
- ChatGPT (via Rick) builds the Transovo app side. If Rick says he already gave something to ChatGPT, don't write briefs or plans for it; only prep the producer side when asked.
- The producer bot builds videos. The main agent coordinates, deploys and reviews.
- Rick's top app priority is the live preview: play the scenes and see the result before the final render. (Videohub, github.com/TensaikunYT/Videohub, was reviewed for ideas: frame notes, 2-second partial re-render, fix checks, live renderOut(t) preview.)

## Working rules with Rick
- Rick stops jobs on purpose. Never assume a stopped job stalled, and never restart or resume one without asking him.
- Don't spend usage polling or re-checking job status, and don't duplicate work another agent is doing. Wait for the result, then review it and note what's missing.
- Check weekly usage at the start and end of each test.
- No login or auth gates on Motion Studio (no-login testing stays).
- Future, only when Rick asks: a full replication package once the producer is about 95% done, plus Remotion templates.

## Clipper status (confirm with Rick)
- Rick's vision (Nov 16): the agent runs the AI Clipper through the same Agent Bridge as Motion Studio. It finds and scores the best moments, cuts the clips, and adds light editing (motion graphics, dead-gap fill in 30/60s clips, speaker-aware layouts), Opus Clip style.
- The Transovo clipper contract is deployed (commit 855ca229): actions clip_and_finish and finish_clip; see briefs/AGENT_CLIPPER_CONTRACT.md.
- The first live run (caf_9cc3e6cb) worked end to end from the front end: 3 clips, about 45 min, $0. Afterward Rick moved toward a cleaner, pro podcast-clip look.
- The producer's memory says the clipper is now PARKED because it costs about as much as a film, with an idea to keep the AI on the creative calls and scripts on the mechanical work. Ask Rick which applies before running clip jobs.

## Open app-side issues (ChatGPT's to fix; not done as of Nov 17)
- Motion Studio editor preview plays only 10 seconds, and the Text track is empty.
- Agent clips open the raw source in the editor, with wrong durations and no layers (editor import for agent clips).
- Clip dispatch happens in a client useEffect when the project page opens; a failed auto-dispatch never retries (needs a server-side trigger). GET jobUrl always reports mode source_footage_enhancement; discover jobs ignore project.json; .srt uploads aren't allowed.
- Brand-kit branch bugs: needsInput questions get filtered (240-char cap, word replacement); /progress overwrites the needs_input state; a retried answer can leave the job stuck; the SVG safety check blocks the standard xmlns line; deleting a brand kit always reports success; no tests for the new parts. Also needed: a timeout for a customer who never answers (e.g. 24h, then best call or close cleanly), and a revise_video that arrives while waiting must fold in or queue, never start a second production.
- GIF and vertical/square output still need testing.
- The integration test of chat, revision and answer_input with the real producer needs the branch on a preview deploy, only when Rick says so.

## Infrastructure (main agent only; the producer must never use any of this)
- Transovo runs on Coolify (app ds8s3hjin60qs6g7s0iqkixs) on 128.140.102.51. The main agent deploys through the Coolify API over SSH as cursor-agent with the key /workspace/secrets/cursor_coolify. Never use the `transovo` SSH alias. Never deploy or modify the SMS worker or Coolify app3. Watch disk space (it hit 100% once); prune old images before deploys.
- Rick's saved rules allow pushing to master and branches in 703deuce/sms, merging PRs there, and deploying the clips-worker without asking. Still: no force-push, additive DB migrations only, no automatic paid retries, never log signed URLs or print keys (GITHUB_TOKEN_TRANSOVO, KIE, REPLICATE_API_TOKEN, OPENAI_API_KEY, etc.).
- Webhook env in Coolify: GROKBOT_WEBHOOK_URL / GROKBOT_WEBHOOK_KEY must point at the new producer's routine once it exists; MOTION_STUDIO_AGENT_PUBLIC_URL=https://transovo.ai.

## Engine files not fetched by install_all.sh
- MediaPipe face models go in /workspace/motion_engines/mediapipe/models/ (URLs and hashes in briefs/ENGINE_STATUS.md): face_landmarker.task, blaze_face_short_range.tflite, blaze_face_full_range.tflite. Download them during setup; the clipper's face framing needs them.
