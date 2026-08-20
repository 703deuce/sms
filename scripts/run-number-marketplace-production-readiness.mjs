#!/usr/bin/env node
/**
 * Runs the number marketplace production-readiness automated gate.
 * Usage: npm run test:number-marketplace-production
 */
import { spawnSync } from "node:child_process";

const commands = [
  ["npx", ["tsc", "--noEmit"]],
  ["npm", ["run", "test:consumer-number-pricing"]],
  ["npm", ["run", "test:vanity-number-scoring"]],
  ["npm", ["run", "test:dual-provider-search"]],
  ["npm", ["run", "test:provider-failure-acceptance"]],
  ["npm", ["run", "test:homepage-number-search-hydration"]],
  ["npm", ["run", "test:port-simulation-harness"]],
  ["npm", ["run", "test:number-product-lifecycle"]],
  ["npx", ["tsx", "scripts/test-port-out-production.ts"]],
  ["npx", ["tsx", "scripts/test-forward-screening.ts"]],
  ["npx", ["tsx", "scripts/test-voicemail-greeting-playback.ts"]],
  ["npx", ["tsx", "scripts/test-personal-actions.ts"]],
  ["npx", ["tsx", "scripts/test-workspace-split.ts"]],
  ["npx", ["tsx", "scripts/test-number-marketplace-launch-scope.ts"]],
];

const results = [];
for (const [cmd, args] of commands) {
  const started = Date.now();
  const proc = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe" });
  const ok = proc.status === 0;
  results.push({
    command: `${cmd} ${args.join(" ")}`,
    ok,
    ms: Date.now() - started,
    output: (proc.stdout || proc.stderr || "").trim().split("\n").slice(-3).join("\n"),
  });
  console.log(`${ok ? "PASS" : "FAIL"} ${cmd} ${args.join(" ")}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  results,
};

const outPath = "/opt/cursor/artifacts/number_marketplace_production_gate.json";
try {
  const fs = await import("node:fs");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
} catch {
  // optional artifact path
}

console.log(JSON.stringify({ passed: report.passed, failed: report.failed }, null, 2));
process.exit(report.failed ? 1 : 0);
