/**
 * Trace latest 866 MCTB cert-D call: TeXML ingress, status callback, SMS.
 */
import { getPrisma } from "../src/lib/db";

const SINCE = process.env.SINCE || new Date(Date.now() - 30 * 60 * 1000).toISOString();

async function main() {
  const prisma = getPrisma();
  const since = new Date(SINCE);

  const calls = await prisma.voiceCall.findMany({
    where: {
      toE164: { contains: "8663464256" },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log("=== Recent 866 voiceCalls ===\n");
  for (const c of calls) {
    console.log(
      JSON.stringify(
        {
          id: c.id,
          at: c.createdAt,
          status: c.status,
          agentId: c.agentId,
          fromE164: c.fromE164,
          durationSeconds: c.durationSeconds,
          connectionId: (c.metadata as Record<string, unknown>)?.payload
            ? ((c.metadata as Record<string, unknown>).payload as Record<string, unknown>)?.ConnectionId ||
              ((c.metadata as Record<string, unknown>).payload as Record<string, unknown>)?.connection_id
            : null,
          source: (c.metadata as Record<string, unknown>)?.source,
          routing: (c.metadata as Record<string, unknown>)?.routing,
        },
        null,
        2,
      ),
    );
  }

  const events = await prisma.providerWebhookEvent.findMany({
    where: {
      createdAt: { gte: since },
      OR: [{ eventType: { contains: "texml" } }, { eventType: { contains: "mctb" } }],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      eventType: true,
      status: true,
      errorMessage: true,
      payloadJson: true,
    },
  });

  const filtered = events.filter((e) => JSON.stringify(e.payloadJson || {}).includes("8663464256"));

  console.log("\n=== Correlated webhooks ===\n");
  for (const e of filtered.slice(0, 10)) {
    const p = (e.payloadJson || {}) as Record<string, unknown>;
    const d = (p.data as Record<string, unknown>) || p;
    console.log(
      JSON.stringify(
        {
          at: e.createdAt,
          type: e.eventType,
          status: e.status,
          error: e.errorMessage,
          from: d.From || d.from,
          to: d.To || d.to,
          callSid: d.CallSid || d.call_sid,
          callStatus: d.CallStatus || d.texml_call_status,
          connectionId: d.ConnectionId || d.connection_id,
        },
        null,
        2,
      ),
    );
  }

  const missed = await prisma.missedCallEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      workspaceId: true,
      callerE164: true,
      businessE164: true,
      status: true,
      suppressionReason: true,
      smsSentAt: true,
      metadata: true,
    },
  });

  console.log("\n=== Recent missedCallEvents ===\n");
  console.log(JSON.stringify(missed, null, 2));

  const sms = await prisma.smsMessage.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      direction: true,
      status: true,
      toE164: true,
      fromE164: true,
      body: true,
      errorMessage: true,
      metadata: true,
    },
  });

  console.log("\n=== Recent smsMessages ===\n");
  console.log(JSON.stringify(sms, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
