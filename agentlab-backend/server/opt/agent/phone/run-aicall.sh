#!/bin/sh
# usage: run-aicall.sh <scenario> [image]
exec docker run --rm --network host --user 10001:10001 -e HOME=/tmp --env-file /opt/agent/secrets/phone.env --env-file /opt/agent/secrets/openai.env \
 -e PHONE_OUTBOUND_TRUNK_ID=ST_YeCHXEYQL8uS -v /opt/agent/workspace/runs:/workspace/runs -v /opt/agent/phone/aicaller.py:/app/aicaller.py:ro ${2:-agentlab-phone:42} python /app/aicaller.py $1
