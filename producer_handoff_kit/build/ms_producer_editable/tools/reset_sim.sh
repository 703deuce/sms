#!/bin/bash
# reset the simulated Transovo store and re-import fixtures (test state only)
set -e; cd "$(dirname "$0")/.."
pkill -f "sim/transovo-sim.mjs" || true; sleep 0.5; rm -rf out/sim/store out/workerA out/workerB
mkdir -p out/sim; nohup node sim/transovo-sim.mjs --root "$PWD/out/sim/store" --port 8787 > out/sim/server.out 2>&1 &
sleep 1; node tools/publish_fonts.mjs | tail -1
for f in fixtures/*/import.mjs; do node "$f" | tail -1; done
