#!/usr/bin/env npx tsx
/**
 * AI Lead Recovery — Full agent E2E certification (production runtime + recording adapters).
 *
 * Does NOT re-run intent-only certification.
 *
 *   LR_CERT_E2E=1 LR_CERT_FORCE_DEEPSEEK=1 LR_CERT_DISABLE_FALLBACK=1 \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/mctb-lead-recovery-e2e-cert.ts
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  formatE2eCertReport,
  runLeadRecoveryE2eCertification,
} from "../src/lib/mctb/lead-recovery/testing/cert-e2e-runner";

async function main() {
  process.env.LR_CERT_E2E = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";

  console.log("=== AI LEAD RECOVERY — FULL E2E CERT ===\n");
  const result = await runLeadRecoveryE2eCertification();
  const timestamp = new Date().toISOString();
  const e2eReport = formatE2eCertReport(result, timestamp);
  const e2ePath = join(process.cwd(), "docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md");
  writeFileSync(e2ePath, e2eReport, "utf8");
  const copyPath = join(process.cwd(), "docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION-FULL-COPY.txt");
  writeFileSync(
    copyPath,
    e2eReport
      .replace(/^# /gm, "")
      .replace(/\*\*/g, "")
      .replace(/\|/g, " ")
      .replace(/`/g, ""),
    "utf8",
  );

  const intentPath = join(process.cwd(), "docs/MCTB-AI-LEAD-RECOVERY-DEEPSEEK-CERTIFICATION.md");
  if (existsSync(intentPath)) {
    let intentDoc = readFileSync(intentPath, "utf8");
    intentDoc = intentDoc.replace(
      /READY_FOR_PRODUCTION_REVIEW \| \*\*YES\*\*/g,
      "INTENT_CERT_ONLY (see E2E doc) | **YES**",
    );
    intentDoc = intentDoc.replace(
      /READY_FOR_PRODUCTION_REVIEW \| \*\*NO\*\*/g,
      "INTENT_CERT_ONLY | **NO**",
    );
    if (!intentDoc.includes("FULL_AGENT_PRODUCTION_CERTIFIED")) {
      intentDoc += `\n\n## Full agent E2E (separate run)\n\nSee \`docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md\`.\n`;
    }
    writeFileSync(intentPath, intentDoc, "utf8");
  }

  console.log(e2eReport);
  console.log(`\nWrote ${e2ePath}`);
  if (result.hardFailures.length || !result.fullAgentProductionCertified) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
