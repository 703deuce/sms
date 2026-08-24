#!/usr/bin/env npx tsx
/** Trace recent 571 MCTB call activity across Telnyx, DB, and LiveKit. */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getPrisma } from "@/lib/db";
import { RoomServiceClient } from "livekit-server-sdk";
import { getActiveMediaBackend, getLiveKitBackendConfig } from "@/lib/voice/media-backend";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";

const E164 = process.argv.find((a) => a.startsWith("+")) || MCTB_PLATFORM_DEMO_E164;
const HOURS = Number(process.argv.find((a) => /^\d+h?$/.test(a))?.replace("h", "") || 6);

async function main() {
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);
  console.log(`\n══ MCTB call trace for ${E164} (last ${HOURS}h since ${since.toISOString()}) ══\n`);

  // Telnyx SIP CDR
  try {
    const sip = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
      query: {
        "filter[record_type]": "sip-trunking",
        "filter[cld]": E164,
        "page[size]": 10,
      },
    });
    const rows = (sip.data || []).filter((r) => {
      const t = String(r.started_at || "");
      return !t || new Date(t) >= since;
    });
    console.log(`Telnyx SIP CDR (${rows.length} recent):`);
    for (const r of rows) {
      console.log(
        " ",
        JSON.stringify({
          at: r.started_at,
          hangup: r.hangup_cause,
          sip_fail: r.sip_invite_failure_status,
          sip_code: r.sip_response_code,
          src_ip: r.src_ip,
          dst_ip: r.dst_ip,
          conn: r.connection_name,
          dir: r.direction,
          duration: r.call_sec,
        }),
      );
    }
    if (!rows.length) console.log("  (none)");
  } catch (e) {
    console.log("Telnyx SIP CDR error:", e instanceof Error ? e.message : e);
  }

  // Telnyx voice CDR
  try {
    const voice = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
      query: {
        "filter[record_type]": "call-control",
        "filter[cld]": E164,
        "page[size]": 10,
      },
    });
    const rows = voice.data || [];
    console.log(`\nTelnyx call-control CDR (${rows.length}):`);
    for (const r of rows.slice(0, 5)) {
      console.log(
        " ",
        JSON.stringify({
          at: r.started_at,
          hangup: r.hangup_cause,
          conn: r.connection_name,
          duration: r.call_sec,
        }),
      );
    }
    if (!rows.length) console.log("  (none)");
  } catch (e) {
    console.log("Telnyx voice CDR error:", e instanceof Error ? e.message : e);
  }

  // DB
  const prisma = getPrisma();
  const calls = await prisma.voiceCall.findMany({
    where: {
      createdAt: { gte: since },
      OR: [{ toE164: E164 }, { toNumber: E164 }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      fromE164: true,
      toE164: true,
      status: true,
      provider: true,
      metadataJson: true,
    },
  });
  console.log(`\nDB voiceCall (${calls.length}):`);
  for (const c of calls) {
    const meta = (c.metadataJson || {}) as Record<string, unknown>;
    console.log(
      " ",
      JSON.stringify({
        id: c.id,
        at: c.createdAt,
        from: c.fromE164,
        status: c.status,
        provider: c.provider,
        source: meta.source,
      }),
    );
  }
  if (!calls.length) console.log("  (none)");

  const missed = await prisma.missedCallEvent.findMany({
    where: { createdAt: { gte: since }, businessNumber: E164 },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, callerNumber: true, status: true, suppressionReason: true },
  });
  console.log(`\nDB missedCallEvent (${missed.length}):`);
  for (const m of missed) {
    console.log(
      " ",
      JSON.stringify({
        id: m.id,
        at: m.createdAt,
        caller: m.callerNumber,
        status: m.status,
        suppress: m.suppressionReason,
      }),
    );
  }
  if (!missed.length) console.log("  (none)");

  // LiveKit rooms
  const backend = getActiveMediaBackend();
  const cfg = getLiveKitBackendConfig(backend);
  const rooms = await new RoomServiceClient(cfg.url, cfg.apiKey, cfg.apiSecret).listRooms();
  console.log(`\nLiveKit (${backend}) active rooms: ${rooms.length}`);
  for (const r of rooms.slice(0, 5)) {
    console.log(" ", r.name, "participants:", r.numParticipants);
  }

  // Phone assignment
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: E164 },
    select: { id: true, workspaceId: true, status: true, settingsJson: true, providerNumberId: true },
  });
  if (pn) {
    const settings = (pn.settingsJson || {}) as Record<string, unknown>;
    const telephony = (settings.telephony || settings.provisioning || {}) as Record<string, unknown>;
    console.log("\nPhoneNumber row:");
    console.log(
      " ",
      JSON.stringify({
        id: pn.id,
        workspaceId: pn.workspaceId,
        status: pn.status,
        mctbSipIngress: settings.mctbSipIngress,
        routingMode: telephony.routingMode,
        livekitInboundTrunkId: telephony.livekitInboundTrunkId,
        livekitDispatchRuleId: telephony.livekitDispatchRuleId,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
