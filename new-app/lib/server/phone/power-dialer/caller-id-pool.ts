import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { parseExtendedConfig } from "./campaign-extended-config";
import { startOfDayInTimezone } from "./timezone-window";

export type CallerIdPick = {
  e164: string;
  phoneNumberId: string | null;
  source: string;
  blockReason?: string;
};

function areaCodeFromE164(e164: string): string | null {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return d.slice(1, 4);
  if (d.length >= 10) return d.slice(-10, -7);
  return null;
}

async function countDialsTodayForNumber(
  workspaceId: string,
  phoneNumberId: string,
  timezone: string,
): Promise<number> {
  const prisma = getPrisma();
  const start = startOfDayInTimezone(new Date(), timezone);
  return prisma.powerDialerAttempt.count({
    where: {
      workspaceId,
      createdAt: { gte: start },
      humanCall: { phoneNumberId },
    },
  });
}

/** M43/M44/M45 — pool rotation, local presence, per-number daily cap. */
export async function pickCampaignCallerId(input: {
  workspaceId: string;
  campaignId: string;
  repUserId?: string | null;
  contactPhone?: string | null;
  timezone: string;
}): Promise<CallerIdPick> {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");
  const ext = parseExtendedConfig(campaign.configJson);
  const cfg =
    campaign.configJson && typeof campaign.configJson === "object"
      ? (campaign.configJson as Record<string, unknown>)
      : {};
  const rotationMode = (cfg.callerIdRotationMode as string) || "sticky";
  const dailyCap =
    typeof cfg.numberPoolDailyCap === "number" && cfg.numberPoolDailyCap > 0
      ? cfg.numberPoolDailyCap
      : 200;
  const poolIds = Array.isArray(ext.callerIdPoolNumberIds)
    ? ext.callerIdPoolNumberIds.filter((x): x is string => typeof x === "string")
    : [];

  const loadNumbers = async (ids: string[]) => {
    if (!ids.length) return [];
    return prisma.phoneNumber.findMany({
      where: { workspaceId: input.workspaceId, id: { in: ids }, status: "Active" },
      select: { id: true, e164: true },
    });
  };

  let candidates = await loadNumbers(poolIds);
  if (rotationMode === "local_presence" && input.contactPhone) {
    const want = areaCodeFromE164(normalizeE164(input.contactPhone));
    if (want) {
      const local = candidates.filter((n) => areaCodeFromE164(n.e164) === want);
      if (local.length) candidates = local;
    }
  }

  const pointer =
    typeof cfg.callerIdRotationPointer === "number" ? cfg.callerIdRotationPointer : 0;

  if (candidates.length) {
    for (let i = 0; i < candidates.length; i++) {
      const idx = (pointer + i) % candidates.length;
      const num = candidates[idx];
      const used = await countDialsTodayForNumber(input.workspaceId, num.id, input.timezone);
      if (used >= dailyCap) continue;
      return {
        e164: num.e164,
        phoneNumberId: num.id,
        source: rotationMode === "local_presence" ? "local_presence_pool" : "rotating_pool",
      };
    }
    return {
      e164: normalizeE164(campaign.callerIdE164),
      phoneNumberId: null,
      source: "pool_exhausted",
      blockReason: "All pool numbers reached daily dial cap",
    };
  }

  const { resolvePowerDialerOutboundCallerId } = await import("./caller-id-resolution");
  const base = await resolvePowerDialerOutboundCallerId({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    repUserId: input.repUserId,
    contactPhone: input.contactPhone,
  });
  return { e164: base.e164, phoneNumberId: base.phoneNumberId, source: base.source };
}

export async function advanceCallerIdRotationPointer(
  workspaceId: string,
  campaignId: string,
) {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) return;
  const cfg =
    campaign.configJson && typeof campaign.configJson === "object"
      ? { ...(campaign.configJson as object) }
      : {};
  const cur = typeof (cfg as { callerIdRotationPointer?: number }).callerIdRotationPointer === "number"
    ? (cfg as { callerIdRotationPointer: number }).callerIdRotationPointer
    : 0;
  await prisma.powerDialerCampaign.update({
    where: { id: campaignId },
    data: {
      configJson: {
        ...cfg,
        callerIdRotationPointer: cur + 1,
      } as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
}

export async function advanceTeamQueuePointer(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) return;
  const cfg =
    campaign.configJson && typeof campaign.configJson === "object"
      ? { ...(campaign.configJson as object) }
      : {};
  const cur = typeof (cfg as { teamQueuePointer?: number }).teamQueuePointer === "number"
    ? (cfg as { teamQueuePointer: number }).teamQueuePointer
    : 0;
  await prisma.powerDialerCampaign.update({
    where: { id: campaignId },
    data: {
      configJson: { ...cfg, teamQueuePointer: cur + 1 } as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
}
