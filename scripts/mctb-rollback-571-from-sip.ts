/**
 * Restore +15714073615 voice assignment from SIP delayed-offer cutover backup.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-571-from-sip.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-571-from-sip.ts --apply
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assign571ToConnection, fetchTelnyxPhoneNumberByE164 } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";

const BACKUP_PATH = join(process.cwd(), ".mctb-571-pre-sip-cutover.json");
const apply = process.argv.includes("--apply");

type SipCutoverBackup = {
  previousConnectionId: string;
  previousConnectionName?: string;
  messagingProfileId?: string | null;
};

async function main() {
  console.log("\n══ MCTB 571 SIP delayed-offer rollback ══\n");

  if (!existsSync(BACKUP_PATH)) {
    console.error(`Backup not found: ${BACKUP_PATH}`);
    console.error("Cannot restore without .mctb-571-pre-sip-cutover.json");
    process.exit(1);
  }

  const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as SipCutoverBackup;
  const targetConnectionId = String(backup.previousConnectionId || "");
  if (!targetConnectionId) {
    console.error("Backup missing previousConnectionId");
    process.exit(1);
  }

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) {
    console.error(`Number ${MCTB_PLATFORM_DEMO_E164} not found`);
    process.exit(1);
  }

  console.log(`Current connection: ${pn.connection_id}`);
  console.log(`Target connection:  ${targetConnectionId}`);
  console.log(`Previous name:      ${backup.previousConnectionName || "(unknown)"}`);
  console.log(`Messaging profile:  ${backup.messagingProfileId || "(none)"}`);

  if (String(pn.connection_id) === targetConnectionId) {
    console.log("\n571 already on backup connection — nothing to do.");
    return;
  }

  if (!apply) {
    console.log("\nDry run — re-run with --apply to restore previous voice routing.");
    return;
  }

  const assigned = await assign571ToConnection(targetConnectionId);
  const verify = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  const messagingAfter = verify?.messaging_profile_id
    ? String(verify.messaging_profile_id)
    : null;

  if (assigned.liveConnectionId !== targetConnectionId) {
    console.error("Rollback verification failed");
    process.exit(1);
  }

  console.log("\n571 RESTORED TO PRE-SIP-CUTOVER VOICE CONNECTION");
  console.log(`Live connection: ${assigned.liveConnectionId}`);
  if (backup.messagingProfileId && messagingAfter !== backup.messagingProfileId) {
    console.warn(
      `⚠ messaging profile changed: was ${backup.messagingProfileId}, now ${messagingAfter || "(none)"}`,
    );
  } else {
    console.log("Messaging profile unchanged ✓");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
