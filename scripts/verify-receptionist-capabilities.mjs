#!/usr/bin/env node
/**
 * Verify RECEPTIONIST_CAPABILITIES has no planned/partial items (any tier).
 *
 * Usage: node scripts/verify-receptionist-capabilities.mjs
 *        (spawns tsx to load the TypeScript checklist)
 * Exit 1 if ANY capability is planned or partial.
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
const allGaps = RECEPTIONIST_CAPABILITIES.filter(
  (c) => c.status === "planned" || c.status === "partial",
);

console.log("Receptionist capability verification");
console.log("Checked " + RECEPTIONIST_CAPABILITIES.length + " capabilities in RECEPTIONIST_CAPABILITIES");
console.log("Appointment receptionist defaults: " + caps.length);
console.log("");

if (allGaps.length) {
  console.error("FAIL: capabilities still planned/partial:");
  for (const g of allGaps) {
    console.error(
      "  - [" + g.tier + "] " + g.id + ": " + g.status + (g.notes ? " — " + g.notes : ""),
    );
  }
  process.exit(1);
}

console.log("OK: no capability in RECEPTIONIST_CAPABILITIES is planned or partial.");
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
