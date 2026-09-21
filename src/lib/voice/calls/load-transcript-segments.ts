import "server-only";

import { getPrisma } from "@/lib/db";

export async function loadTranscriptsWithSegmentsForCall(callId: string) {
  const prisma = getPrisma();
  const rows = (await prisma.voiceTranscript.findMany({ where: { callId } })) ?? [];
  return Promise.all(
    rows.map(async (t) => ({
      ...t,
      segments:
        (await prisma.voiceTranscriptSegment.findMany({
          where: { transcriptId: t.id },
          orderBy: { startMs: "asc" },
        })) ?? [],
    })),
  );
}

export async function callIdsWithTranscripts(callIds: string[]): Promise<Set<string>> {
  if (!callIds.length) return new Set();
  const prisma = getPrisma();
  const rows =
    (await prisma.voiceTranscript.findMany({
      where: { callId: { in: callIds } },
      select: { callId: true },
    })) ?? [];
  return new Set(rows.map((r) => r.callId));
}
