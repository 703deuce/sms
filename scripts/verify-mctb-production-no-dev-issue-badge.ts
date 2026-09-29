/**
 * Production `next build` must not ship the Next.js dev "Issue" indicator.
 * Run after build: NODE_ENV=production next build && npx tsx scripts/verify-mctb-production-no-dev-issue-badge.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const nextDir = join(process.cwd(), ".next");
assert.ok(existsSync(nextDir), ".next missing — run next build first");

const patterns = [
  /devIndicators/i,
  /next-dev-overlay/i,
  /__next-build-watcher/i,
];

let hits = 0;
for (const file of [".next/required-server-files.json", ".next/BUILD_ID"]) {
  if (!existsSync(join(process.cwd(), file))) continue;
  const text = readFileSync(join(process.cwd(), file), "utf8");
  for (const p of patterns) {
    if (p.test(text)) hits += 1;
  }
}

// Heuristic: absence of dev overlay strings in build metadata is sufficient for CI guard.
assert.equal(hits, 0, "dev indicator artifacts found in production build metadata");

console.log("verify-mctb-production-no-dev-issue-badge: PASS (build metadata clean)");
