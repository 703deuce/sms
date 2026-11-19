#!/usr/bin/env bash
# run-tests.sh: end-to-end tests against LOCAL mocks only (no Transovo calls).
#  A  chaos (20% 500s, 5% hung requests) + kill -9 of the worker mid-upload -> resumes -> completes
#  B  unpacked package, kill worker, then kill watchdog+worker ("box restart") -> resume-all.sh -> completes
#  C  producer lease expires mid-upload -> FAILED (401), watchdog stops
#  D  server returns 500 forever -> retry window exhausted -> FAILED, MP4 stays playable
#  E  409 after complete; DONE re-run; lost /complete response; repacked scenes byte-identical
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; K="$(dirname "$HERE")"; T=${BG_TEST_DIR:-/workspace/bg_delivery_test}
M=${BG_TEST_MASTER:-/workspace/motion_jobs/msaj_558aa7f9-d7e7-4da0-9f0b-e06c1228096c/editable/out/master.mp4}
SRC=${BG_TEST_SRC:-/workspace/motion_jobs/msaj_6c02fc45-d3fa-4e67-8ac7-dc8b6807ab6d/editable/live}
export BG_DELIVERY_TIMEOUT_MS=3000 BG_DELIVERY_PUT_TIMEOUT_MS=3000 BG_DELIVERY_BACKOFF_BASE_MS=300 BG_DELIVERY_BACKOFF_CAP_MS=3000 BG_DELIVERY_HEARTBEAT_MS=2000 BG_DELIVERY_RESTART_SEC=2
rm -rf "$T"; mkdir -p "$T"; PASS=0; FAIL=0
ok() { echo "PASS $*"; PASS=$((PASS+1)); }; bad() { echo "FAIL $*"; FAIL=$((FAIL+1)); }
freeport() { for p in $(seq 18700 18799); do ss -ltn | grep -q ":$p " || { echo $p; return; }; done; }
mock() { local j=$1 port=$2; shift 2; local job; job=$(bash "$HERE/make-test-job.sh" "$T/$j" "$port")
  ( env MOCK_PORT=$port MOCK_JOB_ID=$job MOCK_TOKEN_FILE="$T/$j/secrets/token" "$@" setsid nohup node "$HERE/mock-server.mjs" > "$T/mock_$j.log" 2>&1 < /dev/null & ); sleep 0.7
  grep -q listening "$T/mock_$j.log" || { echo "mock for $j failed to start"; cat "$T/mock_$j.log"; exit 1; }; }
