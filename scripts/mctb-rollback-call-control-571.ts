/**
 * Restore +15714073615 to original TeXML application.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-call-control-571.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-call-control-571.ts --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_571_CONSENT_TEXML_APP_ID } from "@/lib/mctb/consent-prompt/telnyx-texml-route";
import {
  assign571ToConnection,
  fetchTelnyxPhoneNumberByE164,
} from "@/lib/mctb/consent-prompt/telnyx-call-control-route";

const BACKUP_PATH = join(process.cwd(), ".mctb-571-voice-backup.json");
const apply = process.argv.includes("--apply");

async function main() {
  console.log("\n══ MCTB 571 Call Control rollback ══\n");

  let targetConnectionId = MCTB_571_CONSENT_TEXML_APP_ID;
  if (existsSync(BACKUP_PATH)) {
    const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as {
      previousConnectionId?: string;
    };
    if (backup.previousConnectionId) {
      targetConnectionId = backup.previousConnectionId;
      console.log(`Using backup previousConnectionId: ${targetConnectionId}`);
    }
  } else {
    console.log(`No backup file — restoring to TeXML app ${targetConnectionId}`);
  }

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) {
    console.error(`Number ${MCTB_PLATFORM_DEMO_E164} not found`);
    process.exit(1);
  }

  console.log(`Current connection: ${pn.connection_id}`);
  console.log(`Target connection:  ${targetConnectionId}`);

  if (String(pn.connection_id) === targetConnectionId) {
    console.log("\n571 RESTORED TO BACKUP CONNECTION (already on target)");
    return;
  }

  if (!apply) {
    console.log("\nDry run — re-run with --apply to restore previous routing.");
    return;
  }

  const assigned = await assign571ToConnection(targetConnectionId);
  if (assigned.liveConnectionId !== targetConnectionId) {
    console.error("Rollback verification failed");
    process.exit(1);
  }

  console.log("\n571 RESTORED TO BACKUP CONNECTION");
  console.log(`Live connection: ${assigned.liveConnectionId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
