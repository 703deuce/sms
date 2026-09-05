/**
 * Diagnose why AT&T CFNA fails while direct dial works on the same MCTB DID.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/diag-mctb-cfna-sip-path.ts
 */
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";

const E164 = process.env.PHONE_E164 || "+15717491060";
const REF_866 = "+18663464256";

async function latestCdrs(e164: string, n = 5) {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[cld]": e164,
      "page[size]": String(n),
    },
  });
  return res.data || [];
}

function summarize(row: Record<string, unknown> | undefined, label: string) {
  if (!row) return { label, found: false };
  return {
    label,
    found: true,
    at: row.started_at,
    durationSec: row.call_sec,
    sipFail: row.sip_invite_failure_status || null,
    sipFullTo: row.sip_full_to,
    sipFromUrl: row.sip_from_url,
    origJip: row.orig_jip,
    answeredAt: row.answered_at,
    callControlId: row.call_control_id || null,
    connected: row.connected,
    connectionName: row.connection_name,
    connectionId: row.connection_id,
    shakenStir: row.shaken_stir,
  };
}

async function main() {
  const urls = getTelnyxWebhookUrls();
  const app = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/texml_applications/${encodeURIComponent(MCTB_TEXML_DEFAULT_APP_ID)}`,
  );

  const rows571 = await latestCdrs(E164, 8);
  const okDirect = rows571.find((r) => Number(r.call_sec || 0) > 0 && !r.sip_invite_failure_status);
  const failForward = rows571.find((r) => String(r.sip_invite_failure_status || "") === "480");

  const rows866 = await latestCdrs(REF_866, 5);
  const ok866Forward = rows866.find((r) => Number(r.call_sec || 0) >= 10);

  const report = {
    summary:
      "CFNA failure is NOT mctb-entry vs mctb-press-1. Telnyx never assigns call_control_id on failed AT&T forward legs.",
    frozenApp: {
      id: MCTB_TEXML_DEFAULT_APP_ID,
      voiceUrl: app.data?.voice_url,
    },
    new571: {
      e164: E164,
      directDialThatWorked: summarize(okDirect, "direct_ok"),
      attForwardThatFailed: summarize(failForward, "cfna_480"),
    },
    reference866CfnaPass: summarize(ok866Forward, "866_cfna_ok_aug30"),
    smokingGun: {
      directSipTo: okDirect ? String(okDirect.sip_full_to || "") : null,
      forwardSipTo: failForward ? String(failForward.sip_full_to || "") : null,
      interpretation:
        "Direct dial hits Telnyx (us.icp.telnyx.com). AT&T CFNA hits @one.att.net — call never becomes programmable TeXML.",
    },
    notTheProblem: [
      "10 vs 20 second ring timer (call dies in <1s with empty call_control_id)",
      "mctb-entry cert=C3 vs cert=D (TeXML never answers on 480 legs)",
      "LiveKit / Smart Routing / mctb-press-1 alternate handlers",
    ],
    likelyCause:
      "AT&T conditional-forward leg for this new local 571 is presented to Telnyx with Request-URI @one.att.net instead of Telnyx ingress (see working 866 forward: sip to Telnyx IP).",
    immediateWorkarounds: [
      `CFNA forward to ${REF_866} (proven AT&T→Telnyx CFNA path on Aug 30 cert)`,
      "Open Telnyx support ticket with failed CDR id + sip_full_to @one.att.net for +15717491060",
      "Keep direct-dial 571 for testing press-1; use 866 only as CFNA target until Telnyx/carrier routing fixed",
    ],
    attForwardStillUse: "*61*5717491060*10# is correct format — problem is downstream carrier routing to Telnyx",
    handlers: {
      ingress: urls.mctbEntry,
      press1Gather: urls.mctbConsentTexml,
      note: "183/PRACK/FQDN SIP adapter path is legacy AT&T experiment — 866 TeXML CFNA passed without it",
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const forwardBroken = String(failForward?.sip_full_to || "").includes("one.att.net");
  const directOk = String(okDirect?.sip_full_to || "").includes("telnyx");
  if (forwardBroken && directOk) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
