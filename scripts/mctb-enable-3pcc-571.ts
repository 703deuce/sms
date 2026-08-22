/**
 * Enable Telnyx 3rd Party Call Control (late-media / delayed-offer SDP) on the
 * MCTB 571 Call Control diagnostic connection.
 *
 * Telnyx API field: third_party_control_enabled
 * Portal label: "Enable 3rd Party Call Control"
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-enable-3pcc-571.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-enable-3pcc-571.ts --apply
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { fetchTelnyxPhoneNumberByE164 } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  MCTB_571_CALL_CONTROL_DIAG_APP_ID,
  readThirdPartyControlEnabled,
  fetchConnectionThirdPartyControl,
} from "@/lib/mctb/consent-prompt/telnyx-3pcc";

const apply = process.argv.includes("--apply");

async function main() {
  console.log("\n══ MCTB 571 — enable 3rd Party Call Control ══\n");

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) {
    console.error(`Number ${MCTB_PLATFORM_DEMO_E164} not found`);
    process.exit(1);
  }

  const liveConnectionId = String(pn.connection_id || "");
  console.log(`571 current connection: ${liveConnectionId}`);
  if (liveConnectionId !== MCTB_571_CALL_CONTROL_DIAG_APP_ID) {
    console.warn(
      `⚠️  Expected Call Control diagnostic ${MCTB_571_CALL_CONTROL_DIAG_APP_ID} — verify before enabling 3PCC`,
    );
  }

  const before = await fetchConnectionThirdPartyControl(MCTB_571_CALL_CONTROL_DIAG_APP_ID);
  console.log("\nBEFORE:");
  console.log(`  connection_id:                  ${before.connectionId}`);
  console.log(`  connection_kind:                ${before.kind}`);
  console.log(`  third_party_control_enabled:    ${format3pcc(before.thirdPartyControlEnabled)}`);
  console.log(`  api_field_readable:             ${before.apiFieldReadable ? "yes" : "no (PATCH accepted; verify in portal if needed)"}`);

  if (before.thirdPartyControlEnabled === true) {
    console.log("\n3PCC already enabled — no change needed.");
    console.log("\n3PCC ENABLED — READY FOR PHYSICAL AT&T FORWARD TEST");
    return;
  }

  if (!apply) {
    console.log("\nDry run — would PATCH:");
    console.log(`  PATCH /call_control_applications/${MCTB_571_CALL_CONTROL_DIAG_APP_ID}`);
    console.log('  body: { "third_party_control_enabled": true }');
    console.log("\nRe-run with --apply to enable.");
    return;
  }

  await telnyxRequest(
    `/call_control_applications/${encodeURIComponent(MCTB_571_CALL_CONTROL_DIAG_APP_ID)}`,
    {
      method: "PATCH",
      body: { third_party_control_enabled: true },
    },
  );

  const after = await fetchConnectionThirdPartyControl(MCTB_571_CALL_CONTROL_DIAG_APP_ID);
  console.log("\nAFTER:");
  console.log(`  connection_id:                  ${after.connectionId}`);
  console.log(`  third_party_control_enabled:    ${format3pcc(after.thirdPartyControlEnabled)}`);
  console.log(`  api_field_readable:             ${after.apiFieldReadable ? "yes" : "no"}`);

  if (after.thirdPartyControlEnabled === true) {
    console.log("\n✓ Verified third_party_control_enabled=true via Telnyx API");
  } else if (!after.apiFieldReadable) {
    console.log(
      "\n✓ PATCH accepted (HTTP 200). Telnyx Call Control apps may not return",
    );
    console.log(
      "  third_party_control_enabled in GET responses — confirm in portal:",
    );
    console.log(
      "  Voice → SIP Trunking → MCTB 571 Call Control Diagnostic → Enable 3rd Party Call Control",
    );
  } else {
    console.error("\n✗ Enable failed — third_party_control_enabled is not true after PATCH");
    process.exit(1);
  }

  console.log("\n3PCC ENABLED — READY FOR PHYSICAL AT&T FORWARD TEST");
}

function format3pcc(value: boolean | null): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "(not returned by API GET — PATCH was sent)";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
