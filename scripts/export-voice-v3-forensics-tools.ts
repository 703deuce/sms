#!/usr/bin/env tsx
import { getPrisma } from "../src/lib/db";

const suffix = process.argv[2]?.trim() ?? "vcrbyQoJ7aLi";

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: { contains: suffix } },
    select: { id: true, startedAt: true, endedAt: true, metadata: true },
  });
  if (!call) {
    console.error("no call for suffix", suffix);
    process.exit(1);
  }
  const meta = (call.metadata || {}) as Record<string, unknown>;
  const forensics = meta.voiceV3Forensics as Record<string, unknown> | undefined;
  console.log(
    JSON.stringify(
      {
        callId: call.id,
        startedAt: call.startedAt?.toISOString(),
        endedAt: call.endedAt?.toISOString(),
        forensicsKeys: forensics ? Object.keys(forensics) : null,
        forensics,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
