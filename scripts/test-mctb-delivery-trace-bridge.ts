import assert from "node:assert/strict";

async function main() {
  const { bridgeMctbRecoveryDeliveryWebhook } = await import(
    "@/lib/mctb/messaging/delivery-trace"
  );

  const skipped = await bridgeMctbRecoveryDeliveryWebhook({
    providerMessageId: "nonexistent-provider-id",
    status: "sent",
  });
  assert.equal(skipped.matched, false);

  const skippedQueued = await bridgeMctbRecoveryDeliveryWebhook({
    providerMessageId: "nonexistent-provider-id",
    status: "queued",
  });
  assert.equal(skippedQueued.matched, false);

  console.log("test-mctb-delivery-trace-bridge: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
