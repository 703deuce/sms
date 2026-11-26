# ROLLBACK: core8 (2026-11-25)
Backups here were taken before any change: runner.tgz, tools.tgz (no pylib/runs), skills.tgz, AGENTS.md, hooks.json,
runs.db, plus workspace-tools-bin.tgz (/opt/agent/workspace/tools/bin) and Dockerfile.

## Per-piece off switches (read live, no restart)
- Deep research tools + gate:   touch /opt/agent/tools/flags/DEEP_RESEARCH_OFF  (gate passes when off)
- Ask the user (tool + runner):  touch /opt/agent/tools/flags/ASK_USER_OFF  (runner also honours runner/state/ASK_USER_OFF)
- Handoff notify + watchdog pause: touch /opt/agent/runner/state/HANDOFF_WATCH_OFF
- doc-verify:                   touch /opt/agent/tools/flags/DOC_VERIFY_OFF
- video-digest:                 touch /opt/agent/tools/flags/VIDEO_DIGEST_OFF
- Image generation:             touch /opt/agent/tools/flags/IMAGE_GEN_OFF  (cap: IMAGE_MAX_USD env, default 0.15)
- Restart resume:               touch /opt/agent/runner/state/RESTART_RESUME_OFF  (back to the old failure() path)
- preview:                      touch /opt/agent/tools/flags/PREVIEW_OFF

## Full rollback
B=/opt/agent/backups/2026-11-25-core8
cd /opt/agent && tar xzf $B/runner.tgz && chown -R agentlab:agentlab runner
cd /opt/agent && tar xzf $B/tools.tgz && rm -f tools/{ask-user,answer,research-fanout,research-coverage,doc-verify,video-digest,preview}
cd /opt/agent && tar xzf $B/workspace-tools-bin.tgz && chown -R agentlab:agentlab workspace/tools/bin
cd /opt/agent && tar xzf $B/skills.tgz && rm -rf workspace/skills/lab-deep-research && chown -R 10001:10001 workspace/skills
cp $B/AGENTS.md /opt/agent/AGENTS.md && bash /opt/agent/sync-settings.sh
cp $B/Dockerfile /opt/agent/build/Dockerfile
systemctl restart agent-lab-runner
Runs left in status 'waiting' (ask-user) are not watched by the old runner: set them back first:
python3 -c "import sqlite3;d=sqlite3.connect('/opt/agent/workspace/runs/runs.db');d.execute(\"UPDATE runs SET status='running' WHERE status='waiting'\");d.commit()"
The pip packages added to the running container (reportlab, pymupdf, pdfplumber) are harmless; they disappear on the next image rebuild from the old Dockerfile.
