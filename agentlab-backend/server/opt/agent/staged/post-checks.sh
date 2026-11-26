#!/bin/bash
# Post-restart checks for the batched apply. Prints PASS/FAIL lines; never prints secrets.
set -uo pipefail
P=0; F=0
ok(){ echo "PASS  $1"; P=$((P+1)); }; bad(){ echo "FAIL  $1  :: ${2:-}"; F=$((F+1)); }
T1=/workspace/jobs/00000000-0000-4000-8000-0000000c0de1; T2=/workspace/jobs/00000000-0000-4000-8000-0000000c0de2
H1=/opt/agent/workspace/jobs/00000000-0000-4000-8000-0000000c0de1; H2=/opt/agent/workspace/jobs/00000000-0000-4000-8000-0000000c0de2
docker exec -u 10001 agent-lab mkdir -p $T1 $T2
echo keep > $H2/keep.txt; chown 10001:10001 $H2/keep.txt
# commands run under the same Landlock rules the terminal gets
sh_in(){ docker exec -u 10001 -w "$1" agent-lab /opt/tools/job-sandbox -- bash -c "$2" 2>/dev/null; }
# the interactive path itself (what the OpenHands tmux terminal starts), through a pseudo-terminal
out=$( (sleep 2; echo 'job-sandbox --check'; sleep 1; echo exit) | docker exec -i -u 10001 -w $T1 agent-lab script -qfc 'bash -i' /dev/null 2>&1 | grep -o "sandbox: [^ ]*" | head -1 | tr -d '\r')
[[ "$out" == *"$T1"* ]] && ok "interactive shell confines itself via /etc/bash.bashrc ($out)" || bad "interactive sandbox" "$out"
out=$(sh_in $T1 "python3 -c \"import os; os.remove('$T2/keep.txt')\" 2>&1 | tail -1"); [[ "$out" == *PermissionError* ]] && ok "python delete in another job blocked" || bad "cross-job delete" "$out"
out=$(sh_in $T1 "node -e \"require('fs').writeFileSync('/workspace/memory/x','x')\" 2>&1 | grep -o EACCES | head -1"); [ "$out" = EACCES ] && ok "node write into memory blocked" || bad "memory write" "$out"
out=$(sh_in $T1 "python3 -c \"import socket; socket.create_connection(('127.0.0.1',8000),3)\" 2>&1 | tail -1"); [[ "$out" == *PermissionError* ]] && ok "agent-server port blocked from the terminal" || bad "port 8000" "$out"

# memory / skills / project notes through the broker
out=$(sh_in $T1 'remember "apply-check temporary fact" 2>&1'); id=$(grep -o '#[0-9]*' <<<"$out" | head -1 | tr -d '#')
[ -n "$id" ] && ok "remember via broker (#$id)" || bad "remember" "$out"
out=$(sh_in $T1 'recall "apply-check temporary" 2>&1'); [[ "$out" == *"apply-check temporary fact"* ]] && ok "recall via broker" || bad "recall" "$out"
[ -n "$id" ] && { out=$(sh_in $T1 "forget $id 2>&1"); [[ "$out" != *rror* ]] && ok "forget via broker" || bad "forget" "$out"; }
out=$(sh_in $T1 'project-note apply-check "post-restart check note" 2>&1 && project-note apply-check 2>&1'); [[ "$out" == *"post-restart check note"* ]] && ok "project-note write + read via broker" || bad "project-note" "$out"
out=$(sh_in $T1 'printf "# Temp\nTemporary skill from the apply checks.\n" > body.md && save-skill apply-check-skill --description "temporary check skill" --file body.md 2>&1 && skill apply-check-skill 2>&1'); [[ "$out" == *"Temporary skill"* ]] && ok "save-skill + skill via broker" || bad "save-skill" "$out"
rm -rf /opt/agent/workspace/skills/apply-check-skill /opt/agent/workspace/memory/projects/apply-check.md

