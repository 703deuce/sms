#!/usr/bin/env tsx
/**
 * Commercial launch guard: deterministic first-text templates (no DB).
 */
import { runMctbDeterministicFirstTextChecks } from "./lib/mctb-deterministic-first-text-verify";

const checks = runMctbDeterministicFirstTextChecks();
const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(c.ok ? "✓" : "✗", c.name, c.detail ? `— ${c.detail}` : "");
}
if (failed.length) process.exit(1);
console.log("test-mctb-deterministic-first-text-guard: PASS");
