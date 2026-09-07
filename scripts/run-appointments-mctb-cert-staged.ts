/**
 * Crash-safe staged certification for Appointments + MCTB.
 *
 * Rules enforced:
 * - One command at a time (serial batches)
 * - Hard timeout per batch
 * - Checkpoint after every batch
 * - No dev server, browser, production build, PSTN, or destructive migrations
 *
 * Run:
 *   npx tsx scripts/run-appointments-mctb-cert-staged.ts
 *   npx tsx scripts/run-appointments-mctb-cert-staged.ts --from 5
 *   npx tsx scripts/run-appointments-mctb-cert-staged.ts --fresh --continue-on-fail
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const CHECKPOINT = join(ROOT, "docs/.generated/appointments-mctb-cert-checkpoint.json");
const RESULTS = join(ROOT, "docs/.generated/appointments-mctb-cert-results.json");

type Batch = {
  id: string;
  matrixIds: string[];
  command: string;
  timeoutMs: number;
  blocked?: string;
  serverOnly?: boolean;
};

const SERVER_ONLY_PREFIX =
  "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' ";

const BATCHES: Batch[] = [
  {
    id: "APT-CORE-01",
    matrixIds: ["APT-ENG-001", "APT-ENG-002", "APT-ENG-003", "APT-ENG-004", "APT-ENG-005", "APT-NAV-001"],
    command: "npm run test:appointments-v1",
    timeoutMs: 180_000,
  },
  {
    id: "APT-AI-01",
    matrixIds: ["AI-APT-001", "AI-APT-002", "AI-APT-003"],
    command: "npx tsx scripts/test-appointment-ai-hardening.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    id: "APT-AI-02",
    matrixIds: ["AI-APT-004"],
    command: "npx tsx scripts/test-appointment-booking-agent-layer.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    id: "APT-WF-01",
    matrixIds: ["APT-AUT-001", "APT-AUT-002"],
    command: "npx tsx scripts/test-appointment-workflows-hardening.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    id: "APT-WF-02",
    matrixIds: ["APT-AUT-003"],
    command: "npx tsx scripts/test-appointment-workflows-scheduling.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    id: "APT-WF-03",
    matrixIds: ["APT-AUT-004"],
    command: "npx tsx scripts/test-appointment-workflow-minutes.ts",
    timeoutMs: 120_000,
    serverOnly: true,
    blocked: "Requires TEST_PHONE E.164 — live workflow SMS (MANUAL)",
  },
  {
    id: "APT-VR-01",
    matrixIds: ["APT-AUT-005"],
    command: "npx tsx scripts/test-appointment-voice-reminders.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    id: "APT-PAY-01",
    matrixIds: ["APT-INT-001"],
    command: "npx tsx scripts/test-merchant-payments.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    id: "APT-MTG-01",
    matrixIds: ["AI-MTG-001", "AI-MTG-002"],
    command: "npx tsx scripts/test-voice-notetaker-wiring.ts",
    timeoutMs: 90_000,
  },
  {
    id: "APT-MTG-02",
    matrixIds: ["AI-MTG-003"],
    command: "npx tsx scripts/test-transovo-video-wiring.ts",
    timeoutMs: 90_000,
  },
  {
    id: "APT-PUB-01",
    matrixIds: ["APT-PUB-001"],
    command: "npx tsx scripts/test-book-idempotency.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    id: "MCTB-HO-01",
    matrixIds: ["MCTB-HO-001", "MCTB-HO-002", "MCTB-HO-003", "MCTB-HO-004"],
    command: "npx tsx scripts/test-mctb-handoff.ts",
    timeoutMs: 90_000,
  },
  {
    id: "MCTB-RT-01",
    matrixIds: ["MCTB-RT-001", "MCTB-RT-002"],
    command: "npx tsx scripts/test-mctb-final-pipeline-contract.ts",
    timeoutMs: 90_000,
  },
  {
    id: "MCTB-RT-02",
    matrixIds: ["MCTB-RT-003", "MCTB-RT-004"],
    command: "npx tsx scripts/test-mctb-consent-modes.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    id: "MCTB-RT-03",
    matrixIds: ["MCTB-RT-005"],
    command: "npx tsx scripts/test-mctb-schedule-pause.ts",
    timeoutMs: 90_000,
    serverOnly: true,
  },
  {
    id: "MCTB-RT-04",
    matrixIds: ["MCTB-RT-006"],
    command: "npx tsx scripts/test-mctb-consent-log.ts",
    timeoutMs: 90_000,
    serverOnly: true,
  },
  {
    id: "MCTB-RT-05",
    matrixIds: ["MCTB-RT-007"],
    command: "npx tsx scripts/test-missed-call-text-back-architecture.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    id: "AI-JOHN-01",
    matrixIds: ["AI-MCTB-001", "AI-MCTB-002", "AI-MCTB-003"],
    command: "npm run test:john-preprod",
    timeoutMs: 300_000,
    serverOnly: true,
  },
  {
    id: "AI-TRX-01",
    matrixIds: ["AI-VM-001", "AI-VM-002"],
    command: "npm run test:ai-transcription",
    timeoutMs: 120_000,
  },
  {
    id: "MCTB-VM-01",
    matrixIds: ["MCTB-VM-001"],
    command: "npx tsx scripts/test-mctb-voicemail-entitlements.ts",
    timeoutMs: 90_000,
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  let from = 0;
  let listOnly = false;
  let continueOnFail = false;
  let fresh = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) {
      from = Number(args[i + 1]);
      i++;
    }
    if (args[i] === "--list") listOnly = true;
    if (args[i] === "--continue-on-fail") continueOnFail = true;
    if (args[i] === "--fresh") fresh = true;
  }
  return { from, listOnly, continueOnFail, fresh };
}

function ensureDir() {
  const dir = join(ROOT, "docs/.generated");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadCheckpoint(): { lastCompletedIndex: number; results: Record<string, unknown> } {
  if (!existsSync(CHECKPOINT)) {
    return { lastCompletedIndex: -1, results: {} };
  }
  return JSON.parse(readFileSync(CHECKPOINT, "utf8"));
}

function runBatch(batch: Batch): { ok: boolean; exitCode: number | null; timedOut: boolean; durationMs: number } {
  const start = Date.now();
  const command = batch.serverOnly ? `${SERVER_ONLY_PREFIX}${batch.command}` : batch.command;
  const result = spawnSync(command, {
    shell: true,
    cwd: ROOT,
    encoding: "utf8",
    timeout: batch.timeoutMs,
  });
  const durationMs = Date.now() - start;
  const timedOut = result.error?.message?.includes("ETIMEDOUT") ?? false;
  const ok = result.status === 0 && !timedOut;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { ok, exitCode: result.status, timedOut, durationMs };
}

function main() {
  const { from, listOnly, continueOnFail, fresh } = parseArgs();
  ensureDir();

  if (listOnly) {
    for (const [i, b] of BATCHES.entries()) {
      console.log(`${i}\t${b.id}\t${b.command}\t${b.matrixIds.join(",")}`);
    }
    return;
  }

  if (fresh && existsSync(CHECKPOINT)) {
    writeFileSync(CHECKPOINT, JSON.stringify({ lastCompletedIndex: -1 }, null, 2));
  }

  const checkpoint = loadCheckpoint();
  const startIndex = fresh ? from : Math.max(from, checkpoint.lastCompletedIndex + 1);
  const allResults: Array<Record<string, unknown>> = [];

  console.log(`Starting staged cert from batch index ${startIndex} (${BATCHES.length} total)`);
  if (continueOnFail) console.log("Mode: continue-on-fail (all batches will run)");

  let failCount = 0;

  for (let i = startIndex; i < BATCHES.length; i++) {
    const batch = BATCHES[i];
    console.log(`\n=== Batch ${i + 1}/${BATCHES.length}: ${batch.id} ===`);
    console.log(`Command: ${batch.command}`);
    console.log(`Matrix IDs: ${batch.matrixIds.join(", ")}`);

    if (batch.blocked) {
      const skipped = {
        batchId: batch.id,
        index: i,
        status: "BLOCKED",
        reason: batch.blocked,
        finishedAt: new Date().toISOString(),
      };
      allResults.push(skipped);
      writeFileSync(CHECKPOINT, JSON.stringify({ lastCompletedIndex: i, results: skipped }, null, 2));
      console.log(`BLOCKED: ${batch.blocked}`);
      continue;
    }

    const outcome = runBatch(batch);
    const record = {
      batchId: batch.id,
      index: i,
      command: batch.command,
      matrixIds: batch.matrixIds,
      status: outcome.ok ? "PASS" : "FAIL",
      exitCode: outcome.exitCode,
      timedOut: outcome.timedOut,
      durationMs: outcome.durationMs,
      finishedAt: new Date().toISOString(),
    };
    allResults.push(record);
    writeFileSync(CHECKPOINT, JSON.stringify({ lastCompletedIndex: i, latest: record }, null, 2));
    writeFileSync(RESULTS, JSON.stringify({ batches: allResults, updatedAt: new Date().toISOString() }, null, 2));

    if (!outcome.ok) {
      failCount++;
      if (!continueOnFail) {
        console.error(`\nBatch ${batch.id} FAILED — stopping staged run (fix and resume with --from ${i})`);
        process.exit(1);
      }
      console.error(`\nBatch ${batch.id} FAILED (${outcome.durationMs}ms) — continuing`);
      continue;
    }
    console.log(`Batch ${batch.id} PASS (${outcome.durationMs}ms)`);
  }

  const passCount = allResults.filter((r) => r.status === "PASS").length;
  const blockedCount = allResults.filter((r) => r.status === "BLOCKED").length;

  console.log("\n========================================");
  console.log("STAGED CERT SUMMARY");
  console.log("========================================");
  for (const r of allResults) {
    const id = r.batchId as string;
    const status = r.status as string;
    const ms = r.durationMs != null ? ` (${r.durationMs}ms)` : "";
    const reason = r.reason ? ` — ${r.reason}` : "";
    console.log(`${status.padEnd(7)} ${id}${ms}${reason}`);
  }
  console.log("----------------------------------------");
  console.log(`PASS: ${passCount}  FAIL: ${failCount}  BLOCKED: ${blockedCount}  TOTAL: ${allResults.length}`);

  const finalStatus = failCount === 0 ? "COMPLETE" : "COMPLETE_WITH_FAILURES";
  writeFileSync(
    RESULTS,
    JSON.stringify(
      {
        batches: allResults,
        status: finalStatus,
        passCount,
        failCount,
        blockedCount,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  if (failCount > 0) {
    console.log("\nCompleted with failures.");
    process.exit(1);
  }
  console.log("\nAll staged batches completed.");
}

main();
