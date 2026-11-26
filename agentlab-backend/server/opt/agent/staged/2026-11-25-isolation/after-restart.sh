#!/bin/bash
# Run right after `bash /opt/agent/run.sh` (container recreated) and the runner restart.
set -u
B=/opt/agent/backups/2026-11-25-isolation-logs
systemctl restart agent-lab-chrome agent-lab-jobbrowsers
for i in $(seq 1 30); do curl -s http://127.0.0.1:9222/json/version >/dev/null && break; sleep 2; done
echo "shared Chromium: $(curl -s http://127.0.0.1:9222/json/version >/dev/null && echo up || echo DOWN)"
echo "job browsers: $(curl -s 127.0.0.1:6073/status)"
echo "agent-lab log config: $(docker inspect -f '{{json .HostConfig.LogConfig}}' agent-lab)"
echo "mcp-server-fetch processes: $(pgrep -fc '[m]cp-server-fetch' || true)"
if [ "$(docker inspect -f '{{.HostConfig.LogConfig.Config}}' searxng)" = "map[]" ]; then
  IMG=$(python3 -c "import json;print(json.load(open('$B/searxng.inspect.json'))[0]['Image'])")
  VOL=$(python3 -c "import json;print([m['Name'] for m in json.load(open('$B/searxng.inspect.json'))[0]['Mounts'] if m['Type']=='volume'][0])")
  /opt/agent/ops/searxng-run.sh "$IMG" "$VOL" >/dev/null && sleep 6
fi
echo "searxng: $(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:8888/search?q=test&format=json') log config: $(docker inspect -f '{{json .HostConfig.LogConfig}}' searxng)"
