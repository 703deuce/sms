/**
 * Number product lifecycle checks (no new Telnyx purchases).
 * Run: npx tsx scripts/test-number-product-lifecycle.ts
 */

import assert from "assert";
import { validateForwardingDestination } from "../src/lib/numbers/forwarding-validation";
import { resolveNumberInboundRoute } from "../src/lib/numbers/inbound-number-routing";
import { normalizeTelnyxError } from "../src/lib/numbers/telnyx-errors";
import { TelnyxApiError } from "../src/lib/messaging/telnyx/client";
import {
  getNumberPaymentProvider,
  testPaymentProvider,
} from "../src/lib/payments/number-payment-provider";

async function main() {
  assert.equal(
    validateForwardingDestination({ destination: "" }).ok,
    false,
    "empty destination rejected",
  );

  assert.equal(
    validateForwardingDestination({
      destination: "+15551234567",
      numberE164: "+15551234567",
    }).ok,
    false,
    "self-forward rejected",
  );

  const valid = validateForwardingDestination({ destination: "+15559876543" });
  assert.equal(valid.ok, true, "valid destination accepted");
  if (valid.ok) {
    assert.equal(valid.e164, "+15559876543");
  }

  const parkedRow = {
    id: "pn1",
    workspaceId: "ws1",
    e164: "+15551110000",
    voiceForwardTo: null,
    settingsJson: { parked: true, personalServiceState: "PARKED" },
  } as const;

  assert.equal(resolveNumberInboundRoute(parkedRow).kind, "vault_message");

  const vaultVmRow = {
    ...parkedRow,
    settingsJson: {
      parked: true,
      vaultIncomingMode: "voicemail",
      voicemailEnabled: true,
    },
  } as const;
  assert.equal(resolveNumberInboundRoute(vaultVmRow).kind, "vault_voicemail");

  const forwardRow = {
    ...parkedRow,
    voiceForwardTo: "+15552220000",
    settingsJson: {
      parked: false,
      forwardingEnabled: true,
      forwardTargets: ["+15552220000"],
    },
  } as const;
  const forwardRoute = resolveNumberInboundRoute(forwardRow);
  assert.equal(forwardRoute.kind, "forward");
  if (forwardRoute.kind === "forward") {
    assert.deepEqual(forwardRoute.destinations, ["+15552220000"]);
    assert.equal(forwardRoute.ringSeconds, 25);
  }

  const staleDisplayStateRow = {
    ...forwardRow,
    settingsJson: {
      ...forwardRow.settingsJson,
      personalServiceState: "PARKED",
    },
  } as const;
  assert.equal(resolveNumberInboundRoute(staleDisplayStateRow).kind, "forward");

  const vmRow = {
    ...parkedRow,
    settingsJson: { voicemailEnabled: true },
  } as const;
  assert.equal(resolveNumberInboundRoute(vmRow).kind, "voicemail");

  const unavailableRow = {
    ...parkedRow,
    settingsJson: { parked: false },
  } as const;
  assert.equal(resolveNumberInboundRoute(unavailableRow).kind, "unavailable");

  const normalized = normalizeTelnyxError(new TelnyxApiError("rate", 429, {}));
  assert.equal(normalized.category, "RATE_LIMITED");
  assert.equal(normalized.retryable, true);

  process.env.NUMBER_PAYMENT_PROVIDER = "test";
  assert.equal(getNumberPaymentProvider().name, "test");

  const pay = await testPaymentProvider.confirm({
    workspaceId: "ws1",
    userId: "u1",
    reservationId: "res1",
    phoneNumber: "+15551112222",
    amountCents: 9900,
    idempotencyKey: "test-key",
  });
  assert.equal(pay.ok, true);
  assert.ok(pay.paymentId.startsWith("test_pay_"));

  process.env.NUMBER_PAYMENT_PROVIDER = "test";
  process.env.NODE_ENV = "production";

  console.log("number product lifecycle checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
