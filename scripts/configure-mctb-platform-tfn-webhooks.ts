/**
 * Configure SMS webhooks on parent-owned MCTB platform TFN (read/write Twilio number only).
 * Run: MCTB_PLATFORM_SENDER_E164=+18885046264 npx tsx scripts/configure-mctb-platform-tfn-webhooks.ts
 */
import { assertLiveTwilioConfigured, getWebhookUrls } from "@/lib/messaging/twilio-config";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const e164 = normalizeE164(process.env.MCTB_PLATFORM_SENDER_E164?.trim() || "+18885046264");

async function main() {
  assertLiveTwilioConfigured();
  const urls = getWebhookUrls();
  const client = getLiveParentClient();
  const listed = await client.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 5 });
  const row = listed.find((n) => normalizeE164(n.phoneNumber) === e164);
  if (!row) throw new Error(`Parent account missing ${e164}`);

  const updated = await client.incomingPhoneNumbers(row.sid).update({
    smsUrl: urls.inbound,
    smsMethod: "POST",
    statusCallback: urls.messageStatus,
    statusCallbackMethod: "POST",
  });

  console.log(
    JSON.stringify({
      ok: true,
      e164,
      smsUrl: updated.smsUrl,
      statusCallback: updated.statusCallback,
      appBase: urls.inbound.replace("/api/twilio/inbound", ""),
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
