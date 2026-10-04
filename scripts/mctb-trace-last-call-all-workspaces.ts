#!/usr/bin/env npx tsx
/** Find most recent MCTB-related voice/webhook activity across all workspaces. */
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

const HOURS = Number(process.env.HOURS || "6");
const FROM = process.env.FROM?.trim();

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  console.log(`Since ${since.toISOString()}${FROM ? ` FROM filter ${FROM}` : ""}\n`);

  const voiceCalls = await prisma.voiceCall.findMany({
    where: {
      createdAt: { gte: since },
      ...(FROM ? { fromE164: { contains: FROM.replace(/\D/g, "").slice(-10) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      workspaceId: true,
      createdAt: true,
      fromE164: true,
      toE164: true,
      status: true,
      direction: true,
      telnyxCallSessionId: true,
      telnyxCallControlId: true,
      durationSeconds: true,
      metadata: true,
    },
  });
  console.log("=== voiceCall (recent) ===");
  for (const v of voiceCalls) {
    console.log(JSON.stringify(v, null, 0));
  }

  const missed = await prisma.missedCallEvent.findMany({
    where: {
      createdAt: { gte: since },
      ...(FROM
        ? {
            callerE164: { contains: FROM.replace(/\D/g, "").slice(-10) },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      workspaceId: true,
      createdAt: true,
      callerE164: true,
      status: true,
      eligible: true,
      suppressionReason: true,
      smsSentAt: true,
      metadata: true,
      voiceCallId: true,
    },
  });
  console.log("\n=== missedCallEvent (recent) ===");
  for (const m of missed) {
    console.log(JSON.stringify(m));
  }

  const webhooks = await prisma.providerWebhookEvent.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        { eventType: { contains: "texml" } },
        { eventType: { contains: "mctb" } },
        { eventType: { contains: "voice" } },
      ],
      ...(FROM ? { payload: { string_contains: FROM.replace(/\D/g, "").slice(-10) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      workspaceId: true,
      createdAt: true,
      eventType: true,
      providerEventId: true,
    },
  });
  console.log("\n=== providerWebhookEvent (voice/texml recent) ===");
  for (const w of webhooks) {
    console.log(JSON.stringify(w));
  }

  // Latest webhook with full payload snippet for most recent call
  const sid =
    voiceCalls[0]?.telnyxCallSessionId || voiceCalls[0]?.telnyxCallControlId || null;
  if (sid) {
    const related = await prisma.providerWebhookEvent.findMany({
      where: {
        OR: [
          { providerEventId: { contains: sid.slice(-20) } },
          { payload: { string_contains: sid } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    console.log(`\n=== webhooks for providerCallId ${sid} (${related.length}) ===`);
    for (const r of related) {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      const summary = {
        at: r.createdAt,
        type: r.eventType,
        ws: r.workspaceId,
        callStatus: (p as { CallStatus?: string })?.CallStatus,
        from: (p as { From?: string })?.From,
        to: (p as { To?: string })?.To,
      };
      console.log(JSON.stringify(summary));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
