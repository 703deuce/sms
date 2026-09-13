#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_IN_INTENT_PROMPTS = [
  /if emergency.*notify owner/i,
  /always book/i,
  /use microsoft/i,
  /use calendly/i,
  /charge \$?\d+/i,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules") continue;
      walk(p, acc);
    } else if (p.endsWith(".ts") || p.endsWith(".tsx")) {
      acc.push(p);
    }
  }
  return acc;
}

const intentAgent = readFileSync("src/lib/mctb/lead-recovery/intent-agent.ts", "utf8");
for (const re of FORBIDDEN_IN_INTENT_PROMPTS) {
  assert.ok(!re.test(intentAgent), `intent-agent violates policy-in-prompt: ${re}`);
}

const leadRecoveryFiles = walk("src/lib/mctb/lead-recovery");
for (const file of leadRecoveryFiles) {
  const src = readFileSync(file, "utf8");
  assert.ok(!src.includes("bookEventInvitee"), `${file} must not call provider book directly`);
  assert.ok(!src.includes("createPaymentRequestStripeCheckout"), `${file} must not call Stripe checkout from LLM path`);
}

assert.ok(
  readFileSync("docs/runtime-rules/AI-LEAD-RECOVERY-POLICY-ENGINE.md", "utf8").includes("Separation rule"),
);

console.log("test-mctb-lead-recovery-conformance-audit: OK");
