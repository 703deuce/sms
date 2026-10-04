import assert from "node:assert/strict";

async function main() {
  const { claimMctbRecoverySmsSend } = await import(
    "@/lib/agents/missed-call-text-back/send-claim"
  );
  const { claimMctbRecoverySchedule } = await import(
    "@/lib/agents/missed-call-text-back/schedule-claim"
  );
  assert.equal(typeof claimMctbRecoverySmsSend, "function");
  assert.equal(typeof claimMctbRecoverySchedule, "function");
  console.log("test-mctb-send-claim-contract: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
