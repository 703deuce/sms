#!/usr/bin/env npx tsx
/**
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/mctb-lead-recovery-adversarial-cert.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatAdversarialFailuresOnly,
  runAdversarialCertificationOnce,
} from "../src/lib/mctb/lead-recovery/testing/cert-adversarial-runner";

async function main() {
  process.env.LR_CERT_E2E = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  const result = await runAdversarialCertificationOnce();
  const text = formatAdversarialFailuresOnly(result);
  const out = join(process.cwd(), "docs/MCTB-AI-LEAD-RECOVERY-ADVERSARIAL-FAILURES-ONLY.txt");
  writeFileSync(out, text, "utf8");
  console.log(text);
  console.log(`\nWrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
