/**
 * Lightweight Telnyx provider wiring checks (no network).
 * Run: npx tsx scripts/test-telnyx-wiring.ts
 */

import assert from "assert";
import { getMessagingProviderName } from "../src/lib/messaging/provider-config";
import { telnyxProvider } from "../src/lib/messaging/telnyx/provider";

process.env.MESSAGING_PROVIDER = "mock";
assert.equal(getMessagingProviderName(), "mock");

process.env.MESSAGING_PROVIDER = "telnyx";
assert.equal(getMessagingProviderName(), "telnyx");

process.env.MESSAGING_PROVIDER = "twilio";
assert.equal(getMessagingProviderName(), "twilio");

const inbound = telnyxProvider.parseInboundMessage({
  data: {
    event_type: "message.received",
    payload: {
      id: "msg_123",
      from: "+15551234567",
      to: [{ phone_number: "+15557654321" }],
      text: "STOP",
      messaging_profile_id: "profile_1",
    },
  },
});
assert.equal(inbound.providerMessageId, "msg_123");
assert.equal(inbound.from, "+15551234567");
assert.equal(inbound.to, "+15557654321");
assert.equal(inbound.body, "STOP");

const status = telnyxProvider.parseDeliveryStatus({
  data: {
    payload: {
      id: "msg_456",
      to: [{ status: "delivered" }],
    },
  },
});
assert.equal(status.providerMessageId, "msg_456");
assert.equal(status.internalStatus, "delivered");

console.log("telnyx wiring checks passed");
