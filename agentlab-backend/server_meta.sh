#!/bin/bash
# Runs ON the server (read-only). Emits a tar of generated metadata with env VALUES stripped.
set -u
T=$(mktemp -d /tmp/agentlab_meta.XXXXXX); trap 'rm -rf "$T"' EXIT
mkdir -p $T/generated
crontab -l 2>/dev/null | sed -E 's/((KEY|TOKEN|SECRET|PASSWORD|PASS)[A-Za-z_]*=)[^ ]+/\1<REDACTED>/Ig' > $T/generated/crontab.txt
ls /etc/cron.d /etc/cron.daily 2>/dev/null > $T/generated/cron-dirs.txt
systemctl list-units --all --no-legend 'agent-lab-*' 'agentlab-*' 2>/dev/null > $T/generated/systemctl-units.txt
systemctl list-unit-files --no-legend 'agent-lab-*' 'agentlab-*' 2>/dev/null > $T/generated/systemctl-unit-files.txt
for c in $(docker ps -a --format '{{.Names}}'); do
  docker inspect "$c" 2>/dev/null | python3 -c '
import sys,json
for d in json.load(sys.stdin):
    cfg=d["Config"]; hc=d["HostConfig"]
    env=[e.split("=",1)[0] for e in (cfg.get("Env") or [])]
    out={"Name":d["Name"],"Image":cfg.get("Image"),"ImageID":d.get("Image"),"Cmd":cfg.get("Cmd"),"Entrypoint":cfg.get("Entrypoint"),
     "EnvNamesOnly":env,"User":cfg.get("User"),"WorkingDir":cfg.get("WorkingDir"),
     "Mounts":[{"Source":m.get("Source"),"Destination":m.get("Destination"),"Mode":m.get("Mode"),"RW":m.get("RW")} for m in d["Mounts"]],
     "NetworkMode":hc.get("NetworkMode"),"RestartPolicy":hc.get("RestartPolicy"),"ShmSize":hc.get("ShmSize"),
     "GroupAdd":hc.get("GroupAdd"),"LogConfig":hc.get("LogConfig"),"Memory":hc.get("Memory"),"Devices":hc.get("Devices"),"PortBindings":hc.get("PortBindings"),"Privileged":hc.get("Privileged")}
    print(json.dumps(out,indent=2))
' > "$T/generated/docker-$c.json"
done
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}' > $T/generated/docker-images.txt 2>/dev/null
docker compose ls 2>/dev/null > $T/generated/docker-compose-ls.txt
(uname -a; lsb_release -d 2>/dev/null; python3 --version; docker --version; df -h / | tail -1; free -m | head -2) > $T/generated/host-info.txt 2>&1
dpkg-query -W -f='${Package} ${Version}\n' 2>/dev/null | head -2000 > $T/generated/dpkg-list.txt
pip3 list --format=freeze 2>/dev/null > $T/generated/pip3-freeze.txt
ls -la /opt/agent/secrets /opt/agent/workspace/secrets 2>/dev/null | awk '{print $1,$3,$5,$9}' > $T/generated/secret-files-inventory.txt
tar -C $T -czf - generated
