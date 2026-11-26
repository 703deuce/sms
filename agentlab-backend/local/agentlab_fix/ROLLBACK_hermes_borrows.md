# ROLLBACK: Hermes borrows (2026-11-25)
Backups in this folder were taken before any change: runner.tgz (all of /opt/agent/runner), tools.tgz (/opt/agent/tools
without pylib/runs), skills.tgz (/opt/agent/workspace/skills), AGENTS.md, hooks.json, runs.db (sqlite backup).

## Turn one piece off (no rollback needed)
- Goal judge:           touch /opt/agent/runner/state/GOAL_JUDGE_OFF
- Loop guard (new):     touch /opt/agent/runner/state/LOOP_GUARD_OFF   (also disables the old 3-identical nudge)
- Graceful step finish: touch /opt/agent/runner/state/GRACEFUL_FINISH_OFF
- Learning review:      touch /opt/agent/runner/state/LEARN_REVIEW_OFF  (dry run: LEARN_REVIEW_DRYRUN)
- Script routines:      touch /opt/agent/runner/state/SCRIPT_ROUTINES_OFF
- Skill gates rows/cmd: touch /opt/agent/runner/state/SKILL_GATE_OFF (whole skill gate) or remove gate_rows/gate_cmd from a skill
- run-script:           touch /opt/agent/tools/flags/RUN_SCRIPT_OFF
- browser-run:          touch /opt/agent/tools/flags/BROWSER_RUN_OFF
- Evidence screenshots: touch /opt/agent/tools/flags/EVIDENCE_OFF
- Steering label:       touch /opt/agent/tools/flags/STEERING_OFF
Runner flags are read live (no restart).

## Full rollback
B=/opt/agent/backups/2026-11-25-hermes-borrows
cd /opt/agent && tar xzf $B/runner.tgz && chown -R agentlab:agentlab runner
cd /opt/agent && tar xzf $B/tools.tgz && rm -f tools/labtools.py tools/run-script tools/browser-run tools/evidencelib.py tools/evidence-shot
cd /opt/agent && tar xzf $B/skills.tgz && chown -R 10001:10001 workspace/skills/lab-routines-reminders
cp $B/AGENTS.md /opt/agent/AGENTS.md && bash /opt/agent/sync-settings.sh
cp $B/hooks.json /opt/agent/oh-home/hooks.json && chown 10001:10001 /opt/agent/oh-home/hooks.json
rm -f /opt/agent/runner/{labllm,goal_judge,loop_guard,learn_review,script_routines}.py
systemctl restart agent-lab-runner
Script routines (action='script') left in runs.db are skipped by the old runner? No: the old runner treats unknown actions as
'run'. Before a full rollback, pause them: python3 -c "import sqlite3;d=sqlite3.connect('/opt/agent/workspace/runs/runs.db');d.execute(\"UPDATE routines SET paused=1 WHERE action='script'\");d.commit()"
Learned skill pitfalls: each patched skill has a dated .SKILL.md.<stamp>.bak; learned memories: `forget <id>` (ids in runner/state/learn-review.jsonl).
