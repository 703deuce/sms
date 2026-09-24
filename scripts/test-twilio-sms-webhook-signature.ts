/**
 * Twilio SMS webhook signature validation (no network).
 * Run: npx tsx scripts/test-twilio-sms-webhook-signature.ts
 */
import assert from "node:assert/strict";
import twilio from "twilio";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import { canonicalTwilioInboundWebhookUrl } from "@/lib/messaging/twilio-sms-webhook-auth";

const authToken = "test_auth_token_for_unit";
const publicUrl = `${canonicalTwilioInboundWebhookUrl().replace(/\/$/, "") || "https://app.transovo.test"}/api/twilio/inbound`;
const params = {
  To: "+18885046264",
  From: "+17035550000",
  Body: "hello",
  MessageSid: "SM123",
  AccountSid: "AC123",
};

const signature = twilio.getExpectedTwilioSignature(authToken, publicUrl, params);

assert.equal(validateTwilioSignature(authToken, signature, publicUrl, params), true);
assert.equal(validateTwilioSignature(authToken, "bad", publicUrl, params), false);
assert.equal(
  validateTwilioSignature(authToken, signature, "https://wrong.example/api/twilio/inbound", params),
  false,
);

console.log("test:twilio-sms-webhook-signature ok");
