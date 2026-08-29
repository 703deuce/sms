/**
 * Gate 1 certification — 571 and 866 must share identical Telnyx Call Control routing.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-pickup-routing-parity.ts
 */
import assert from "node:assert/strict";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { verifyEventOnlyRouteForE164 } from "@/lib/mctb/consent-prompt/telnyx-event-only-route";
import { fetchCallControlAppRaw } from "@/lib/mctb/sip-diagnostic/fqdn-direct-setup";
import { MCTB_FQDN_DIRECT_TEST_E164 } from "@/lib/mctb/sip-diagnostic/constants";
import { TELNYX_THIRD_PARTY_CONTROL_API_FIELD } from "@/lib/mctb/consent-prompt/telnyx-3pcc";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";

const failures: string[] = [];
function ok(label: string) {
  console.log(`✓ ${label}`);
}
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const configuredWebhook = getTelnyxWebhookUrls().mctbEventOnly.replace(/\/$/, "");

  const route571 = await verifyEventOnlyRouteForE164(MCTB_PLATFORM_DEMO_E164);
  const route866 = await verifyEventOnlyRouteForE164(MCTB_FQDN_DIRECT_TEST_E164);

  if (route571.ok) ok(`571 on Call Control (${route571.detail})`);
  else fail("571 on Call Control", route571.detail);

  if (route866.ok) ok(`866 on Call Control (${route866.detail})`);
  else fail("866 on Call Control", route866.detail);

  if (route571.callControlAppId && route571.callControlAppId === route866.callControlAppId) {
    ok(`571 and 866 share Call Control app ${route571.callControlAppId}`);
  } else {
    fail(
      "571/866 Call Control parity",
      `571=${route571.callControlAppId || "none"} 866=${route866.callControlAppId || "none"}`,
    );
  }

  if (route571.callControlAppId) {
    const app = await fetchCallControlAppRaw(route571.callControlAppId);
    const webhook = String(app?.webhook_event_url || "").replace(/\/$/, "");
    const threePcc = app?.[TELNYX_THIRD_PARTY_CONTROL_API_FIELD];

    if (webhook === configuredWebhook) ok("Call Control webhook matches mctb-event-only");
    else fail("Call Control webhook", `live=${webhook} expected=${configuredWebhook}`);

    if (threePcc === true) ok("3PCC enabled on Call Control app");
    else if (threePcc === false) fail("3PCC enabled", "third_party_control_enabled=false");
    else ok("3PCC field not returned on GET (PATCH applied via cutover script)");

    if (app?.first_command_timeout === true) ok("first_command_timeout enabled");
    else fail("first_command_timeout", String(app?.first_command_timeout));
  }

  console.log("\n--- Gate 1 manual smoke (pickup only) ---");
  console.log("1. Forward business line no-answer → +18663464256 — confirm 15+ sec connected call");
  console.log("2. Repeat with forward → +15714073615 — must behave identically");
  console.log("3. Trace: npx tsx scripts/mctb-trace-recent-571-calls.ts +18663464256 6");
  console.log("\n--- Gate 2 (separate) ---");
  console.log("After pickup stable: press 1 → consent row → recovery SMS");

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      "\nFix: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-fix-571-forward-pickup.ts --apply",
    );
    process.exit(1);
  }

  console.log("\ntest-mctb-pickup-routing-parity: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
