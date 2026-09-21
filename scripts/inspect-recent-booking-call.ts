#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const calls = await prisma.voiceCall.findMany({
    where: { startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: {
      id: true,
      workspaceId: true,
      fromE164: true,
      toE164: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      status: true,
      metadata: true,
    },
  });

  console.log(`Recent calls (last 12h): ${calls.length}`);
  for (const call of calls) {
    const meta = (call.metadata || {}) as Record<string, unknown>;
    console.log("\n==========", call.id, "==========");
    console.log({
      from: call.fromE164,
      started: call.startedAt?.toISOString(),
      ended: call.endedAt?.toISOString(),
      duration: call.durationSeconds,
      status: call.status,
      voiceV3: meta.voiceV3Product ?? meta.voiceV3LiveSessionId ?? meta.liveSessionId,
    });

    const tools = await prisma.voiceToolExecution.findMany({
      where: { voiceCallId: call.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        toolName: true,
        status: true,
        createdAt: true,
        input: true,
        output: true,
        errorMessage: true,
      },
    });
    console.log(`\nTool executions: ${tools.length}`);
    for (const t of tools) {
      const inp = JSON.stringify(t.input ?? {}).slice(0, 400);
      const out = JSON.stringify(t.output ?? {}).slice(0, 400);
      console.log(`  ${t.createdAt.toISOString()} ${t.toolName} ${t.status}`);
      if (t.toolName === "update_intake" || t.toolName === "book_appointment") {
        console.log("    in:", inp);
        console.log("    out:", out);
      }
    }

    const transcript = await prisma.voiceTranscript.findFirst({
      where: { callId: call.id },
      orderBy: { createdAt: "desc" },
    });
    if (transcript?.fullText) {
      console.log("\n--- TRANSCRIPT ---\n");
      console.log(transcript.fullText);
    } else if (transcript?.segments) {
      console.log("\n--- TRANSCRIPT SEGMENTS ---\n");
      console.log(JSON.stringify(transcript.segments, null, 2).slice(0, 8000));
    }

    const events = await prisma.voiceCallEvent.findMany({
      where: { voiceCallId: call.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { createdAt: true, eventType: true, payload: true },
    });
    if (events.length) {
      console.log(`\nVoiceCallEvents: ${events.length}`);
      for (const e of events) {
        console.log(`  ${e.createdAt.toISOString()} ${e.eventType} ${JSON.stringify(e.payload).slice(0, 200)}`);
      }
    }

    const appt = await prisma.appointment.findFirst({
      where: {
        workspaceId: call.workspaceId,
        createdAt: { gte: call.startedAt ?? since },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        startTime: true,
        status: true,
        customerPhone: true,
        customerName: true,
        metadata: true,
        createdAt: true,
      },
    });
    if (appt) {
      console.log("\nRecent appointment (same workspace after call start):", appt);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
