# producer_handoff_kit: START HERE (Motion Studio Producer + Chief of Staff)

**Current as of November 21, 2026. A new bot should read [`HANDOFF_2026-11-21.md`](HANDOFF_2026-11-21.md) first.** That file is the definitive index: standing rules, self-hosted render vs Modal, infrastructure, secrets (names/paths only), and how to rebuild from zero.

Everything a Motion Studio Producer bot needs lives in this one folder of `703deuce/sms`. Nothing here depends on another
bot's computer: `setup/bootstrap_producer_box.sh` creates every `/workspace/...` path the skill and routine use.

**New bot or catching up from the Nov 17/19 kit? Read [`HANDOFF_2026-11-21.md`](HANDOFF_2026-11-21.md) first.** Then use [`HANDOFF_UPDATE_2026_11_19.md`](HANDOFF_UPDATE_2026_11_19.md) for the original step-by-step box setup. Where the two disagree (especially Modal vs the sms server), the November 21 handoff wins.

| Path | What it is |
|---|---|
| [`HANDOFF_2026-11-21.md`](HANDOFF_2026-11-21.md) | **Read first.** Current rules, self-hosted render path, infrastructure, rebuild steps, secrets (names only) |
| [`HANDOFF_UPDATE_2026_11_19.md`](HANDOFF_UPDATE_2026_11_19.md) | Nov 19 catch-up: original setup commands and credentials to wire up (superseded on render path / rules where this disagrees with the Nov 21 handoff) |
| [`setup/bootstrap_producer_box.sh`](setup/bootstrap_producer_box.sh) | One idempotent installer: skill, self-hosted render kit (scripts/render/ → /workspace/motion_kit/modal/, plus .modal_disabled), bg_delivery, first_right, producer build, runner, engines, live ledgers, env templates, checks. Modal CLI/venv is optional (`--with-modal`) |
| `setup/env/*.example` | Templates (names only) for producer, runner, webhook, render worker, chief, B2, and Modal fallback env files |
| [`skills/motion-studio-production/`](skills/motion-studio-production/README.md) | The production skill (SKILL.md first; RULES_FROM_RICK.md; craft/; delivery.md; engines.md; qa.md ...) |
| `skills/motion-studio-production/scripts/modal/` and `motion_kit/modal/` | Bootstrap installs `scripts/render/` (self-hosted: `submit.sh`, `submit.py`, `make_bundle.py`, `status.sh`, `reuse.sh`, `.modal_disabled`) to `/workspace/motion_kit/modal/`. `scripts/modal/` is the older Modal-era kit, used only with `--with-modal` |
| `skills/motion-studio-production/scripts/bg_delivery/` | Box-fallback delivery (`launch.sh`, `resume-all.sh`, watchdog) (installed to `/workspace/motion_kit/bg_delivery/`) |
| `motion_kit/first_right/` | Optional layout/face/lint helpers (installed to `/workspace/motion_kit/first_right/`) |
| `motion_kit/worked_examples/` | Code (no media) of the two reference films cited in `engines.md` / `reference-films.md` / `qa.md` (installed to `/workspace/motion_kit/code_motion_cinematic/keef` and `/workspace/motion_kit/round2_cinematic/gme`) |
| [`routine/transovo-motion-studio-production.md`](routine/transovo-motion-studio-production.md) | Webhook routine prompt (Nov 21 supersession at the top is the live self-hosted render path; replaces the Nov 17 `motion-studio-job-intake.md`) |
| `profile/profile.json` | Bot name and description |
| `memory/` | Nov 19 memory updates, the Nov 21 producer memory export (`producer_memory_and_routines.md`), and applied Nov 20 rule notes |
| `build/ms_producer_editable/` | Current producer build code (editable packages, publish-live/editable, leased renderer) |
| `motion_runner/` | `launch-leased-render.sh` and `coord-report.mjs` for coordinator / leased-render assignments |
| `engines/` | `install_all.sh`, `pins.txt`, `check_engines.sh` (HyperFrames 0.9.52), engine source lists |
| [`ledgers/`](ledgers/README.md) | Live `STYLE_LEDGER.md` and `ENGINE_STATUS.md` used on jobs through Nov 21, 2026 (bootstrap copies these into `/workspace/motion_jobs/` if missing) |
| `templates/` | Older ledger seeds; prefer `ledgers/` on a new box |
| `chief_of_staff/2026-11-19-chief-of-staff/` | Chief of Staff Nov 19 handoff (also at `docs/handoffs/2026-11-19-chief-of-staff/` on master) |
| `specs/` | ChatGPT specs from `/workspace/handoff_for_chatgpt/*.md` (reference only) |


The original Nov 17 kit (briefs, POC, fixtures media, validation reports, original memory/routine) stays on branch
`grokbot/motion-studio-producer-kit-20261117`; the bootstrap fetches the build fixtures from there when needed.

This repository is public: never commit API keys, tokens, signed URLs, webhook keys, server or database details, or customer media.
