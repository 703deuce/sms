# >>> INSTRUCTIONS FOR THE AGENT READING THIS <<<
Your job: CREATE A NEW GROKBOT that is an exact copy of Rick's "Motion Studio Producer" bot, the bot that produces and edits Transovo videos, with everything it has: its skill, memory, webhook routine, engines, build and rules. Use your CreateAgent tool to make the bot, then follow "How to build the new bot" below step by step (skill, memory, engines, routine, build). Everything you need is in this folder, on branch grokbot/motion-studio-producer-kit-20261117 of 703deuce/sms. Don't merge this branch into master. When you're done, tell Rick the new bot's name and its webhook URL, and ask him for the API keys through a secure form.

# START HERE: everything needed to build a new "Motion Studio Producer" Grokbot (Nov 17, 2026)
Owner: Rick James (America/New_York). Transovo = Rick's platform (transovo.ai). GitHub repo: 703deuce/sms.

**Test support (simulator, capture script, test footage): see test_support/README.md.**

**Also read ADDENDUM_FROM_MAIN_AGENT.md (coordinator context, open issues, clipper status).**

## Where everything is
- This kit: GitHub repo 703deuce/sms, branch `grokbot/motion-studio-producer-kit-20261117` (folder producer_handoff_kit/), and as a zip on the old bot's box: /workspace/producer_handoff_kit.zip
- Transovo-side code (ChatGPT's), validated green for preview, NOT merged or deployed: branch `feat/motion-studio-video-types-brand-kits-20261117` in 703deuce/sms, commit 05e6d7a. Contract doc in that branch: docs/contracts/motion-studio-video-types-brand-kits-20261117.md. Validation report: validation/REPORT_05e6d7a.md (5 non-blocking issues listed there for ChatGPT).
- The bot's production skill (its brain): skills/motion-studio-production/ (SKILL.md first, then delivery-contract.md, clip-production.md, brand-and-type.md, engine-library.md, engines.md, craft-standards.md, retention-psychology.md, qa.md, reference-films.md, scripts/). Install it as a skill named motion-studio-production on the new bot; it expects the path /home/box/agent-data/workflows/motion-studio-production/.
- Webhook routine: routine/motion-studio-job-intake.md (verbatim saved prompt and how to recreate it).
- Bot profile (name and description): profile/profile.json.
- Memory (all of Rick's rules and history): memory/MEMORY.md.
- ChatGPT/Transovo contracts and briefs: briefs/ (AGENT_BRIDGE_V2_CONTRACT, AGENT_CLIPPER_CONTRACT, BRAND_KIT_CONTRACT, CLIPPER briefs, PRODUCER_ROUTINE_* updates, STYLE_LEDGER.md (past looks; never repeat), ENGINE_STATUS.md, PRODUCER_SIDE_ASSIGNMENT.txt (the current big assignment)).
- Current build (editable projects / no-AI re-render): build/ms_producer_editable/ plus BUILD_HANDOFF.md (status, what's left, how to run tests). Proof of concept and evidence: poc/.
- Engines: engines/ (install_all.sh, pins.txt, INSTALLED_ENGINES.txt, ENGINE_GIT_SOURCES.txt, ENGINES_PLAN.md). Core five: Cinematic Skill https://github.com/Moh4696/cinematic-skill @bf43556 (expected at /workspace/motion_kit/code_motion_cinematic/repo), Dolly https://github.com/pvhuwung/dolly @a78a821, HyperFrames https://github.com/heygen-com/hyperframes @e426ce4, Open 3D Skills https://github.com/Moh4696/open-3d-skills @53beb89, Claude Remotion Skill https://github.com/haidrrrry/claude-remotion-skill @1dcbe5e (expected under /workspace/engines/). Motion library under /workspace/motion_engines/ (installed by install_all.sh): d3, gsap-svg, lottie, manim, maplibre-deckgl, mediapipe, motion-canvas, natron, opencv, p5js, pixijs, rembg, revideo, rive, sam2, skia-canvaskit, threejs-theatre.

## Access the new bot needs (values are NOT in this kit; get them from Rick in a secure form, never in chat)
File /workspace/secrets/motion_production.env with: OPENAI_API_KEY, PIXABAY_API_KEY, KIE_API_KEY, ELEVENLABS_API_KEY, GEMINI_API_KEY, REPLICATE_API_TOKEN. Load with: set -a && source /workspace/secrets/motion_production.env && set +a. Never print values.
GitHub: access to 703deuce/sms (Rick's saved rule allows pushing branches and master there and merging PRs, but Rick said do NOT merge or deploy the Transovo branch until integration testing).
Transovo job access: per-job jobUrl + jobToken arrive in each webhook payload; nothing else needed. Pull-queue mode (future) uses MOTION_STUDIO_PRODUCER_QUEUE_KEY (server env).
Webhook: after recreating the routine, give its webhook URL and key to Rick/ChatGPT for Transovo's worker registry.
Tools needed on the box: node 20+, python3, ffmpeg, chromium/playwright, yt-dlp, whisper (small.en), bubblewrap (for the worker B sandbox test), and the engines above.
NOT allowed: production SSH, Coolify admin or credentials (/workspace/secrets/cursor_coolify), or direct DB access.

## How to build the new bot (for the main agent)
1. Create the bot. Copy name and description from profile/profile.json (change "Stay in setup mode" since live mode is on).
2. Put skills/motion-studio-production at /home/box/agent-data/workflows/motion-studio-production (or save it as a skill), including scripts/.
3. Write every fact from memory/MEMORY.md into the new bot's memory (profile facts = rules; journal = history).
4. Install the engines (engines/install_all.sh plus git clones at the pinned commits), and copy briefs/STYLE_LEDGER.md and ENGINE_STATUS.md to /workspace/motion_jobs/.
5. Recreate the webhook routine from routine/motion-studio-job-intake.md. Report its URL to Rick.
6. Have Rick supply the secrets file.
7. Copy build/ms_producer_editable to /workspace/ms_producer_editable, run npm install, and finish BUILD_HANDOFF.md "Next steps" (rerun tests, expansion scenes, report).

## What we are building toward
Transovo Motion Studio: customers ask for a video, a Grokbot produces it end to end (research, unique look, multi-engine scenes, narration, render, QA, deliver through the job API). Then customers edit it in Transovo's own editor with NO AI: text, fonts, colors/theme, logos, images, live in the browser, via the editable-elements contract. AI is used only for creative redesigns. Every project is a portable package by Transovo asset IDs, so ANY Grokbot (many bots, several Grok plans, several computers) can continue any project. Transovo's server is the central coordinator (PostgreSQL queue, worker/plan/machine registry, webhook wake-up); bots never run a scheduler. Each bot reports usage % at job start and end.
