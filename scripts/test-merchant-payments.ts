import assert from "node:assert/strict";
import { calculatePaymentAmounts, validatePaymentRequirement } from "../src/lib/merchant-payments/amounts.ts";
import { MERCHANT_PAYMENT_TRANSACTION_TYPE } from "../src/lib/merchant-payments/types.ts";

assert.equal(MERCHANT_PAYMENT_TRANSACTION_TYPE, "appointment_merchant_payment");

const deposit = calculatePaymentAmounts({
  mode: "deposit",
  priceCents: 20000,
  depositPercent: 25,
  currency: "usd",
  provider: "stripe",
});
assert.equal(deposit.amountDueCents, 5000);
assert.equal(deposit.balanceDueCents, 15000);
assert.equal(deposit.paymentMode, "deposit");

const full = calculatePaymentAmounts({
  mode: "full",
  priceCents: 15000,
  provider: "square",
});
assert.equal(full.amountDueCents, 15000);
assert.equal(full.balanceDueCents, 0);

assert.equal(
  validatePaymentRequirement({ mode: "full", provider: "stripe", priceCents: 100 }),
  null,
);
assert.match(
  validatePaymentRequirement({ mode: "full", priceCents: 100 }) || "",
  /provider/i,
);

import { evaluateConditionGroup } from "../src/lib/appointment-workflows/conditions.ts";

const depositPaid = evaluateConditionGroup(
  { logic: "and", conditions: [{ id: "1", field: "payment", operator: "deposit_paid" }] },
  {
    appointmentId: "a1",
    workspaceId: "w1",
    serviceName: "Consult",
    status: "awaiting_confirmation",
    startsAt: new Date(),
    metadata: { depositPaidCents: 5000, balanceDueCents: 15000 },
    paymentStatus: "succeeded",
  },
);
assert.equal(depositPaid, true);

const balanceDue = evaluateConditionGroup(
  { logic: "and", conditions: [{ id: "1", field: "payment", operator: "balance_due" }] },
  {
    appointmentId: "a1",
    workspaceId: "w1",
    serviceName: "Consult",
    status: "awaiting_confirmation",
    startsAt: new Date(),
    metadata: { balanceDueCents: 15000 },
    paymentStatus: "succeeded",
  },
);
assert.equal(balanceDue, true);

console.log("merchant-payments unit tests passed");
