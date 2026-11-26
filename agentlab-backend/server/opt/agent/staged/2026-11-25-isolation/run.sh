#!/bin/bash
# Starts the Transovo Agent Lab (OpenHands agent-server) container. Secrets come from /opt/agent/.env.
set -a; . /opt/agent/.env; set +a
docker rm -f agent-lab >/dev/null 2>&1 || true
docker run -d --name agent-lab --restart unless-stopped --network host \
  --log-opt max-size=20m --log-opt max-file=5 \
  --shm-size=1g --group-add 19998 -v /opt/agent/ops/sandbox/job-exec:/usr/local/bin/job-exec:ro \
  -e DEEPSEEK_API_KEY -e GEMINI_API_KEY -e ELEVENLABS_API_KEY -e DEEPGRAM_API_KEY -e VISION_ACTOR_MODEL -e VISION_ACTOR_FALLBACK -e OH_SECRET_KEY \
  -e OH_SESSION_API_KEYS_0="$AGENT_LAB_TOKEN" \
  -e OH_ENABLE_VSCODE=false -e OPENHANDS_SUPPRESS_BANNER=1 \
  -v /opt/agent/workspace:/workspace -v /opt/agent/oh-home:/home/openhands/.openhands -v /opt/agent/tools:/opt/tools:ro -v /opt/agent/ops/sandbox/bash.bashrc:/etc/bash.bashrc:ro -e BOT_ID=agent-lab -e TZ=America/New_York -e PATH=/workspace/tools/bin:/opt/tools:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  transovo-agent:1.63.1-full --host 0.0.0.0 --port 8000
# expose Agent Lab tools (read-only mount /opt/tools) on every shell PATH
sleep 2; docker exec -u root agent-lab bash -c "for f in /opt/tools/*; do case \$f in *.py|*/pylib|*/__pycache__) ;; *) ln -sf \$f /usr/local/bin/; esac; done"
docker exec -u root agent-lab bash -c "echo export\ PATH=/workspace/tools/bin:/opt/tools:\\\$PATH > /etc/profile.d/agent-tools.sh"
# resume vision helpers that were interrupted by this restart (the daemon waits 3 minutes for them)
docker exec -d -u 10001 agent-lab /opt/tools/vision-act --resume-all
