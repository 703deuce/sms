#!/bin/sh
# (Re)start the AgentLab phone worker. Image tag in $1 (default: latest built).
TAG=${1:-agentlab-phone:43}
docker rm -f agentlab-phone >/dev/null 2>&1
exec docker run -d --name agentlab-phone --restart unless-stopped --memory 1500m --network host --user 10001:10001 -e HOME=/tmp \
 --env-file /opt/agent/secrets/phone.env --env-file /opt/agent/secrets/openai.env --env-file /opt/agent/secrets/anthropic.env \
 -e PHONE_OUTBOUND_TRUNK_ID=ST_YeCHXEYQL8uS -e PHONE_AGENT_NAME=agentlab-phone -e PHONE_WORKER_HTTP_PORT=8091 -e RUNS_DB=/workspace/runs/runs.db -e BOT_ID=agent-lab \
 -e PHONE_VAD=${PHONE_VAD:-off} $PHONE_EXTRA_ENV -v /opt/agent/workspace/runs:/workspace/runs -v /opt/agent/tools:/opt/tools:ro $TAG
