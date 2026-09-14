#!/usr/bin/env npx tsx
/**
 * Static audit: natural-language regex must not be semantic authority on LR path.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/lib/mctb");
const SKIP = [
  "/testing/legacy-keyword-intent-classifier.ts",
  "/testing/deterministic-scheduling-fixture.ts",
  "/ai-booking/testing/",
  "/lead-recovery/john-policy-guard.ts",
  "/ai-booking/agents/router.ts", // deterministicIntentRouter is test-only export; production uses LLM
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

const patterns: Array<{ id: string; re: RegExp }> = [
  { id: "confirm_regex", re: /\\b\(yes\|yeah\|confirm/i },
  { id: "book_keyword", re: /book\|schedule\|appointment/i },
  { id: "pay_keyword", re: /pay\|deposit\|invoice/i },
  { id: "cancel_never_mind", re: /never\s*mind|forget\s*it/i },
];

const files = walk(ROOT).filter((f) => !SKIP.some((s) => f.includes(s.replace(/\//g, join("/", "")))));
let rawConfirm = 0;
let keywordHits = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (patterns[0].re.test(text) && file.includes("orchestrator")) rawConfirm++;
  if (file.includes("john-policy-guard")) continue;
  if (file.includes("protocol-intent")) continue;
  if (patterns[1].re.test(text) && file.includes(".test(")) continue;
  if (patterns[1].re.test(text) && !file.includes("prompts.ts") && !file.includes("intent-agent")) {
    if (/\.test\(/.test(text) && /book\|schedule/.test(text)) keywordHits++;
  }
}

const customerSmsSrc = readFileSync(
  join(process.cwd(), "src/lib/agents/missed-call-text-back/customer-sms.ts"),
  "utf8",
);
const johnReachable =
  customerSmsSrc.includes("runJohnCustomerLlmLoop") ||
  customerSmsSrc.includes("handleMctbAiBookingInboundSms")
    ? 1
    : 0;

console.log("NATURAL_LANGUAGE_REGEX_SEMANTIC_AUTHORITY (orchestrator confirm) ...", rawConfirm);
console.log("JOHN_REACHABLE_FROM_LEAD_RECOVERY_ENABLED .................", johnReachable);
console.log("SEMANTIC_KEYWORD_AUTHORITY (heuristic scan) ..............", keywordHits);

if (rawConfirm > 0 || johnReachable > 0) process.exit(1);
