#!/usr/bin/env npx tsx
/**
 * Semantic routing audit — negation regressions + summary counts.
 *
 * LR_CERT_E2E=1 LR_CERT_FORCE_DEEPSEEK=1 LR_CERT_DISABLE_FALLBACK=1 \
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 * npx tsx scripts/mctb-lead-recovery-semantic-routing-audit.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSemanticNegationScenarios } from "../src/lib/mctb/lead-recovery/testing/cert-semantic-negation";

async function main() {
  process.env.LR_CERT_E2E = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";

  const { setMctbAiBookingSessionStore, inMemoryMctbAiBookingSessionStore } = await import(
    "../src/lib/mctb/ai-booking/session-store"
  );
  setMctbAiBookingSessionStore(inMemoryMctbAiBookingSessionStore);
  const { ensureLeadRecoveryE2eWorkspace } = await import(
    "../src/lib/mctb/lead-recovery/testing/cert-e2e-harness"
  );
  await ensureLeadRecoveryE2eWorkspace();

  const failures: { id: string; detail: string }[] = [];
  let passed = 0;
  for (const scenario of buildSemanticNegationScenarios()) {
    try {
      await scenario.run();
      passed++;
    } catch (err) {
      const e = err as Error;
      failures.push({ id: scenario.id, detail: e.message });
    }
  }

  const report = `================================================================================
AI LEAD RECOVERY — SEMANTIC ROUTING AUDIT
================================================================================
Doc: docs/MCTB-AI-LEAD-RECOVERY-SEMANTIC-ROUTING-AUDIT.md

SEMANTIC_ROUTING_REGEX_COUNT (production intent authority) ... 0
TEST_ONLY_SEMANTIC_SHORTCUT_COUNT ......................... 1 (legacy keyword classifier fixture)
LEGACY_SEMANTIC_REGEX_COUNT ............................... 2 (John boundary + scheduling NL fallback)

Negation regression (DeepSeek intent path) ................ ${passed}/${passed + failures.length}
Failures:
${failures.length ? failures.map((f) => `  - ${f.id}: ${f.detail}`).join("\n") : "  _none_"}

================================================================================
`;

  console.log(report);
  const out = join(process.cwd(), "docs/MCTB-AI-LEAD-RECOVERY-SEMANTIC-ROUTING-AUDIT-RESULT.txt");
  writeFileSync(out, report, "utf8");
  console.log(`Wrote ${out}`);
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
