# START HERE: Motion Studio handover (for an agent with no access to the old machine)

Read in this order:
1. `transovo_team/HANDOVER-motion-studio.md`: what Motion Studio is, John's rules, status, and what's done and left. Section 7 is the full Keef/GameStop pipeline.
2. `code_motion_cinematic/repo/skills/cinematic-film/SKILL.md` and its `references/`: the official how-to for the Cinematic Skill engine (how to write scenes, blocks, camera, render). This is the engine manual.
3. `transovo_team/specs/studio-reference-workflow.md`: the 16 stages, step by step, with inputs and outputs.
4. `transovo_team/specs/transovo-studio-build.md`: the binding product spec (about 290 requirements). Also read `documentary-studio-ux-concept.md` (UI) and `backend/motion-studio-api-contract.md` (API).

## Path mapping
The docs refer to `/workspace/...` on the old machine. In this kit, the same folders sit at the kit root:
- `code_motion_cinematic/keef/`: the Keef film (map world). `scene.py` is the whole film.
- `round2_cinematic/gme/`: the GameStop film (chart world). `scene.py` holds the scenes, `ext.py` the custom blocks, `music.py` the beat-keyed score, `audit.py` the QA checks, and `measure_mix.py` the loudness checks. Raw data is in `round2_cinematic/raw/`.
- `keef_insert_test/` and `gme_insert_test/`: the footage handoff (hard cut, plus a push-in and pull-back that render only the camera moves).
- `code_motion_cinematic/repo/`: Cinematic Skill engine at commit bf43556 (MIT), from github.com/Moh4696/cinematic-skill.

## Set up a machine to reproduce the films
- Linux, Python 3.9+ (3.13 was used), and ffmpeg/ffprobe with libx264.
- `python3 -m venv venv && . venv/bin/activate && pip install -r code_motion_cinematic/repo/requirements.txt` (numpy, pillow, skia-python, scipy).
- `python3 code_motion_cinematic/repo/skills/cinematic-film/scripts/check_setup.py`: says exactly what's missing, including fonts.
- Fonts: run `scripts/get_fonts.py` (OFL fonts).
- Render: see SKILL.md. Each project's `scene.py` is rendered by the engine's `scripts/render.py`; multiple workers render in parallel, and ffmpeg concatenates.
- Narration: ElevenLabs with-timestamps endpoint, voice "Brian", model eleven_multilingual_v2, speed 0.85, 128 kbps. Word timings feed the beat table (`make_beats.py` / `word_times.py`).
- Music: `round2_cinematic/gme/music.py` is pure numpy. Its key, tempo, cues and ducking come from the narration word times. Write a new one per video.

## The live product (this is what you're finishing)
- Code lives on GitHub in **703deuce/sms** on the master branch. Web app: `new-app/` (Motion Studio UI in `new-app/app/app/motion-studio/` and `new-app/components/motion-studio/`, API at `new-app/app/api/motion-studio/`). Worker: `worker/clips_worker/motion_studio/` (the engine is vendored in `vendor/`). The handover lists the merged PRs (#1260–#1267) and issues (#1198–#1259).
- Live site: transovo.ai, signed in at `/app/motion-studio`. Deploy check: `https://transovo.ai/api/health` shows `commitSha`.
- Deploys: the web app auto-deploys from master via Coolify on a Hetzner server. Workers deploy with `scripts/deploy-worker.sh` in the repo (e.g. `WORKER_ONLY=clips-worker scripts/deploy-worker.sh <sha>`).

## Access you must get from John (not in this kit, by design: no secrets)
- GitHub access to 703deuce/sms (push to master).
- SSH access to the worker server and the Coolify dashboard.
- API keys: OpenAI (GPT-6 Luna / GPT-6.1 Sol), ElevenLabs, Gemini. On the server they're already in the clips-worker env.
- A Transovo login, to test from the live front end.

## Rules (short version; the full list is in the handover)
Push to master, then deploy the workers, and fix from the build and worker logs. No long local self-test loops. Never touch the SMS worker or Coolify app3. No force-push. Additive DB migrations only. Never show $ in the UI. Never print secrets. John approves new spending, destructive DB ops, pricing changes and pivots.
