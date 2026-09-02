import "server-only";

import { getPrisma } from "@/lib/db";
import { attachMediaToFirstSmsStep } from "@/lib/campaigns/sequence-engine";
import { massTextProductConfigPatch } from "@/lib/mass-texting/campaign-send";
import { normalizeMediaUrls } from "@/lib/mass-texting/mms";
import { MASS_TEXT_RECURRING_PRODUCTION_ENABLED } from "@/lib/mass-texting/constants";
import { computeBroadcastNextRun, validateRecurrence } from "@/lib/campaigns/recurrence-format";
import { audienceSummaryLabel, enrollBroadcastAudience } from "./audience";
import type {
  BroadcastCampaignConfig,
  BroadcastCampaignInput,
  BroadcastRecurrence,
} from "./types";

export function isBroadcastCampaign(configJson: unknown): boolean {
  const config =
    configJson && typeof configJson === "object"
      ? (configJson as Record<string, unknown>)
      : {};
  return config.broadcastVersion === 1 && config.productSource === "mass_text";
}

export function broadcastCampaignWhere(workspaceId: string) {
  return { workspaceId };
}

function buildBroadcastSequence(message: string, mediaUrls: string[]) {
  const sequence = [
    {
      step_key: "sms_1",
      step_type: "send_sms" as const,
      config: { body: message, ...(mediaUrls.length ? { mediaUrls } : {}) },
    },
    { step_key: "end", step_type: "end" as const, config: {} },
  ];
  return attachMediaToFirstSmsStep(sequence, mediaUrls);
}

function recurrenceNextRun(recurrence: BroadcastRecurrence): Date {
  return computeBroadcastNextRun(recurrence, new Date()) ?? new Date(recurrence.startDate);
}

function buildConfig(input: BroadcastCampaignInput): BroadcastCampaignConfig {
  const mediaUrls = normalizeMediaUrls(input.mediaUrls);
  return {
    productSource: "mass_text",
    massTexting: true,
    broadcastVersion: 1,
    audience: input.audience,
    numberId: input.numberId,
    scheduleMode: input.scheduleMode,
    timezone: input.timezone,
    recurrence: input.recurrence,
    mediaUrls: mediaUrls.length ? mediaUrls : undefined,
    trackLinks: input.trackLinks ?? input.trackedLinks?.some((l) => l.tracked),
    trackedLinks: input.trackedLinks,
    messageType: mediaUrls.length ? "mms" : "sms",
  };
}

function resolveScheduledAt(input: BroadcastCampaignInput): Date | null {
  if (input.scheduleMode === "now") return null;
  if (input.scheduleMode === "later" && input.scheduledAt) {
    return new Date(input.scheduledAt);
  }
  if (input.scheduleMode === "recurring" && input.recurrence) {
    return recurrenceNextRun(input.recurrence);
  }
  return null;
}

function statusWhereClause(status?: string) {
  if (!status || status === "all") return {};
  const normalized = status.toLowerCase();
  if (normalized === "completed") {
    return { status: { in: ["COMPLETED" as const] } };
  }
  if (normalized === "failed") {
    return { status: { in: ["FAILED" as const] } };
  }
  if (normalized === "canceled") {
    return { status: { in: ["CANCELED" as const] } };
  }
  return {
    status: status.toUpperCase() as
      | "DRAFT"
      | "SCHEDULED"
      | "SENDING"
      | "COMPLETED"
      | "FAILED"
      | "PAUSED"
      | "CANCELED",
  };
}

export async function listBroadcastCampaigns(
  workspaceId: string,
  opts?: { take?: number; skip?: number; status?: string },
) {
  const prisma = getPrisma();
  const take = opts?.take ?? 50;
  const skip = opts?.skip ?? 0;
  // JSON path filters on configJson are unreliable on our Postgres adapter — filter in memory.
  const rows = await prisma.campaign.findMany({
    where: {
      workspaceId,
      ...statusWhereClause(opts?.status),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { _count: { select: { recipients: true } } },
  });
  return rows
    .filter((c: (typeof rows)[number]) => isBroadcastCampaign(c.configJson))
    .slice(skip, skip + take)
    .map((row: (typeof rows)[number]) => ({
      ...row,
      recipientCount: row._count?.recipients ?? 0,
    }));
}

export async function getBroadcastCampaign(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const row = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!row || !isBroadcastCampaign(row.configJson)) return null;
  return row;
}

