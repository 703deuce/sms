/**
 * Assign +15714073615 to MCTB Event Only Call Control app (Existing Consent — no voice media).
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-571-event-only.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-571-event-only.ts --apply
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  assign571ToConnection,
  classifyTelnyxConnectionId,
  fetchTelnyxPhoneNumberByE164,
} from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  ensureMctb571EventOnlyCallControlApplication,
  mctb571EventOnlyWebhookUrl,
  verify571EventOnlyRoute,
} from "@/lib/mctb/consent-prompt/telnyx-event-only-route";

const BACKUP_PATH = join(process.cwd(), ".mctb-571-event-only-backup.json");
const apply = process.argv.includes("--apply");

type Backup = {
  e164: string;
  providerNumberId: string;
  previousConnectionId: string;
  previousConnectionName: string;
  previousConnectionKind: string;
  savedAt: string;
};

async function main() {
  console.log("\n══ MCTB 571 EVENT_ONLY setup ══\n");

  const appId = await ensureMctb571EventOnlyCallControlApplication();
  const webhook = mctb571EventOnlyWebhookUrl();

  console.log("Event Only Call Control app:");
  console.log(`  App ID:  ${appId}`);
  console.log(`  Webhook: ${webhook}`);

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) {
    console.error(`Number ${MCTB_PLATFORM_DEMO_E164} not found`);
    process.exit(1);
  }

  const currentConnectionId = String(pn.connection_id || "");
  const currentConnectionName = String(pn.connection_name || "");
  const currentKind = await classifyTelnyxConnectionId(currentConnectionId);

  console.log("\nCurrent 571 assignment:");
  console.log(`  Connection ID:   ${currentConnectionId}`);
  console.log(`  Connection name: ${currentConnectionName}`);
  console.log(`  Kind:            ${currentKind}`);

  if (currentConnectionId === appId) {
    console.log("\n571 already on Event Only app.");
    const verify = await verify571EventOnlyRoute();
    console.log(verify.ok ? "✓ Verified" : `⚠ ${verify.detail}`);
    console.log("\nREADY FOR EXISTING CONSENT EVENT-ONLY PHYSICAL TEST");
    return;
  }

  const backup: Backup = {
    e164: MCTB_PLATFORM_DEMO_E164,
    providerNumberId: String(pn.id),
    previousConnectionId: currentConnectionId,
    previousConnectionName: currentConnectionName,
    previousConnectionKind: currentKind,
    savedAt: new Date().toISOString(),
  };

  if (!apply) {
    console.log("\nDry run — no changes made.");
    console.log(`Would save backup → ${BACKUP_PATH}`);
    console.log(`Would assign 571 → Event Only app ${appId}`);
    console.log("\nRe-run with --apply after production deploy is healthy.");
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Saved backup → ${BACKUP_PATH}`);

  const assigned = await assign571ToConnection(appId);
  const verify = await verify571EventOnlyRoute();

  console.log("\nCutover result:");
  console.log(`  571 connection: ${assigned.liveConnectionId}`);
  console.log(verify.ok ? "✓ 571 on Event Only app" : `✗ ${verify.detail}`);

  if (!verify.ok) process.exit(1);

  const prisma = getPrisma();
  const localPn = await prisma.phoneNumber.findFirst({
    where: { e164: MCTB_PLATFORM_DEMO_E164 },
    select: { id: true, settingsJson: true, workspaceId: true },
  });
  if (localPn) {
    const settings =
      localPn.settingsJson && typeof localPn.settingsJson === "object"
        ? { ...(localPn.settingsJson as Record<string, unknown>) }
        : {};
    const telephony =
      settings.telephony && typeof settings.telephony === "object"
        ? { ...(settings.telephony as Record<string, unknown>) }
        : {};
    telephony.routingMode = "call_control_event_only";
    telephony.lastProvisionedAt = new Date().toISOString();
    settings.telephony = telephony;
    await prisma.phoneNumber.update({
      where: { id: localPn.id },
      data: { settingsJson: settings },
    });
    console.log(`✓ Phone settings routingMode → call_control_event_only (ws ${localPn.workspaceId})`);
  }

  console.log("\nREADY FOR MCTB CALL CONTROL TEST (571 → mctb-event-only, no LiveKit)");
  console.log(
    "Rollback: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-571-event-only.ts --apply",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
