import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";

const NUMBERS = ["+15717491060", "+15714073615", "+18663464256"];

async function main() {
  const urls = getTelnyxWebhookUrls();
  const apps = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/texml_applications", {
    query: { "page[size]": 50 },
  });

  console.log("=== MCTB route map (what each path is) ===\n");
  console.log(
    JSON.stringify(
      {
        frozenWorkingRoute: {
          name: "MCTB TeXML Ingress (866 cert pass)",
          texmlAppId: MCTB_TEXML_DEFAULT_APP_ID,
          voiceUrl: `${urls.mctbEntry}?cert=C3`,
          press1Callback: `${urls.mctbConsentTexml}?event=gather&path=texml_mctb_ingress&cert=C3`,
          statusCallback: urls.texmlStatus,
          notUsed: ["LiveKit", "mctb-sip Asterisk", "Smart Routing", "mctb-call-control"],
        },
        otherMctbRoutesInCodebase: {
          mctbPress1Only: urls.mctbPress1,
          mctbVoicemailOnly: urls.mctbVoicemail,
          oldPlatform571Consent: urls.mctbConsentTexml,
          callControlDiagnostic: urls.mctbCallControlDiagnostic,
        },
      },
      null,
      2,
    ),
  );

  console.log("\n=== Live Telnyx per-number connection ===\n");
  for (const e164 of NUMBERS) {
    const pn = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
      query: { "filter[phone_number]": e164 },
    });
    const row = pn.data?.[0];
    const app = (apps.data || []).find((a) => a.id === row?.connection_id);
    console.log(
      JSON.stringify(
        {
          e164,
          connection_id: row?.connection_id,
          connection_name: row?.connection_name,
          texmlAppVoiceUrl: app?.voice_url || null,
          onFrozenIngress: row?.connection_id === MCTB_TEXML_DEFAULT_APP_ID,
        },
        null,
        2,
      ),
    );
  }

  console.log("\n=== Recent inbound CDR on new 571 ===\n");
  const cdr = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[cld]": "+15717491060",
      "page[size]": 5,
    },
  });
  for (const r of cdr.data || []) {
    console.log(
      JSON.stringify({
        at: r.started_at,
        duration: r.call_sec,
        sip_fail: r.sip_invite_failure_status || "-",
        conn: r.connection_name,
        cli: r.cli,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
