# Motion Studio production skill

> Setting up a producer bot? Start at [`../../README.md`](../../README.md) and [`../../HANDOFF_UPDATE_2026_11_19.md`](../../HANDOFF_UPDATE_2026_11_19.md); `setup/bootstrap_producer_box.sh` installs this folder to `/home/box/agent-data/workflows/motion-studio-production/`.

The shared rulebook for every agent that produces Transovo Motion Studio videos (films, clips, bring-your-own-footage edits, revisions).

- **Start at [`SKILL.md`](SKILL.md).** It is judgment-first: every job begins with a creative decision about what is best for this edit, then takes one of three paths (edit of the customer's footage, clip pack, or a film made from scratch). It links the reference files (engines, delivery, QA, brand and type, craft standards, retention psychology).
- **[`film-pipeline.md`](film-pipeline.md)** holds the detailed steps for films made from scratch (research, sourcing, script, voice, design system, scene build, sound).
- **[`craft/`](craft/README.md) is the editing craft playbook** — cutting, sound, design and motion, color and style, review, and notes per video type. Use it on every edit.
- **[`RULES_FROM_RICK.md`](RULES_FROM_RICK.md) holds the owner's standing rules,** dated, with superseded rules marked. Where it is newer than `SKILL.md`, it wins.
- `scripts/qa_report.py` is a small technical QA helper (contact sheet, loudness, black/freeze checks).
- `scripts/modal/` is the Modal CPU render kit (default for live jobs) and `scripts/bg_delivery/` the box-fallback delivery; both install to `/workspace/motion_kit/`.

## Keeping it current

New rules from Rick must be added **here** (to `RULES_FROM_RICK.md`, and to `SKILL.md` or the relevant reference file) in the same change — never only in one agent's memory.

This repository is public: never commit API keys, tokens, signed URLs, server or database details, or customer data. Refer to secrets by environment-variable name only.
