import assert from "node:assert/strict";
import {
  mctbEstimatedMonthlyTotalCents,
  MCTB_OWN_SENDER_MONTHLY_CENTS,
  MCTB_TEXT_BACK_MONTHLY_CENTS,
  MCTB_AI_RECOVERY_MONTHLY_CENTS,
} from "../src/lib/mctb/commercial-pricing";

assert.equal(
  mctbEstimatedMonthlyTotalCents({ basePlan: "free", ownSenderAddOn: true }),
  1000,
);
assert.equal(
  mctbEstimatedMonthlyTotalCents({ basePlan: "text_back", ownSenderAddOn: true }),
  MCTB_TEXT_BACK_MONTHLY_CENTS + MCTB_OWN_SENDER_MONTHLY_CENTS,
);
assert.equal(
  mctbEstimatedMonthlyTotalCents({ basePlan: "ai_recovery", ownSenderAddOn: true }),
  MCTB_AI_RECOVERY_MONTHLY_CENTS + MCTB_OWN_SENDER_MONTHLY_CENTS,
);

console.log("test-mctb-commercial-pricing: ok");
