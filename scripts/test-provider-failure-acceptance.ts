/**
 * Provider failure acceptance — forced Telnyx/Twilio failures via acceptance inject env.
 * Does not modify AI controller logic.
 *
 * Usage:
 *   NUMBER_SEARCH_ACCEPTANCE_INJECT=1 npx tsx scripts/test-provider-failure-acceptance.ts
 */
import dotenv from "dotenv";

dotenv.config();

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { acceptanceInjectEnabled } from "../src/lib/numbers/providers/acceptance-inject";
import { numberSearchService } from "../src/lib/numbers/providers/number-search-service";
import { telnyxNumberProvider } from "../src/lib/numbers/providers/telnyx-number-provider";
import { twilioNumberProvider } from "../src/lib/numbers/providers/twilio-number-provider";
import { searchPremiumNumbers } from "../src/lib/premium-numbers/premium-number-search";
import {
  detectSensitiveLeaks,
  sanitizeCustomerAiOutput,
} from "../src/lib/premium-numbers/ai-number-search/output-sanitizer";

type ScenarioResult = {
  name: string;
  pass: boolean;
  notes: string;
};

const results: ScenarioResult[] = [];

function record(name: string, pass: boolean, notes: string) {
  results.push({ name, pass, notes });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name}: ${notes}`);
}

function leakScan(text: string): boolean {
  return detectSensitiveLeaks(text).length === 0;
}

async function runInventoryScenario(
  name: string,
  env: Record<string, string>,
  assert: (out: Awaited<ReturnType<typeof numberSearchService.searchInventory>>) => boolean,
  note: string,
) {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const out = await numberSearchService.searchInventory({
    areaCode: "571",
    keywordDigitStrings: ["4448", "7584"],
    memorablePatterns: ["4444"],
    baseLimit: 15,
  });
  const pass = assert(out);
  record(name, pass, note + ` candidates=${out.candidates.length} attempts=${out.attempts.length}`);
}

async function main() {
  if (!acceptanceInjectEnabled()) {
    console.error("Set NUMBER_SEARCH_ACCEPTANCE_INJECT=1");
    process.exit(1);
  }

  const telnyx = telnyxNumberProvider.isConfigured();
  const twilio = twilioNumberProvider.isConfigured();
  console.log(`Providers: telnyx=${telnyx} twilio=${twilio}`);

  process.env.NUMBER_SEARCH_ACCEPTANCE_INJECT = "1";

  // Telnyx forced failure — Twilio may still return inventory
  await runInventoryScenario(
    "Telnyx-only failure",
    { NUMBER_SEARCH_INJECT_FAIL: "telnyx", NUMBER_SEARCH_INJECT_DELAY_MS: "0" },
    (out) => {
      const telnyxErr = out.attempts.some((a) => a.provider === "telnyx" && a.status === "error");
      const hasTwilioOk = out.attempts.some((a) => a.provider === "twilio" && a.status === "ok");
      return telnyxErr && (twilio ? hasTwilioOk || out.candidates.length > 0 : telnyxErr);
    },
    "Telnyx errors; partial inventory policy when Twilio configured",
  );

  await runInventoryScenario(
    "Twilio-only failure",
    { NUMBER_SEARCH_INJECT_FAIL: "twilio" },
    (out) => {
      const twilioErr = out.attempts.some((a) => a.provider === "twilio" && a.status === "error");
      const telnyxOk = out.attempts.some((a) => a.provider === "telnyx" && a.status === "ok");
      return twilioErr && (telnyx ? telnyxOk || out.candidates.length > 0 : twilioErr);
    },
    "Twilio errors; Telnyx may still return inventory",
  );

  await runInventoryScenario(
    "Both providers failure",
    { NUMBER_SEARCH_INJECT_FAIL: "both" },
    (out) => out.candidates.length === 0 && out.attempts.every((a) => a.status === "error"),
    "Zero candidates; no fabricated numbers",
  );

  const slowStart = Date.now();
  await runInventoryScenario(
    "Telnyx slow (15s inject delay)",
    {
      NUMBER_SEARCH_INJECT_FAIL: "",
      NUMBER_SEARCH_INJECT_DELAY_MS: "15000",
      NUMBER_SEARCH_INJECT_DELAY_PROVIDER: "telnyx",
    },
    (out) => out.attempts.length > 0,
    `Completed in ${((Date.now() - slowStart) / 1000).toFixed(1)}s`,
  );

  // Recovery — clear inject fail
  delete process.env.NUMBER_SEARCH_INJECT_FAIL;
  delete process.env.NUMBER_SEARCH_INJECT_DELAY_MS;
  delete process.env.NUMBER_SEARCH_INJECT_DELAY_PROVIDER;

  await runInventoryScenario(
    "Recovery after inject cleared",
    {},
    (out) => out.attempts.some((a) => a.status === "ok"),
    "At least one provider succeeds after recovery",
  );

  // Premium search layer — both fail should not leak providers in message
  process.env.NUMBER_SEARCH_INJECT_FAIL = "both";
  const premium = await searchPremiumNumbers({
    areaCodes: ["571"],
    industry: "electrician",
    customKeywords: ["SPARK"],
    limit: 20,
  });
  const msg = premium.message ?? "";
  const statusOk = premium.status === "NO_INVENTORY" || premium.status === "TELNYX_ERROR";
  record(
    "Premium search both-fail customer message",
    statusOk && leakScan(msg) && premium.candidates.length === 0,
    `status=${premium.status} message=${msg.slice(0, 80)}`,
  );

  // Sanitizer blocks provider names in synthetic error text
  const sanitized = sanitizeCustomerAiOutput(
    "Telnyx failed and Twilio wholesale cost was $1.00. providerNumberId=PN123 apiKey=sk-test1234567890",
  );
  record(
    "Output sanitizer redacts provider/cost leaks",
    leakScan(sanitized) && !sanitized.includes("Telnyx") && !sanitized.includes("Twilio"),
    sanitized.slice(0, 120),
  );

  delete process.env.NUMBER_SEARCH_INJECT_FAIL;
  process.env.NUMBER_SEARCH_ACCEPTANCE_INJECT = "0";

  const failed = results.filter((r) => !r.pass).length;
  const reportPath =
    process.env.REPORT_PATH ?? "/opt/cursor/artifacts/provider-failure-acceptance-report.md";
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(
    reportPath,
    [
      "# Provider Failure Acceptance Report",
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      `Summary: ${results.length - failed} PASS / ${failed} FAIL`,
      "",
      ...results.map((r) => `- **${r.name}**: ${r.pass ? "PASS" : "FAIL"} — ${r.notes}`),
    ].join("\n"),
    "utf8",
  );
  console.log(`\nReport: ${reportPath}`);

  if (failed) process.exit(1);
  console.log("\nAll provider failure scenarios passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
