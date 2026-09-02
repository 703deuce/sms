import "server-only";

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import {
  computeBroadcastNextRun,
  type ComposeRecurrence,
} from "@/lib/campaigns/recurrence-format";
import type { BroadcastCampaignConfig, BroadcastRecurrence } from "@/lib/mass-texting/broadcast/types";
import { isBroadcastCampaign } from "@/lib/mass-texting/broadcast/service";

export function parseBroadcastRecurrence(configJson: unknown): ComposeRecurrence | null {
  if (!isBroadcastCampaign(configJson)) return null;
  const config = configJson as BroadcastCampaignConfig;
  if (config.scheduleMode !== "recurring" || !config.recurrence) return null;
  return config.recurrence;
}

export async function tickBroadcastRecurringCampaigns(workspaceId?: string) {
  const prisma = getPrisma();
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      status: { in: ["SCHEDULED", "PAUSED"] },
      scheduledAt: { lte: now },
    },
    take: 100,
    orderBy: { scheduledAt: "asc" },
  });

  const activated: string[] = [];

  for (const parent of campaigns) {
    const recurrence = parseBroadcastRecurrence(parent.configJson);
    if (!recurrence) continue;

    const config = parent.configJson as BroadcastCampaignConfig;
    const child = await prisma.campaign.create({
      data: {
        workspaceId: parent.workspaceId,
        name: `${parent.name} — ${now.toISOString().slice(0, 10)}`,
        type: parent.type,
        category: parent.category,
        audience: parent.audience,
        body: parent.body,
        status: "DRAFT",
        sequenceJson: parent.sequenceJson as Prisma.InputJsonValue,
        configJson: {
          ...config,
          scheduleMode: "now",
          recurrence: undefined,
          parentCampaignId: parent.id,
          recurrenceRunAt: now.toISOString(),
        } as Prisma.InputJsonValue,
        createdBy: parent.createdBy,
      },
    });

    const { launchCampaignWithAudit } = await import("@/lib/mass-texting/campaign-launch");
    const launch = await launchCampaignWithAudit({
      workspaceId: parent.workspaceId,
      campaignId: child.id,
      userId: parent.createdBy,
      idempotencyKey: `recurrence:${parent.id}:${now.toISOString().slice(0, 16)}`,
      confirmLargeSend: true,
    });

    if (!launch.ok) {
      await prisma.campaign.update({
        where: { id: child.id },
        data: { status: "FAILED" },
      });
      continue;
    }

    const nextRecurrence: BroadcastRecurrence = {
      ...recurrence,
      runsCompleted: (recurrence.runsCompleted ?? 0) + 1,
    };
    const nextRun = computeBroadcastNextRun(nextRecurrence, now);
    const updatedConfig: BroadcastCampaignConfig = {
      ...config,
      recurrence: nextRecurrence,
    };

    await prisma.campaign.update({
      where: { id: parent.id },
      data: {
        configJson: updatedConfig as Prisma.InputJsonValue,
        scheduledAt: nextRun,
        status: nextRun ? "SCHEDULED" : "COMPLETED",
      },
    });

    activated.push(child.id);
  }

  if (activated.length) {
    const { processSequenceWaits } = await import("@/lib/campaigns/sequence-runner");
    await processSequenceWaits();
  }

  return { activated, count: activated.length };
}
