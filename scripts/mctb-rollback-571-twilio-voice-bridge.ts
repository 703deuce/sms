/**
 * Restore +15714073615 Telnyx voice assignment and Twilio 855 ingress webhook from backup.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-571-twilio-voice-bridge.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-571-twilio-voice-bridge.ts --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_571_CONSENT_TEXML_APP_ID } from "@/lib/mctb/consent-prompt/telnyx-texml-route";
import {
  assign571ToConnection,
  fetchTelnyxPhoneNumberByE164,
} from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import { getTwilioParentCredentials } from "@/lib/messaging/twilio-config";
import { getParentTwilioClient } from "@/lib/messaging/twilio-client";

const BACKUP_PATH = join(process.cwd(), ".mctb-571-voice-bridge-backup.json");
const apply = process.argv.includes("--apply");

async function main() {
  console.log("\n══ MCTB 571 Twilio voice bridge rollback ══\n");

  if (!existsSync(BACKUP_PATH)) {
    console.error(`Backup not found: ${BACKUP_PATH}`);
    process.exit(1);
  }

  const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as {
    previousConnectionId?: string;
    twilioIngressSid?: string | null;
    previousTwilioVoiceUrl?: string | null;
  };

  const targetConnectionId = backup.previousConnectionId || MCTB_571_CONSENT_TEXML_APP_ID;
  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) {
    console.error(`Number ${MCTB_PLATFORM_DEMO_E164} not found`);
    process.exit(1);
  }

  console.log(`Current Telnyx connection: ${pn.connection_id}`);
  console.log(`Target Telnyx connection:  ${targetConnectionId}`);
  if (backup.twilioIngressSid) {
    console.log(`Twilio ingress SID:        ${backup.twilioIngressSid}`);
    console.log(`Restore Twilio voice URL:  ${backup.previousTwilioVoiceUrl || "(clear)"}`);
  }

  if (!apply) {
    console.log("\nDry run — re-run with --apply to restore.");
    return;
  }

  const assigned = await assign571ToConnection(targetConnectionId);
  if (assigned.liveConnectionId !== targetConnectionId) {
    console.error("Telnyx rollback verification failed");
    process.exit(1);
  }

  if (backup.twilioIngressSid) {
    const { accountSid, authToken } = getTwilioParentCredentials();
    if (accountSid && authToken) {
      const client = getParentTwilioClient();
      await client.incomingPhoneNumbers(backup.twilioIngressSid).update({
        voiceUrl: backup.previousTwilioVoiceUrl || "",
        voiceMethod: "POST",
      });
    }
  }

  console.log("\n571 VOICE BRIDGE ROLLBACK COMPLETE");
  console.log(`Live Telnyx connection: ${assigned.liveConnectionId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
