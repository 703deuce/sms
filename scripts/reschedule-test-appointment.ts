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

const APPOINTMENT_ID = process.argv[2] || "cmtpfnp2s213u32144h2d5d1c";
const NEW_STARTS_AT = process.argv[3] || "2026-09-07T18:00:00.000Z";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const { reschedulePlatformAppointment } = await import("../src/lib/appointments/booking-platform");
  const prisma = getPrisma();
  const before = await prisma.voiceAppointment.findUnique({ where: { id: APPOINTMENT_ID } });
  if (!before) throw new Error("Appointment not found");
  console.log("Before:", {
    id: before.id,
    startsAt: before.startsAt.toISOString(),
    externalId: before.externalId,
    reminderGeneration: (before.metadata as { reminderGeneration?: number })?.reminderGeneration,
  });

  const updated = await reschedulePlatformAppointment(
    WORKSPACE_ID,
    APPOINTMENT_ID,
    NEW_STARTS_AT,
    "staff",
  );

  const after = await prisma.voiceAppointment.findUnique({ where: { id: APPOINTMENT_ID } });
  const meta = (after?.metadata || {}) as {
    reminderGeneration?: number;
    timeline?: Array<{ type: string; label: string }>;
  };
  console.log("After:", {
    id: updated.id,
    startsAt: updated.startsAt.toISOString(),
    externalId: updated.externalId,
    reminderGeneration: meta.reminderGeneration,
    timelineTail: meta.timeline?.slice(-3).map((t) => `${t.type}:${t.label}`),
  });
  console.log(updated.id === before.id ? "PASS same row updated" : "FAIL duplicate id");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
