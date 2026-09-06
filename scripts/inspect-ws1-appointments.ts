#!/usr/bin/env tsx
import Module from "node:module";
const ol = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = (r: string, p: unknown, m: boolean) => {
  if (r === "server-only") return {};
  return ol(r, p, m);
};
import { getPrisma } from "../src/lib/db";

async function main() {
  const p = getPrisma();
  const ws = "ws_1";
  const conns = await p.voiceCalendarConnection.findMany({ where: { workspaceId: ws } });
  console.log("connections:");
  for (const x of conns) {
    console.log(`  ${x.id} ${x.provider} ${x.name} ${x.status}`);
  }
  const services = await p.voiceService.findMany({ where: { workspaceId: ws } });
  console.log("services -> calendarId:");
  for (const x of services) {
    const cfg = (x.config || {}) as { enabled?: boolean };
    console.log(`  ${x.name} calendar=${x.calendarId} active=${cfg.enabled !== false}`);
  }
  const now = new Date();
  const future = await p.voiceAppointment.findMany({
    where: { workspaceId: ws, startsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    take: 10,
  });
  console.log(`future appointments: ${future.length}`);
  for (const a of future) {
    console.log(`  ${a.startsAt.toISOString()} ${a.serviceName} ${a.status}`);
  }
  const scheduled = await p.voiceAppointment.count({
    where: { workspaceId: ws, status: "scheduled", startsAt: { gte: now } },
  });
  const confirmed = await p.voiceAppointment.count({
    where: { workspaceId: ws, status: "confirmed", startsAt: { gte: now } },
  });
  console.log(`upcoming scheduled=${scheduled} confirmed=${confirmed}`);
}

main().catch(console.error);
