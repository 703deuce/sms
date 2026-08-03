#!/usr/bin/env node
/**
 * Verify appointment_receptionist required capabilities are not still planned/partial.
 *
 * Usage: node scripts/verify-receptionist-capabilities.mjs
 *        (spawns tsx to load the TypeScript checklist)
 * Exit 1 if any required_receptionist or required_booking capability is planned or partial.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const code = `
import {
  capabilitiesForSolution,
  RECEPTIONIST_CAPABILITIES,
} from "./src/lib/voice/capabilities/receptionist-checklist.ts";

const caps = capabilitiesForSolution("appointment_receptionist");
const requiredGaps = caps.filter(
  (c) =>
    (c.tier === "required_receptionist" || c.tier === "required_booking") &&
    (c.status === "planned" || c.status === "partial"),
);
const allGaps = RECEPTIONIST_CAPABILITIES.filter(
  (c) => c.status === "planned" || c.status === "partial",
);

console.log("Appointment receptionist capability verification");
console.log("Checked " + caps.length + " default capabilities for appointment_receptionist");
console.log("");

if (allGaps.length) {
  console.log("Still planned/partial (any tier):");
  for (const g of allGaps) {
    console.log(
      "  - [" + g.tier + "] " + g.id + ": " + g.status + (g.notes ? " — " + g.notes : ""),
    );
  }
  console.log("");
}

if (requiredGaps.length) {
  console.error("FAIL: required capabilities still planned/partial:");
  for (const g of requiredGaps) {
    console.error("  - " + g.id + " (" + g.tier + "): " + g.status);
  }
  process.exit(1);
}

console.log("OK: no required_receptionist / required_booking capability is planned or partial.");
process.exit(0);
`;

const result = spawnSync("npx", ["tsx", "-e", code], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
  maxBuffer: 4 * 1024 * 1024,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
