#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";

async function main() {
  const suffix = process.argv[2] || "oATFW5UYHFah";
  const prisma = getPrisma();
  const calls = await prisma.voiceCall.findMany({
    where: { id: { contains: suffix } },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: {
      id: true,
      status: true,
      appointmentBooked: true,
      durationSeconds: true,
      createdAt: true,
      workspaceId: true,
      agentId: true,
    },
  });
  const appts = await prisma.voiceAppointment.findMany({
    where: { callId: { contains: suffix } },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: {
      id: true,
      callId: true,
      provider: true,
      providerEventId: true,
      bookingAttemptId: true,
      createdAt: true,
    },
  });
  console.log(JSON.stringify({ voiceCalls: calls, voiceAppointments: appts }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
