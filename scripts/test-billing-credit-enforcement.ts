/**
 * Credit enforcement: pre-billing workspaces stay unlimited until Stripe is attached.
 */
import assert from "node:assert/strict";
import { isWorkspaceCreditEnforced } from "../src/lib/settings/billing";
import { checkCreditBalance } from "../src/lib/billing/entitlements";

const originalStripe = process.env.STRIPE_SECRET_KEY;
const originalCreditsFlag = process.env.BILLING_CREDITS_ENABLED;

function restoreEnv() {
  if (originalStripe === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalStripe;
  if (originalCreditsFlag === undefined) delete process.env.BILLING_CREDITS_ENABLED;
  else process.env.BILLING_CREDITS_ENABLED = originalCreditsFlag;
}

async function main() {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.BILLING_CREDITS_ENABLED = "true";

  const enforcedForPreBilling = await isWorkspaceCreditEnforced("cmt2zyg4l43373s0f146b442h");
  assert.equal(
    enforcedForPreBilling,
    false,
    "test workspace without Stripe billing should not enforce credits",
  );

  const gate = await checkCreditBalance("cmt2zyg4l43373s0f146b442h");
  assert.equal(gate.ok, true, "negative balance must not block pre-billing workspace");

  process.env.BILLING_CREDITS_ENABLED = "false";
  const enforcedWhenDisabled = await isWorkspaceCreditEnforced("cmt2zyg4l43373s0f146b442h");
  assert.equal(enforcedWhenDisabled, false, "platform-wide credit disable skips enforcement");

  console.log("test-billing-credit-enforcement: ok");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    restoreEnv();
  });
