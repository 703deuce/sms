#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [
  /if emergency.*notify owner/i,
  /if booking.*schedule/i,
  /always book/i,
  /text the owner/i,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules") continue;
      walk(p, acc);
    } else if (/customer-llm|john.*prompt|missed-call-text-back.*prompt/i.test(p) && /\.ts$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

const paths = walk("src/lib/agents/missed-call-text-back");
let violations = 0;
for (const file of paths) {
  const src = readFileSync(file, "utf8");
  for (const re of FORBIDDEN) {
    if (re.test(src)) {
      violations++;
      console.error(`policy in prompt: ${file} ${re}`);
    }
  }
}

assert.equal(violations, 0, "workspace policy must not live in John prompts");

const sms = readFileSync("src/lib/agents/missed-call-text-back/customer-sms.ts", "utf8");
assert.ok(sms.includes("handleMctbLeadRecoveryInboundSms"));
assert.ok(!sms.includes("runJohnCustomerLlmLoop"));
assert.ok(!sms.includes("handleMctbAiBookingInboundSms"));
assert.ok(!sms.includes("processMctbInboundReply"));
assert.ok(sms.includes("recordMctbLeadRecoveryInboundSideEffects"));

console.log("test-mctb-lead-recovery-legacy-prompt-audit: OK");
