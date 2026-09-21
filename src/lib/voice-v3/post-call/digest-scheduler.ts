import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

/** Enqueue per-workspace digest jobs once per calendar day (idempotent). */
export async function scanAndEnqueueAfterHoursDigests(): Promise<{ queued: number }> {
  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { publishedVersionId: { not: null } },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });
  const dayKey = new Date().toISOString().slice(0, 10);
  let queued = 0;
  for (const { workspaceId } of agents) {
    await enqueueJob({
      jobType: "voice_after_hours_digest",
      queueName: "maintenance",
      payload: { workspaceId },
      idempotencyKey: `voice-after-hours-digest:${workspaceId}:${dayKey}`,
    });
    queued += 1;
  }
  return { queued };
}
