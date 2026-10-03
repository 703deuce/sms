#!/usr/bin/env npx tsx
/**
 * processMissedInboundCall must pass merged recovery usage metadata into eligibility.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const processSrc = readFileSync(
  path.join(process.cwd(), "src/lib/agents/missed-call-text-back/process.ts"),
  "utf8",
);

assert.ok(
  processSrc.includes("const eligibilityMetadata = {"),
  "process must build eligibilityMetadata from usageMetadata + input.eventMetadata",
);
assert.ok(
  processSrc.includes("eventMetadata: eligibilityMetadata"),
  "eligibility evaluate must receive merged metadata (liveTest / excludeFromRecoveryUsage)",
);

const setupTestSrc = readFileSync(
  path.join(process.cwd(), "src/lib/mctb/setup-test.ts"),
  "utf8",
);
assert.ok(
  setupTestSrc.includes("detectedAt: { gte: since }"),
  "setup test status must query missed calls by detectedAt (runtime truth)",
);

const liveTestAuthSrc = readFileSync(
  path.join(process.cwd(), "src/lib/mctb/onboarding/live-test-recovery-send.ts"),
  "utf8",
);
assert.ok(
  liveTestAuthSrc.includes("MCTB_LIVE_TEST_SESSION_LOOKBACK_MS"),
  "onboarding live-test authorize must share session lookback with getLiveTestStatus",
);

console.log("test-mctb-process-recovery-metadata: PASS");