export async function createBroadcastCampaign(
  workspaceId: string,
  input: BroadcastCampaignInput,
  createdBy?: string | null,
) {
  const prisma = getPrisma();
  const message = input.message.trim();
  if (!input.name.trim() || !message) {
    throw new Error("Campaign name and message are required");
  }
  if (!input.audience.include.length) {
    throw new Error("Select at least one audience");
  }
  if (input.scheduleMode === "recurring") {
    if (!MASS_TEXT_RECURRING_PRODUCTION_ENABLED) {
      throw new Error("Recurring campaigns are not enabled yet");
    }
    if (!input.recurrence) throw new Error("Recurrence settings are required");
    const recurrenceError = validateRecurrence(input.recurrence);
    if (recurrenceError) throw new Error(recurrenceError);
  }
  if (input.scheduleMode === "later") {
    const scheduledAt = resolveScheduledAt(input);
    if (!scheduledAt) {
      throw new Error("Scheduled date and time are required");
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new Error("Scheduled time must be in the future");
    }
  }

  const mediaUrls = normalizeMediaUrls(input.mediaUrls);
  const config = buildConfig(input);
  const configJson = massTextProductConfigPatch(config);
  const scheduledAt = resolveScheduledAt(input);

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      type: mediaUrls.length ? "MMS broadcast" : "SMS broadcast",
      category: input.category ?? null,
      audience: audienceSummaryLabel(input.audience),
      body: message,
      status: "DRAFT",
      scheduledAt,
      sequenceJson: buildBroadcastSequence(message, mediaUrls) as object,
      configJson: configJson as object,
      createdBy: createdBy ?? null,
    },
  });

  try {
    await enrollBroadcastAudience(workspaceId, campaign.id, input.audience);
  } catch (err) {
    await prisma.campaign.delete({ where: { id: campaign.id } }).catch(() => undefined);
    throw err;
  }
  return campaign;
}

export async function updateBroadcastCampaign(
  workspaceId: string,
  campaignId: string,
  input: Partial<BroadcastCampaignInput>,
) {
  const prisma = getPrisma();
  const existing = await getBroadcastCampaign(workspaceId, campaignId);
  if (!existing) throw new Error("Campaign not found");
  if (!["DRAFT", "SCHEDULED", "PAUSED"].includes(existing.status)) {
    throw new Error("Only draft or scheduled campaigns can be edited");
  }

  const prevConfig =
    existing.configJson && typeof existing.configJson === "object"
      ? (existing.configJson as BroadcastCampaignConfig)
      : null;

  const message = (input.message ?? existing.body).trim();
  const audience = input.audience ?? prevConfig?.audience ?? { include: [], exclude: [] };
  const mediaUrls = normalizeMediaUrls(input.mediaUrls ?? prevConfig?.mediaUrls);
  const scheduleMode = input.scheduleMode ?? prevConfig?.scheduleMode ?? "now";

  const merged: BroadcastCampaignInput = {
    name: input.name ?? existing.name,
    message,
    audience,
    numberId: input.numberId ?? prevConfig?.numberId,
    scheduleMode,
    scheduledAt:
      input.scheduledAt !== undefined
        ? input.scheduledAt
        : scheduleMode === "later" && existing.scheduledAt
          ? existing.scheduledAt.toISOString()
          : undefined,
    timezone: input.timezone ?? prevConfig?.timezone,
    recurrence: input.recurrence ?? prevConfig?.recurrence,
    mediaUrls,
    trackLinks: input.trackLinks ?? prevConfig?.trackLinks,
    trackedLinks: input.trackedLinks ?? prevConfig?.trackedLinks,
  };

  if (scheduleMode === "later") {
    const scheduledAt = resolveScheduledAt(merged);
    if (!scheduledAt) {
      throw new Error("Scheduled date and time are required");
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new Error("Scheduled time must be in the future");
    }
  }
  if (scheduleMode === "recurring") {
    if (!MASS_TEXT_RECURRING_PRODUCTION_ENABLED) {
      throw new Error("Recurring campaigns are not enabled");
    }
    if (!merged.recurrence) throw new Error("Recurrence settings are required");
    const recurrenceError = validateRecurrence(merged.recurrence);
    if (recurrenceError) throw new Error(recurrenceError);
  }

  const config = buildConfig(merged);
  const scheduledAt = resolveScheduledAt(merged);

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      name: merged.name.trim(),
      body: message,
      audience: audienceSummaryLabel(audience),
      scheduledAt,
      sequenceJson: buildBroadcastSequence(message, mediaUrls) as object,
      configJson: massTextProductConfigPatch(config) as object,
    },
  });

  if (input.audience) {
    await prisma.campaignRecipient.deleteMany({
      where: {
        campaignId,
        workspaceId,
        workflowStatus: { in: ["pending", "scheduled", "waiting", "in_progress"] },
      },
    });
    await prisma.campaignMessage.deleteMany({
      where: {
        campaignId,
        workspaceId,
        status: { in: ["queued", "sending"] },
      },
    });
    await enrollBroadcastAudience(workspaceId, campaignId, audience);
  }

  return updated;
}

