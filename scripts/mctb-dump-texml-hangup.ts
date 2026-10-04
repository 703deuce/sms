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

const AT = process.env.AT || "2026-10-02T23:51";

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();
  const since = new Date(`${AT}:00.000Z`);
  const until = new Date(since.getTime() + 5 * 60 * 1000);

  const hooks = await prisma.providerWebhookEvent.findMany({
    where: {
      createdAt: { gte: since, lte: until },
      eventType: { contains: "texml" },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Found ${hooks.length} texml events between ${since.toISOString()} and ${until.toISOString()}`);
  for (const h of hooks) {
    console.log("\n---", h.createdAt.toISOString(), h.eventType, h.workspaceId, "---");
    console.log(JSON.stringify(h.payload, null, 2));
    if (h.errorMessage) console.log("error:", h.errorMessage);
    console.log("status:", h.status, "processedAt:", h.processedAt);
  }

  const pl = hooks[0]?.payload as { eventPayload?: { CallSid?: string }; CallSid?: string } | undefined;
  const callSid = pl?.eventPayload?.CallSid || pl?.CallSid;
  if (callSid) {
    const all = await prisma.providerWebhookEvent.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 48 * 3600 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const related = all.filter((x) => JSON.stringify(x.payload || {}).includes(callSid));
    console.log(`\nAll events mentioning CallSid ${callSid}: ${related.length}`);
    for (const r of related.reverse()) {
      console.log(r.createdAt.toISOString(), r.eventType, r.status, r.errorMessage || "");
    }
  }

  const callSid2 = "v3:sv4RQTAiTbJo-c-yiE2gJMpDsI7pdNUD6pEn7bX36_M9AZEByRnzdg";
  const jobs = await prisma.jobQueue.findMany({
    where: {
      OR: [
        { idempotencyKey: { contains: callSid2.slice(-24) } },
        { payload: { string_contains: callSid2.slice(0, 20) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  }).catch(async () => {
    const all = await prisma.jobQueue.findMany({
      where: { createdAt: { gte: since }, jobType: { contains: "mctb" } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return all.filter((j) => JSON.stringify(j.payload).includes("sv4RQTAiTbJo"));
  });
  console.log("\njobs:", jobs.length);
  for (const j of jobs) {
    console.log(JSON.stringify({ at: j.createdAt, type: j.jobType, status: j.status, err: j.lastError, key: j.idempotencyKey }));
  }

  const msgs = await prisma.message.findMany({
    where: {
      createdAt: { gte: since },
      OR: [{ toE164: { contains: "7038166017" } }, { fromE164: { contains: "7038166017" } }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, direction: true, status: true, toE164: true, fromE164: true, body: true, workspaceId: true },
  });
  console.log("\nmessages to/from caller:", msgs.length);
  for (const m of msgs) console.log(JSON.stringify(m));

  const { loadMctbConsentMode } = await import("../src/lib/mctb/consent-prompt/service");
  for (const ws of ["ws_1"]) {
    const mode = await loadMctbConsentMode(ws).catch(() => "err");
    console.log("consent mode", ws, mode);
  }

  const pn = await prisma.phoneNumber.findFirst({ where: { e164: "+18666020680" } });
  console.log("\ningress phone ws", pn?.workspaceId, JSON.stringify(pn?.settingsJson));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
