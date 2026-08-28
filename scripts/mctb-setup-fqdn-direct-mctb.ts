/**
 * Wire 866 toll-free to Call Control app (3PCC) → mctb-event-only.
 * Reference FQDN keeps PRACK/ringback flags for audit only (not PSTN assignment).
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
  assignE164ToCallControlApp,
  ensureMctbFqdnDirectConnection,
  fetchFqdnConnectionRaw,
  listTelnyxTollFreeCandidates,
  mctbFqdnDirectEventOnlyWebhookUrl,
  mctbLiveKitFqdnWebhookUrl,
  prepareFqdnForDirectMctb,
  resolveFqdnDirectTestE164,
  restoreLiveKitFqdnForProduction,
  verifyFqdnDirectMctbRoute,
} from "@/lib/mctb/sip-diagnostic/fqdn-direct-setup";
import {
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_571_SIP_FQDN_CONNECTION_NAME,
  MCTB_866_DIRECT_CALL_CONTROL_APP_NAME,
  MCTB_FQDN_DIRECT_CONNECTION_NAME,
} from "@/lib/mctb/sip-diagnostic/constants";

const BACKUP_PATH = join(process.cwd(), ".mctb-fqdn-direct-mctb-backup.json");
const apply = process.argv.includes("--apply");

type Backup = {
  testE164: string;
  providerNumberId: string;
  previousConnectionId: string;
  previousConnectionName: string;
  callControlAppId: string;
  referenceFqdnConnectionId: string;
  livekitFqdnConnectionId: string;
  previousLivekitFqdnWebhookUrl: string | null;
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
  const direct = await ensureMctbFqdnDirectConnection();

  console.log("\n══ MCTB 866 Direct — Call Control (no LiveKit) ══\n");
  console.log(`Test toll-free:       ${testE164} (NOT ${MCTB_PLATFORM_DEMO_E164})`);
  console.log(`Call Control app:     ${MCTB_866_DIRECT_CALL_CONTROL_APP_NAME}`);
  console.log(`Reference FQDN:       ${MCTB_FQDN_DIRECT_CONNECTION_NAME} (${direct.connectionId})`);
  console.log(`LiveKit FQDN (571):   ${MCTB_571_SIP_FQDN_CONNECTION_NAME} (${MCTB_571_SIP_FQDN_CONNECTION_ID})`);
  console.log(`Webhook target:       ${mctbFqdnDirectEventOnlyWebhookUrl()}`);
  console.log(`Reference FQDN dests: ${direct.fqdnDestinations.join(", ") || "(none — not used for PSTN)"}`);
  console.log(`Telnyx TFNs:          ${candidates.map((c) => `${c.e164} → ${c.connectionName || c.connectionId}`).join(", ") || "(none)"}\n`);

  const testPn = await fetchTelnyxPhoneNumberByE164(testE164);
  if (!testPn?.id) {
    console.error(`Test number ${testE164} not found in Telnyx account`);
    process.exit(1);
  }

  const livekitFqdnBefore = await fetchFqdnConnectionRaw(MCTB_571_SIP_FQDN_CONNECTION_ID);
  const previousLivekitFqdnWebhookUrl = livekitFqdnBefore?.webhook_event_url
    ? String(livekitFqdnBefore.webhook_event_url)
    : livekitFqdnBefore?.webhook_url
      ? String(livekitFqdnBefore.webhook_url)
      : null;

  const { lateMediaPatched, callControlAppId, referenceFqdnConnectionId, media } =
    await prepareFqdnForDirectMctb();
  console.log("Late-media / signaling:");
  console.log(`  3PCC (Call Control): ${formatBool(media.thirdPartyControlEnabled)}`);
  console.log(`  PRACK (ref FQDN):    ${formatBool(media.prackEnabled)}`);
  console.log(`  Ringback (ref FQDN): ${formatBool(media.generateRingbackTone)}`);
  console.log(`  lateMediaReady:      ${media.lateMediaReady ? "YES" : "NO"}`);
  console.log(`  Note:                ${media.note}`);
  if (lateMediaPatched) console.log("  (reference FQDN late-media flags were patched)");

  if (!media.lateMediaReady && apply) {
    console.error("\n✗ 3PCC not enabled on Call Control app after PATCH");
    process.exit(1);
  }

  const currentConnectionId = String(testPn.connection_id || "");
  const currentConnectionName = String(testPn.connection_name || "");

  const backup: Backup = {
    testE164,
    providerNumberId: String(testPn.id),
    previousConnectionId: currentConnectionId,
    previousConnectionName: currentConnectionName,
    callControlAppId,
    referenceFqdnConnectionId,
    livekitFqdnConnectionId: MCTB_571_SIP_FQDN_CONNECTION_ID,
    previousLivekitFqdnWebhookUrl,
    savedAt: new Date().toISOString(),
  };

  const ready = await verifyFqdnDirectMctbRoute();
  if (ready.ok) {
    console.log("\n✓ 866 direct MCTB route already configured.");
    if (
      previousLivekitFqdnWebhookUrl &&
      previousLivekitFqdnWebhookUrl.includes("mctb-event-only")
    ) {
      console.log("\n⚠ LiveKit FQDN webhook still points at mctb-event-only — run --apply to restore.");
    }
    console.log(`\nForward your business line to: ${ready.testE164}`);
    console.log("\nREADY FOR CONDITIONAL-FORWARD TEST");
    return;
  }

  if (!apply) {
    console.log("\nDry run — no changes made.");
    console.log(`Would save backup → ${BACKUP_PATH}`);
    console.log(`Would assign ${testE164} → ${MCTB_866_DIRECT_CALL_CONTROL_APP_NAME} (${callControlAppId})`);
    console.log(`Would restore LiveKit FQDN webhook → ${mctbLiveKitFqdnWebhookUrl()}`);
    console.log(`\nCurrent: ${ready.detail}`);
    console.log("\nRe-run with --apply after deploying transovo-web.");
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Saved backup → ${BACKUP_PATH}`);

  await restoreLiveKitFqdnForProduction(mctbLiveKitFqdnWebhookUrl());
  console.log(`✓ LiveKit FQDN webhook restored → ${mctbLiveKitFqdnWebhookUrl()}`);

  await assignE164ToCallControlApp(testE164, callControlAppId);
  console.log(`✓ ${testE164} assigned to ${MCTB_866_DIRECT_CALL_CONTROL_APP_NAME}`);

  const verify = await verifyFqdnDirectMctbRoute();
  if (!verify.ok) {
    console.error(`✗ Verification failed: ${verify.detail}`);
    process.exit(1);
  }

  console.log("\n✓ 866 direct MCTB route configured");
  console.log(`\nForward your business line to: ${verify.testE164}`);
  console.log("\nREADY FOR CONDITIONAL-FORWARD TEST (Call Control answer, no LiveKit)");
  console.log("Rollback: npm run rollback:mctb-fqdn-direct-mctb -- --apply");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
