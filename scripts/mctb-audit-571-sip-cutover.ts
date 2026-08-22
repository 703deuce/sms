/**
 * Read-only audit before MCTB 571 SIP delayed-offer physical test.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-audit-571-sip-cutover.ts
 */
import { MCTB_571_CALL_CONTROL_DIAG_APP_ID } from "@/lib/mctb/consent-prompt/telnyx-3pcc";
import {
  auditMctb571SipFqdnConnection,
  fetch571PhoneAssignment,
} from "@/lib/mctb/sip-diagnostic/fqdn-audit";
import {
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_571_SIP_FQDN_CONNECTION_NAME,
} from "@/lib/mctb/sip-diagnostic/constants";

function formatBool(v: boolean | null): string {
  if (v === true) return "ON";
  if (v === false) return "OFF";
  return "unknown";
}

async function main() {
  console.log("\n══ MCTB 571 SIP delayed-offer pre-cutover audit (read-only) ══\n");

  const assignment = await fetch571PhoneAssignment();
  console.log("571 voice assignment:");
  console.log(`  DID:                 ${assignment.e164}`);
  console.log(`  providerNumberId:    ${assignment.providerNumberId}`);
  console.log(`  connectionId:        ${assignment.connectionId}`);
  console.log(`  connectionName:      ${assignment.connectionName || "(none)"}`);
  console.log(`  connectionType:      ${assignment.connectionKind}`);
  console.log(`  messagingProfileId:  ${assignment.messagingProfileId || "(none)"}`);
  console.log(`  messagingProfileName:${assignment.messagingProfileName || "(none)"}`);

  console.log("\nTarget SIP/FQDN connection:");
  console.log(`  name: ${MCTB_571_SIP_FQDN_CONNECTION_NAME}`);
  console.log(`  id:   ${MCTB_571_SIP_FQDN_CONNECTION_ID}`);

  console.log("\nCall Control diagnostic (NOT used for this test):");
  console.log(`  id: ${MCTB_571_CALL_CONTROL_DIAG_APP_ID}`);

  const fqdn = await auditMctb571SipFqdnConnection();
  console.log("\nSIP/FQDN late-media settings:");
  console.log(`  third_party_control_enabled: ${formatBool(fqdn.thirdPartyControlEnabled)}`);
  console.log(`  prack_enabled:               ${formatBool(fqdn.prackEnabled)}`);
  console.log(`  generate_ringback_tone:      ${formatBool(fqdn.generateRingbackTone)}`);
  console.log(`  lateMediaReady:              ${fqdn.lateMediaReady ? "YES" : "NO"}`);

  console.log("\nSIP/FQDN transport + routing:");
  console.log(`  transportProtocol: ${fqdn.transportProtocol || "(none)"}`);
  console.log(`  encryptedMedia:    ${fqdn.encryptedMedia || "(none)"}`);
  console.log(`  inboundCodecs:     ${fqdn.inboundCodecs.join(", ") || "(none)"}`);
  console.log(`  channelLimit:      ${fqdn.channelLimit ?? "(none)"}`);
  console.log(`  fqdnDestinations:  ${fqdn.fqdnDestinations.join(", ") || "(none)"}`);

  console.log("\nAssessment:");
  if (assignment.connectionId === MCTB_571_SIP_FQDN_CONNECTION_ID) {
    console.log("  571 is already assigned to the SIP/FQDN connection.");
  } else {
    console.log(
      `  571 is on ${assignment.connectionId} (${assignment.connectionKind}) — cutover required.`,
    );
  }
  if (fqdn.lateMediaReady) {
    console.log("  SIP late-media flags are ON — ready for delayed-offer test.");
  } else {
    console.log("  SIP late-media flags incomplete — enable before physical test.");
  }
  console.log("\nNo changes made (read-only audit).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
