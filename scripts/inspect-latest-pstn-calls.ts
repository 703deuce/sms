#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";

const HOURS = Number(process.env.HOURS || "6");

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  const calls = await prisma.voiceCall.findMany({
    where: { startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      workspaceId: true,
      fromE164: true,
      toE164: true,
      agentId: true,
      startedAt: true,
      status: true,
      outcome: true,
      summary: true,
      appointmentBooked: true,
      metadata: true,
    },
  });
  console.log(`voice_calls_last_${HOURS}h`, calls.length);
  for (const c of calls) {
    const meta = (c.metadata || {}) as Record<string, unknown>;
    console.log(
      JSON.stringify({
        id: c.id,
        ws: c.workspaceId,
        from: c.fromE164,
        to: c.toE164,
        at: c.startedAt,
        agentId: c.agentId,
        status: c.status,
        outcome: c.outcome,
        booked: c.appointmentBooked,
        transport: meta.voiceTransport,
        liveSession: meta.liveSessionId ?? meta.live_session_id,
      }),
    );
  }

  if (calls[0]) {
    const callId = calls[0].id;
    const t = await prisma.voiceTranscript.findFirst({
      where: { callId },
      select: { fullText: true },
    });
    const tools = await prisma.voiceToolExecution.findMany({
      where: { callId },
      orderBy: { createdAt: "asc" },
      take: 30,
    });
    console.log("\nLATEST_CALL_ID", callId);
    console.log("SUMMARY", calls[0].summary);
    if (t?.fullText) console.log("\nTRANSCRIPT\n", t.fullText);
    for (const tool of tools) {
      console.log(
        JSON.stringify({
          tool: tool.toolName,
          status: tool.status,
          error: tool.errorMessage,
          input: tool.inputPayload,
          result: tool.resultPayload,
        }),
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
