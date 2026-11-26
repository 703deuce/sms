#!/bin/bash
# Push /opt/agent/AGENTS.md into the agent server settings as the system message suffix.
set -e; . /opt/agent/.env
python3 - <<PY > /tmp/s.json
import json
print(json.dumps({"agent_settings_diff": {"agent_context": {"system_message_suffix": open("/opt/agent/AGENTS.md").read(),
  "load_project_skills": False, "load_user_skills": False, "current_datetime": ""},
  "llm": {"disable_vision": False, "max_input_tokens": 200000, "prompt_cache_retention": "5m"},
  "condenser": {"condenser_kind": "llm_summarizing", "enabled": True, "max_size": 2000, "keep_first": 3, "max_tokens": None}}}))
PY
curl -s -X PATCH -H "X-Session-API-Key: $AGENT_LAB_TOKEN" -H "Content-Type: application/json" localhost:8000/api/settings -d @/tmp/s.json \
 | python3 -c "import json,sys;s=json.load(sys.stdin)[\"agent_settings\"];a=s[\"agent_context\"];print(\"suffix chars:\",len(a[\"system_message_suffix\"] or \"\"),\"project_skills:\",a[\"load_project_skills\"],\"disable_vision:\",s[\"llm\"].get(\"disable_vision\"),\"current_datetime:\",a.get(\"current_datetime\"),\"retention:\",s[\"llm\"].get(\"prompt_cache_retention\"))"
rm -f /tmp/s.json
