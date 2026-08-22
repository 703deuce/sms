/**
 * Assign +15714073615 to existing Transovo LiveKit Inbound SIP (FQDN + 3PCC).
 *
 * Prerequisite: Enable "3rd Party Call Control" on the LiveKit FQDN connection in Telnyx portal.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-livekit-sip-571.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-livekit-sip-571.ts --apply
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  assign571ToConnection,
  classifyTelnyxConnectionId,
  fetchTelnyxPhoneNumberByE164,
} from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  TELNYX_THIRD_PARTY_CONTROL_API_FIELD,
  fetchConnectionThirdPartyControl,
} from "@/lib/mctb/consent-prompt/telnyx-3pcc";
import { findFqdnConnectionByName } from "@/lib/telephony/provisioning/telnyx/sip-connection";
import { TRANSOVO_TELNYX_FQDN_CONNECTION_NAME } from "@/lib/telephony/provisioning/config";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";

/** Known production LiveKit inbound FQDN connection (fallback if name lookup fails). */
export const TRANSOVO_LIVEKIT_INBOUND_FQDN_CONNECTION_ID =
  process.env.TELNYX_LIVEKIT_FQDN_CONNECTION_ID?.trim() || "3022029259041408870";

const BACKUP_PATH = join(process.cwd(), ".mctb-571-voice-backup.json");
const apply = process.argv.includes("--apply");

type Backup = {
  e164: string;
  providerNumberId: string;
  previousConnectionId: string;
  previousConnectionName: string;
  previousConnectionKind: string;
  targetConnectionId: string;
  targetConnectionName: string;
  savedAt: string;
};

async function resolveLiveKitInboundFqdnConnectionId(): Promise<{
  connectionId: string;
  connectionName: string;
}> {
  const byName = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  if (byName?.id) {
    return {
      connectionId: String(byName.id),
      connectionName: String(byName.connection_name || TRANSOVO_TELNYX_FQDN_CONNECTION_NAME),
    };
  }
  const byId = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(TRANSOVO_LIVEKIT_INBOUND_FQDN_CONNECTION_ID)}`,
  );
  const row = byId.data;
  if (!row?.id) {
    throw new Error(
      `LiveKit FQDN connection not found (name=${TRANSOVO_TELNYX_FQDN_CONNECTION_NAME}, id=${TRANSOVO_LIVEKIT_INBOUND_FQDN_CONNECTION_ID})`,
    );
  }
  return {
    connectionId: String(row.id),
    connectionName: String(row.connection_name || TRANSOVO_TELNYX_FQDN_CONNECTION_NAME),
  };
}

async function main() {
  console.log("\n══ MCTB 571 → Transovo LiveKit Inbound SIP (3PCC) ══\n");

  const target = await resolveLiveKitInboundFqdnConnectionId();
  const target3pcc = await fetchConnectionThirdPartyControl(target.connectionId);

  console.log("Target SIP connection:");
  console.log(`  Name:           ${target.connectionName}`);
  console.log(`  ID:             ${target.connectionId}`);
  console.log(`  Kind:           ${target3pcc.kind}`);
  console.log(
    `  ${TELNYX_THIRD_PARTY_CONTROL_API_FIELD}: ${target3pcc.thirdPartyControlEnabled === true ? "true ✓" : target3pcc.thirdPartyControlEnabled === false ? "false ✗ — enable in portal first" : "unknown"}`,
  );

  if (target3pcc.thirdPartyControlEnabled !== true) {
    console.error(
      "\n✗ 3PCC is not enabled on this SIP connection. Enable in Telnyx portal first, then re-run.",
    );
    process.exit(1);
  }

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) {
    console.error(`Number ${MCTB_PLATFORM_DEMO_E164} not found`);
    process.exit(1);
  }

  const providerNumberId = String(pn.id);
  const currentConnectionId = String(pn.connection_id || "");
  const currentConnectionName = String(pn.connection_name || "");
  const currentKind = await classifyTelnyxConnectionId(currentConnectionId);

  console.log("\nCurrent 571 assignment:");
  console.log(`  Connection ID:  ${currentConnectionId}`);
  console.log(`  Connection name:${currentConnectionName}`);
  console.log(`  Kind:           ${currentKind}`);

  if (currentConnectionId === target.connectionId) {
    console.log("\n571 is already on Transovo LiveKit Inbound.");
    console.log("\nREADY FOR PHYSICAL AT&T CONDITIONAL-FORWARD TEST (SIP + 3PCC)");
    return;
  }

  const backup: Backup = {
    e164: MCTB_PLATFORM_DEMO_E164,
    providerNumberId,
    previousConnectionId: currentConnectionId,
    previousConnectionName: currentConnectionName,
    previousConnectionKind: currentKind,
    targetConnectionId: target.connectionId,
    targetConnectionName: target.connectionName,
    savedAt: new Date().toISOString(),
  };

  if (!apply) {
    console.log("\nDry run — no changes made.");
    console.log(`Would save backup → ${BACKUP_PATH}`);
    console.log(`Would assign 571 → ${target.connectionName} (${target.connectionId})`);
    console.log("\nRe-run with --apply to cut over.");
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Saved backup → ${BACKUP_PATH}`);

  const assigned = await assign571ToConnection(target.connectionId);
  const verifyPn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  const liveConnectionId = String(verifyPn?.connection_id || "");

  console.log("\nCutover result:");
  console.log(`  Live connection: ${liveConnectionId}`);
  console.log(`  Expected:        ${target.connectionId}`);

  if (liveConnectionId !== target.connectionId) {
    console.error("✗ Assignment verification failed");
    process.exit(1);
  }

  console.log("✓ 571 assigned to Transovo LiveKit Inbound (SIP + 3PCC)");
  console.log("\nREADY FOR PHYSICAL AT&T CONDITIONAL-FORWARD TEST (SIP + 3PCC)");
  console.log(
    "Rollback: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-call-control-571.ts --apply",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
