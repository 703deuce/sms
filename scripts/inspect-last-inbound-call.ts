/**
 * Inspect the most recent inbound PSTN attempt for platform DIDs.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-last-inbound-call.ts
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const DIDS = ["+18663464256", "+15714073615"];

async function fetchTelnyxSipCdrs(e164: string, limit = 5) {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/detail_records",
    {
      query: {
        "filter[phone_number]": e164,
        "filter[record_type]": "sip-trunking",
        "page[size]": limit,
      },
    },
  );
  return res.data || [];
}

async function fetchTelnyxVoiceCdrs(e164: string, limit = 5) {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/detail_records",
    {
      query: {
        "filter[phone_number]": e164,
        "filter[record_type]": "voice",
        "page[size]": limit,
      },
    },
  );
  return res.data || [];
}

function pickCdrFields(r: Record<string, unknown>) {
  return {
    id: r.id,
    created_at: r.created_at,
    finished_at: r.finished_at,
    direction: r.direction,
    record_type: r.record_type,
    cli: r.cli,
    cld: r.cld,
    hangup_cause: r.hangup_cause,
    sip_hangup_cause: r.sip_hangup_cause,
    sip_response_code: r.sip_response_code,
    connection_id: r.connection_id,
    connection_name: r.connection_name,
    cost: r.cost,
    tags: r.tags,
    session_id: r.telnyx_session_id || r.session_id,
  };
}

async function main() {
  const prisma = getPrisma();

  console.log("=== Telnyx SIP trunking CDRs (newest first) ===\n");
  for (const e164 of DIDS) {
    const sip = await fetchTelnyxSipCdrs(e164, 5);
    console.log(`--- ${e164} ---`);
    if (!sip.length) {
      console.log("  (no recent sip-trunking CDRs)\n");
      continue;
    }
    for (const r of sip) {
      console.log("  [sip-trunking]", JSON.stringify(pickCdrFields(r), null, 2));
    }
    console.log();
  }

  console.log("=== DB voiceCall rows (newest 5, any platform DID) ===\n");
  const calls = await prisma.voiceCall.findMany({
    where: {
      OR: DIDS.map((toNumber) => ({ toNumber })),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      workspaceId: true,
      status: true,
      direction: true,
      fromNumber: true,
      toNumber: true,
      durationSeconds: true,
      hangupCause: true,
      providerCallId: true,
      livekitRoomName: true,
      agentId: true,
      createdAt: true,
      endedAt: true,
    },
  });
  if (!calls.length) {
    console.log("  (no voiceCall rows for these DIDs)\n");
  } else {
    for (const c of calls) {
      console.log(JSON.stringify(c, null, 2));
    }
  }

  console.log("\n=== Recent providerWebhookEvent (voice/sip, last 10) ===\n");
  const events = await prisma.providerWebhookEvent.findMany({
    where: {
      OR: [
        { eventType: { contains: "voice" } },
        { eventType: { contains: "sip" } },
        { eventType: { contains: "call" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      eventType: true,
      provider: true,
      createdAt: true,
      payload: true,
    },
  });
  for (const e of events) {
    const p = (e.payload || {}) as Record<string, unknown>;
    const data = (p.data || p) as Record<string, unknown>;
    const payload = (data.payload || data) as Record<string, unknown>;
    const to =
      payload.to ||
      payload.called_number ||
      payload.cld ||
      (payload as Record<string, unknown>).phone_number;
    const from = payload.from || payload.caller_number || payload.cli;
    const eventType = payload.event_type || data.event_type || e.eventType;
  console.log(
      `${e.createdAt.toISOString()} ${e.eventType} to=${to ?? "?"} from=${from ?? "?"} inner=${String(eventType ?? "")}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
