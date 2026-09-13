#!/usr/bin/env npx tsx
/**
 * AI Lead Recovery — DeepSeek Flash full production certification (baseline first).
 *
 *   LR_CERT_DISABLE_FALLBACK=1 \
 *   LR_CERT_FORCE_DEEPSEEK=1 \
 *   npx tsx scripts/mctb-lead-recovery-deepseek-cert.ts
 *
 * SMS summary (optional):
 *   LR_CERT_SEND_SMS=1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx ...
 *
 * Requires DEEPSEEK_API_KEY. Does not use OpenAI for intent agent when LR_CERT_FORCE_DEEPSEEK=1.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatCertReport,
  runDeepSeekCertification,
} from "../src/lib/mctb/lead-recovery/testing/cert-runner";
async function main() {
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";

  const repeat = Number(process.env.LR_CERT_CRITICAL_REPEAT || "3");
  console.log("=== AI LEAD RECOVERY — DEEPSEEK CERT (BASELINE) ===\n");

  const { metrics, model, ready } = await runDeepSeekCertification({
    repeatCritical: repeat,
  });

  const timestamp = new Date().toISOString();
  const report = formatCertReport({ metrics, model, ready, timestamp });
  const outPath = join(process.cwd(), "docs/MCTB-AI-LEAD-RECOVERY-DEEPSEEK-CERTIFICATION.md");
  writeFileSync(outPath, report, "utf8");
  console.log(report);
  console.log(`\nWrote ${outPath}`);

  const notifyTo = process.env.LR_CERT_NOTIFY_E164?.trim();
  const workspaceId = process.env.WORKSPACE_ID || "ws_1";
  if (process.env.LR_CERT_SEND_SMS === "1" && notifyTo) {
    const body = `LR DeepSeek cert ${ready ? "PASS" : "FAIL"}: ${metrics.intentPassed}/${metrics.intentTotal} intents, hard=${metrics.hardFailures.length}. Model ${model}.`;
    try {
      const { sendQuickSms } = await import("../src/lib/sms/send-quick");
      await sendQuickSms({
        workspaceId,
        to: notifyTo,
        body,
        idempotencyKey: `lr-cert:${timestamp.slice(0, 16)}`,
      });
      console.log(`SMS summary sent to ${notifyTo}`);
    } catch (e) {
      console.warn("SMS notify failed:", e instanceof Error ? e.message : e);
    }
  }

  if (process.env.LR_CERT_SEND_SMS === "1" && !notifyTo) {
    console.warn("LR_CERT_SEND_SMS=1 but LR_CERT_NOTIFY_E164 is not set — skipping SMS");
  }

  if (!ready) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
