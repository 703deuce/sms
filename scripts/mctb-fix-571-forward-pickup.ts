#!/usr/bin/env npx tsx
/**
 * Fix MCTB 571 forwarded-call pickup:
 * - AT&T no-answer forwards cancel in ~1–2s (Diversion header).
 * - TeXML voice_url fetch is too slow → SIP 480, no pickup.
 * - Call Control + 3PCC answers with 183 while webhook runs → press-1 on mctb-event-only.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-fix-571-forward-pickup.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-fix-571-forward-pickup.ts --apply
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  classifyTelnyxConnectionId,
  fetchTelnyxPhoneNumberByE164,
} from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  ensureMctb571EventOnlyCallControlApplication,
  mctb571EventOnlyWebhookUrl,
  verify571EventOnlyRoute,
  assign571ToConnection,
} from "@/lib/mctb/consent-prompt/telnyx-event-only-route";
import { TELNYX_THIRD_PARTY_CONTROL_API_FIELD } from "@/lib/mctb/consent-prompt/telnyx-3pcc";
import { fetchCallControlAppRaw } from "@/lib/mctb/sip-diagnostic/fqdn-direct-setup";

const BACKUP_PATH = join(process.cwd(), ".mctb-571-forward-pickup-backup.json");
const apply = process.argv.includes("--apply");

async function main() {
  console.log("\n══ MCTB 571 forwarded-call pickup fix ══\n");
  console.log(
    "Root cause: TeXML voice_url HTTP fetch cannot answer AT&T forwards in ~1–2s.",
  );
  console.log(
    "Fix: Call Control (mctb-event-only) + 3PCC → 183/progress while we answer + press-1.\n",
  );

  const eventOnlyAppId = await ensureMctb571EventOnlyCallControlApplication();
  const webhookUrl = mctb571EventOnlyWebhookUrl();

  const ccBefore = await fetchCallControlAppRaw(eventOnlyAppId);
  console.log("Event Only Call Control app:");
  console.log(`  id:      ${eventOnlyAppId}`);
  console.log(`  webhook: ${webhookUrl}`);
  console.log(
    `  3PCC:    ${ccBefore?.[TELNYX_THIRD_PARTY_CONTROL_API_FIELD] ?? "(not returned by GET — will PATCH)"}`,
  );

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) {
    console.error(`Number ${MCTB_PLATFORM_DEMO_E164} not found`);
    process.exit(1);
  }

  const currentConnectionId = String(pn.connection_id || "");
  const currentConnectionName = String(pn.connection_name || "");
  const currentKind = await classifyTelnyxConnectionId(currentConnectionId);

  console.log("\n571 current assignment:");
  console.log(`  connection: ${currentConnectionId} (${currentConnectionName}, ${currentKind})`);
  console.log(`  target:     ${eventOnlyAppId} (MCTB 866 Direct Test / event-only)`);

  if (!apply) {
    console.log("\nDry run — would:");
    console.log(`  1. PATCH Call Control app ${eventOnlyAppId} → 3PCC on, first_command_timeout 30s`);
    console.log(`  2. Assign 571 → ${eventOnlyAppId}`);
    console.log(`  3. Save backup → ${BACKUP_PATH}`);
    console.log("\nRe-run with --apply to cut over.");
    return;
  }

  const backup = {
    e164: MCTB_PLATFORM_DEMO_E164,
    providerNumberId: String(pn.id),
    previousConnectionId: currentConnectionId,
    previousConnectionName: currentConnectionName,
    previousConnectionKind: currentKind,
    savedAt: new Date().toISOString(),
  };
  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Saved backup → ${BACKUP_PATH}`);

  const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
  await telnyxRequest(`/call_control_applications/${encodeURIComponent(eventOnlyAppId)}`, {
    method: "PATCH",
    body: {
      webhook_event_url: webhookUrl,
      webhook_api_version: "2",
      active: true,
      first_command_timeout: true,
      first_command_timeout_secs: 30,
      [TELNYX_THIRD_PARTY_CONTROL_API_FIELD]: true,
      inbound: {
        codecs: ["G711U", "G711A", "G722"],
      },
    },
  });
  console.log("✓ Patched Event Only Call Control (3PCC + webhook)");

  await assign571ToConnection(eventOnlyAppId);
  const verify = await verify571EventOnlyRoute();
  console.log(verify.ok ? "\n✓ 571 on Event Only Call Control" : `\n✗ ${verify.detail}`);

  if (!verify.ok) process.exit(1);

  console.log("\nREADY — retry your business-line no-answer forward to +15714073615.");
  console.log("Expected: call stays up, press-1 prompt, SMS on 1.");
  console.log(
    "Trace: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-trace-recent-571-calls.ts",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
