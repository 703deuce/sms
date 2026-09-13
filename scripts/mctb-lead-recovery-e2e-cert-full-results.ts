#!/usr/bin/env npx tsx
/**
 * Full E2E cert + per-scenario copy-friendly results file.
 *
 *   LR_CERT_E2E=1 LR_CERT_FORCE_DEEPSEEK=1 LR_CERT_DISABLE_FALLBACK=1 LR_CERT_RESULTS_DUMP=1 \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/mctb-lead-recovery-e2e-cert-full-results.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatE2eCertReport,
  runLeadRecoveryE2eCertification,
} from "../src/lib/mctb/lead-recovery/testing/cert-e2e-runner";
import { getCertScenarioRecords } from "../src/lib/mctb/lead-recovery/testing/cert-results-trace";
import { formatCertScenarioResultsCopyText } from "../src/lib/mctb/lead-recovery/testing/cert-results-format";

async function main() {
  process.env.LR_CERT_E2E = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.LR_CERT_RESULTS_DUMP = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";

  console.log("=== AI LEAD RECOVERY — FULL E2E + SCENARIO RESULTS DUMP ===\n");
  const result = await runLeadRecoveryE2eCertification();
  const timestamp = new Date().toISOString();
  const records = getCertScenarioRecords();
  const fullCopy = formatCertScenarioResultsCopyText(records, result, timestamp);
  const outPath = join(
    process.cwd(),
    "docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION-SCENARIO-RESULTS.txt",
  );
  writeFileSync(outPath, fullCopy, "utf8");

  const e2eReport = formatE2eCertReport(result, timestamp);
  writeFileSync(join(process.cwd(), "docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md"), e2eReport, "utf8");

  console.log(`Wrote ${outPath} (${records.length} scenarios, ${fullCopy.length} chars)`);
  console.log(e2eReport);
  if (result.hardFailures.length || !result.fullAgentProductionCertified) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
