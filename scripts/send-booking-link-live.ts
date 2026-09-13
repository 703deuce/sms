#!/usr/bin/env npx tsx
/**
 * Live booking-link SMS (571 sender when platform route allows).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/send-booking-link-live.ts 5714776175
 *
 * Modes:
 *   SEND_MODE=resource (default) — full executeSendResource path
 *   SEND_MODE=cert — HP 571 via demoBypass (same as /api/cert/send-sms)
 */
import { HP_CERTIFIED_SMS_E164 } from "@/lib/messaging/preferred-sending-number";
import { resolveVoiceSmsTemplate } from "@/lib/voice/sms/voice-sms-templates";
import { executeSendResource } from "@/lib/voice/tools/send-resource";

const toRaw = process.argv[2]?.replace(/\D/g, "");
const e164 = toRaw?.startsWith("1") ? `+${toRaw}` : toRaw ? `+1${toRaw}` : "";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";
const INGRESS = process.env.MCTB_E164 || "+18663464256";
const SEND_MODE = (process.env.SEND_MODE || "resource").toLowerCase();

async function main() {
  if (!e164 || e164.length < 11) {
    console.error("Usage: send-booking-link-live.ts <phone e.g. 5714776175>");
    process.exit(1);
  }

  delete process.env.HEADLESS_PROVIDER_MODE;
  delete process.env.VOICE_HEADLESS_SMS_MODE;

  const template = resolveVoiceSmsTemplate({
    templateId: "booking_link",
    callId: `live-${Date.now()}`,
    businessName: process.env.BUSINESS_NAME || "Harbor Drain Pros",
  });

  if (SEND_MODE === "cert") {
    const { sendQuickSms } = await import("@/lib/sms/send-quick");
    const out = await sendQuickSms({
      workspaceId: WORKSPACE_ID,
      to: e164,
      from: HP_CERTIFIED_SMS_E164,
      body: template.body,
      demoBypass: true,
      idempotencyKey: `voice-live-cert:${Date.now()}`,
    });
    console.log(JSON.stringify({ mode: "cert", ...out }, null, 2));
    return;
  }

  const result = await executeSendResource({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    resourceType: "booking",
    verbalSmsConsent: true,
    callerE164: e164,
    calledE164: INGRESS,
    telnyxConversationId: `live-sms-${Date.now()}`,
    telnyxCallControlId: `live-sms-cc-${Date.now()}`,
  });

  console.log(JSON.stringify({ mode: "resource", ...result }, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
