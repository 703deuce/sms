/**
 * Wire Telnyx toll-free to same FQDN SIP as LiveKit MCTB — point 3PCC webhook at mctb-event-only.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-fqdn-direct-mctb.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-fqdn-direct-mctb.ts --apply
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { fetchTelnyxPhoneNumberByE164 } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  assignE164ToFqdnConnection,
  fetchFqdnConnectionRaw,
  listTelnyxTollFreeCandidates,
  mctbFqdnDirectEventOnlyWebhookUrl,
  patchFqdnEventOnlyWebhook,
  prepareFqdnForDirectMctb,
  resolveFqdnDirectTestE164,
  verifyFqdnDirectMctbRoute,
} from "@/lib/mctb/sip-diagnostic/fqdn-direct-setup";
import { MCTB_571_SIP_FQDN_CONNECTION_ID, MCTB_571_SIP_FQDN_CONNECTION_NAME } from "@/lib/mctb/sip-diagnostic/constants";

const BACKUP_PATH = join(process.cwd(), ".mctb-fqdn-direct-mctb-backup.json");
const apply = process.argv.includes("--apply");

type Backup = {
  testE164: string;
  providerNumberId: string;
  previousConnectionId: string;
  previousConnectionName: string;
  fqdnConnectionId: string;
  previousFqdnWebhookUrl: string | null;
  targetWebhookUrl: string;
  savedAt: string;
};

function formatBool(v: boolean | null): string {
  if (v === true) return "ON";
  if (v === false) return "OFF";
  return "unknown";
}

async function main() {
  const testE164 = await resolveFqdnDirectTestE164();
  const candidates = await listTelnyxTollFreeCandidates();

  console.log("\n══ MCTB FQDN Direct — same SIP as LiveKit, bypass LiveKit ══\n");
  console.log(`Test toll-free:  ${testE164} (NOT ${MCTB_PLATFORM_DEMO_E164})`);
  console.log(`FQDN connection: ${MCTB_571_SIP_FQDN_CONNECTION_NAME} (${MCTB_571_SIP_FQDN_CONNECTION_ID})`);
  console.log(`Webhook target:  ${mctbFqdnDirectEventOnlyWebhookUrl()} (existing mctb-event-only)`);
  console.log(`Telnyx TFNs:     ${candidates.map((c) => `${c.e164} → ${c.connectionName || c.connectionId}`).join(", ") || "(none)"}\n`);

  const testPn = await fetchTelnyxPhoneNumberByE164(testE164);
  if (!testPn?.id) {
    console.error(`Test number ${testE164} not found in Telnyx account`);
    process.exit(1);
  }

  const fqdnBefore = await fetchFqdnConnectionRaw();
  const previousFqdnWebhookUrl = fqdnBefore?.webhook_event_url
    ? String(fqdnBefore.webhook_event_url)
    : fqdnBefore?.webhook_url
      ? String(fqdnBefore.webhook_url)
      : null;

  const { lateMediaPatched, audit } = await prepareFqdnForDirectMctb();
  console.log("FQDN late-media (unchanged — same as LiveKit path):");
  console.log(`  3PCC:           ${formatBool(audit.thirdPartyControlEnabled)}`);
  console.log(`  PRACK:          ${formatBool(audit.prackEnabled)}`);
  console.log(`  Ringback:       ${formatBool(audit.generateRingbackTone)}`);
  console.log(`  lateMediaReady: ${audit.lateMediaReady ? "YES" : "NO"}`);
  console.log(`  LiveKit FQDN:   ${audit.fqdnDestinations.join(", ") || "(none)"} (unchanged)`);
  if (lateMediaPatched) console.log("  (late-media flags were patched)");

  if (!audit.lateMediaReady && apply) {
    console.error("\n✗ FQDN late-media not ready after PATCH");
    process.exit(1);
  }

  const currentConnectionId = String(testPn.connection_id || "");
  const currentConnectionName = String(testPn.connection_name || "");

  const backup: Backup = {
    testE164,
    providerNumberId: String(testPn.id),
    previousConnectionId: currentConnectionId,
    previousConnectionName: currentConnectionName,
    fqdnConnectionId: MCTB_571_SIP_FQDN_CONNECTION_ID,
    previousFqdnWebhookUrl,
    targetWebhookUrl: mctbFqdnDirectEventOnlyWebhookUrl(),
    savedAt: new Date().toISOString(),
  };

  const ready = await verifyFqdnDirectMctbRoute();
  if (ready.ok) {
    console.log("\n✓ FQDN direct MCTB route already configured.");
    console.log(`\nForward your business line to: ${ready.testE164}`);
    console.log("\nREADY FOR CONDITIONAL-FORWARD TEST (existing MCTB event-only, no LiveKit)");
    return;
  }

  if (!apply) {
    console.log("\nDry run — no changes made.");
    console.log(`Would save backup → ${BACKUP_PATH}`);
    if (currentConnectionId !== MCTB_571_SIP_FQDN_CONNECTION_ID) {
      console.log(`Would assign ${testE164} → FQDN ${MCTB_571_SIP_FQDN_CONNECTION_ID}`);
    }
    console.log(`Would PATCH FQDN webhook → ${backup.targetWebhookUrl}`);
    console.log("\nRe-run with --apply after deploying transovo-web.");
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Saved backup → ${BACKUP_PATH}`);

  await patchFqdnEventOnlyWebhook();
  console.log("✓ FQDN webhook patched to mctb-event-only");

  if (currentConnectionId !== MCTB_571_SIP_FQDN_CONNECTION_ID) {
    await assignE164ToFqdnConnection(testE164);
    console.log(`✓ ${testE164} assigned to FQDN connection`);
  } else {
    console.log(`✓ ${testE164} already on FQDN connection`);
  }

  const verify = await verifyFqdnDirectMctbRoute();
  if (!verify.ok) {
    console.error(`✗ Verification failed: ${verify.detail}`);
    process.exit(1);
  }

  console.log("\n✓ FQDN direct MCTB route configured");
  console.log(`\nForward your business line to: ${verify.testE164}`);
  console.log("\nREADY FOR CONDITIONAL-FORWARD TEST (existing MCTB event-only, no LiveKit)");
  console.log("Rollback: npm run rollback:mctb-fqdn-direct-mctb -- --apply");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
