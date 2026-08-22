/**
 * Assign +15714073615 to MCTB Voice Bridge Call Control app and configure Twilio 855 ingress.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-571-twilio-voice-bridge.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-571-twilio-voice-bridge.ts --apply
 *
 * IMPORTANT: Deploy /api/telnyx/voice/mctb-voice-bridge and /api/twilio/voice/mctb-ingress first.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  MCTB_PLATFORM_DEMO_E164,
  MCTB_TWILIO_VOICE_INGRESS_E164,
} from "@/lib/mctb/onboarding/constants";
import {
  assign571ToConnection,
  classifyTelnyxConnectionId,
  fetchTelnyxPhoneNumberByE164,
} from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  ensureMctb571VoiceBridgeCallControlApplication,
  mctb571VoiceBridgeWebhookUrl,
  verify571VoiceBridgeRoute,
} from "@/lib/mctb/consent-prompt/telnyx-voice-bridge-route";
import { getTelnyxWebhookUrls, getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { getTwilioParentCredentials } from "@/lib/messaging/twilio-config";
import { getParentTwilioClient } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const BACKUP_PATH = join(process.cwd(), ".mctb-571-voice-bridge-backup.json");
const apply = process.argv.includes("--apply");

type Backup = {
  e164: string;
  providerNumberId: string;
  previousConnectionId: string;
  previousConnectionName: string;
  previousConnectionKind: string;
  twilioIngressE164: string;
  twilioIngressSid: string | null;
  previousTwilioVoiceUrl: string | null;
  savedAt: string;
};

async function findTwilioIngressNumber(): Promise<{
  sid: string;
  voiceUrl: string | null;
}> {
  const target = normalizeE164(MCTB_TWILIO_VOICE_INGRESS_E164);
  const { accountSid, authToken } = getTwilioParentCredentials();
  if (!accountSid || !authToken) {
    throw new Error("Twilio parent credentials missing — cannot configure 855 ingress webhook");
  }
  const client = getParentTwilioClient();
  const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: target, limit: 1 });
  const row = numbers[0];
  if (!row?.sid) {
    throw new Error(`Twilio ingress number ${target} not found in parent account`);
  }
  return { sid: row.sid, voiceUrl: row.voiceUrl || null };
}

async function configureTwilioIngressWebhook(sid: string): Promise<string> {
  const voiceUrl = `${getAppBaseUrl().replace(/\/$/, "")}/api/twilio/voice/mctb-ingress`;
  const { accountSid, authToken } = getTwilioParentCredentials();
  const client = getParentTwilioClient();
  await client.incomingPhoneNumbers(sid).update({
    voiceUrl,
    voiceMethod: "POST",
  });
  return voiceUrl;
}

async function main() {
  console.log("\n══ MCTB 571 → Twilio voice bridge setup ══\n");

  const bridgeAppId = await ensureMctb571VoiceBridgeCallControlApplication();
  const bridgeWebhook = mctb571VoiceBridgeWebhookUrl();
  const twilioIngressWebhook = getTelnyxWebhookUrls().mctbTwilioVoiceIngress;

  console.log("Voice bridge Call Control app:");
  console.log(`  App ID:      ${bridgeAppId}`);
  console.log(`  Webhook:     ${bridgeWebhook}`);
  console.log(`  Twilio URL:  ${twilioIngressWebhook}`);

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) {
    console.error(`Number ${MCTB_PLATFORM_DEMO_E164} not found`);
    process.exit(1);
  }

  const providerNumberId = String(pn.id);
  const currentConnectionId = String(pn.connection_id || "");
  const currentConnectionName = String(pn.connection_name || "");
  const currentKind = await classifyTelnyxConnectionId(currentConnectionId);

  console.log("\nCurrent 571 assignment:");
  console.log(`  Connection ID:   ${currentConnectionId}`);
  console.log(`  Connection name: ${currentConnectionName}`);
  console.log(`  Kind:            ${currentKind}`);

  const twilio = await findTwilioIngressNumber();
  console.log("\nTwilio ingress number:");
  console.log(`  E164:      ${MCTB_TWILIO_VOICE_INGRESS_E164}`);
  console.log(`  SID:       ${twilio.sid}`);
  console.log(`  Voice URL: ${twilio.voiceUrl || "(none)"}`);

  if (currentConnectionId === bridgeAppId && twilio.voiceUrl === twilioIngressWebhook) {
    console.log("\n571 voice bridge already configured.");
    const verify = await verify571VoiceBridgeRoute();
    console.log(verify.ok ? "✓ Verified" : `⚠ ${verify.detail}`);
    console.log("\nREADY FOR 571 → TWILIO 855 PHYSICAL VOICE-BRIDGE TEST");
    return;
  }

  const backup: Backup = {
    e164: MCTB_PLATFORM_DEMO_E164,
    providerNumberId,
    previousConnectionId: currentConnectionId,
    previousConnectionName: currentConnectionName,
    previousConnectionKind: currentKind,
    twilioIngressE164: MCTB_TWILIO_VOICE_INGRESS_E164,
    twilioIngressSid: twilio.sid,
    previousTwilioVoiceUrl: twilio.voiceUrl,
    savedAt: new Date().toISOString(),
  };

  if (!apply) {
    console.log("\nDry run — no changes made.");
    console.log(`Would save backup → ${BACKUP_PATH}`);
    console.log(`Would assign 571 → Voice Bridge app ${bridgeAppId}`);
    console.log(`Would set Twilio ${MCTB_TWILIO_VOICE_INGRESS_E164} voice URL → ${twilioIngressWebhook}`);
    console.log("\nRe-run with --apply after production deploy is healthy.");
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Saved backup → ${BACKUP_PATH}`);

  const assigned = await assign571ToConnection(bridgeAppId);
  const newTwilioVoiceUrl = await configureTwilioIngressWebhook(twilio.sid);
  const verify = await verify571VoiceBridgeRoute();

  console.log("\nCutover result:");
  console.log(`  571 connection:     ${assigned.liveConnectionId}`);
  console.log(`  Twilio voice URL:   ${newTwilioVoiceUrl}`);
  console.log(verify.ok ? "✓ 571 on Voice Bridge app" : `✗ ${verify.detail}`);

  if (!verify.ok) process.exit(1);

  console.log("\nREADY FOR 571 → TWILIO 855 PHYSICAL VOICE-BRIDGE TEST");
  console.log(
    "Rollback: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-571-twilio-voice-bridge.ts --apply",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
