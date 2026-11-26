# Rollback: 2026-11-25 per-job browsers, conversation search, bounded logs

Backups of every changed file: `/opt/agent/backups/2026-11-25-isolation-logs/files/` (same paths as on disk).
Container configs before the change: `agent-lab.inspect.json`, `searxng.inspect.json` (mode 600; contain env values, do not share).
Staged new versions: `/opt/agent/staged/2026-11-25-isolation/`. Deploy log: `deploy.log` here.

## Fast switches (no restart)
- Send every job back to the shared browser: `touch /opt/agent/workspace/desktop/jobs/DISABLED`
  (terminal tools + browser-mcp then use 127.0.0.1:9222). Remove the file to re-enable.
- New runs get the old built-in `browser_tool_set` again: `touch /opt/agent/runner/state/jobbrowser.off`
  (read by agentd at each run start; no restart needed).

## Full rollback
```bash
B=/opt/agent/backups/2026-11-25-isolation-logs/files
# 1. per-job browsers + tool wiring
systemctl disable --now agent-lab-jobbrowsers; rm /etc/systemd/system/agent-lab-jobbrowsers.service; systemctl daemon-reload
for f in chrome-keeper browser-upload captcha-solve desktop-yield recall; do cp -a $B/opt/agent/tools/$f /opt/agent/tools/$f; done
rm -f /opt/agent/tools/{browser-shot,job-browser,browser-mcp,jobbrowser.py,history-search}; rm -rf /opt/agent/tools/pylib/pwmcp
for f in _desktop.py desktop-open desktop-reset handoff; do cp -a $B/opt/agent/workspace/tools/bin/$f /opt/agent/workspace/tools/bin/$f; done
rm -f /opt/agent/workspace/tools/bin/history-search
docker exec -u root agent-lab rm -f /usr/local/bin/browser-shot /usr/local/bin/job-browser /usr/local/bin/browser-mcp /usr/local/bin/history-search  # symlinks made by run.sh
rm -rf /opt/agent/workspace/desktop/jobs
# 2. runner + helper + prompt
cp -a $B/opt/agent/runner/agentd.py /opt/agent/runner/agentd.py; systemctl restart agent-lab-runner     # only when no run is running
cp -a $B/opt/agent/ops/sandbox/helperd.py /opt/agent/ops/sandbox/helperd.py; systemctl restart agent-lab-helper
cp -a $B/opt/agent/AGENTS.md /opt/agent/AGENTS.md; python3 /opt/agent/ops/pushprompt.py
# 3. fetch MCP back on (it was only disabled)
python3 -c "import sys;sys.path.insert(0,'/opt/agent/ops');from oh import api;f=api('GET','/api/settings')['agent_settings']['mcp_config']['fetch'];f['enabled']=True;print(api('POST','/api/settings/mcp/fetch',f).get('_http_error','ok'))"
# 4. history search
crontab -l | sed '/BEGIN agent-lab-2026-11-25/,/END agent-lab-2026-11-25/d' | crontab -
rm -f /opt/agent/workspace/memory/history.db
# 5. logs
rm -f /etc/logrotate.d/agent-lab /etc/systemd/journald.conf.d/agentlab-size.conf /etc/docker/daemon.json /opt/agent/ops/weekly-cleanup
systemctl restart systemd-journald
cp -a $B/opt/agent/run.sh /opt/agent/run.sh          # takes effect on the next container recreate (bash /opt/agent/run.sh, when idle)
# searxng without log limits (same image/volume as before):
#   IMG/VOL from searxng.inspect.json; docker rm -f searxng; docker run -d --name searxng --restart unless-stopped \
#   -p 127.0.0.1:8888:8080 -v /opt/agent/searxng:/etc/searxng -v $VOL:/var/cache/searxng $IMG
```
`/etc/docker/daemon.json` did not exist before; it only matters at the next dockerd restart/reboot.
`chown agentlab /opt/agent/workspace/desktop/browser-heal.log` was the only ownership change (was root).
