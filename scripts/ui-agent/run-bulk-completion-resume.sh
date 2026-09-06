#!/usr/bin/env bash
set -euo pipefail
cd /workspace
LOG=".ui-agent/mode4/bulk-completion-$(date -u +%Y%m%dT%H%M%SZ).log"
REMAINING=$(node -e "const s=require('./.ui-agent/mode4/batch-state.json'); console.log(s.jobs.filter(j=>j.stage==='bulk'&&!j.reworkReason?.startsWith('completion pass')).length)")
echo "=== Bulk completion resume: ${REMAINING} remaining | concurrency=15 pool $(date -u) ===" | tee "$LOG"
npm run ui:kimi-mode4-completion -- --bulk-batch --concurrency 15 --stagger-ms 500 2>&1 | tee -a "$LOG"
