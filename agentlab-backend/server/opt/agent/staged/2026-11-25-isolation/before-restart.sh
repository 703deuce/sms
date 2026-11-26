#!/bin/bash
# Run ONCE, right before the planned runner/agent-lab restart (no run running). Does not restart the runner
# or the container itself. Then do the restart, then run after-restart.sh.
set -u
D=$(dirname "$(readlink -f "$0")")
python3 $D/apply-patches.py || echo "!! some file was not patched (see above); the rest is fine"
systemctl restart agent-lab-helper && echo "helper restarted (history-search op live): $(systemctl is-active agent-lab-helper)"
python3 /opt/agent/ops/pushprompt.py
python3 - <<'PY'
import sys; sys.path.insert(0, '/opt/agent/ops')
from oh import api
f = ((api('GET', '/api/settings').get('agent_settings') or {}).get('mcp_config') or {}).get('fetch')
if f and f.get('enabled'):
    f = dict(f); f['enabled'] = False
    r = api('POST', '/api/settings/mcp/fetch', f); print('fetch MCP disabled:', r.get('_http_error') or 'ok')
else:
    print('fetch MCP already disabled or absent')
PY
echo "Now restart: systemctl restart agent-lab-runner, and recreate the container with: bash /opt/agent/run.sh"
