#!/usr/bin/env npx tsx
/**
 * Verify frozen Voice V3 PSTN Microsoft booking pipeline.
 *
 * @see docs/VOICE-V3-PSTN-BOOKING-PIPELINE-FROZEN.md
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VOICE_V3_BOOKING_FROZEN_BASELINE_GIT,
  VOICE_V3_BOOKING_FROZEN_REVISION,
  VOICE_V3_BOOKING_PIPELINE_ID,
} from "../src/lib/voice-v3/frozen-booking-pipeline";

function run(cmd: string): void {
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

run("npx tsx scripts/test-voice-v3-booking-pipeline-frozen-contract.ts");
run("npx tsx scripts/test-voice-v3-scheduling-architecture-guards.ts");
run(
  "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-booking-scene-invariant.ts",
);
run(
  "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-booking.ts",
);

let head = "";
try {
  head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {
  head = "(no git)";
}

const baselineNote =
  head === VOICE_V3_BOOKING_FROZEN_BASELINE_GIT
    ? "HEAD matches frozen baseline commit"
    : `HEAD ${head.slice(0, 12)} differs from frozen baseline ${VOICE_V3_BOOKING_FROZEN_BASELINE_GIT.slice(0, 12)} — OK if revision bumped + PSTN re-cert`;

console.log(
  `\nverify-voice-v3-booking-pipeline-frozen: PASS\n` +
    `  pipeline: ${VOICE_V3_BOOKING_PIPELINE_ID}\n` +
    `  revision: ${VOICE_V3_BOOKING_FROZEN_REVISION}\n` +
    `  ${baselineNote}\n`,
);
