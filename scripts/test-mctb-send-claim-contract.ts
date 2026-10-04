import assert from "node:assert/strict";

// Contract tests — no DB required.
const { claimMctbRecoverySmsSend } = await import(
  "@/lib/agents/missed-call-text-back/send-claim"
);

assert.equal(typeof claimMctbRecoverySmsSend, "function");

console.log("test-mctb-send-claim-contract: PASS (export smoke)");
