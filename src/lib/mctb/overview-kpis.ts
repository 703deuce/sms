import "server-only";

import { getPrisma } from "@/lib/db";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";
import { isRecoveryTextSent, isCustomerReplied } from "@/lib/mctb/analytics-metric-definitions";
import { startOfWorkspaceDayUtc, loadWorkspaceTimeZone } from "@/lib/mctb/workspace-timezone";

export type MctbOverviewKpis = {
  windowLabel: string;
  timeZone: string;
  missedCalls: number;
  recoveryTextsSent: number;
  customerReplies: number;
  needsReplyCount: number;
};

export async function loadMctbOverviewKpis(workspaceId: string): Promise<MctbOverviewKpis> {
  const prisma = getPrisma();
  const timeZone = await loadWorkspaceTimeZone(workspaceId);
  const todayStart = startOfWorkspaceDayUtc(new Date(), timeZone);

  const [events, needsReplyCount] = await Promise.all([
    prisma.missedCallEvent.findMany({
      where: { workspaceId, detectedAt: { gte: todayStart } },
      select: { status: true, smsSentAt: true },
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

  const missedCalls = events.length;
  const recoveryTextsSent = events.filter((e) =>
    isRecoveryTextSent({ ...e, eligible: false, suppressionReason: null, detectedAt: todayStart }),
  ).length;
  const customerReplies = events.filter((e) =>
    isCustomerReplied({
      ...e,
      eligible: false,
      suppressionReason: null,
      detectedAt: todayStart,
    }),
  ).length;

  return {
    windowLabel: "Today",
    timeZone,
    missedCalls,
    recoveryTextsSent,
    customerReplies,
    needsReplyCount,
  };
}
