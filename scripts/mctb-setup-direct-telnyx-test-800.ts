/**
 * Assign Telnyx TFN (+18663464256) on FQDN SIP for direct-path test.
 * Patches FQDN webhook to /api/telnyx/voice/mctb-direct-telnyx-test — does NOT remove LiveKit destination.
 *
 * Prerequisite: deploy transovo-web with mctb-direct-telnyx-test route.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-direct-telnyx-test-800.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-direct-telnyx-test-800.ts --apply
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MCTB_PLATFORM_DEMO_E164, MCTB_TELNYX_FQDN_TEST_E164 } from "@/lib/mctb/onboarding/constants";
import { fetchTelnyxPhoneNumberByE164 } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  assignE164ToConnection,
  fetchFqdnConnectionRaw,
  mctbDirectTelnyxTestWebhookUrl,
  patchFqdnDirectTestWebhook,
  prepareFqdnForDirectTelnyxTest,
  verifyDirectTelnyxTestRoute,
} from "@/lib/mctb/direct-telnyx-test/telnyx-fqdn-route";
import { MCTB_571_SIP_FQDN_CONNECTION_ID, MCTB_571_SIP_FQDN_CONNECTION_NAME } from "@/lib/mctb/sip-diagnostic/constants";

const BACKUP_PATH = join(process.cwd(), ".mctb-direct-telnyx-test-800-backup.json");
const apply = process.argv.includes("--apply");
const TEST_E164 = MCTB_TELNYX_FQDN_TEST_E164;

type Backup = {
  testE164: string;
  providerNumberId: string;
  previousConnectionId: string;
  previousConnectionName: string;
  fqdnConnectionId: string;
  previousFqdnWebhookUrl: string | null;
  targetWebhookUrl: string;
  platform571ConnectionId: string | null;
  savedAt: string;
};

function formatBool(v: boolean | null): string {
  if (v === true) return "ON";
  if (v === false) return "OFF";
  return "unknown";
}

async function main() {
  console.log("\n══ MCTB Direct Telnyx Test — 855 TFN on FQDN SIP (no LiveKit) ══\n");
  console.log(`Test number:     ${TEST_E164}`);
  console.log(`FQDN connection: ${MCTB_571_SIP_FQDN_CONNECTION_NAME} (${MCTB_571_SIP_FQDN_CONNECTION_ID})`);
  console.log(`Webhook target:  ${mctbDirectTelnyxTestWebhookUrl()}`);
  console.log(`No env vars required — gated by test DID only.\n`);

  const pn571 = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  const platform571ConnectionId = pn571?.connection_id ? String(pn571.connection_id) : null;
  if (platform571ConnectionId === MCTB_571_SIP_FQDN_CONNECTION_ID) {
    console.warn(
      `⚠️  Platform 571 (${MCTB_PLATFORM_DEMO_E164}) is currently on the same FQDN connection.`,
    );
    console.warn(
      "   Patching FQDN webhook affects 571 too. Move 571 off FQDN before --apply, or accept shared webhook during test.",
    );
  } else {
    console.log(`✓ Platform 571 is NOT on FQDN (connection=${platform571ConnectionId || "(none)"})`);
  }

  const testPn = await fetchTelnyxPhoneNumberByE164(TEST_E164);
  if (!testPn?.id) {
    console.error(`Test number ${TEST_E164} not found in Telnyx account`);
    process.exit(1);
  }

  const fqdnBefore = await fetchFqdnConnectionRaw();
  const previousFqdnWebhookUrl = fqdnBefore?.webhook_event_url
    ? String(fqdnBefore.webhook_event_url)
    : fqdnBefore?.webhook_url
      ? String(fqdnBefore.webhook_url)
      : null;

  const { lateMediaPatched, audit } = await prepareFqdnForDirectTelnyxTest();
  console.log("FQDN late-media:");
  console.log(`  3PCC:           ${formatBool(audit.thirdPartyControlEnabled)}`);
  console.log(`  PRACK:          ${formatBool(audit.prackEnabled)}`);
  console.log(`  Ringback:       ${formatBool(audit.generateRingbackTone)}`);
  console.log(`  lateMediaReady: ${audit.lateMediaReady ? "YES" : "NO"}`);
  console.log(`  destinations:   ${audit.fqdnDestinations.join(", ") || "(none)"}`);
  if (lateMediaPatched) console.log("  (late-media flags were patched)");

  if (!audit.lateMediaReady && !apply) {
    console.log("\nDry run — would enable 3PCC + PRACK + ringback on FQDN.");
  } else if (!audit.lateMediaReady) {
    console.error("\n✗ FQDN late-media not ready after PATCH");
    process.exit(1);
  }

  const currentConnectionId = String(testPn.connection_id || "");
  const currentConnectionName = String(testPn.connection_name || "");

  console.log("\nCurrent test number assignment:");
  console.log(`  connectionId:   ${currentConnectionId}`);
  console.log(`  connectionName: ${currentConnectionName || "(none)"}`);
  console.log(`  FQDN webhook:   ${previousFqdnWebhookUrl || "(none)"}`);

  const backup: Backup = {
    testE164: TEST_E164,
    providerNumberId: String(testPn.id),
    previousConnectionId: currentConnectionId,
    previousConnectionName: currentConnectionName,
    fqdnConnectionId: MCTB_571_SIP_FQDN_CONNECTION_ID,
    previousFqdnWebhookUrl,
    targetWebhookUrl: mctbDirectTelnyxTestWebhookUrl(),
    platform571ConnectionId,
    savedAt: new Date().toISOString(),
  };

  const alreadyReady = await verifyDirectTelnyxTestRoute(TEST_E164);
  if (alreadyReady.ok) {
    console.log("\n✓ Direct Telnyx test route already configured.");
    console.log("\nREADY FOR PHYSICAL CONDITIONAL-FORWARD TEST (FQDN 3PCC, no LiveKit)");
    console.log("See docs/MCTB-DIRECT-TELNYX-LIVE-TEST.md");
    return;
  }

  if (!apply) {
    console.log("\nDry run — no changes made.");
    console.log(`Would save backup → ${BACKUP_PATH}`);
    console.log(`Would assign ${TEST_E164} → FQDN ${MCTB_571_SIP_FQDN_CONNECTION_ID}`);
    console.log(`Would PATCH FQDN webhook → ${backup.targetWebhookUrl}`);
    console.log("\nRe-run with --apply after deploying transovo-web.");
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Saved backup → ${BACKUP_PATH}`);

  await patchFqdnDirectTestWebhook();
  console.log("✓ FQDN webhook patched to direct-test endpoint");

  await assignE164ToConnection(TEST_E164, MCTB_571_SIP_FQDN_CONNECTION_ID);
  console.log(`✓ ${TEST_E164} assigned to FQDN connection`);

  const verify = await verifyDirectTelnyxTestRoute(TEST_E164);
  if (!verify.ok) {
    console.error(`✗ Verification failed: ${verify.detail}`);
    process.exit(1);
  }

  console.log("\n✓ Direct Telnyx test route configured");
  console.log("\nREADY FOR PHYSICAL CONDITIONAL-FORWARD TEST (FQDN 3PCC, no LiveKit)");
  console.log("Rollback:");
  console.log(
    "  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-direct-telnyx-test-800.ts --apply",
  );
  console.log("\nLive test runbook: docs/MCTB-DIRECT-TELNYX-LIVE-TEST.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
