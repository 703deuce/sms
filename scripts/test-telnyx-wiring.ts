/**
 * Lightweight Telnyx provider wiring checks (no network).
 * Run: npx tsx scripts/test-telnyx-wiring.ts
 */

import assert from "assert";
import { getMessagingProviderName } from "../src/lib/messaging/provider-config";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { unwrapTelnyxData, looksLikeTwilioMessagingServiceSid } from "../src/lib/messaging/provider-ids";
import {
  isApprovedCampaignStatus,
  isRejectedCampaignStatus,
  mapTelnyxVertical,
  pickCampaignStatus,
} from "../src/lib/messaging/telnyx/status-map";
import {
  TELNYX_ORDER_ID_PREFIX,
  fromTelnyxOrderRef,
  isTelnyxOrderId,
  toTelnyxOrderRef,
} from "../src/lib/messaging/telnyx/phone-numbers";
import { telnyxProvider } from "../src/lib/messaging/telnyx/provider";
import {
  classifyTelnyxMessagingEvent,
} from "../src/lib/messaging/telnyx/webhook-handlers";

process.env.MESSAGING_PROVIDER = "mock";
assert.equal(getMessagingProviderName(), "mock");

process.env.MESSAGING_PROVIDER = "telnyx";
assert.equal(getMessagingProviderName(), "telnyx");

process.env.MESSAGING_PROVIDER = "twilio";
assert.equal(getMessagingProviderName(), "twilio");

// String from (legacy / simplified payloads)
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

// Object from (actual Telnyx shape)
const inboundObj = telnyxProvider.parseInboundMessage({
  data: {
    event_type: "message.received",
    payload: {
      id: "msg_obj",
      from: { phone_number: "+15551112222", carrier: "X" },
      to: [{ phone_number: "+15553334444", status: "webhook_delivered" }],
      text: "HELP",
    },
  },
});
assert.equal(inboundObj.from, "+15551112222");
assert.equal(inboundObj.to, "+15553334444");
assert.equal(inboundObj.body, "HELP");
assert.notEqual(inboundObj.from, "[object Object]");

const status = telnyxProvider.parseDeliveryStatus({
  data: {
    event_type: "message.finalized",
    payload: {
      id: "msg_456",
      to: [{ status: "delivered" }],
    },
  },
});
assert.equal(status.providerMessageId, "msg_456");
assert.equal(status.internalStatus, "delivered");

const webhookDelivered = telnyxProvider.parseDeliveryStatus({
  data: {
    event_type: "message.finalized",
    payload: {
      id: "msg_webhook_delivered",
      from: { phone_number: "+18666020680" },
      to: [{ phone_number: "+17038166017", status: "webhook_delivered" }],
    },
  },
});
assert.equal(webhookDelivered.internalStatus, "delivered");
assert.equal(webhookDelivered.toE164, "+17038166017");
assert.equal(webhookDelivered.fromE164, "+18666020680");

assert.equal(classifyTelnyxMessagingEvent("message.received"), "inbound");
assert.equal(classifyTelnyxMessagingEvent("message.finalized"), "status");
assert.equal(classifyTelnyxMessagingEvent("message.sent"), "status");

assert.ok(isTelnyxOrderId(`${TELNYX_ORDER_ID_PREFIX}abc`));
assert.equal(toTelnyxOrderRef("ord_1"), "ORDER:ord_1");
assert.equal(fromTelnyxOrderRef("ORDER:ord_1"), "ord_1");
assert.equal(isTelnyxOrderId("pn_123"), false);

assert.equal(looksLikeTwilioMessagingServiceSid("MG123"), true);
assert.equal(looksLikeTwilioMessagingServiceSid("MG_mock_1"), true);
assert.equal(looksLikeTwilioMessagingServiceSid("uuid-profile"), false);

assert.equal(unwrapTelnyxData<{ brandId: string }>({ data: { brandId: "b1" } }).brandId, "b1");
assert.equal(unwrapTelnyxData<{ brandId: string }>({ brandId: "b2" }).brandId, "b2");

assert.equal(mapTelnyxVertical("professional_services"), "PROFESSIONAL");
assert.equal(mapTelnyxVertical("Home Services"), "CONSTRUCTION");
assert.equal(mapTelnyxVertical("SaaS / Technology"), "TECHNOLOGY");
assert.equal(mapTelnyxVertical(null, "HEALTHCARE"), "HEALTHCARE");

assert.equal(isApprovedCampaignStatus("MNO_PROVISIONED"), true);
assert.equal(isApprovedCampaignStatus("TCR_ACCEPTED"), false);
assert.equal(isRejectedCampaignStatus("TELNYX_FAILED"), true);
assert.equal(isRejectedCampaignStatus("TCR_SUSPENDED"), true);
assert.equal(pickCampaignStatus({ status: "ACTIVE", campaignStatus: "MNO_PENDING" }), "ACTIVE");
assert.equal(pickCampaignStatus({ campaignStatus: "MNO_PROVISIONED" }), "MNO_PROVISIONED");

process.env.APP_URL = "https://transovo.ai";
const urls = getTelnyxWebhookUrls();
assert.equal(urls.messaging, "https://transovo.ai/api/telnyx/messaging");
assert.equal(urls.compliance, "https://transovo.ai/api/telnyx/compliance");

async function main() {
  // verifyWebhook fail-closed when API key set without public key
  process.env.TELNYX_API_KEY = "KEY";
  delete process.env.TELNYX_PUBLIC_KEY;
  assert.equal(await telnyxProvider.verifyWebhook({ payload: "{}", signature: null }), false);

  delete process.env.TELNYX_API_KEY;
  assert.equal(await telnyxProvider.verifyWebhook({ payload: "{}", signature: null }), true);

  console.log("telnyx wiring checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