# times
out=$(sh_in $T1 'remind --at "tomorrow 9am" "apply-check reminder" 2>&1'); rid=$(grep -o 'rm_[0-9a-f]*' <<<"$out" | head -1)
exp=$(TZ=America/New_York date -d tomorrow '+%A, %B %-d, %Y at 9:00 AM')
[[ "$out" == *"$exp"* ]] && ok "remind 'tomorrow 9am' -> $exp ET (echoed)" || bad "remind tomorrow" "$out"
[ -n "$rid" ] && sh_in $T1 "routine rm $rid" >/dev/null
out=$(echo '{"event_type":"UserPromptSubmit","working_dir":"/tmp","message":"hi"}' | docker exec -i -u 10001 agent-lab /opt/tools/agent-context)
[[ "$out" == *"[Clock] Now: $(TZ=America/New_York date '+%A, %B %-d, %Y')"* ]] && ok "clock line injected every turn (ET)" || bad "clock line" "${out:0:200}"

# cost
out=$(sh_in $T1 'usage --conversation b676011e-7881-486d-b95a-e85d664ae838 2>&1'); [[ "$out" == *"TOTAL: \$0.3071"* ]] && ok "usage --conversation matches the ledger (\$0.3071)" || bad "usage --conversation" "$out"

# file editor guard (installed hook)
out=$(printf '{"event_type":"PreToolUse","session_id":"c","working_dir":"%s","tool_name":"file_editor","tool_input":{"command":"create","path":"/workspace/skills/x.md"}}' $T1 | docker exec -i -u 10001 agent-lab /opt/tools/agent-guard; echo "rc=$?")
[[ "$out" == *rc=2* ]] && ok "file editor blocked outside the job" || bad "editor guard" "$out"
out=$(printf '{"event_type":"PreToolUse","session_id":"c","working_dir":"%s","tool_name":"file_editor","tool_input":{"command":"create","path":"%s/a.md"}}' $T1 $T1 | docker exec -i -u 10001 agent-lab /opt/tools/agent-guard; echo "rc=$?")
[[ "$out" == *rc=0* ]] && ok "file editor allowed inside the job" || bad "editor guard allow" "$out"

# desktop: clean start, reset between jobs
sh_in $T1 'desktop-open about:blank >/dev/null 2>&1'; sleep 4
out=$(sh_in $T2 'desktop-open https://example.com 2>&1'); sleep 6
grep -q "browser reset: closed" <(journalctl -u agent-lab-desktop --since "-1 min" --no-pager) && ok "new job's desktop-open reset the previous job's browser" || bad "desktop reset between jobs" "$out"
out=$(sh_in $T2 'desktop-shot -o shot.png >/dev/null 2>&1 && look shot.png "Answer yes or no for each: (1) Is a \"Restore pages\" or crash-restore prompt visible? (2) Is the Example Domain page shown?" 2>/dev/null | head -2')
[[ "$out" =~ [Nn]o.*[Yy]es|1.*[Nn]o.*2.*[Yy]es ]] && ok "browser opened clean (no restore prompt): ${out//$'\n'/ }" || bad "clean browser" "$out"
out=$(sh_in $T2 'desktop-reset 2>&1'); [[ "$out" == *'"ok": true'* ]] && ok "desktop-reset" || bad "desktop-reset" "$out"

# services
[ -S /opt/agent/workspace/.helper/helper.sock ] && ok "broker socket present" || bad "broker socket"
for s in agent-lab-helper agent-lab-runner agent-lab-desktop; do systemctl is-active -q $s && ok "$s active" || bad "$s"; done
docker exec -u 10001 agent-lab bash -c 'command -v watch-media conv-usage desktop-reset >/dev/null && ! [ -e /opt/tools/watch ]' && ok "watch-media/conv-usage/desktop-reset on PATH, watch shim gone" || bad "tool links"
rm -rf $H1 $H2
echo "checks: $P passed, $F failed"
