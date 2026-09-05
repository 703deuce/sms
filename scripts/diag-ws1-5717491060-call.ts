/**
 * Diagnose live call failure on +15717491060 (ws_1 new MCTB 571).
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { peekMctbInboundRoutingProfileByE164 } from "../src/lib/mctb/texml-ingress/routing-profile";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";
import { resolveMctbTexmlCertMode } from "../src/lib/mctb/texml-ingress/cert-mode";

const E164 = process.env.PHONE_E164 || "+15717491060";

async function main() {
  const prisma = getPrisma();

  const events = await prisma.providerWebhookEvent.findMany({
    where: { createdAt: { gte: new Date("2026-09-05T16:00:00Z") } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const filtered = events.filter((e) => {
    const raw = JSON.stringify(e.payloadJson || {});
    return raw.includes("5717491060") || raw.includes("15717491060");
  });

  console.log("=== Webhooks mentioning 5717491060 ===\n");
  for (const e of filtered) {
    const p = (e.payloadJson || {}) as Record<string, unknown>;
    const data = (p.data as Record<string, unknown>) || p;
    console.log(
      JSON.stringify(
        {
          id: e.id,
          at: e.createdAt,
          type: e.eventType,
          status: e.status,
          httpStatus: e.httpStatus,
          error: e.errorMessage,
          from: data.From || data.from,
          to: data.To || data.to,
          callSid: data.CallSid || data.call_sid,
          callStatus: data.CallStatus || data.texml_call_status,
          hangup: data.HangupCause || data.hangup_cause,
          sipHangup: data.SipHangupCause,
          connectionId: data.ConnectionId || data.connection_id,
          payloadKeys: Object.keys(data),
        },
        null,
        2,
      ),
    );
  }

  const hangup = filtered.find((e) => e.eventType.includes("hangup"));
  if (hangup) {
    console.log("\n=== Full hangup payload ===\n");
    console.log(JSON.stringify(hangup.payloadJson, null, 2));
  }

  const app = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/texml_applications/${encodeURIComponent(MCTB_TEXML_DEFAULT_APP_ID)}`,
  );
  const voiceUrl = String(app.data?.voice_url || "");
  console.log("\n=== TeXML App ===\n");
  console.log(
    JSON.stringify(
      {
        voice_url: voiceUrl,
        voice_method: app.data?.voice_method,
        active: app.data?.active,
        certMode: resolveMctbTexmlCertMode(new URL(voiceUrl, "https://x").searchParams.get("cert")),
      },
      null,
      2,
    ),
  );

  const pn = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": E164 },
  });
  console.log("\n=== Telnyx phone number ===\n");
  console.log(
    JSON.stringify(
      {
        connection_id: pn.data?.[0]?.connection_id,
        connection_name: pn.data?.[0]?.connection_name,
        status: pn.data?.[0]?.status,
        onMctbApp: pn.data?.[0]?.connection_id === MCTB_TEXML_DEFAULT_APP_ID,
      },
      null,
      2,
    ),
  );

  const profile = peekMctbInboundRoutingProfileByE164(E164);
  console.log("\n=== In-process routing profile (this runner only) ===\n");
  console.log(JSON.stringify(profile, null, 2));

  const entryUrl = getTelnyxWebhookUrls().mctbEntry;
  const res = await fetch(entryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: "+15555550100",
      To: E164,
      CallSid: `diag-${Date.now()}`,
    }),
  });
  const xml = await res.text();
  console.log("\n=== Entry probe (production URL) ===\n");
  console.log(
    JSON.stringify(
      {
        url: entryUrl,
        status: res.status,
        hasGather: xml.includes("Gather"),
        hasPlay: xml.includes("Play"),
        hasHangup: xml.includes("Hangup"),
        preview: xml.slice(0, 400),
      },
      null,
      2,
    ),
  );

  const sip = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[cld]": E164,
      "page[size]": 5,
    },
  });
  console.log("\n=== Recent SIP CDR ===\n");
  for (const r of sip.data || []) {
    console.log(
      JSON.stringify(
        {
          at: r.started_at,
          hangup: r.hangup_cause,
          sip_fail: r.sip_invite_failure_status,
          sip_code: r.sip_response_code,
          conn: r.connection_name,
          duration: r.call_sec,
          src: r.cli,
          dst: r.cld,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
