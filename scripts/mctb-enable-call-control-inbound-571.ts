/**
 * Enable inbound late-media settings on MCTB 571 Call Control diagnostic app
 * (3031983555518399856) — NOT the LiveKit FQDN SIP connection.
 *
 * Telnyx API reality (verified 2026-08-22):
 * - third_party_control_enabled: PATCH accepted on Call Control; may not appear in GET
 * - prack_enabled / generate_ringback_tone: SIP connection fields only; Call Control PATCH
 *   returns 200 but silently drops these fields
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-enable-call-control-inbound-571.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-enable-call-control-inbound-571.ts --apply
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { fetchTelnyxPhoneNumberByE164 } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  MCTB_571_CALL_CONTROL_DIAG_APP_ID,
  TELNYX_INBOUND_PRACK_API_FIELD,
  TELNYX_INBOUND_RINGBACK_API_FIELD,
  TELNYX_THIRD_PARTY_CONTROL_API_FIELD,
  fetchConnectionLateMediaSettings,
} from "@/lib/mctb/consent-prompt/telnyx-3pcc";

const apply = process.argv.includes("--apply");
const TARGET_CODECS = ["G711U", "G711A", "G722"];

function formatBool(value: boolean | null): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "(not returned by API GET)";
}

async function main() {
  console.log("\n══ MCTB 571 Call Control inbound late-media enable ══\n");

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  const liveConnectionId = String(pn?.connection_id || "");
  const liveConnectionName = String(pn?.connection_name || "");

  console.log("571 phone assignment:");
  console.log(`  live connection: ${liveConnectionId} (${liveConnectionName || "unknown"})`);
  console.log(`  target Call Control: ${MCTB_571_CALL_CONTROL_DIAG_APP_ID}`);
  if (liveConnectionId !== MCTB_571_CALL_CONTROL_DIAG_APP_ID) {
    console.warn(
      "\n⚠️  571 is NOT currently assigned to the Call Control diagnostic app.",
    );
    console.warn(
      "   Webhook logs may reference Call Control from a prior cutover, but inbound PSTN",
    );
    console.warn(
      "   hits whatever connection 571 is assigned to right now (see live connection above).",
    );
    console.warn(
      "   Cut over first: npm run setup:mctb-call-control-571 -- --apply",
    );
  }

  const before = await fetchConnectionLateMediaSettings(MCTB_571_CALL_CONTROL_DIAG_APP_ID);
  console.log("\nBEFORE (Call Control diagnostic):");
  console.log(`  name: ${before.connectionName}`);
  console.log(`  kind: ${before.kind}`);
  console.log(`  ${TELNYX_THIRD_PARTY_CONTROL_API_FIELD}: ${formatBool(before.settings.thirdPartyControlEnabled)}`);
  console.log(`  ${TELNYX_INBOUND_PRACK_API_FIELD}: ${formatBool(before.settings.prackEnabled)}`);
  console.log(`  ${TELNYX_INBOUND_RINGBACK_API_FIELD}: ${formatBool(before.settings.generateRingbackTone)}`);
  console.log(`  codecs: ${before.settings.codecs?.join(", ") || "(none)"}`);
  console.log(`  supports SIP inbound late-media fields: ${before.settings.supportsSipInboundLateMediaFields ? "yes" : "no"}`);

  const alreadyReady =
    before.settings.thirdPartyControlEnabled === true &&
    before.settings.codecs?.[0] === "G711U";

  if (!apply) {
    console.log("\nDry run — would PATCH Call Control app:");
    console.log(`  PATCH /call_control_applications/${MCTB_571_CALL_CONTROL_DIAG_APP_ID}`);
    console.log(
      JSON.stringify(
        {
          [TELNYX_THIRD_PARTY_CONTROL_API_FIELD]: true,
          inbound: {
            [TELNYX_INBOUND_PRACK_API_FIELD]: true,
            [TELNYX_INBOUND_RINGBACK_API_FIELD]: true,
            instant_ringback_enabled: false,
            codecs: TARGET_CODECS,
          },
        },
        null,
        2,
      ),
    );
    console.log(
      "\nNote: prack/ringback in inbound{} are best-effort on Call Control — Telnyx API",
    );
    console.log(
      "may accept but not persist them. Those fields are documented for SIP connections only.",
    );
    console.log("\nRe-run with --apply to send PATCH.");
    return;
  }

  await telnyxRequest(
    `/call_control_applications/${encodeURIComponent(MCTB_571_CALL_CONTROL_DIAG_APP_ID)}`,
    {
      method: "PATCH",
      body: {
        [TELNYX_THIRD_PARTY_CONTROL_API_FIELD]: true,
        inbound: {
          [TELNYX_INBOUND_PRACK_API_FIELD]: true,
          [TELNYX_INBOUND_RINGBACK_API_FIELD]: true,
          instant_ringback_enabled: false,
          codecs: TARGET_CODECS,
        },
      },
    },
  );

  const after = await fetchConnectionLateMediaSettings(MCTB_571_CALL_CONTROL_DIAG_APP_ID);
  console.log("\nAFTER (Call Control diagnostic):");
  console.log(`  ${TELNYX_THIRD_PARTY_CONTROL_API_FIELD}: ${formatBool(after.settings.thirdPartyControlEnabled)}`);
  console.log(`  ${TELNYX_INBOUND_PRACK_API_FIELD}: ${formatBool(after.settings.prackEnabled)}`);
  console.log(`  ${TELNYX_INBOUND_RINGBACK_API_FIELD}: ${formatBool(after.settings.generateRingbackTone)}`);
  console.log(`  codecs: ${after.settings.codecs?.join(", ") || "(none)"}`);

  if (after.settings.thirdPartyControlEnabled === true) {
    console.log("\n✓ third_party_control_enabled readable as true");
  } else {
    console.log("\n✓ third_party_control_enabled PATCH sent (not readable via GET — confirm in portal)");
  }

  if (after.settings.prackEnabled !== true || after.settings.generateRingbackTone !== true) {
    console.log("\n⚠️  prack_enabled / generate_ringback_tone are NOT exposed on Call Control apps.");
    console.log("   Telnyx documents these under SIP Connection inbound settings only.");
    console.log("   For 183+SDP on delayed-offer INVITEs, options are:");
    console.log("   1) Route 571 through a SIP connection (FQDN) with those flags ON, or");
    console.log("   2) Confirm in Telnyx portal whether Call Control has equivalent toggles, or");
    console.log("   3) Use EVENT_ONLY (no answer) path — SMS independent of SIP late-media.");
  } else {
    console.log("\n✓ prack + generate_ringback_tone verified on Call Control");
  }

  if (after.settings.codecs?.[0] === "G711U") {
    console.log("✓ codecs reordered with G711U first");
  }

  if (liveConnectionId !== MCTB_571_CALL_CONTROL_DIAG_APP_ID) {
    console.log("\nNEXT: assign 571 to Call Control before physical test:");
    console.log("  npm run setup:mctb-call-control-571 -- --apply");
  } else if (alreadyReady && after.settings.codecs?.[0] === "G711U") {
    console.log("\nCALL CONTROL INBOUND SETTINGS APPLIED — READY FOR PHYSICAL TEST");
  } else {
    console.log("\nCALL CONTROL PATCH APPLIED — confirm portal + assign 571 if needed");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
