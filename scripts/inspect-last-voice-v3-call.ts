#!/usr/bin/env tsx
import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const calls = await prisma.voiceCall.findMany({
    where: { startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    take: 3,
    select: {
      id: true,
      fromE164: true,
      toE164: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      status: true,
      metadata: true,
      telnyxConversationId: true,
    },
  });

  for (const call of calls) {
    const meta = (call.metadata || {}) as Record<string, unknown>;
    console.log("\n=== VoiceCall", call.id, "===");
    console.log({
      from: call.fromE164,
      to: call.toE164,
      started: call.startedAt?.toISOString(),
      ended: call.endedAt?.toISOString(),
      durationSeconds: call.durationSeconds,
      status: call.status,
      liveSessionId: meta.liveSessionId ?? meta.live_session_id,
      voiceV3: meta.voiceV3 ?? meta.voice_v3,
    });

    const events = await prisma.providerWebhookEvent.findMany({
      where: {
        createdAt: { gte: call.startedAt ?? since },
        ...(call.endedAt ? { createdAt: { lte: call.endedAt } } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 80,
      select: { id: true, eventType: true, createdAt: true, payload: true },
    });
    const liveSession = String(meta.liveSessionId ?? meta.live_session_id ?? "");
    const filtered = liveSession
      ? events.filter((e) => JSON.stringify(e.payload).includes(liveSession))
      : events.slice(0, 30);
    console.log(`providerWebhookEvent (matched): ${filtered.length}`);
    for (const e of filtered.slice(0, 25)) {
      console.log(`  ${e.createdAt.toISOString()} ${e.eventType}`);
    }

    const transcript = await prisma.voiceTranscript.findFirst({
      where: { callId: call.id },
      orderBy: { createdAt: "desc" },
      select: { fullText: true, segments: true },
    });
    if (transcript?.fullText) {
      console.log("transcript:", transcript.fullText.slice(0, 2000));
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
