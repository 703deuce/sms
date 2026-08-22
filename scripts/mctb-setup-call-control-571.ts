/**
 * Assign +15714073615 to MCTB Call Control diagnostic app (reversible).
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-call-control-571.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-call-control-571.ts --apply
 *
 * IMPORTANT: Deploy /api/telnyx/voice/mctb-call-control to production BEFORE --apply.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_571_CONSENT_TEXML_APP_ID } from "@/lib/mctb/consent-prompt/telnyx-texml-route";
import {
  assign571ToConnection,
  classifyTelnyxConnectionId,
  ensureMctb571CallControlDiagnosticApplication,
  fetchTelnyxPhoneNumberByE164,
  mctb571CallControlDiagnosticWebhookUrl,
  verify571CallControlDiagnosticRoute,
} from "@/lib/mctb/consent-prompt/telnyx-call-control-route";

const BACKUP_PATH = join(process.cwd(), ".mctb-571-voice-backup.json");
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
  console.log("\n══ MCTB 571 Call Control diagnostic setup ══\n");

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) {
    console.error(`Number ${MCTB_PLATFORM_DEMO_E164} not found in Telnyx`);
    process.exit(1);
  }

  const providerNumberId = String(pn.id);
  const currentConnectionId = String(pn.connection_id || "");
  const currentConnectionName = String(pn.connection_name || "");
  const currentKind = await classifyTelnyxConnectionId(currentConnectionId);

  console.log("Current assignment:");
  console.log(`  E164:           ${MCTB_PLATFORM_DEMO_E164}`);
  console.log(`  Provider ID:    ${providerNumberId}`);
  console.log(`  Connection ID:  ${currentConnectionId}`);
  console.log(`  Connection name:${currentConnectionName}`);
  console.log(`  Kind:           ${currentKind}`);
  console.log(`  Expected TeXML: ${MCTB_571_CONSENT_TEXML_APP_ID}`);

  const diagAppId = await ensureMctb571CallControlDiagnosticApplication();
  const webhookUrl = mctb571CallControlDiagnosticWebhookUrl();

  console.log("\nDiagnostic Call Control app:");
  console.log(`  App ID:         ${diagAppId}`);
  console.log(`  Webhook URL:    ${webhookUrl}`);

  if (currentConnectionId === diagAppId) {
    console.log("\n571 is already on the Call Control diagnostic app.");
    const verify = await verify571CallControlDiagnosticRoute();
    console.log(verify.ok ? "✓ Verified" : `⚠ ${verify.detail}`);
    return;
  }

  const backup: Backup = {
    e164: MCTB_PLATFORM_DEMO_E164,
    providerNumberId,
    previousConnectionId: currentConnectionId,
    previousConnectionName: currentConnectionName,
    previousConnectionKind: currentKind,
    savedAt: new Date().toISOString(),
  };

  if (!apply) {
    console.log("\nDry run — no changes made.");
    console.log(`Would save backup to ${BACKUP_PATH}`);
    console.log(`Would assign 571 → Call Control app ${diagAppId}`);
    console.log("\nRe-run with --apply after production deploy is healthy.");
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Saved backup → ${BACKUP_PATH}`);

  const assigned = await assign571ToConnection(diagAppId);
  const verify = await verify571CallControlDiagnosticRoute();

  console.log("\nCutover result:");
  console.log(`  Live connection: ${assigned.liveConnectionId}`);
  console.log(verify.ok ? "✓ Verified on Call Control diagnostic" : `✗ ${verify.detail}`);

  if (!verify.ok) process.exit(1);

  console.log("\nREADY FOR ONE PHYSICAL AT&T CONDITIONAL-FORWARD TEST");
  console.log("Rollback: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-call-control-571.ts --apply");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
