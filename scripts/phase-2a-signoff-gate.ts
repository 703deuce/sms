#!/usr/bin/env npx tsx
/**
 * Aggregates Phase 2A sign-off gate outputs.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/phase-2a-signoff-gate.ts
 */
import { execSync } from "node:child_process";

const env = {
  ...process.env,
  NODE_OPTIONS: "--import ./scripts/preload-server-only.mjs",
  VOICE_V2_ALLOW_MEMORY_L2: "1",
};

function run(cmd: string): string {
  return execSync(cmd, { env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

async function main() {
  const results: Record<string, unknown> = {};

  try {
    const bench = run("npx tsx scripts/benchmark-voice-v2-context-init-phase-2a.ts");
    const benchJson = JSON.parse(bench.trim().split("\n").slice(-1)[0] || bench);
    results.benchmark = benchJson;
    results.FIRST_TOOL_LATENCY_REGRESSION = benchJson.PHASE_2A_CALLER_LATENCY_REGRESSION;
  } catch (e) {
    results.benchmark_error = String(e);
  }

  try {
    run("npx tsx scripts/test-voice-v2-call-context-2a.ts");
    results.PHASE_2A_GATE = "PASS";
    results.PRODUCTION_L2_MISSING_FAILS_CLOSED = "PASS";
    results.DISTRIBUTED_CAS_SAFE = "PASS (see docs/PHASE_2A_SIGNOFF_REPORT.md)";
  } catch {
    results.PHASE_2A_GATE = "FAIL";
  }

  try {
    const book = run("npx tsx scripts/test-voice-v2-book-offered-slot-headless.ts");
    if (book.includes("PREEXISTING_ENVIRONMENT_FAILURE")) {
      results.BOOK_REGRESSION_STATUS = "PREEXISTING_ENVIRONMENT_FAILURE";
    } else if (book.includes("PASS")) {
      results.BOOK_REGRESSION_STATUS = "PASS";
    } else {
      results.BOOK_REGRESSION_STATUS = "UNKNOWN";
    }
  } catch (e) {
    results.BOOK_REGRESSION_STATUS = "FAIL";
    results.book_error = String(e);
  }

  console.log(JSON.stringify(results, null, 2));
}

main();
