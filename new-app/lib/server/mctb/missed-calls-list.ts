import "server-only";

import { getPrisma } from "@/lib/server/db";

export type MctbMissedCallRow = {
  id: string;
  callerE164: string;
  businessE164: string;
  status: string;
  suppressionReason: string | null;
  detectedAt: string;
  smsSentAt: string | null;
  eligible: boolean;
};

export async function listMctbMissedCalls(input: {
  workspaceId: string;
  page: number;
  limit: number;
  q?: string;
}): Promise<{ rows: MctbMissedCallRow[]; total: number }> {
  const prisma = getPrisma();
  const q = input.q?.trim();
  const where = {
    workspaceId: input.workspaceId,
    ...(q
      ? {
          OR: [
            { callerE164: { contains: q.replace(/\D/g, "") } },
            { businessE164: { contains: q.replace(/\D/g, "") } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.missedCallEvent.count({ where }),
    prisma.missedCallEvent.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      skip: input.page * input.limit,
      take: input.limit,
      select: {
        id: true,
        callerE164: true,
        businessE164: true,
        status: true,
        suppressionReason: true,
        detectedAt: true,
        smsSentAt: true,
        eligible: true,
      },
    }),
  ]);
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      callerE164: r.callerE164,
      businessE164: r.businessE164,
      status: r.status,
      suppressionReason: r.suppressionReason,
      detectedAt: r.detectedAt.toISOString(),
      smsSentAt: r.smsSentAt?.toISOString() ?? null,
      eligible: r.eligible,
    })),
  };
}
