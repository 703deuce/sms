/**
 * Compare direct vs forwarded (480) inbound legs on the same MCTB DID.
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const E164 = process.env.PHONE_E164 || "+15717491060";

async function main() {
  const sip = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[cld]": E164,
      "page[size]": 10,
    },
  });

  console.log("=== Full SIP CDR fields (newest first) ===\n");
  for (const r of sip.data || []) {
    console.log(JSON.stringify(r, null, 2));
    console.log("---\n");
  }

  const prisma = getPrisma();
  const since = new Date("2026-09-05T16:00:00Z");
  const events = await prisma.providerWebhookEvent.findMany({
    where: {
      createdAt: { gte: since },
      eventType: { contains: "texml" },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  console.log("=== TeXML webhooks since 16:00 UTC ===\n");
  for (const e of events) {
    const raw = JSON.stringify(e.payload || e.payloadJson || {});
    if (!raw.includes("5717491060") && !raw.includes("15717491060")) continue;
    const p = (e.payload || e.payloadJson || {}) as Record<string, unknown>;
    const ep = (p.eventPayload as Record<string, unknown>) || (p.data as Record<string, unknown>) || p;
    console.log(
      JSON.stringify(
        {
          id: e.id,
          at: e.createdAt,
          type: e.eventType,
          from: ep.From || ep.from,
          to: ep.To || ep.to,
          forwardedFrom: ep.ForwardedFrom || ep.forwarded_from,
          callSid: ep.CallSid || ep.call_sid,
          callDuration: ep.CallDuration || ep.call_duration,
          answeredTime: ep.AnsweredTime,
          hangup: ep.HangupCause || ep.hangup_cause,
          sipHangup: ep.SipHangupCause,
          connectionId: ep.ConnectionId || ep.connection_id,
          fromSipUri: ep.FromSipUri,
          toSipUri: ep.ToSipUri,
          callingPartyType: ep.CallingPartyType,
        },
        null,
        2,
      ),
    );
    console.log("");
  }

  // Compare Telnyx phone number resource details
  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": E164 },
  });
  const pnId = String(listed.data?.[0]?.id || "");
  if (pnId) {
    const detail = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(pnId)}`,
    );
    console.log("=== Telnyx phone number detail ===\n");
    console.log(
      JSON.stringify(
        {
          id: detail.data?.id,
          phone_number: detail.data?.phone_number,
          status: detail.data?.status,
          connection_id: detail.data?.connection_id,
          connection_name: detail.data?.connection_name,
          messaging_profile_id: detail.data?.messaging_profile_id,
          voice: detail.data?.voice,
          emergency_enabled: detail.data?.emergency_enabled,
          tags: detail.data?.tags,
          purchased_at: detail.data?.purchased_at,
        },
        null,
        2,
      ),
    );
  }

  // 866 reference when CFNA worked (per-DID texml app name)
  const ref = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[cld]": "+18663464256",
      "page[size]": 3,
    },
  });
  console.log("\n=== Reference 866 successful CFNA CDR (connection name when it worked) ===\n");
  for (const r of ref.data || []) {
    console.log(
      JSON.stringify({
        at: r.started_at,
        duration: r.call_sec,
        sip_fail: r.sip_invite_failure_status,
        connection_name: r.connection_name,
        connection_id: r.connection_id,
        cli: r.cli,
        orig: r.orig,
        orig_cld: r.orig_cld,
        tags: r.tags,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