st() { curl -s "127.0.0.1:$1/__state"; }
jq_() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }
committed() { node -e 'try{console.log(Object.keys(require(process.argv[1]).storage||{}).length)}catch{console.log(0)}' "$T/$1/deliver_bg/state.json"; }
waitdone() { for i in $(seq 1 ${2:-120}); do [ -f "$T/$1/deliver_bg/DONE" ] || [ -f "$T/$1/deliver_bg/FAILED" ] && return; sleep 1; done; }
export -f >/dev/null
PA=$(freeport); mock jobA $PA CHAOS_500=0.2 CHAOS_HANG=0.05 HANG_MS=6000 MOCK_PUT_DELAY_MS=1500
timeout 300 bash "$K/launch.sh" "$T/jobA" "$M" --test-localhost >/dev/null 2>&1 && [ "$(st $PA | jq_ 'd["customerCanPlayMp4"] and d["status"]=="running"')" = True ] && ok "A: MP4 playable while job stays open" || bad "A: master step"
sleep 3; n1=$(committed jobA); kill -9 "$(cat $T/jobA/deliver_bg/worker.pid)" 2>/dev/null; echo "   A: killed worker with $n1 files committed"
waitdone jobA; [ -f "$T/jobA/deliver_bg/DONE" ] && ok "A: completed after kill + restart" || bad "A: not done"
grep -q "already ready" "$T/jobA/deliver_bg/worker.log" && ok "A: restart skipped committed files ($(grep -o '[0-9]* already ready' $T/jobA/deliver_bg/worker.log | tail -1))" || bad "A: no resume evidence"
st $PA | jq_ '"   A mock: status=%s complete=%s retries: 500s=%d hangs=%d commits=%d ready=%d" % (d["status"], d["completeBody"], d["chaos500"], d["chaosHang"], d["commits"], d["ready"])'
PB=$(freeport); mock jobB $PB CHAOS_500=0.15 CHAOS_HANG=0.03 HANG_MS=6000 MOCK_PUT_DELAY_MS=2500
timeout 300 bash "$K/launch.sh" "$T/jobB" "$M" --test-localhost --no-repack >/dev/null 2>&1
sleep 6; kill -9 "$(cat $T/jobB/deliver_bg/worker.pid)"; sleep 7; n=$(committed jobB)
kill -9 "$(cat $T/jobB/deliver_bg/watchdog.pid)" "$(cat $T/jobB/deliver_bg/worker.pid)" 2>/dev/null; sleep 1; echo "   B: killed watchdog+worker with $n/29 committed (simulated box restart)"
bash "$K/resume-all.sh" "$T" >/dev/null; waitdone jobB
[ -f "$T/jobB/deliver_bg/DONE" ] && [ "$(st $PB | jq_ 'd["commits"]')" -le 30 ] && ok "B: resume-all.sh finished it, every file committed once ($(st $PB | jq_ 'd["commits"]') commits for 29 files + master)" || bad "B"
PC=$(freeport); mock jobC $PC MOCK_PUT_DELAY_MS=2500
timeout 120 bash "$K/launch.sh" "$T/jobC" "$M" --test-localhost >/dev/null 2>&1; sleep 3; curl -s -X POST "127.0.0.1:$PC/__expire_lease" >/dev/null; waitdone jobC 60
grep -q "lease expired" "$T/jobC/deliver_bg/FAILED" 2>/dev/null && ! pgrep -f "watchdog.sh $T/jobC" >/dev/null && ok "C: lease expiry -> FAILED file, watchdog stopped" || bad "C"
PD=$(freeport); mock jobD $PD MOCK_PUT_DELAY_MS=200
timeout 120 bash "$K/launch.sh" "$T/jobD" "$M" --test-localhost --window-hours 0.002 >/dev/null 2>&1; curl -s -X POST -d '{"P500":1}' "127.0.0.1:$PD/__chaos" >/dev/null; waitdone jobD 60
grep -q "retry window exhausted" "$T/jobD/deliver_bg/FAILED" 2>/dev/null && [ "$(st $PD | jq_ 'd["customerCanPlayMp4"]')" = True ] && ok "D: window exhausted -> FAILED, MP4 still playable" || bad "D"
( umask 077; printf 'header = "Authorization: Bearer %s"\n' "$(cat $T/jobA/secrets/token)" > "$T/jobA/secrets/curl.cfg" )
code=$(curl -s -o /dev/null -w '%{http_code}' --config "$T/jobA/secrets/curl.cfg" -H 'content-type: application/json' -d '{"stage":"delivering"}' "$(cat $T/jobA/secrets/job_url)/progress"); rm -f "$T/jobA/secrets/curl.cfg"
[ "$code" = 409 ] && ok "E: progress after complete -> 409" || bad "E: got $code"
node "$K/deliver-editable.mjs" --job-dir "$T/jobA" >/dev/null; [ $? -eq 0 ] && ok "E: re-run after DONE is a no-op" || bad "E: rerun"
rm "$T/jobA/deliver_bg/DONE"; node -e 'const f=process.argv[1],s=require(f); delete s.completedAt; require("fs").writeFileSync(f, JSON.stringify(s))' "$T/jobA/deliver_bg/state.json"
node "$K/deliver-editable.mjs" --job-dir "$T/jobA" >/dev/null; [ -f "$T/jobA/deliver_bg/DONE" ] && ok "E: lost /complete response recovers (repeat complete is harmless)" || bad "E: lost complete"
node "$HERE/verify-repack.mjs" "$T/jobA/editable/live" "$SRC/preview/scenes" && ok "E: repacked scenes byte-identical" || bad "E: repack"
pkill -f "$HERE/mock-server.mjs"; echo "== $PASS passed, $FAIL failed"; [ $FAIL -eq 0 ]
