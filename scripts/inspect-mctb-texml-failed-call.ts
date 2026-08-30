/**
 * Inspect production logs for recent MCTB TeXML ingress failures.
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import {
  preflightTexmlVoiceUrl,
  resolveMctbTexmlVoiceUrlCandidates,
} from "../src/lib/mctb/texml-ingress/preflight";

const CALL_ID = process.env.CALL_ID?.trim() || "cmtf5fw8t6a141y3a52243o3c";
const EVENT_ID = process.env.EVENT_ID?.trim() || "cmtf5fvkx443s4h5d4k213g1j";
const SINCE = process.env.SINCE || "2026-08-30T01:40:00Z";
const TEXML_APP_ID = process.env.MCTB_TEXML_APP_ID?.trim() || "3037587396909598261";

async function main() {
  const prisma = getPrisma();
  const since = new Date(SINCE);

  const events = await prisma.providerWebhookEvent.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        { eventType: { contains: "texml" } },
        { eventType: { contains: "call" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      createdAt: true,
      eventType: true,
      provider: true,
      status: true,
      httpStatus: true,
      errorMessage: true,
      payloadJson: true,
    },
  });

  const filtered = events.filter((e) => {
    const raw = JSON.stringify(e.payloadJson || {});
    return (
      raw.includes("8663464256") ||
      raw.includes(TEXML_APP_ID) ||
      e.eventType.includes("texml")
    );
  });

  console.log("=== Correlated providerWebhookEvent ===\n");
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
          callSid: data.CallSid || data.call_sid || data.CallControlId,
          connectionId: data.ConnectionId || data.connection_id,
          callStatus: data.CallStatus || data.call_status || data.texml_call_status,
          hangupCause: data.HangupCause || data.hangup_cause,
          sipHangupCause: data.SipHangupCause,
        },
        null,
        2,
      ),
    );
  }

  if (CALL_ID) {
    const call = await prisma.voiceCall.findUnique({ where: { id: CALL_ID } });
    console.log("\n=== VoiceCall ===\n", JSON.stringify(call, null, 2));
  }

  if (EVENT_ID) {
    const evt = await prisma.providerWebhookEvent.findUnique({ where: { id: EVENT_ID } });
    console.log("\n=== Hangup webhook payload ===\n", JSON.stringify(evt?.payloadJson, null, 2));
  }

  const app = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/texml_applications/${encodeURIComponent(TEXML_APP_ID)}`,
  );
  console.log("\n=== TeXML application ===\n");
  console.log(
    JSON.stringify(
      {
        id: app.data?.id,
        voice_url: app.data?.voice_url,
        voice_method: app.data?.voice_method,
        status_callback: app.data?.status_callback,
        active: app.data?.active,
      },
      null,
      2,
    ),
  );

  const urls = resolveMctbTexmlVoiceUrlCandidates();
  console.log("\n=== Production preflight (now) ===\n");
  for (const [name, url] of Object.entries(urls)) {
    const pre = await preflightTexmlVoiceUrl(url);
    console.log(JSON.stringify({ name, ...pre }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
