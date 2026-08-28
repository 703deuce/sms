#!/usr/bin/env npx tsx
/** Audit PRACK + 3PCC for an MCTB production DID. */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { fetchConnectionLateMediaSettings } from "@/lib/mctb/consent-prompt/telnyx-3pcc";
import { auditMctb571SipFqdnConnection } from "@/lib/mctb/sip-diagnostic/fqdn-audit";
import { auditDirectTestLateMedia, fetchCallControlAppRaw } from "@/lib/mctb/sip-diagnostic/fqdn-direct-setup";
import { verifyEventOnlyRouteForE164 } from "@/lib/mctb/consent-prompt/telnyx-event-only-route";

const E164 = process.argv[2]?.trim() || "+15714073615";

async function main() {
  console.log("\n══ MCTB late-media audit (PRACK + 3PCC) ══\n");
  console.log("Number:", E164);

  const route = await verifyEventOnlyRouteForE164(E164);
  console.log("\nLive route:", route.detail);

  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: E164 },
    select: { settingsJson: true },
  });
  const telephony =
    pn?.settingsJson &&
    typeof pn.settingsJson === "object" &&
    (pn.settingsJson as Record<string, unknown>).telephony;
  const tel =
    telephony && typeof telephony === "object"
      ? (telephony as Record<string, unknown>)
      : {};
  const refFqdn = String(tel.telnyxReferenceFqdnConnectionId || "");
  const ccApp = String(tel.telnyxCallControlAppId || route.callControlAppId || "");

  console.log("\nDB telephony refs:");
  console.log("  Call Control app:", ccApp || "(none)");
  console.log("  Reference FQDN:", refFqdn || "(none)");
  console.log("  routingMode:", tel.routingMode);

  if (ccApp) {
    const ccLate = await fetchConnectionLateMediaSettings(ccApp);
    const ccRaw = await fetchCallControlAppRaw(ccApp);
    console.log("\n── Call Control app (number assignment) ──");
    console.log("  Name:", ccLate.connectionName);
    console.log(
      "  3PCC raw (third_party_control_enabled):",
      ccRaw?.third_party_control_enabled ?? "(field missing on API response)",
    );
    console.log("  3PCC parsed:", ccLate.settings.thirdPartyControlEnabled);
    console.log("  PRACK on Call Control:", ccLate.settings.prackEnabled, "(N/A — lives on FQDN ref)");
    console.log("  first_command_timeout:", ccRaw?.first_command_timeout);
    console.log("  first_command_timeout_secs:", ccRaw?.first_command_timeout_secs);
    console.log("  webhook:", ccRaw?.webhook_event_url);
  }

  const fqdnId = refFqdn || "3036078478664401929";
  if (fqdnId) {
    const fqdnAudit = await auditMctb571SipFqdnConnection(fqdnId);
    console.log("\n── Reference FQDN (183/PRACK + ringback template) ──");
    console.log("  Name:", fqdnAudit.connectionName);
    console.log("  3PCC:", fqdnAudit.thirdPartyControlEnabled);
    console.log("  PRACK (183/100rel):", fqdnAudit.prackEnabled);
    console.log("  generate_ringback_tone:", fqdnAudit.generateRingbackTone);
    console.log("  lateMediaReady:", fqdnAudit.lateMediaReady);
    console.log("  FQDN destinations:", fqdnAudit.fqdnDestinations.length ? fqdnAudit.fqdnDestinations : "(none — correct for Event Only)");
  }

  if (ccApp && fqdnId) {
    const combined = await auditDirectTestLateMedia({
      fqdnConnectionId: fqdnId,
      callControlAppId: ccApp,
    });
    console.log("\n── Combined MCTB media readiness ──");
    console.log("  3PCC:", combined.thirdPartyControlEnabled);
    console.log("  PRACK:", combined.prackEnabled);
    console.log("  ringback:", combined.generateRingbackTone);
    console.log("  lateMediaReady:", combined.lateMediaReady);
    console.log("  Note:", combined.note);
  }

  try {
    const sip = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
      query: {
        "filter[record_type]": "sip-trunking",
        "filter[cld]": E164,
        "page[size]": 3,
      },
    });
    console.log("\n── Recent SIP CDR (forward path signaling) ──");
    for (const r of sip.data || []) {
      console.log(
        " ",
        JSON.stringify({
          at: r.started_at,
          hangup: r.hangup_cause,
          sip_fail: r.sip_invite_failure_status,
          sip_code: r.sip_response_code,
          conn: r.connection_name,
        }),
      );
    }
  } catch (e) {
    console.log("SIP CDR error:", e instanceof Error ? e.message : e);
  }

  console.log("\n── How this architecture works ──");
  console.log("  PSTN → your DID is on the Call Control app (3PCC ON).");
  console.log("  PRACK/183 early media flags live on the reference FQDN connection,");
  console.log("  which Telnyx uses as the late-media template for carrier forwards (AT&T Diversion).");
  console.log("  Provisioning fails closed if lateMediaReady is false after setup.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
