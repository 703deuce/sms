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

async function hasActiveRecurrenceChild(workspaceId: string, parentId: string) {
  const prisma = getPrisma();
  const recent = await prisma.campaign.findMany({
    where: {
      workspaceId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, status: true, configJson: true },
    take: 100,
    orderBy: { createdAt: "desc" },
  });
  return recent.some((row: (typeof recent)[number]) => {
    if (!row.configJson || typeof row.configJson !== "object") return false;
    const cfg = row.configJson as Record<string, unknown>;
    return (
      cfg.parentCampaignId === parentId &&
      ["SENDING", "SCHEDULED", "DRAFT"].includes(row.status)
    );
  });
}

export async function tickBroadcastRecurringCampaigns(workspaceId?: string) {
  const prisma = getPrisma();
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    take: 100,
    orderBy: { scheduledAt: "asc" },
  });

  const activated: string[] = [];

  for (const parent of campaigns) {
    const recurrence = parseBroadcastRecurrence(parent.configJson);
    if (!recurrence) continue;

    if (await hasActiveRecurrenceChild(parent.workspaceId, parent.id)) {
      continue;
    }

    const dueAt = parent.scheduledAt;
    const claimed = await prisma.campaign.updateMany({
      where: {
        id: parent.id,
        status: "SCHEDULED",
        scheduledAt: dueAt,
      },
      data: {
        status: "SCHEDULED",
      },
    });
    if (claimed.count !== 1) continue;

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

    const { enrollBroadcastAudience } = await import("@/lib/mass-texting/broadcast/audience");
    if (config.audience) {
      try {
        await enrollBroadcastAudience(parent.workspaceId, child.id, config.audience);
      } catch (err) {
        await prisma.campaign.update({
          where: { id: child.id },
          data: { status: "FAILED" },
        });
        await prisma.campaign.update({
          where: { id: parent.id },
          data: {
            scheduledAt: new Date(now.getTime() + 60 * 60 * 1000),
          },
        });
        continue;
      }
    }

    const { launchCampaignWithAudit } = await import("@/lib/mass-texting/campaign-launch");
    const launch = await launchCampaignWithAudit({
      workspaceId: parent.workspaceId,
      campaignId: child.id,
      userId: parent.createdBy,
      idempotencyKey: `recurrence:${parent.id}:${dueAt?.toISOString() ?? now.toISOString()}`,
      confirmLargeSend: true,
    });

    if (!launch.ok) {
      await prisma.campaign.update({
        where: { id: child.id },
        data: { status: "FAILED" },
      });
      await prisma.campaign.update({
        where: { id: parent.id },
        data: {
          scheduledAt: new Date(now.getTime() + 60 * 60 * 1000),
          configJson: {
            ...config,
            lastRecurrenceError: launch.error,
          } as Prisma.InputJsonValue,
        },
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
