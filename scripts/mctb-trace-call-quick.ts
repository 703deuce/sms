#!/usr/bin/env npx tsx
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

const DIGITS = (process.env.FROM || "7038166017").replace(/\D/g, "").slice(-10);
const HOURS = Number(process.env.HOURS || "24");

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  const missed = await prisma.missedCallEvent.findMany({
    where: { createdAt: { gte: since }, callerE164: { contains: DIGITS } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("missedCallEvent:", missed.length);
  for (const m of missed) console.log(JSON.stringify(m, null, 2));

  const bridge = await prisma.mctbVoiceBridgeCallEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const bridgeFiltered = bridge.filter((b) => {
    const s = JSON.stringify(b);
    return s.includes(DIGITS) || s.includes("8666020680");
  });
  console.log("\nmctbVoiceBridgeCallEvent (filtered):", bridgeFiltered.length);
  for (const b of bridgeFiltered) console.log(JSON.stringify(b, null, 2));

  const hooks = await prisma.providerWebhookEvent.findMany({
    where: {
      createdAt: { gte: since },
      eventType: { contains: "texml" },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const hookFiltered = hooks.filter((h) => {
    const s = JSON.stringify(h.payload || {});
    return s.includes(DIGITS) || s.includes("8666020680") || s.includes("5714776175");
  });
  console.log("\ntexml webhooks (filtered):", hookFiltered.length);
  for (const h of hookFiltered) {
    const p = (h.payload || {}) as Record<string, unknown>;
    console.log(
      JSON.stringify({
        at: h.createdAt,
        type: h.eventType,
        ws: h.workspaceId,
        CallSid: p.CallSid,
        CallStatus: p.CallStatus,
        From: p.From,
        To: p.To,
        Duration: p.CallDuration,
        AnsweredBy: p.AnsweredBy,
      }),
    );
  }

  const phones = await prisma.phoneNumber.findMany({
    where: {
      OR: [
        { e164: { contains: "8666020680" } },
        { e164: { contains: "5714776175" } },
      ],
    },
    select: {
      id: true,
      workspaceId: true,
      e164: true,
      settingsJson: true,
    },
  });
  console.log("\nphone numbers:");
  for (const p of phones) {
    const settings = p.settingsJson as Record<string, unknown> | null;
    console.log(
      JSON.stringify({
        ws: p.workspaceId,
        e164: p.e164,
        texmlHandlerMode: settings?.texmlHandlerMode,
        mctbIngress: settings?.mctbIngress,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
