import "server-only";

import { getPrisma } from "@/lib/server/db";
import { loadMctbRecoveryConfig } from "@/lib/server/mctb/config";
import { loadMctbConsentMode } from "@/lib/server/mctb/attestation";
import { readPhoneMctbInbound } from "@/lib/server/mctb/phone-line-config";

export type MctbOverviewSnapshot = {
  masterEnabled: boolean;
  activeLines: number;
  missedToday: number;
  textsSentToday: number;
  needsReply: number;
  consentMode: string;
  recentMissed: {
    id: string;
    callerE164: string;
    status: string;
    detectedAt: string;
    smsSentAt: string | null;
  }[];
};

export async function loadMctbOverviewForNewApp(workspaceId: string): Promise<MctbOverviewSnapshot> {
  const prisma = getPrisma();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [config, consentMode, numbers, missedToday, textsToday, needsReply, recent] = await Promise.all([
    loadMctbRecoveryConfig(workspaceId),
    loadMctbConsentMode(workspaceId),
    prisma.phoneNumber.findMany({
      where: { workspaceId, status: "Active" },
      select: { settingsJson: true },
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, detectedAt: { gte: startOfDay } },
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, smsSentAt: { gte: startOfDay } },
    }),
    prisma.conversation.count({
      where: {
        workspaceId,
        status: "OPEN",
        unread: true,
        productSource: "MCTB",
      },
    }),
    prisma.missedCallEvent.findMany({
      where: { workspaceId },
      orderBy: { detectedAt: "desc" },
      take: 6,
      select: {
        id: true,
        callerE164: true,
        status: true,
        detectedAt: true,
        smsSentAt: true,
      },
    }),
  ]);

  const activeLines = numbers.filter((n) => readPhoneMctbInbound(n.settingsJson).enabled).length;

  return {
    masterEnabled: config.masterEnabled && config.enabled,
    activeLines,
    missedToday,
    textsSentToday: textsToday,
    needsReply,
    consentMode,
    recentMissed: recent.map((r) => ({
      id: r.id,
      callerE164: r.callerE164,
      status: r.status,
      detectedAt: r.detectedAt.toISOString(),
      smsSentAt: r.smsSentAt?.toISOString() ?? null,
    })),
  };
}