export async function duplicateBroadcastCampaign(
  workspaceId: string,
  campaignId: string,
  createdBy?: string | null,
) {
  const source = await getBroadcastCampaign(workspaceId, campaignId);
  if (!source) throw new Error("Campaign not found");
  const config =
    source.configJson && typeof source.configJson === "object"
      ? (source.configJson as BroadcastCampaignConfig)
      : null;
  if (!config?.audience) throw new Error("Campaign has no audience definition");

  return createBroadcastCampaign(
    workspaceId,
    {
      name: `${source.name} (copy)`,
      message: source.body,
      audience: config.audience,
      numberId: config.numberId,
      scheduleMode: "now",
      timezone: config.timezone,
      mediaUrls: config.mediaUrls,
      trackLinks: config.trackLinks,
      trackedLinks: config.trackedLinks,
    },
    createdBy,
  );
}

export async function pauseBroadcastCampaign(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await getBroadcastCampaign(workspaceId, campaignId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "SENDING") {
    throw new Error("Only sending campaigns can be paused");
  }
  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED" },
  });
}

export async function resumeBroadcastCampaign(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await getBroadcastCampaign(workspaceId, campaignId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "PAUSED") {
    throw new Error("Only paused campaigns can be resumed");
  }
  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });
  const { enqueueDueCampaignMessages } = await import("@/lib/campaigns/campaign-processor");
  await enqueueDueCampaignMessages(workspaceId);
  return updated;
}

export async function cancelBroadcastCampaign(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await getBroadcastCampaign(workspaceId, campaignId);
  if (!campaign) throw new Error("Campaign not found");
  if (!["DRAFT", "SCHEDULED", "PAUSED", "SENDING"].includes(campaign.status)) {
    throw new Error("Only draft, scheduled, paused, or sending campaigns can be canceled");
  }

  await prisma.campaignMessage.updateMany({
    where: { campaignId, status: { in: ["queued", "sending"] } },
    data: { status: "cancelled", error: "campaign_canceled" },
  });
  await prisma.campaignRecipient.updateMany({
    where: {
      campaignId,
      workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
    },
    data: {
      workflowStatus: "stopped",
      stopReason: "campaign_canceled",
      completedAt: new Date(),
      enrollmentKey: null,
      nextActionAt: null,
    },
  });

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "CANCELED" },
  });

  const { settleCampaignReservation } = await import("@/lib/mass-texting/credit-accounting");
  await settleCampaignReservation(campaignId);

  return updated;
}

export function readBroadcastConfig(configJson: unknown): BroadcastCampaignConfig | null {
  if (!isBroadcastCampaign(configJson)) return null;
  return configJson as BroadcastCampaignConfig;
}
