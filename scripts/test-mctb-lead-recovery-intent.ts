#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deterministicLeadRecoveryIntent } from "../src/lib/mctb/lead-recovery/intent-agent";

const cases: Array<{ msg: string; primary: string; secondary?: string[] }> = [
  { msg: "I was calling about my AC.", primary: "SERVICE_REQUEST" },
  { msg: "Water is pouring everywhere.", primary: "EMERGENCY_OR_URGENT" },
  { msg: "Have someone call me.", primary: "CALLBACK_REQUEST" },
  { msg: "Can somebody come tomorrow?", primary: "BOOKING_REQUEST" },
  { msg: "How much does this cost?", primary: "PRICING_QUESTION" },
  { msg: "I need an estimate.", primary: "ESTIMATE_REQUEST" },
  { msg: "Do you come to Stafford?", primary: "SERVICE_AREA_CHECK" },
  { msg: "Are you open tonight?", primary: "UNKNOWN", secondary: ["BUSINESS_HOURS"] },
  { msg: "You guys were here yesterday.", primary: "EXISTING_CUSTOMER_ISSUE" },
  { msg: "I need to move tomorrow.", primary: "RESCHEDULE_REQUEST" },
  { msg: "I want to cancel.", primary: "CANCEL_REQUEST" },
  { msg: "Can I pay the deposit?", primary: "PAYMENT_REQUEST" },
  { msg: "Did my payment go through?", primary: "PAYMENT_STATUS_QUESTION" },
  { msg: "Your technician broke something.", primary: "COMPLAINT" },
  { msg: "Stop texting me.", primary: "OPT_OUT" },
  { msg: "Wrong number.", primary: "WRONG_NUMBER" },
];

for (const c of cases) {
  const intent = deterministicLeadRecoveryIntent({ message: c.msg });
  assert.equal(intent.primary_intent, c.primary, `primary for: ${c.msg}`);
  if (c.secondary?.length) {
    for (const s of c.secondary) {
      assert.ok(
        intent.secondary_intents.includes(s as typeof intent.secondary_intents[number]) ||
          intent.primary_intent === s,
        `secondary ${s} for: ${c.msg}`,
      );
    }
  }
}

const multi = deterministicLeadRecoveryIntent({
  message: "I need someone tomorrow and how much does it cost?",
});
assert.equal(multi.primary_intent, "BOOKING_REQUEST");
assert.ok(multi.secondary_intents.includes("PRICING_QUESTION"));

const intentSrc = readFileSync("src/lib/mctb/lead-recovery/intent-agent.ts", "utf8");
assert.ok(!intentSrc.includes("notify owner"));
assert.ok(!intentSrc.includes("bookEventInvitee"));
assert.ok(!intentSrc.includes("createPaymentRequest"));

console.log("test-mctb-lead-recovery-intent: OK");
