#!/usr/bin/env tsx
import Module from "node:module";
const ol = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = (r: string, p: unknown, m: boolean) => {
  if (r === "server-only") return {};
  return ol(r, p, m);
};
import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const conns = await prisma.voiceCalendarConnection.findMany({
    where: { provider: "microsoft" },
  });
  console.log("Microsoft connections:");
  for (const c of conns) {
    const ws = await prisma.workspace.findUnique({
      where: { id: c.workspaceId },
      select: { slug: true, name: true, displayName: true },
    });
    const cfg = (c.config || {}) as Record<string, unknown>;
    console.log({
      workspaceId: c.workspaceId,
      slug: ws?.slug,
      workspaceName: ws?.displayName || ws?.name,
      connName: c.name,
      status: c.status,
      email: cfg.email,
      writeCalendarId: cfg.writeCalendarId,
      blocking: cfg.blockingCalendarIds,
      import: cfg.importCalendarIds,
    });
  }

  const setups = await prisma.solutionSetup.findMany({
    where: { solutionType: "appointments-platform" },
    select: { workspaceId: true, configJson: true },
  });
  console.log("\nAppointments setups:", setups.length);
  for (const s of setups) {
    const ws = await prisma.workspace.findUnique({ where: { id: s.workspaceId } });
    const cfg = (s.configJson || {}) as Record<string, unknown>;
    const types = await prisma.voiceService.count({ where: { workspaceId: s.workspaceId } });
    const appts = await prisma.voiceAppointment.count({ where: { workspaceId: s.workspaceId } });
    console.log({
      workspaceId: s.workspaceId,
      slug: ws?.slug,
      types,
      appts,
      bookingEnabled: cfg.bookingEnabled,
      timezone: cfg.timezone,
    });
  }
}

main().catch(console.error);
