#!/usr/bin/env npx tsx
import Module from "node:module";
const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

const KEY =
  "mctb-texml-capture:ws_1:v3:sv4RQTAiTbJo-c-yiE2gJMpDsI7pdNUD6pEn7bX36_M9AZEByRnzdg";

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();
  const j = await prisma.jobQueue.findFirst({ where: { idempotencyKey: KEY } });
  console.log("job", JSON.stringify(j, null, 2));
  const counts = await prisma.jobQueue.groupBy({
    by: ["queueName", "status"],
    _count: true,
    where: { status: "pending" },
  });
  console.log("pending by queue", counts);
  const vm = await prisma.voicemailMessage.findFirst({
    where: { createdAt: { gte: new Date("2026-10-02T23:50:00Z") } },
    orderBy: { createdAt: "desc" },
    select: { id: true, workspaceId: true, callerE164: true, createdAt: true, voiceCallId: true },
  });
  console.log("voicemail", vm);
  const { loadMctbConsentMode } = await import("../src/lib/mctb/consent-prompt/service");
  console.log("consent ws_1", await loadMctbConsentMode("ws_1"));
}

main();
