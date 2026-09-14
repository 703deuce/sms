#!/usr/bin/env npx tsx
/**
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/mctb-lead-recovery-semantic-stress-v2.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatStressV2FailuresOnly,
  runSemanticStressV2,
} from "../src/lib/mctb/lead-recovery/testing/cert-semantic-stress-v2-runner";

async function main() {
  const results = await runSemanticStressV2({ suitePasses: 2, highRiskRepeats: 10 });
  const text = formatStressV2FailuresOnly(results);
  const out = join(process.cwd(), "docs/MCTB-SEMANTIC-STRESS-V2-FAILURES-ONLY.txt");
  writeFileSync(out, text, "utf8");
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
