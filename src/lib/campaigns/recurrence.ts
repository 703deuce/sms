import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { enrollListInCampaign } from "@/lib/campaigns/enroll-campaign";
import { processSequenceWaits } from "@/lib/campaigns/sequence-runner";

export type RecurrenceConfig = {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  nextRunAt: string;
  listId?: string;
};

export function parseRecurrence(configJson: unknown): RecurrenceConfig | null {
  if (!configJson || typeof configJson !== "object") return null;
  const obj = configJson as Record<string, unknown>;
  const rec = obj.recurrence;
  if (!rec || typeof rec !== "object") return null;
  const r = rec as Record<string, unknown>;
  const frequency = r.frequency;
  if (frequency !== "daily" && frequency !== "weekly" && frequency !== "monthly") return null;
  const interval = Number(r.interval || 1);
  const nextRunAt = String(r.nextRunAt || "");
  if (!nextRunAt) return null;
  return {
    frequency,
    interval: interval >= 1 ? interval : 1,
    nextRunAt,
    listId: r.listId ? String(r.listId) : undefined,
  };
}

export function hasRecurrence(configJson: unknown): boolean {
  return parseRecurrence(configJson) !== null;
}

function addInterval(date: Date, frequency: RecurrenceConfig["frequency"], interval: number): Date {
  const next = new Date(date);
  if (frequency === "daily") {
    next.setDate(next.getDate() + interval);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7 * interval);
  } else {
    next.setMonth(next.getMonth() + interval);
  }
  return next;
}

export async function tickRecurringCampaigns() {
  const prisma = getPrisma();
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: { in: ["SCHEDULED", "SENDING", "COMPLETED", "PAUSED"] },
    },
    take: 200,
    orderBy: { updatedAt: "desc" },
  });

  const activated: string[] = [];

  for (const parent of campaigns) {
    const recurrence = parseRecurrence(parent.configJson);
    if (!recurrence) continue;

    const nextRun = new Date(recurrence.nextRunAt);
    if (nextRun > now) continue;

    const childName = `${parent.name} — ${now.toISOString().slice(0, 10)}`;
    const child = await prisma.campaign.create({
      data: {
        workspaceId: parent.workspaceId,
        name: childName,
        type: parent.type,
        category: parent.category,
        audience: parent.audience,
        body: parent.body,
        status: "SENDING",
        sequenceJson: parent.sequenceJson as Prisma.InputJsonValue,
        configJson: {
          ...(parent.configJson as object),
          parentCampaignId: parent.id,
          recurrenceRunAt: now.toISOString(),
        } as Prisma.InputJsonValue,
        successMode: parent.successMode,
        dailySendLimit: parent.dailySendLimit,
        sendWindowStart: parent.sendWindowStart,
        sendWindowEnd: parent.sendWindowEnd,
        createdBy: parent.createdBy,
      },
    });

    const listId =
      recurrence.listId ||
      (parent.configJson as Record<string, unknown> | null)?.listId?.toString();

    if (listId) {
      await enrollListInCampaign(parent.workspaceId, child.id, listId);
    }

    const nextNext = addInterval(nextRun, recurrence.frequency, recurrence.interval);
    const updatedConfig = {
      ...(parent.configJson as object),
      recurrence: {
        ...recurrence,
        nextRunAt: nextNext.toISOString(),
      },
    };

    await prisma.campaign.update({
      where: { id: parent.id },
      data: {
        configJson: updatedConfig as Prisma.InputJsonValue,
        scheduledAt: nextNext,
      },
    });

    activated.push(child.id);
  }

  if (activated.length) {
    await processSequenceWaits();
  }

  return { activated, count: activated.length };
}
