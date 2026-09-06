#!/usr/bin/env bash
set -euo pipefail
cd /workspace

LOG=".ui-agent/mode4/bulk-completion-pairs-$(date -u +%Y%m%dT%H%M%SZ).log"
CONCURRENCY=2
PAUSE_SEC=30

mapfile -t IDS < <(node -e "
const s=require('./.ui-agent/mode4/batch-state.json');
s.jobs
  .filter(j=>j.stage==='bulk'&&!j.reworkReason?.startsWith('completion pass'))
  .map(j=>j.id)
  .forEach(id=>console.log(id));
")

if [ "${#IDS[@]}" -eq 0 ]; then
  echo "No bulk surfaces need completion." | tee "$LOG"
  exit 0
fi

echo "=== Bulk completion pairs: ${#IDS[@]} remaining | 2 at a time, ${PAUSE_SEC}s between pairs $(date -u) ===" | tee "$LOG"

i=0
pair=1
while [ "$i" -lt "${#IDS[@]}" ]; do
  batch=()
  for j in 0 1; do
    if [ "$((i+j))" -lt "${#IDS[@]}" ]; then
      batch+=("${IDS[$((i+j))]}")
    fi
  done

  echo "" | tee -a "$LOG"
  echo ">>> PAIR ${pair}: ${batch[*]} $(date -u)" | tee -a "$LOG"

  pids=()
  for id in "${batch[@]}"; do
    (
      echo "  START $id $(date -u)" | tee -a "$LOG"
      npm run ui:kimi-mode4-completion -- --only "$id" 2>&1 | tee -a "$LOG"
      echo "  END $id exit=$? $(date -u)" | tee -a "$LOG"
    ) &
    pids+=($!)
  done

  for pid in "${pids[@]}"; do
    wait "$pid" || true
  done

  i=$((i + ${#batch[@]}))
  pair=$((pair + 1))

  if [ "$i" -lt "${#IDS[@]}" ]; then
    echo ">>> cooldown ${PAUSE_SEC}s before next pair…" | tee -a "$LOG"
    sleep "$PAUSE_SEC"
  fi
done

echo "" | tee -a "$LOG"
echo "=== PAIRS BATCH DONE $(date -u) ===" | tee -a "$LOG"
node -e "
const s=require('./.ui-agent/mode4/batch-state.json');
const bulk=s.jobs.filter(j=>j.stage==='bulk');
const done=bulk.filter(j=>j.reworkReason?.startsWith('completion pass'));
console.log('bulk completion:', done.length+'/'+bulk.length);
const remain=bulk.filter(j=>!j.reworkReason?.startsWith('completion pass'));
if(remain.length) { console.log('remaining:', remain.map(j=>j.id).join(', ')); }
" | tee -a "$LOG"
