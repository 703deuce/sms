#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";

async function main() {
  const suffix = process.argv[2] || "oATFW5UYHFah";
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: { contains: suffix } },
    select: { id: true, metadata: true },
  });
  if (!call) {
    console.log("not_found");
    return;
  }
  const meta = (call.metadata || {}) as Record<string, unknown>;
  const forensics = (meta.voiceV3Forensics || {}) as Record<string, unknown>;
  const turns = Array.isArray(forensics.canonicalTurns) ? forensics.canonicalTurns : [];
  const events = Array.isArray(forensics.events) ? forensics.events : [];
  console.log(
    JSON.stringify({
      callId: call.id,
      canonicalTurnCount: turns.length,
      forensicEventCount: events.length,
      forensicsFinal: forensics.final,
      roles: turns.reduce(
        (acc: Record<string, number>, t: { role?: string }) => {
          const r = String(t.role || "unknown");
          acc[r] = (acc[r] || 0) + 1;
          return acc;
        },
        {},
      ),
    }),
  );
}

main();
