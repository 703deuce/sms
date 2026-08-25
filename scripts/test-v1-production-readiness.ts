#!/usr/bin/env tsx
/**
 * Definitive V1 production-readiness orchestrator (MCTB + Fax).
 * Verify is intentionally excluded — run npm run test:verify separately.
 */
import { spawnSync } from "node:child_process";

type Suite = { name: string; cmd: string; optional?: boolean };

const SUITES: Suite[] = [
  { name: "V1 API products (MCTB + Fax)", cmd: "npm run test:v1-api-products" },
  { name: "Verify dormant preserved", cmd: "npm run test:verify" },
  { name: "Fax routing regression", cmd: "npm run test:fax-routing-regression" },
  { name: "Transovo platform", cmd: "npm run test:transovo-platform", optional: true },
  { name: "MCTB launch matrix (file)", cmd: "test -f scripts/mctb-launch-readiness-matrix.ts" },
  { name: "TypeScript", cmd: "npx tsc --noEmit" },
];

function run(cmd: string) {
  const res = spawnSync(cmd, { shell: true, stdio: "inherit", cwd: process.cwd() });
  return res.status === 0;
}

console.log("\n=== V1 Production Readiness Orchestrator ===\n");
console.log("Active V1 products: MCTB, Fax");
console.log("Dormant: Verify (preserved, not gated)\n");

let failed = 0;
for (const suite of SUITES) {
  process.stdout.write(`→ ${suite.name}…\n`);
  const ok = run(suite.cmd);
  if (!ok) {
    if (suite.optional) {
      console.log(`  SKIP (optional) ${suite.name}\n`);
    } else {
      console.log(`  FAIL ${suite.name}\n`);
      failed += 1;
    }
  } else {
    console.log(`  OK ${suite.name}\n`);
  }
}

if (failed > 0) {
  console.log(`${failed} required suite(s) failed`);
  process.exit(1);
}

console.log("All required V1 readiness suites passed.");
console.log("Live verification still required — see docs/V1-PRODUCTION-CERTIFICATION.md");
