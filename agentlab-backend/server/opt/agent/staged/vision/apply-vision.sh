#!/bin/bash
# Direct vision for vision-capable main models (`view`), staged 2026-11-22.
# No container restart: installs files, syncs settings (llm.disable_vision=false + AGENTS.md), restarts the runner daemon only.
#   apply-vision.sh [--force] [--probe]   (--probe runs one tiny Flash conversation that uses `view`, ~$0.003)
set -euo pipefail
S=$(cd "$(dirname "$0")" && pwd); FORCE=0; PROBE=0
for a in "$@"; do case $a in --force) FORCE=1;; --probe) PROBE=1;; esac; done
BASE_AGENTS=093303474a0ca81318968a2c61bfce2ef604b0a881e07e5cd6cdad336722c0f6
act=$(python3 -c "import sqlite3;print(sqlite3.connect('/opt/agent/workspace/runs/runs.db').execute(\"select count(*) from runs where status in ('queued','running')\").fetchone()[0])")
if [ "$act" != 0 ] && [ $FORCE = 0 ]; then echo "refusing: $act background run(s) active (use --force)"; exit 1; fi
if [ "$(sha256sum /opt/agent/AGENTS.md | cut -c1-64)" != $BASE_AGENTS ]; then
  echo "refusing: live /opt/agent/AGENTS.md changed since staging; re-stage AGENTS.md with the vision edits first"; exit 1; fi
B=/opt/agent/ops/bak-vision-$(date +%Y%m%d-%H%M%S); mkdir -p $B
cp -p /opt/agent/runner/agentd.py /opt/agent/tools/agent-context /opt/agent/tools/agent-guard /opt/agent/AGENTS.md /opt/agent/sync-settings.sh $B/
install -o root -g root -m 755 $S/view /opt/agent/tools/view
install -o root -g root -m 755 $S/agent-context /opt/agent/tools/agent-context
install -o root -g root -m 755 $S/agent-guard /opt/agent/tools/agent-guard
install -o root -g root -m 644 $S/agentd.py /opt/agent/runner/agentd.py
install -o root -g root -m 644 $S/AGENTS.md /opt/agent/AGENTS.md
install -o root -g root -m 755 $S/sync-settings.sh /opt/agent/sync-settings.sh
/opt/agent/sync-settings.sh
systemctl restart agent-lab-runner
echo "runner restarted at $(TZ=America/New_York date '+%-I:%M:%S %p %Z')"
sleep 12
P=0; F=0; ok(){ echo "PASS  $1"; P=$((P+1)); }; bad(){ echo "FAIL  $1 :: ${2:-}"; F=$((F+1)); }
systemctl is-active -q agent-lab-runner && ok "runner active" || bad "runner"
docker exec -u 10001 agent-lab bash -c 'command -v view && view --help | head -1' >/dev/null 2>&1 && ok "view on PATH" || bad "view on PATH"
[ -d /opt/agent/workspace/runs/view-queue ] && ok "view queue ready" || bad "view queue"
n=$(ls /opt/agent/workspace/runs/vision 2>/dev/null | wc -l); [ "$n" -gt 0 ] && ok "vision status written for $n conversation(s)" || bad "vision status files"
out=$(echo '{"event_type":"PreToolUse","tool_name":"file_editor","tool_input":{"command":"view","path":"/workspace/jobs/x/a.png"},"working_dir":"/workspace/jobs/00000000-0000-4000-8000-000000000000"}' | docker exec -i -u 10001 agent-lab /opt/tools/agent-guard 2>&1 || true)
[[ "$out" == *"view <image>"* ]] && ok "file editor image view redirected to view/look" || bad "guard image redirect" "$out"
out=$(echo '{"event_type":"UserPromptSubmit","working_dir":"/workspace/jobs/00000000-0000-4000-8000-000000000000"}' | docker exec -i -u 10001 agent-lab /opt/tools/agent-context 2>/dev/null || true)
[[ "$out" == *"[Vision]"* ]] && ok "[Vision] line in per-turn context" || bad "vision line" "${out:0:200}"
set +e; . /opt/agent/.env
dv=$(curl -s -H "X-Session-API-Key: $AGENT_LAB_TOKEN" localhost:8000/api/settings | python3 -c "import json,sys;print(json.load(sys.stdin)['agent_settings']['llm'].get('disable_vision'))")
[ "$dv" = False ] && ok "settings: disable_vision=false (SDK still treats text-only models as text-only)" || bad "disable_vision" "$dv"
if [ $PROBE = 1 ]; then python3 $S/probe.py && ok "Flash probe: view delivered and model read the image" || bad "Flash probe"; fi
echo "vision checks: $P passed, $F failed   (backup: $B)"
