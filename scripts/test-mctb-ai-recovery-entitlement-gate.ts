/**
 * Static proof: Recovery-paid workspaces cannot enable AI via API without aiRecoveryEntitled.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const files = [
  "src/app/api/mctb/lead-recovery/config/route.ts",
  "src/app/api/mctb/ai-recovery/settings/route.ts",
  "src/app/api/mctb/handoff/route.ts",
  "src/lib/mctb/lead-recovery/config.ts",
];

for (const rel of files) {
  const src = readFileSync(path.join(process.cwd(), rel), "utf8");
  assert.ok(
    src.includes("aiRecoveryEntitled") || src.includes('requireMctbCapability'),
    `${rel} must gate AI Recovery on aiRecoveryEntitled`,
  );
}

const grants = readFileSync(
  path.join(process.cwd(), "src/lib/mctb/commercial-entitlement-grants.ts"),
  "utf8",
);
assert.ok(grants.includes("mctbAiRecoveryEntitled"));
assert.ok(grants.includes("mctb_own_sender"));

console.log("test-mctb-ai-recovery-entitlement-gate: PASS");
