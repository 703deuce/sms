# COS-22 production skills split (AgentLab server files)
Mirror of the live AgentLab server files changed by COS-22 (Nov 26, 2026), paths relative to `/opt/agent/`:
- `workspace/skills/lab-video-*`, `workspace/skills/lab-engine-*`: the film-from-scratch stage, type and engine skills.
- `workspace/tools/bin/video-stage`: prints each stage's pages (and the plan-picked engine pages / reference sections) and logs the reads; `--verify` is the producer skill's gate_cmd.
- `runner/skill_gate.py`: model-picked include pages (one type playbook). `runner/goal_judge.py`: `stage_facts()` in the judge facts.
Design, dry-runs, tokens per stage: `agentlab-backend/local/transovo_team/research/production-skills-split-nov26.md`.
Rollback on the server: `/opt/agent/backups/2026-11-26-production-split/ROLLBACK.md`. No secrets in these files (pattern scan + exact-value cross-check, 0 hits).
