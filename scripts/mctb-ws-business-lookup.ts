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
  const biz = "+15714776175";
  const setups = await prisma.solutionSetup.findMany({
    where: { solutionKey: "missed_call_text_back" },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { workspaceId: true, status: true, updatedAt: true, configJson: true },
  });
  for (const s of setups) {
    const cfg = JSON.stringify(s.configJson || {});
    if (cfg.includes("5714776175") || cfg.includes("571-477")) {
      console.log("match", s.workspaceId, s.status, s.updatedAt, cfg.slice(0, 500));
    }
  }
  const mctb = await prisma.mctbWorkspaceConfig.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { workspaceId: true, businessLineE164: true, updatedAt: true, activationStatus: true },
  }).catch(() => []);
  console.log("mctb configs", mctb);
}

main();
