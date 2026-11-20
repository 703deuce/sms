# producer_handoff_kit: START HERE (Motion Studio Producer, current as of Nov 19, 2026)

Everything a Motion Studio Producer bot needs lives in this one folder of `703deuce/sms`. Nothing here depends on another
bot's computer: `setup/bootstrap_producer_box.sh` creates every `/workspace/...` path the skill and routine use.

**New bot or catching up from the Nov 17 kit? Read [`HANDOFF_UPDATE_2026_11_19.md`](HANDOFF_UPDATE_2026_11_19.md) and follow it step by step.**

| Path | What it is |
|---|---|
| [`HANDOFF_UPDATE_2026_11_19.md`](HANDOFF_UPDATE_2026_11_19.md) | What changed since the original handoff, exact setup commands, credentials to wire up, what to ask Chief of Staff / Rick |
| [`setup/bootstrap_producer_box.sh`](setup/bootstrap_producer_box.sh) | One idempotent installer: skill, motion_kit (Modal, bg_delivery, first_right), producer build, runner, engines, ledgers, env templates, Modal venv, checks |
| `setup/env/*.example` | Templates (names only) for `/workspace/secrets/motion_production.env`, `/workspace/secrets/motion_runner.env`, `/workspace/render_bench/.modal_env` |
| [`skills/motion-studio-production/`](skills/motion-studio-production/README.md) | The production skill (SKILL.md first; RULES_FROM_RICK.md; craft/; delivery.md; engines.md; qa.md ...) |
| `skills/motion-studio-production/scripts/modal/` | Modal CPU render kit: `make_bundle.py`, `submit.sh`, `status.sh`, `reuse.sh`, `setup.sh` (installed to `/workspace/motion_kit/modal/`) |
| `skills/motion-studio-production/scripts/bg_delivery/` | Box-fallback delivery (`launch.sh`, `resume-all.sh`, watchdog) (installed to `/workspace/motion_kit/bg_delivery/`) |
| `motion_kit/first_right/` | Optional layout/face/lint helpers (installed to `/workspace/motion_kit/first_right/`) |
| `motion_kit/worked_examples/` | Code (no media) of the two reference films cited in `engines.md` / `reference-films.md` / `qa.md` (installed to `/workspace/motion_kit/code_motion_cinematic/keef` and `/workspace/motion_kit/round2_cinematic/gme`) |
| [`routine/transovo-motion-studio-production.md`](routine/transovo-motion-studio-production.md) | The current webhook routine prompt (replaces the Nov 17 `motion-studio-job-intake.md`) |
| `profile/profile.json` | Bot name and description |
| `memory/MEMORY_UPDATES_2026_11_19.md` | Memory facts to add on top of the Nov 17 `memory/MEMORY.md` (plus what is superseded) |
| `build/ms_producer_editable/` | Current producer build code (editable packages, publish-live/editable, leased renderer) |
| `motion_runner/` | `launch-leased-render.sh` for `motion_studio_deterministic_render` assignments |
| `engines/` | `install_all.sh`, `pins.txt`, `check_engines.sh` (HyperFrames 0.9.52), engine source lists |
| `templates/` | `STYLE_LEDGER.md` (past looks; never repeat) and `ENGINE_STATUS.md` seeds for `/workspace/motion_jobs/` |

The original Nov 17 kit (briefs, POC, fixtures media, validation reports, original memory/routine) stays on branch
`grokbot/motion-studio-producer-kit-20261117`; the bootstrap fetches the build fixtures from there when needed.

This repository is public: never commit API keys, tokens, signed URLs, webhook keys, server or database details, or customer media.
