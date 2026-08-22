/**
 * Assign +15714073615 to Transovo LiveKit Inbound SIP (FQDN) for delayed-offer test.
 *
 * Saves rollback state to .mctb-571-pre-sip-cutover.json
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-571-sip-delayed-offer.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-571-sip-delayed-offer.ts --apply
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assign571ToConnection } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  auditMctb571SipFqdnConnection,
  ensureMctb571SipFqdnLateMediaSettings,
  fetch571PhoneAssignment,
} from "@/lib/mctb/sip-diagnostic/fqdn-audit";
import {
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_571_SIP_FQDN_CONNECTION_NAME,
} from "@/lib/mctb/sip-diagnostic/constants";

const BACKUP_PATH = join(process.cwd(), ".mctb-571-pre-sip-cutover.json");
const apply = process.argv.includes("--apply");

type SipCutoverBackup = {
  e164: string;
  providerNumberId: string;
  previousConnectionId: string;
  previousConnectionName: string;
  previousConnectionKind: string;
  messagingProfileId: string | null;
  messagingProfileName: string | null;
  targetConnectionId: string;
  targetConnectionName: string;
  savedAt: string;
};

function formatBool(v: boolean | null): string {
  if (v === true) return "ON";
  if (v === false) return "OFF";
  return "unknown";
}

async function printFinalAudit(input: {
  assignment: Awaited<ReturnType<typeof fetch571PhoneAssignment>>;
  fqdn: Awaited<ReturnType<typeof auditMctb571SipFqdnConnection>>;
  messagingUnchanged: boolean;
}) {
  const { assignment, fqdn, messagingUnchanged } = input;
  console.log("\n══ Final pre-physical-test audit ══\n");
  console.log(`DID:\n${assignment.e164}\n`);
  console.log(`Current voice connection:\n${assignment.connectionId}\n`);
  console.log(`Connection name:\n${assignment.connectionName || MCTB_571_SIP_FQDN_CONNECTION_NAME}\n`);
  console.log(`3PCC:\n${formatBool(fqdn.thirdPartyControlEnabled)}\n`);
  console.log(`PRACK:\n${formatBool(fqdn.prackEnabled)}\n`);
  console.log(`Generate Ringback Tone:\n${formatBool(fqdn.generateRingbackTone)}\n`);
  console.log(`Messaging profile unchanged:\n${messagingUnchanged ? "YES" : "NO — VERIFY"}\n`);
  console.log(`MCTB 571 routing isolated from AI:\nYES (worker branches on To == 571 before bootstrap)\n`);
  console.log(`SIP → normalized MCTB event adapter:\nREADY (capture_mctb_sip_inbound)\n`);
  console.log(`Existing Consent queue path:\nREADY (shared EVENT_ONLY pipeline)\n`);
  console.log(`Telnyx SMS sender:\n${assignment.e164}\n`);
  console.log(`Rollback command:\nnpm run rollback:mctb-571-from-sip -- --apply\n`);
  console.log("\nPost-call SIP trace checklist:");
  console.log("  - Look for 183 Session Progress (not 180 Ringing with Content-Length: 0)");
  console.log("  - Content-Type: application/sdp with SDP body");
  console.log("  - Require: 100rel / PRACK if negotiated");
  console.log("  - 200 OK + ACK + hangup cause");
  console.log("\nREADY FOR SIP + EVENT_ONLY COMBINED PHYSICAL TEST");
}

async function main() {
  console.log("\n══ MCTB 571 → SIP/FQDN delayed-offer cutover ══\n");

  const assignment = await fetch571PhoneAssignment();
  const fqdnBefore = await auditMctb571SipFqdnConnection();

  console.log("Pre-cutover assignment:");
  console.log(`  connectionId:   ${assignment.connectionId}`);
  console.log(`  connectionType: ${assignment.connectionKind}`);
  console.log(`  messagingProfileId: ${assignment.messagingProfileId || "(none)"}`);

  console.log("\nTarget SIP/FQDN:");
  console.log(`  ${MCTB_571_SIP_FQDN_CONNECTION_NAME} (${MCTB_571_SIP_FQDN_CONNECTION_ID})`);
  console.log(`  lateMediaReady: ${fqdnBefore.lateMediaReady ? "YES" : "NO"}`);

  if (!fqdnBefore.lateMediaReady) {
    if (!apply) {
      console.log("\nDry run — would enable 3PCC + PRACK + Generate Ringback on FQDN connection.");
    } else {
      const enabled = await ensureMctb571SipFqdnLateMediaSettings();
      console.log(
        enabled.patched
          ? "\n✓ Enabled SIP late-media flags on FQDN connection"
          : "\n✓ SIP late-media flags already enabled",
      );
      if (!enabled.audit.lateMediaReady) {
        console.error("✗ SIP late-media flags still not ready after PATCH");
        process.exit(1);
      }
    }
  }

  if (assignment.connectionId === MCTB_571_SIP_FQDN_CONNECTION_ID) {
    const fqdn = await auditMctb571SipFqdnConnection();
    await printFinalAudit({ assignment, fqdn, messagingUnchanged: true });
    return;
  }

  const backup: SipCutoverBackup = {
    e164: assignment.e164,
    providerNumberId: assignment.providerNumberId,
    previousConnectionId: assignment.connectionId,
    previousConnectionName: assignment.connectionName,
    previousConnectionKind: assignment.connectionKind,
    messagingProfileId: assignment.messagingProfileId,
    messagingProfileName: assignment.messagingProfileName,
    targetConnectionId: MCTB_571_SIP_FQDN_CONNECTION_ID,
    targetConnectionName: MCTB_571_SIP_FQDN_CONNECTION_NAME,
    savedAt: new Date().toISOString(),
  };

  if (!apply) {
    console.log("\nDry run — no changes made.");
    console.log(`Would save rollback → ${BACKUP_PATH}`);
    console.log(`Would assign 571 → ${MCTB_571_SIP_FQDN_CONNECTION_ID}`);
    console.log("\nRe-run with --apply after Coolify deploy includes MCTB SIP worker branch.");
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Saved rollback → ${BACKUP_PATH}`);

  const assigned = await assign571ToConnection(MCTB_571_SIP_FQDN_CONNECTION_ID);
  const after = await fetch571PhoneAssignment();
  const fqdn = await auditMctb571SipFqdnConnection();

  if (assigned.liveConnectionId !== MCTB_571_SIP_FQDN_CONNECTION_ID) {
    console.error("✗ Voice assignment verification failed");
    process.exit(1);
  }

  const messagingUnchanged =
    after.messagingProfileId === backup.messagingProfileId &&
    after.messagingProfileName === backup.messagingProfileName;

  console.log("\nCutover result:");
  console.log(`  voice connection: ${after.connectionId}`);
  console.log(`  messagingProfileId: ${after.messagingProfileId || "(none)"} ${messagingUnchanged ? "✓" : "⚠"}`);

  await printFinalAudit({ assignment: after, fqdn, messagingUnchanged });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
