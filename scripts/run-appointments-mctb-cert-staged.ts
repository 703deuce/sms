/**
 * Crash-safe staged certification pipeline for Appointments + MCTB.
 *
 * Authority: docs/APPOINTMENTS-MCTB-FULL-FEATURE-SETTINGS-INVENTORY.md
 * Matrix: docs/certification/APPOINTMENTS-MCTB-CERTIFICATION-MATRIX.md
 *
 * Rules:
 * - One command at a time, worker count 1, hard timeouts
 * - No dev server, browser, production build, PSTN, db:push
 * - Checkpoint after every batch
 * - Resume from docs/certification/appointments-mctb-certification-state.json
 *
 * Run:
 *   npm run cert:appointments-mctb-staged
 *   npm run cert:appointments-mctb-staged -- --from 5 --continue-on-fail
 *   npm run cert:appointments-mctb-staged -- --fresh
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const CERT_DIR = join(ROOT, "docs/certification");
const STATE_FILE = join(CERT_DIR, "appointments-mctb-certification-state.json");
const RESULTS_MD = join(CERT_DIR, "APPOINTMENTS_MCTB_CERTIFICATION_RESULTS.md");
const MATRIX_JSON = join(CERT_DIR, "appointments-mctb-certification-matrix.json");

const SERVER_ONLY_PREFIX =
  "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' ";

type CertResultStatus =
  | "PASS"
  | "FAIL"
  | "BLOCKED — PSTN"
  | "BLOCKED — LIVE EXTERNAL PROVIDER"
  | "BLOCKED — ENVIRONMENT"
  | "DEFECT — MISSING UI"
  | "DEFECT — MISSING RUNTIME"
  | "TIMEOUT"
  | "SKIPPED";

type Batch = {
  phase: string;
  id: string;
  matrixIds: string[];
  command: string;
  timeoutMs: number;
  blocked?: string;
  blockedStatus?: CertResultStatus;
  serverOnly?: boolean;
  staticOnly?: boolean;
};

const BATCHES: Batch[] = [
  // Phase 1 — Static audit
  {
    phase: "1-static",
    id: "STATIC-01",
    matrixIds: ["MATRIX-GEN"],
    command: "npx tsx scripts/generate-appointments-mctb-cert-matrix.ts",
    timeoutMs: 120_000,
    staticOnly: true,
  },
  {
    phase: "1-static",
    id: "STATIC-02",
    matrixIds: ["SETTINGS-PROOF"],
    command: "npx tsx scripts/generate-settings-coverage-proof.ts",
    timeoutMs: 60_000,
    staticOnly: true,
  },
  {
    phase: "1-static",
    id: "STATIC-03",
    matrixIds: ["ROUTE-CLASS"],
    command: "npx tsx scripts/generate-route-api-classification.ts",
    timeoutMs: 60_000,
    staticOnly: true,
  },
  {
    phase: "1-static",
    id: "STATIC-04",
    matrixIds: ["ROUTE-INVENTORY"],
    command: "npx tsx scripts/generate-appointments-mctb-inventory.ts",
    timeoutMs: 60_000,
    staticOnly: true,
  },
  // Phase 2 — Type check
  {
    phase: "2-typecheck",
    id: "TSC-01",
    matrixIds: ["TYPECHECK"],
    command: "npx tsc --noEmit",
    timeoutMs: 120_000,
    staticOnly: true,
  },
  // Phase 3 — Appointments unit/domain
  {
    phase: "3-appointments-unit",
    id: "APT-ENG-01",
    matrixIds: ["APT-ENG-001", "APT-ENG-002", "APT-ENG-003"],
    command: "npx tsx scripts/test-availability-engine.ts && npx tsx scripts/test-booking-protection.ts && npx tsx scripts/test-appointments-reminder-state.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "3-appointments-unit",
    id: "APT-ENG-02",
    matrixIds: ["APT-ENG-004", "APT-ENG-005", "APT-NAV-001"],
    command: "npx tsx scripts/test-appointments-double-booking.ts && npx tsx scripts/test-appointments-tenant-isolation.ts && npx tsx scripts/test-appointments-nav.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  // Phase 4 — Appointments API/service
  {
    phase: "4-appointments-api",
    id: "APT-AI-01",
    matrixIds: ["AP-AI-BOOKING-*", "AP-OWNER-AMY-*", "AP-WRITE-VERIFIER-*"],
    command: "npx tsx scripts/test-appointment-ai-hardening.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "4-appointments-api",
    id: "APT-AI-02",
    matrixIds: ["AP-BOOKING-AGENT-*"],
    command: "npx tsx scripts/test-appointment-booking-agent-layer.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "4-appointments-api",
    id: "APT-XPROD-01",
    matrixIds: ["X-PRODUCT-*"],
    command: "npx tsx scripts/test-mctb-cross-product-booking.ts",
    timeoutMs: 90_000,
  },
  {
    phase: "4-appointments-api",
    id: "APT-WF-01",
    matrixIds: ["AP-WORKFLOWS-*"],
    command: "npx tsx scripts/test-appointment-workflows-hardening.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "4-appointments-api",
    id: "APT-WF-02",
    matrixIds: ["AP-WORKFLOWS-scheduling"],
    command: "npx tsx scripts/test-appointment-workflows-scheduling.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "4-appointments-api",
    id: "APT-WF-03",
    matrixIds: ["AP-WORKFLOWS-minutes"],
    command: "npx tsx scripts/test-appointment-workflow-minutes-scheduling.ts",
    timeoutMs: 90_000,
    serverOnly: true,
  },
  {
    phase: "4-appointments-api",
    id: "APT-WF-03-live",
    matrixIds: ["AP-WORKFLOWS-minutes-live"],
    command: "npx tsx scripts/test-appointment-workflow-minutes.ts",
    timeoutMs: 120_000,
    serverOnly: true,
    blocked:
      "Live SMS delivery only — requires TEST_PHONE E.164 (scheduling certified locally in APT-WF-03)",
    blockedStatus: "BLOCKED — PSTN",
  },
  {
    phase: "4-appointments-api",
    id: "APT-VR-01",
    matrixIds: ["AP-VOICE-REMINDERS-*"],
    command: "npx tsx scripts/test-appointment-voice-reminders.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "4-appointments-api",
    id: "APT-PAY-01",
    matrixIds: ["APT-INT-001"],
    command: "npx tsx scripts/test-merchant-payments.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "4-appointments-api",
    id: "APT-PUB-01",
    matrixIds: ["APT-PUB-001"],
    command: "npx tsx scripts/test-book-idempotency.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "4-appointments-api",
    id: "APT-MTG-01",
    matrixIds: ["AP-NOTETAKER-*"],
    command: "npx tsx scripts/test-voice-notetaker-wiring.ts",
    timeoutMs: 90_000,
  },
  {
    phase: "4-appointments-api",
    id: "APT-MTG-02",
    matrixIds: ["AP-NATIVE-VIDEO-*"],
    command: "npx tsx scripts/test-transovo-video-wiring.ts",
    timeoutMs: 90_000,
  },
  // Phase 5 — MCTB unit/domain
  {
    phase: "5-mctb-unit",
    id: "MCTB-FILTER-01",
    matrixIds: ["MCTB-OP-010"],
    command: "npx tsx scripts/test-mctb-missed-calls-filters.ts",
    timeoutMs: 90_000,
    serverOnly: true,
  },
  {
    phase: "5-mctb-unit",
    id: "MCTB-INBOX-01",
    matrixIds: ["MCTB-OP-020"],
    command: "npx tsx scripts/test-mctb-inbox-product-filter.ts",
    timeoutMs: 90_000,
    serverOnly: true,
  },
  {
    phase: "5-mctb-unit",
    id: "MCTB-VM-01",
    matrixIds: ["MCTB-VM-001"],
    command: "npx tsx scripts/test-mctb-voicemail-entitlements.ts",
    timeoutMs: 90_000,
  },
  {
    phase: "5-mctb-unit",
    id: "MCTB-TFV-01",
    matrixIds: ["MCTB-RT-007"],
    command: "npx tsx scripts/test-mctb-tfv-gates.ts",
    timeoutMs: 90_000,
    serverOnly: true,
  },
  // Phase 6 — MCTB API/service
  {
    phase: "6-mctb-api",
    id: "MCTB-HO-01",
    matrixIds: ["MCTB-HO-MODE-*", "MCTB-HO-FIELD-*"],
    command: "npx tsx scripts/test-mctb-handoff.ts",
    timeoutMs: 90_000,
  },
  {
    phase: "6-mctb-api",
    id: "MCTB-RT-01",
    matrixIds: ["MCTB-RT-001", "MCTB-RT-002"],
    command: "npx tsx scripts/test-mctb-final-pipeline-contract.ts",
    timeoutMs: 90_000,
  },
  {
    phase: "6-mctb-api",
    id: "MCTB-RT-02",
    matrixIds: ["MCTB-SET-003"],
    command: "npx tsx scripts/test-mctb-consent-modes.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "6-mctb-api",
    id: "MCTB-RT-03",
    matrixIds: ["MCTB-LEGACY-SCHED-001", "MCTB-SET-005"],
    command: "npx tsx scripts/test-mctb-schedule-pause.ts",
    timeoutMs: 90_000,
    serverOnly: true,
  },
  {
    phase: "6-mctb-api",
    id: "MCTB-RT-04",
    matrixIds: ["MCTB-RT-006"],
    command: "npx tsx scripts/test-mctb-consent-log.ts",
    timeoutMs: 90_000,
    serverOnly: true,
  },
  {
    phase: "6-mctb-api",
    id: "MCTB-RT-05",
    matrixIds: ["MCTB-RT-003"],
    command: "npx tsx scripts/test-missed-call-text-back-architecture.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  {
    phase: "6-mctb-api",
    id: "MCTB-RT-06",
    matrixIds: ["MCTB-RT-engine"],
    command: "npx tsx scripts/test-mctb-engine-matrix.ts",
    timeoutMs: 120_000,
    serverOnly: true,
  },
  // Phase 7 — Cross-product + AI
  {
    phase: "7-cross-ai",
    id: "AI-JOHN-01",
    matrixIds: ["AI-MCTB-001", "AI-MCTB-002", "AI-MCTB-003"],
    command: "npm run test:john-preprod",
    timeoutMs: 300_000,
    serverOnly: true,
  },
  {
    phase: "7-cross-ai",
    id: "AI-VM-01",
    matrixIds: ["AI-VM-001", "AI-VM-002"],
    command: "npx tsx scripts/test-mctb-voicemail-ai-hermetic.ts",
    timeoutMs: 90_000,
  },
  {
    phase: "7-cross-ai",
    id: "AI-TRX-01",
    matrixIds: ["AI-TRANSCRIPTION-CATALOG"],
    command: "npm run test:ai-transcription",
    timeoutMs: 120_000,
  },
  {
    phase: "6-mctb-api",
    id: "MCTB-LINKS-01",
    matrixIds: ["MCTB-DEFECT-SETUP-LINKS"],
    command: "npx tsx scripts/test-mctb-setup-links.ts",
    timeoutMs: 90_000,
  },
];

type State = {
  lastCompletedIndex: number;
  batches: Array<Record<string, unknown>>;
  caseResults: Record<string, { status: CertResultStatus; batchId: string; at: string; reason?: string }>;
  updatedAt: string;
};

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

function ensureCertDir() {
  if (!existsSync(CERT_DIR)) mkdirSync(CERT_DIR, { recursive: true });
}

function loadState(): State {
  if (!existsSync(STATE_FILE)) {
    return { lastCompletedIndex: -1, batches: [], caseResults: {}, updatedAt: new Date().toISOString() };
  }
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
}

function saveState(state: State) {
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function runBatch(batch: Batch): { ok: boolean; exitCode: number | null; timedOut: boolean; durationMs: number } {
  const start = Date.now();
  const command =
    batch.serverOnly && !batch.staticOnly ? `${SERVER_ONLY_PREFIX}${batch.command}` : batch.command;
  const result = spawnSync(command, {
    shell: true,
    cwd: ROOT,
    encoding: "utf8",
    timeout: batch.timeoutMs,
    env: { ...process.env, CI: "1" },
  });
  const durationMs = Date.now() - start;
  const timedOut = result.error?.message?.includes("ETIMEDOUT") ?? false;
  const ok = result.status === 0 && !timedOut;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { ok, exitCode: result.status, timedOut, durationMs };
}

function updateCaseResults(
  state: State,
  batch: Batch,
  status: CertResultStatus,
  reason?: string,
) {
  const at = new Date().toISOString();
  for (const id of batch.matrixIds) {
    state.caseResults[id] = { status, batchId: batch.id, at, reason };
  }
}

function writeResultsMd(state: State, summary: { pass: number; fail: number; blocked: number; timeout: number }) {
  const lines = [
    `# Appointments + MCTB Certification Results`,
    ``,
    `**Updated:** ${state.updatedAt}`,
    `**Authority:** docs/APPOINTMENTS-MCTB-FULL-FEATURE-SETTINGS-INVENTORY.md`,
    ``,
    `## Summary`,
    ``,
    `| Status | Count |`,
    `|--------|-------|`,
    `| PASS | ${summary.pass} |`,
    `| FAIL | ${summary.fail} |`,
    `| BLOCKED | ${summary.blocked} |`,
    `| TIMEOUT | ${summary.timeout} |`,
    ``,
    `## Batches`,
    ``,
    `| Batch | Phase | Status | Duration | Command |`,
    `|-------|-------|--------|----------|---------|`,
  ];

  for (const b of state.batches) {
    lines.push(
      `| ${b.batchId} | ${b.phase} | ${b.status} | ${b.durationMs ?? "—"}ms | \`${String(b.command).slice(0, 60)}\` |`,
    );
  }

  lines.push(``, `## Known defects`, ``);
  const openDefects = Object.entries(state.caseResults).filter(
    ([, v]) => v.status.startsWith("DEFECT") || v.status === "FAIL",
  );
  if (openDefects.length === 0) {
    lines.push(`_No open certification defects._`);
  } else {
    for (const [id, v] of openDefects) {
      lines.push(`- **${id}:** ${v.reason || v.status}`);
    }
  }
  lines.push(`- **MCTB-LEGACY-SCHED-001:** Legacy business-hours fields — backward compat only; Business Hours UI must not return`);

  if (existsSync(MATRIX_JSON)) {
    const matrix = JSON.parse(readFileSync(MATRIX_JSON, "utf8")) as { totalCases: number };
    lines.push(``, `## Matrix coverage`, ``);
    lines.push(`Total matrix cases: **${matrix.totalCases}**`);
    lines.push(`Cases with batch mapping: **${Object.keys(state.caseResults).length}**`);
    lines.push(`UI-deferred cases require separate browser pass.`);
  }

  writeFileSync(RESULTS_MD, lines.join("\n"));
}

function summarize(state: State) {
  const statuses = Object.values(state.caseResults).map((r) => r.status);
  return {
    pass: statuses.filter((s) => s === "PASS").length,
    fail: statuses.filter((s) => s === "FAIL").length,
    blocked: statuses.filter((s) => s.startsWith("BLOCKED")).length,
    timeout: statuses.filter((s) => s === "TIMEOUT").length,
  };
}

function main() {
  const { from, listOnly, continueOnFail, fresh } = parseArgs();
  ensureCertDir();

  if (listOnly) {
    for (const [i, b] of BATCHES.entries()) {
      console.log(`${i}\t${b.phase}\t${b.id}\t${b.command}\t${b.matrixIds.join(",")}`);
    }
    return;
  }

  let state = loadState();
  if (fresh) {
    state = { lastCompletedIndex: -1, batches: [], caseResults: {}, updatedAt: new Date().toISOString() };
    saveState(state);
  }

  const startIndex = fresh ? from : Math.max(from, state.lastCompletedIndex + 1);
  let failCount = 0;

  console.log(`Cert pipeline: batch ${startIndex + 1}/${BATCHES.length} (authority = 2026-09-07 inventory)`);
  if (continueOnFail) console.log("Mode: continue-on-fail");

  for (let i = startIndex; i < BATCHES.length; i++) {
    const batch = BATCHES[i];
    console.log(`\n=== [${batch.phase}] ${i + 1}/${BATCHES.length}: ${batch.id} ===`);
    console.log(`Command: ${batch.command}`);

    if (batch.blocked) {
      const status = batch.blockedStatus ?? "BLOCKED — ENVIRONMENT";
      const record = {
        batchId: batch.id,
        phase: batch.phase,
        index: i,
        command: batch.command,
        status,
        reason: batch.blocked,
        finishedAt: new Date().toISOString(),
      };
      state.batches.push(record);
      updateCaseResults(state, batch, status, batch.blocked);
      state.lastCompletedIndex = i;
      saveState(state);
      writeResultsMd(state, summarize(state));
      console.log(`${status}: ${batch.blocked}`);
      if (status === "FAIL") failCount++;
      if (status.startsWith("DEFECT")) failCount++;
      continue;
    }

    const outcome = runBatch(batch);
    const status: CertResultStatus = outcome.timedOut
      ? "TIMEOUT"
      : outcome.ok
        ? "PASS"
        : "FAIL";

    const record = {
      batchId: batch.id,
      phase: batch.phase,
      index: i,
      command: batch.command,
      matrixIds: batch.matrixIds,
      status,
      exitCode: outcome.exitCode,
      timedOut: outcome.timedOut,
      durationMs: outcome.durationMs,
      finishedAt: new Date().toISOString(),
    };
    state.batches.push(record);
    updateCaseResults(state, batch, status);
    state.lastCompletedIndex = i;
    saveState(state);
    writeResultsMd(state, summarize(state));

    if (!outcome.ok) {
      failCount++;
      if (!continueOnFail) {
        console.error(`\nBatch ${batch.id} ${status} — stopping (resume: --from ${i} --continue-on-fail)`);
        process.exit(1);
      }
      console.error(`Batch ${batch.id} ${status} — continuing`);
    } else {
      console.log(`Batch ${batch.id} PASS (${outcome.durationMs}ms)`);
    }
  }

  const summary = summarize(state);
  console.log("\n========================================");
  console.log("CERTIFICATION PIPELINE SUMMARY");
  console.log("========================================");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}  BLOCKED: ${summary.blocked}  TIMEOUT: ${summary.timeout}`);
  console.log(`Results: ${RESULTS_MD}`);
  console.log(`State: ${STATE_FILE}`);

  if (failCount > 0) {
    console.log("\nCompleted with failures — product NOT fully certified.");
    process.exit(1);
  }
  console.log("\nAutomated pipeline batches complete. UI-deferred + PSTN cases remain.");
}

main();
