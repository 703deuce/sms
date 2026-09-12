import "server-only";

import { getPrisma } from "@/lib/db";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";
import {
  dateRangeFromFilter,
  missedCallsSummaryRangeLabel,
  type MissedCallsDateFilter,
} from "@/lib/mctb/missed-calls-list-filters";

export type MissedCallsListSummary = {
  missedCount: number;
  recoveryTextsCount: number;
  repliesCount: number;
  needsReplyCount: number;
  rangeLabel: string;
};

export async function loadMissedCallsListSummary(
  workspaceId: string,
  date: MissedCallsDateFilter = "all",
): Promise<MissedCallsListSummary> {
  const prisma = getPrisma();
  const detectedRange = dateRangeFromFilter(date);
  const detectedWhere = detectedRange ? { detectedAt: detectedRange } : {};

  const [missedCount, recoveryTextsCount, repliesCount, needsReplyCount] = await Promise.all([
    prisma.missedCallEvent.count({
      where: { workspaceId, ...detectedWhere },
    }),
    prisma.missedCallEvent.count({
      where: {
        workspaceId,
        smsSentAt: detectedRange ? { gte: detectedRange.gte } : { not: null },
      },
    }),
    prisma.missedCallEvent.count({
      where: {
        workspaceId,
        status: "CUSTOMER_REPLIED",
        ...(detectedRange ? { updatedAt: detectedRange } : {}),
      },
    }),
    prisma.conversation.count({
      where: {
        workspaceId,
        productSource: appProductSourceToPrisma("mctb"),
        status: "OPEN",
        unread: true,
      },
    }),
  ]);

  return {
    missedCount,
    recoveryTextsCount,
    repliesCount,
    needsReplyCount,
    rangeLabel: missedCallsSummaryRangeLabel(date),
  };
}
