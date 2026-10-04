#!/usr/bin/env npx tsx
import Module from "node:module";
const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();
  const hb = await prisma.workerHeartbeat.findMany({ orderBy: { lastBeatAt: "desc" }, take: 10 });
  console.log(JSON.stringify(hb, null, 2));
}

main();
