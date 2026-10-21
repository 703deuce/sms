#!/usr/bin/env npx tsx
/**
 * Golden-era (monolith src/lib/voice-v3) vs new-app runtime parity gate.
 * Fails CI when critical executors diverge without an explicit allowlist entry.
 *
 * NODE_OPTIONS='--import ../scripts/preload-server-only.mjs' \
 *   npx tsx new-app/scripts/verify-golden-runtime-parity.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..", "..");
const MONO = path.join(REPO, "src/lib/voice-v3");
const APP = path.join(__dirname, "..", "lib/server/voice-v3");

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

/** Byte-identical to golden monolith at HEAD (scheduling/booking core). */
const MUST_MATCH: string[] = [
  "calendar/book-dispatch.ts",
  "calendar/find-dispatch.ts",
  "calendar/cancel-dispatch.ts",
  "tools/execute-voice-tool.ts",
  "tools/handle-delegated-voice-tools.ts",
  "tools/concurrency-policy.ts",
  "tools/registry.ts",
  "tools/book-appointment-tool.ts",
  "tools/find-availability-tool.ts",
  "tools/set-scheduling-preference-tool.ts",
  "tools/cancel-appointment-tool.ts",
  "tools/reschedule-appointment-tool.ts",
  "tools/transfer-call-tool.ts",
  "tools/request-callback-tool.ts",
  "tools/send-booking-link-tool.ts",
  "tools/update-intake-tool.ts",
  "tools/astra-tool-contracts.ts",
  "delegation/conversation-freshness.ts",
  "delegation/live-response-coordinator.ts",
  "operations/run-authoritative-operation.ts",
  "operations/registry.ts",
  "agent/after-state-change.ts",
  "recovery/push-recovery-to-live.ts",
];

/** Documented intentional deltas (do not fail gate). */
const ALLOWED_DIFF: Record<string, string> = {
  "tools/voice-tool-catalog.ts": "Conversational IVR four-tool allowlist (new product mode)",
  "tools/find-appointment-tool.ts": "Editor intake key mapping + booked_this_call status",
  "calendar/build-create-booking-request.ts": "resolveCustomerIdentityFromIntake for wizard field ids",
  "calendar/appointment-management-dispatch.ts": "Intake identity + new-app db import paths",
  "calendar/reschedule-dispatch.ts": "Intake identity + new-app db import paths",
  "delegation/push-delegated-runtime-context.ts": "Skip intake objective block in Conversational IVR",
  "calendar/microsoft/resolve-voice-v3-microsoft-calendar.ts": "new-app prisma path + connected status aliases",
  "prompts/live-delegation-policy.ts": "Booking delegation guard (runtime incident); not golden text rollback",
  "prompts/astra-cross-tool-instructions.ts": "Rules 6b/6c booking verification",
  "recovery/evaluate-recovery.ts": "Skip recovery directives in Conversational IVR",
};

function relUnder(root: string, abs: string): string {
  return path.relative(root, abs).replace(/\\/g, "/");
}

function checkMustMatch(): void {
  for (const rel of MUST_MATCH) {
    const monoPath = path.join(MONO, rel);
    const appPath = path.join(APP, rel);
    const monoHash = sha256File(monoPath);
    const appHash = sha256File(appPath);
    assert.equal(
      monoHash,
      appHash,
      `Golden parity: ${rel} must match monolith (hash ${monoHash.slice(0, 12)} vs ${appHash.slice(0, 12)})`,
    );
  }
  console.log(`PASS must_match_byte_identical (${MUST_MATCH.length} files)`);
}

function reportAllowedDiffs(): void {
  for (const [rel, reason] of Object.entries(ALLOWED_DIFF)) {
    const monoPath = path.join(MONO, rel);
    const appPath = path.join(APP, rel);
    const same = sha256File(monoPath) === sha256File(appPath);
    console.log(same ? "OK same:" : "DIFF allowed:", rel, "—", reason);
  }
}

function runNewAppTests(): void {
  const nodeOpts = "--import ../scripts/preload-server-only.mjs";
  const tests = [
    "scripts/test-receptionist-config-source.ts",
    "scripts/test-voice-v3-runtime-parity-smoke.ts",
    "scripts/test-voice-v3-post-call-parity.ts",
  ];
  for (const script of tests) {
    const r = spawnSync("npx", ["tsx", script], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, NODE_OPTIONS: nodeOpts },
      encoding: "utf8",
    });
    if (r.status !== 0) {
      console.error(r.stdout, r.stderr);
      process.exit(r.status ?? 1);
    }
    console.log(`PASS ${script}`);
  }
}

checkMustMatch();
reportAllowedDiffs();
runNewAppTests();
console.log("VOICE_V3_NEW_APP_GOLDEN_RUNTIME_PARITY_GATE_PASS");
