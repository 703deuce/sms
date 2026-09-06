#!/usr/bin/env tsx
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

import { getPrisma } from "../src/lib/db";

const id = process.argv[2] || "cmtpfnp2s213u32144h2d5d1c";

async function main() {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findUnique({ where: { id } });
  if (!row) throw new Error("not found");
  const m = (row.metadata || {}) as Record<string, unknown>;
  const timeline = Array.isArray(m.timeline) ? m.timeline : [];
  console.log(JSON.stringify({
    id: row.id,
    startsAt: row.startsAt,
    externalId: row.externalId,
    smsConsent: m.smsConsent,
    reminderGeneration: m.reminderGeneration,
    reminderSentKeys: m.reminderSentKeys,
    timeline: timeline.map((t: { type: string; label: string }) => `${t.type}:${t.label}`),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
