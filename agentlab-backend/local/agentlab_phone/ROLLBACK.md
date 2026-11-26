# ROLLBACK: AgentLab phone line + connectors (2026-11-25)
Backups: /opt/agent/backups/2026-11-25-phone/ (AGENTS.md.orig, runs.db.bak, phone-config.default.json, Caddyfile.dist, livekit_sip_before.json, src/)

Quick off (no rollback): `phone set '{"enabled": false}'` (calls are dropped by the AI), or `docker stop agentlab-phone`.

Full rollback (on 204.168.139.158 as root):
1. Worker: `docker rm -f agentlab-phone; docker rmi agentlab-phone:14 agentlab-phone:13 agentlab-phone:12 agentlab-phone:11 agentlab-phone:10 agentlab-phone:9 agentlab-phone:8 agentlab-phone:7 agentlab-phone:6 agentlab-phone:5 agentlab-phone:4 agentlab-phone:3 agentlab-phone:2 agentlab-phone:1 agentlab-phone:base`
2. Return the number to the old Transovo routing and remove the AgentLab trunks/rule:
   `docker run --rm --env-file /opt/agent/secrets/phone.env agentlab-phone:14 python /app/provision.py detach +15715474814 --back-to ST_vewjyLgDxVda`
   (run this before step 1, or rebuild from /opt/agent/phone). Then delete LiveKit `ST_jfXYgG4kqoxu` (inbound), `ST_YeCHXEYQL8uS` (outbound), `SDR_miJSdHZm3Kwe` (rule) with `lk sip` or livekit-api.
   To restore the exact old number list on ST_vewjyLgDxVda (with no-"+" aliases), see livekit_sip_before.json.
3. Telnyx: delete credential connection 3101291759108360086 ("AgentLab LiveKit Outbound"). The number's connection (3037959952799893412) didn't change.
4. Connectors: `systemctl disable --now agentlab-connectors; rm /etc/systemd/system/agentlab-connectors.service; rm -rf /opt/agent/connectors /opt/agent/secrets/connectors`
   Caddy: `cp /opt/agent/backups/2026-11-25-phone/Caddyfile.dist /etc/caddy/Caddyfile; systemctl stop caddy; apt-get remove -y caddy`
5. AgentLab: `rm /opt/agent/tools/phone /opt/agent/tools/connector; rm -rf /opt/agent/tools/pylib_phone /opt/agent/workspace/skills/lab-phone-agent /opt/agent/workspace/skills/lab-connectors`
   `cp /opt/agent/backups/2026-11-25-phone/AGENTS.md.orig /opt/agent/AGENTS.md`
6. Data (optional): `/opt/agent/workspace/runs/phone/` (config, calls.db, transcripts). Secrets: `/opt/agent/secrets/phone.env`.

## Update (images 5-10, Nov 25 evening)
- Images: :5 = first full-featured worker (options/transfer/SMS/booking), :6 = intake fields + warm/waterfall transfer + hold music + alerts + spam, :7 = away-timeout/goodbye fixes, :8 = transfer status/summary fixes, :9 = Graph read-back verification for bookings, :10 = name read-back. :11 = own-number alert skip, :12 = availability time-of-day filter + calendarView timezone fix. :13 = stale booked-hold fix (calendar is source of truth), :14 = deterministic booking setup (slot ids, holidays, blackouts, tz). Current = :14 (run-worker.sh runs it).
- Step back one version (keeps everything else): `sh /opt/agent/phone/run-worker.sh agentlab-phone:<n>` (on 204.168.139.158). Note :5 cannot read the newer config keys (it ignores them), so for :5 also restore the v5 config:
  `cp /opt/agent/backups/2026-11-25-phone/v5/config.json /opt/agent/workspace/runs/phone/config.json`
  Pre-v6 code, CLI and config are in `/opt/agent/backups/2026-11-25-phone/v5/` (worker/, phone, pylib_phone/, config.json). To restore the old CLI: `cp .../v5/phone /opt/agent/tools/phone; cp .../v5/pylib_phone/store.py /opt/agent/tools/pylib_phone/store.py`.
- Calls and config are in /opt/agent/workspace/runs/phone/ (calls.db keeps new columns; older code ignores them).

## Traefik OAuth hand-off on the Coolify host (128.140.102.51): `agentlab-oauth.yaml`
Added Nov 25 ~6:48 PM ET. File: `/data/coolify/proxy/dynamic/agentlab-oauth.yaml` (Traefik file provider; reload is automatic). It routes ONLY these transovo.ai callback paths when the OAuth `state` starts with `agentlab.` to the AgentLab broker at http://204.168.139.158:6082:
`/api/integrations/microsoft/callback`, `/api/crm/salesforce/callback`, `/api/crm/zoho/callback`, `/api/integrations/native/calendly/callback`. All other callbacks (every real sign-in) still reach the production app; no new DNS or redirect URLs were registered.
To remove (as cursor-agent with sudo): `sudo rm /data/coolify/proxy/dynamic/agentlab-oauth.yaml` (Traefik drops the router within seconds). Verify: `curl -sI 'https://transovo.ai/api/integrations/microsoft/callback?state=agentlab.x&code=x'` should now behave like any other callback (prod app response), not the broker page. Without this file, AgentLab connector sign-ins stop working but nothing else changes. Also stop the broker if wanted: `systemctl disable --now agentlab-connectors` on 204.168.139.158 (step 4 above).
