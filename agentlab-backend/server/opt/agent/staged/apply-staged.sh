#!/bin/bash
# Applies the staged Agent Lab changes in ONE batch: sandbox lockdown (Landlock), file-editor guard, helperd broker,
# daemon (vision resume grace), AGENTS.md, watch shim removal. Restarts: agent-lab-helper, agent-lab container, runner.
# Usage: apply-staged.sh [--force]   (refuses while runs or conversations are active unless --force)
set -euo pipefail
S=/opt/agent/staged
cd "$S"
if [ "${1:-}" != "--force" ]; then
  active=$(python3 -c "
import sqlite3; d=sqlite3.connect('/opt/agent/workspace/runs/runs.db')
print(d.execute(\"select count(*) from runs where status in ('queued','running')\").fetchone()[0])")
  [ "$active" = 0 ] || { echo "refusing: $active runs queued/running (use --force)"; exit 3; }
fi
TS=$(date +%Y%m%d-%H%M%S); B=/opt/agent/ops/bak-apply-$TS; mkdir -p $B
cp -p /opt/agent/run.sh /opt/agent/AGENTS.md /opt/agent/runner/agentd.py /opt/agent/tools/agent-guard /opt/agent/ops/sandbox/helperd.py $B/
# 1) files
install -o root -g root -m 644 bash.bashrc /opt/agent/ops/sandbox/bash.bashrc
install -o root -g root -m 755 agent-guard /opt/agent/tools/agent-guard
install -o root -g root -m 755 helperd.py /opt/agent/ops/sandbox/helperd.py
install -o root -g root -m 644 agentd.py /opt/agent/runner/agentd.py
install -o root -g root -m 644 AGENTS.md /opt/agent/AGENTS.md
install -o 10001 -g 10001 -m 755 recall.wrapper /opt/agent/workspace/tools/bin/recall
cp -p /opt/agent/ops/desktop/desktop-service.py /opt/agent/workspace/tools/bin/desktop-open $B/
install -o root -g root -m 755 desktop-service.py /opt/agent/ops/desktop/desktop-service.py
install -o 10001 -g 10001 -m 755 desktop-open /opt/agent/workspace/tools/bin/desktop-open
install -o 10001 -g 10001 -m 755 desktop-reset /opt/agent/workspace/tools/bin/desktop-reset
mkdir -p /etc/systemd/system/agent-lab-helper.service.d
install -m 644 helperd.dropin.conf /etc/systemd/system/agent-lab-helper.service.d/uid.conf
rm -f /opt/agent/tools/watch            # compatibility shim for the old name
install -m 700 run.sh /opt/agent/run.sh
# 2) services + the one container restart
systemctl daemon-reload
systemctl restart agent-lab-helper
systemctl restart agent-lab-desktop
echo "container restart at $(TZ=America/New_York date '+%H:%M:%S %Z')"
/opt/agent/run.sh >/dev/null
sleep 8
/opt/agent/sync-settings.sh
systemctl restart agent-lab-runner
# 3) checks
sleep 5
bash $S/post-checks.sh
echo "backup of replaced files: $B"
