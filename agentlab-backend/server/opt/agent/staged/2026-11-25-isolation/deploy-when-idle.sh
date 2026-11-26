#!/bin/bash
# Waits (cheap 60 s polls, up to 8 h) until Agent Lab is idle, then deploys the 2026-11-25 isolation+logs change.
# Log: /opt/agent/backups/2026-11-25-isolation-logs/deploy.log
set -u
S=/opt/agent/staged/2026-11-25-isolation
B=/opt/agent/backups/2026-11-25-isolation-logs
LOG=$B/deploy.log
log() { echo "$(TZ=America/New_York date '+%Y-%m-%d %I:%M:%S %p ET') $*" >> "$LOG"; }
TOK=$(grep '^AGENT_LAB_TOKEN=' /opt/agent/.env | cut -d= -f2-)
busy() {  # prints what is busy; empty when idle
  python3 - "$TOK" <<'PY'
import json, sqlite3, sys, urllib.request
tok = sys.argv[1]
out = []
try:
    db = sqlite3.connect("file:/opt/agent/workspace/runs/runs.db?mode=ro", uri=True, timeout=10)
    out += [f"run {r[0]} {r[1]}" for r in db.execute("SELECT id, status FROM runs WHERE status NOT IN ('done','failed','stopped','cancelled','canceled','error')")]
except Exception as e:
    out.append(f"runs.db unreadable {e}")
try:
    req = urllib.request.Request("http://127.0.0.1:8000/api/conversations/search?limit=100", headers={"X-Session-API-Key": tok})
    items = json.load(urllib.request.urlopen(req, timeout=30))["items"]
    out += [f"conv {c['id'][:8]} {c.get('execution_status')}" for c in items if c.get("execution_status") in ("running", "starting", "queued")]
except Exception as e:
    out.append(f"agent server unreachable {str(e)[:60]}")
print("; ".join(out))
PY
}
log "armed: waiting for no running/queued runs and no running conversations"
for i in $(seq 1 480); do
  b=$(busy)
  [ -z "$b" ] && break
  [ $((i % 15)) = 1 ] && log "still busy: $b"
  sleep 60
done
[ -n "$(busy)" ] && { log "gave up after 8 h; nothing deployed"; exit 1; }
for f in opt/agent/runner/agentd.py opt/agent/ops/sandbox/helperd.py opt/agent/AGENTS.md opt/agent/run.sh; do
  if ! cmp -s "/$f" "$B/files/$f"; then log "ABORT: /$f changed since the backup was taken; re-stage the patch on top of it"; exit 1; fi
done
log "idle; stopping the runner so no new run starts during the deploy"
systemctl stop agent-lab-runner
sleep 5
b=$(busy); if [ -n "$b" ]; then log "became busy ($b); starting runner again and aborting (re-run this script)"; systemctl start agent-lab-runner; exit 1; fi

log "1/7 install agentd.py (runs get their own browser MCP), helperd.py (history-search), AGENTS.md"
install -o root -g root -m 644 $S/new/runner/agentd.py /opt/agent/runner/agentd.py
install -o root -g root -m 644 $S/new/ops/sandbox/helperd.py /opt/agent/ops/sandbox/helperd.py
install -m 644 $S/AGENTS.md /opt/agent/AGENTS.md
python3 -m py_compile /opt/agent/runner/agentd.py /opt/agent/ops/sandbox/helperd.py && log "   compile ok" || log "   COMPILE FAILED"
systemctl restart agent-lab-helper; sleep 1; log "   helper: $(systemctl is-active agent-lab-helper)"

log "2/7 recreate agent-lab with bounded docker logs (run.sh; same image, mounts, env)"
install -m 755 $S/run.sh /opt/agent/run.sh
bash /opt/agent/run.sh >> "$LOG" 2>&1
for i in $(seq 1 60); do curl -s -o /dev/null -w '%{http_code}' -H "X-Session-API-Key: $TOK" http://127.0.0.1:8000/api/settings | grep -q 200 && break; sleep 2; done
log "   agent server: $(curl -s -o /dev/null -w '%{http_code}' -H "X-Session-API-Key: $TOK" http://127.0.0.1:8000/api/settings); log config: $(docker inspect -f '{{json .HostConfig.LogConfig}}' agent-lab)"
systemctl restart agent-lab-chrome agent-lab-jobbrowsers
for i in $(seq 1 30); do curl -s http://127.0.0.1:9222/json/version >/dev/null && break; sleep 2; done
log "   shared Chromium CDP: $(curl -s http://127.0.0.1:9222/json/version >/dev/null && echo up || echo DOWN); job browsers: $(curl -s 127.0.0.1:6073/status)"

log "3/7 disable the redundant fetch MCP server (readpage covers it) and push AGENTS.md into the prompt"
python3 - "$TOK" >> "$LOG" 2>&1 <<'PY'
import sys; sys.path.insert(0, '/opt/agent/ops')
from oh import api
s = api('GET', '/api/settings')
f = ((s.get('agent_settings') or {}).get('mcp_config') or {}).get('fetch')
if f:
    f = {k: v for k, v in f.items()}; f['enabled'] = False
    r = api('POST', '/api/settings/mcp/fetch', f)
    print('   fetch disabled:', '_http_error' not in r, r.get('_http_error', ''))
else:
    print('   fetch not configured')
PY
python3 /opt/agent/ops/pushprompt.py >> "$LOG" 2>&1
log "   mcp-server-fetch processes now: $(pgrep -fc mcp-server-fetch || true)"

log "4/7 recreate searxng with bounded docker logs (same image id, port, config, cache volume)"
IMG=$(python3 -c "import json;print(json.load(open('$B/searxng.inspect.json'))[0]['Image'])")
VOL=$(python3 -c "import json;print([m['Name'] for m in json.load(open('$B/searxng.inspect.json'))[0]['Mounts'] if m['Type']=='volume'][0])")
/opt/agent/ops/searxng-run.sh "$IMG" "$VOL" >> "$LOG" 2>&1
sleep 6
log "   searxng: $(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:8888/search?q=test&format=json'); log config: $(docker inspect -f '{{json .HostConfig.LogConfig}}' searxng)"

log "5/7 start the runner on the new code"
systemctl start agent-lab-runner; sleep 3
log "   runner: $(systemctl is-active agent-lab-runner)"

log "6/7 history index refresh"
/opt/agent/tools/history-search --index >> "$LOG" 2>&1

log "7/7 smoke test: two small concurrent Haiku runs, each must get its own browser"
for site in example.com example.org; do
  curl -s -X POST -H "X-Session-API-Key: $TOK" -H 'Content-Type: application/json' http://127.0.0.1:8010/runs \
    -d "{\"model\":\"haiku\",\"title\":\"[test] own browser $site\",\"prompt\":\"Infrastructure smoke test, keep it short. 1) Call browser_navigate with url https://$site . 2) Call browser_tabs with action list. 3) In the terminal run: job-browser status. Then reply in two lines: the page title, and the job-browser mode and port. Do nothing else.\"}" >> "$LOG"
  echo >> "$LOG"
done
log "deploy finished; smoke runs queued (check: job-browser --status-all, runs.db)"
