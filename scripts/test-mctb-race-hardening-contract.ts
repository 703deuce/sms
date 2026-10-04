import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

async function main() {
  const { claimMctbRecoverySmsSend } = await import(
    "@/lib/agents/missed-call-text-back/send-claim"
  );
  const { claimMctbRecoverySchedule } = await import(
    "@/lib/agents/missed-call-text-back/schedule-claim"
  );
  const { appendMctbTraceOnce } = await import("@/lib/agents/missed-call-text-back/trace");

  assert.equal(typeof claimMctbRecoverySmsSend, "function");
  assert.equal(typeof claimMctbRecoverySchedule, "function");
  assert.equal(typeof appendMctbTraceOnce, "function");

  const processTs = read("src/lib/agents/missed-call-text-back/process.ts");
  assert.match(processTs, /P2002/, "process must handle unique idempotency races");
  assert.match(processTs, /appendMctbTraceOnce/, "process uses idempotent traces");

  const scheduleTs = read("src/lib/agents/missed-call-text-back/schedule.ts");
  assert.match(scheduleTs, /claimMctbRecoverySchedule/, "schedule uses schedule claim");

  const sendJobTs = read("src/lib/mctb/messaging/send-customer-sms-job.ts");
  assert.match(sendJobTs, /idempotencyKey/, "customer sms job dedupes by idempotency key");

  const vmTs = read("src/lib/phone/voicemail-service.ts");
  assert.match(vmTs, /sameRecording/, "voicemail attach skips duplicate transcription");

  console.log("test-mctb-race-hardening-contract: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
