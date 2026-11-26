#!/bin/bash
# Push /opt/agent/AGENTS.md into the agent server settings as the system message suffix.
set -e; . /opt/agent/.env
python3 - <<PY > /tmp/s.json
import json
print(json.dumps({"agent_settings_diff": {"agent_context": {"system_message_suffix": open("/opt/agent/AGENTS.md").read(),
  "load_project_skills": False, "load_user_skills": False},
  "llm": {"disable_vision": False},
  "condenser": {"condenser_kind": "llm_summarizing", "enabled": True, "max_size": 160, "keep_first": 4}}}))
PY
curl -s -X PATCH -H "X-Session-API-Key: $AGENT_LAB_TOKEN" -H "Content-Type: application/json" localhost:8000/api/settings -d @/tmp/s.json \
 | python3 -c "import json,sys;s=json.load(sys.stdin)[\"agent_settings\"];a=s[\"agent_context\"];print(\"suffix chars:\",len(a[\"system_message_suffix\"] or \"\"),\"project_skills:\",a[\"load_project_skills\"],\"disable_vision:\",s[\"llm\"].get(\"disable_vision\"))"
rm -f /tmp/s.json
