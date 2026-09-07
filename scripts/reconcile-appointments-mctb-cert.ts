#!/usr/bin/env tsx
/**
 * Targeted certification reconciliation — rerun specific batches and merge into state.
 * Does NOT run the full 31-batch pipeline.
 *
 * Usage:
 *   npx tsx scripts/reconcile-appointments-mctb-cert.ts --batch APT-AI-01 --batch MCTB-TFV-01
 *   npx tsx scripts/reconcile-appointments-mctb-cert.ts --all-failed
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const STATE_FILE = join(ROOT, "docs/certification/appointments-mctb-certification-state.json");
const RESULTS_MD = join(ROOT, "docs/certification/APPOINTMENTS_MCTB_CERTIFICATION_RESULTS.md");
const SERVER_ONLY_PREFIX = "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' ";

type Batch = {
  id: string;
  command: string;
  matrixIds: string[];
  serverOnly?: boolean;
  blocked?: string;
  blockedStatus?: string;
  phase?: string;
};

// Keep in sync with run-appointments-mctb-cert-staged.ts targeted batches
const TARGET_BATCHES: Batch[] = [
  { id: "APT-AI-01", matrixIds: ["AP-AI-BOOKING-*", "AP-OWNER-AMY-*", "AP-WRITE-VERIFIER-*"], command: "npx tsx scripts/test-appointment-ai-hardening.ts", serverOnly: true, phase: "4-appointments-api" },
  { id: "APT-AI-02", matrixIds: ["AP-BOOKING-AGENT-*"], command: "npx tsx scripts/test-appointment-booking-agent-layer.ts", serverOnly: true, phase: "4-appointments-api" },
  { id: "APT-XPROD-01", matrixIds: ["X-PRODUCT-*"], command: "npx tsx scripts/test-mctb-cross-product-booking.ts", phase: "4-appointments-api" },
  { id: "APT-WF-03", matrixIds: ["AP-WORKFLOWS-minutes"], command: "npx tsx scripts/test-appointment-workflow-minutes-scheduling.ts", serverOnly: true, phase: "4-appointments-api" },
  { id: "MCTB-TFV-01", matrixIds: ["MCTB-RT-007"], command: "npx tsx scripts/test-mctb-tfv-gates.ts", serverOnly: true, phase: "5-mctb-unit" },
  { id: "MCTB-RT-06", matrixIds: ["MCTB-RT-engine"], command: "npx tsx scripts/test-mctb-engine-matrix.ts", serverOnly: true, phase: "6-mctb-api" },
  { id: "AI-JOHN-01", matrixIds: ["AI-MCTB-001", "AI-MCTB-002", "AI-MCTB-003"], command: "npm run test:john-preprod", serverOnly: true, phase: "7-cross-ai" },
  { id: "AI-VM-01", matrixIds: ["AI-VM-001", "AI-VM-002"], command: "npx tsx scripts/test-mctb-voicemail-ai-hermetic.ts", phase: "7-cross-ai" },
  { id: "AI-TRX-01", matrixIds: ["AI-TRANSCRIPTION-CATALOG"], command: "npm run test:ai-transcription", phase: "7-cross-ai" },
  { id: "MCTB-LINKS-01", matrixIds: ["MCTB-DEFECT-SETUP-LINKS"], command: "npx tsx scripts/test-mctb-setup-links.ts", phase: "6-mctb-api" },
];

const ORIGINAL_FAILURES: Record<string, { batchId: string; originalStatus: string; note?: string }> = {
  "AP-AI-BOOKING-*": { batchId: "APT-AI-01", originalStatus: "FAIL", note: "OUT_OF_SCOPE vs BOOK fallback — fixed in understand-fallback.ts" },
  "AP-OWNER-AMY-*": { batchId: "APT-AI-01", originalStatus: "FAIL", note: "Owner Amy default model assertion — fixed for OpenAI gpt-5-nano" },
  "AP-WRITE-VERIFIER-*": { batchId: "APT-AI-01", originalStatus: "FAIL", note: "Same batch as booking hardening" },
  "X-PRODUCT-*": { batchId: "APT-AI-02", originalStatus: "FAIL", note: "Was incorrectly bundled with booking agent layer test" },
  "AP-WORKFLOWS-minutes": { batchId: "APT-WF-03", originalStatus: "BLOCKED — PSTN", note: "Reclassified — local scheduling now APT-WF-03; live SMS is APT-WF-03-live" },
  "MCTB-RT-007": { batchId: "MCTB-TFV-01", originalStatus: "FAIL", note: "isPlatformDemoNumber stub returned false" },
  "MCTB-RT-engine": { batchId: "MCTB-RT-06", originalStatus: "FAIL", note: "SIP ingress assertions obsolete — updated for TeXML-first pipeline" },
  "AI-MCTB-001": { batchId: "AI-JOHN-01", originalStatus: "FAIL", note: "See per-gate john-preprod results" },
  "AI-MCTB-002": { batchId: "AI-JOHN-01", originalStatus: "FAIL", note: "See per-gate john-preprod results" },
  "AI-MCTB-003": { batchId: "AI-JOHN-01", originalStatus: "FAIL", note: "See per-gate john-preprod results" },
  "AI-VM-001": { batchId: "AI-TRX-01", originalStatus: "FAIL", note: "Was mapped to wrong script — now AI-VM-01 hermetic" },
  "AI-VM-002": { batchId: "AI-TRX-01", originalStatus: "FAIL", note: "Was mapped to wrong script — now AI-VM-01 hermetic" },
  "MCTB-DEFECT-SETUP-LINKS": { batchId: "DEFECT-01", originalStatus: "DEFECT — MISSING UI", note: "Implemented /mctb/setup/links" },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const batchIds: string[] = [];
  let allFailed = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--batch" && args[i + 1]) {
      batchIds.push(args[++i]);
    }
    if (args[i] === "--all-failed") allFailed = true;
  }
  if (allFailed) return TARGET_BATCHES.map((b) => b.id);
  return batchIds.length ? batchIds : TARGET_BATCHES.map((b) => b.id);
}

function runBatch(batch: Batch) {
  const start = Date.now();
  const command = batch.serverOnly ? `${SERVER_ONLY_PREFIX}${batch.command}` : batch.command;
  const result = spawnSync(command, { shell: true, cwd: ROOT, encoding: "utf8", timeout: batch.id === "AI-JOHN-01" ? 240_000 : 300_000, env: { ...process.env, CI: "1" } });
  const durationMs = Date.now() - start;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { ok: result.status === 0, exitCode: result.status, durationMs };
}

function main() {
  const ids = parseArgs();
  const state = existsSync(STATE_FILE)
    ? JSON.parse(readFileSync(STATE_FILE, "utf8"))
    : { batches: [], caseResults: {}, reconciliation: [] };

  state.reconciliation = state.reconciliation || [];

  for (const id of ids) {
    const batch = TARGET_BATCHES.find((b) => b.id === id);
    if (!batch) {
      console.error(`Unknown batch: ${id}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`\n=== RECONCILE ${batch.id} ===`);
    const { ok, exitCode, durationMs } = runBatch(batch);
    const status = ok ? "PASS" : "FAIL";
    const finishedAt = new Date().toISOString();

    const entry = {
      batchId: batch.id,
      status,
      exitCode,
      durationMs,
      finishedAt,
      command: batch.command,
    };

    const idx = state.batches.findIndex((b: { batchId: string }) => b.batchId === batch.id);
    if (idx >= 0) state.batches[idx] = { ...state.batches[idx], ...entry };
    else state.batches.push({ phase: batch.phase, matrixIds: batch.matrixIds, ...entry });

    for (const matrixId of batch.matrixIds) {
      const prior = ORIGINAL_FAILURES[matrixId];
      state.caseResults[matrixId] = {
        status,
        batchId: batch.id,
        at: finishedAt,
        reconciliation: {
          originalStatus: prior?.originalStatus || "UNKNOWN",
          originalBatchId: prior?.batchId || batch.id,
          fixNote: prior?.note || null,
          retestCommand: batch.command,
          currentStatus: status,
          reconciledAt: finishedAt,
        },
      };
      state.reconciliation.push({
        matrixId,
        ...state.caseResults[matrixId].reconciliation,
      });
    }

    console.log(`${batch.id}: ${status} (${durationMs}ms)`);
    if (!ok) process.exitCode = 1;
  }

  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`\nUpdated ${STATE_FILE}`);
}

main();
