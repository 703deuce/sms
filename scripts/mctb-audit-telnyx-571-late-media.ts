/**
 * Audit Telnyx routing for platform 571 (+15714073615):
 * - connection type (TeXML vs Call Control vs SIP)
 * - third_party_control_enabled (3rd Party Call Control / late-media)
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-audit-telnyx-571-late-media.ts
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_571_CONSENT_TEXML_APP_ID } from "@/lib/mctb/consent-prompt/telnyx-texml-route";
import {
  MCTB_571_CALL_CONTROL_DIAG_APP_ID,
  TELNYX_THIRD_PARTY_CONTROL_API_FIELD,
  auditMctb571ThirdPartyControl,
  fetchConnectionThirdPartyControl,
  readThirdPartyControlEnabled,
} from "@/lib/mctb/consent-prompt/telnyx-3pcc";

const e164 = process.argv.includes("--e164")
  ? process.argv[process.argv.indexOf("--e164") + 1]!
  : MCTB_PLATFORM_DEMO_E164;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

async function tryFetch(path: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await telnyxRequest<{ data?: Record<string, unknown> }>(path);
    return asRecord(res.data) ?? asRecord(res);
  } catch {
    return null;
  }
}

function format3pcc(value: boolean | null): string {
  if (value === true) return "true ✓";
  if (value === false) return "false ✗";
  return "unknown (not in API GET)";
}

async function main() {
  console.log(`\nMCTB Telnyx 571 late-media / 3PCC audit — ${e164}\n`);

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": e164, "page[size]": 1 },
  });
  const pn = listed.data?.[0];
  if (!pn) {
    console.error("Number not found in Telnyx account");
    process.exit(1);
  }

  const connId = String(pn.connection_id || "");
  const connName = String(pn.connection_name || "");
  console.log("Phone number ID:", pn.id);
  console.log("Live connection ID:", connId);
  console.log("Live connection name:", connName || "(none)");
  console.log("MCTB TeXML app:", MCTB_571_CONSENT_TEXML_APP_ID);
  console.log("MCTB Call Control diagnostic:", MCTB_571_CALL_CONTROL_DIAG_APP_ID);

  const live3pcc = await fetchConnectionThirdPartyControl(connId);
  console.log("\n── Live 571 assignment ──");
  console.log(`Kind: ${live3pcc.kind}`);
  console.log(`${TELNYX_THIRD_PARTY_CONTROL_API_FIELD}: ${format3pcc(live3pcc.thirdPartyControlEnabled)}`);

  console.log("\n── MCTB voice connections (Telnyx support IDs) ──");
  const auditRows = await auditMctb571ThirdPartyControl();
  for (const row of auditRows) {
    console.log(
      `- ${row.label} | id=${row.connectionId} | kind=${row.kind} | ` +
        `${TELNYX_THIRD_PARTY_CONTROL_API_FIELD}=${format3pcc(row.thirdPartyControlEnabled)}` +
        (row.is571LiveConnection ? " | **571 LIVE**" : ""),
    );
  }

  const texml = connId ? await tryFetch(`/texml_applications/${encodeURIComponent(connId)}`) : null;
  const cc = connId ? await tryFetch(`/call_control_applications/${encodeURIComponent(connId)}`) : null;
  const sip = connId ? await tryFetch(`/connections/${encodeURIComponent(connId)}`) : null;

  if (cc) {
    console.log("\n── Call Control application (live) ──");
    console.log(
      JSON.stringify(
        {
          id: cc.id,
          application_name: cc.application_name,
          webhook_event_url: cc.webhook_event_url,
          active: cc.active,
          [TELNYX_THIRD_PARTY_CONTROL_API_FIELD]: readThirdPartyControlEnabled(cc),
        },
        null,
        2,
      ),
    );
  }

  if (texml) {
    console.log("\n── TeXML application (live) ──");
    console.log(
      JSON.stringify(
        {
          id: texml.id,
          friendly_name: texml.friendly_name,
          voice_url: texml.voice_url,
          active: texml.active,
          [TELNYX_THIRD_PARTY_CONTROL_API_FIELD]: readThirdPartyControlEnabled(texml),
        },
        null,
        2,
      ),
    );
  }

  if (sip && !cc && !texml) {
    console.log("\n── SIP connection (live) ──");
    console.log(
      JSON.stringify(
        {
          id: sip.id,
          connection_name: sip.connection_name,
          connection_type: sip.connection_type,
          [TELNYX_THIRD_PARTY_CONTROL_API_FIELD]: readThirdPartyControlEnabled(sip),
          inbound: sip.inbound,
        },
        null,
        2,
      ),
    );
  }

  console.log("\n── Assessment ──");
  if (live3pcc.thirdPartyControlEnabled === true) {
    console.log("3PCC is ON for the live 571 connection — ready for AT&T delayed-offer forward test.");
  } else if (live3pcc.thirdPartyControlEnabled === false) {
    console.log("3PCC is OFF for the live 571 connection — enable before AT&T forward test:");
    console.log("  npx tsx scripts/mctb-enable-3pcc-571.ts --apply");
  } else {
    console.log(
      "3PCC status not readable via API GET for this connection type.",
    );
    console.log(
      "If PATCH was applied, confirm in Telnyx portal (SIP Settings → Enable 3rd Party Call Control).",
    );
    console.log("Enable via script:");
    console.log("  npx tsx scripts/mctb-enable-3pcc-571.ts --apply");
  }

  const connections = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/connections",
    { query: { "page[size]": 50 } },
  );
  console.log("\n── All SIP/IP connections (credential/fqdn) ──");
  for (const row of connections.data || []) {
    const type = String(row.connection_type || row.record_type || "");
    if (!/credential|fqdn|ip/i.test(type)) continue;
    const id = String(row.id || "");
    const full = id ? await fetchConnectionThirdPartyControl(id) : null;
    console.log(
      `- ${row.connection_name || row.name} | id=${id} | type=${type} | ` +
        `${TELNYX_THIRD_PARTY_CONTROL_API_FIELD}=${format3pcc(full?.thirdPartyControlEnabled ?? null)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
