import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { mergePowerDialerSettings } from "@/lib/products/power-dialer";
import { parseExtendedConfig } from "./campaign-extended-config";

/** Sticky caller ID: campaign override → workspace default → campaign.callerIdE164. No rotation. */
export async function resolvePowerDialerOutboundCallerId(input: {
  workspaceId: string;
  campaignId: string;
  repUserId?: string | null;
  contactPhone?: string | null;
}): Promise<{ e164: string; phoneNumberId: string | null; source: string }> {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const ext = parseExtendedConfig(campaign.configJson);
  const wsRow = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const pdSettings = mergePowerDialerSettings(
    (wsRow?.customFieldsConfig as { powerDialer?: unknown })?.powerDialer,
  );
  const poolIds = Array.isArray(ext.callerIdPoolNumberIds)
    ? ext.callerIdPoolNumberIds.filter((x): x is string => typeof x === "string")
    : [];

  const pickFromPool = async (): Promise<{ e164: string; id: string } | null> => {
    if (!poolIds.length) return null;
    const stickyKey = `${input.campaignId}:${input.repUserId || "all"}`;
    const stickyIndex =
      Math.abs(stickyKey.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % poolIds.length;
    const phoneNumberId = poolIds[stickyIndex];
    const num = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId: input.workspaceId },
      select: { id: true, e164: true },
    });
    if (!num) return null;
    return { e164: num.e164, id: num.id };
  };

  if (typeof ext.callerIdPhoneNumberId === "string" && ext.callerIdPhoneNumberId) {
    const num = await prisma.phoneNumber.findFirst({
      where: { id: ext.callerIdPhoneNumberId, workspaceId: input.workspaceId },
    });
    if (num) {
      return { e164: num.e164, phoneNumberId: num.id, source: "campaign_number" };
    }
  }

  const pooled = await pickFromPool();
  if (pooled) {
    return { e164: pooled.e164, phoneNumberId: pooled.id, source: "sticky_pool" };
  }

  if (typeof pdSettings.defaultCallerIdPhoneNumberId === "string") {
    const num = await prisma.phoneNumber.findFirst({
      where: { id: pdSettings.defaultCallerIdPhoneNumberId, workspaceId: input.workspaceId },
    });
    if (num) {
      return { e164: num.e164, phoneNumberId: num.id, source: "workspace_default" };
    }
  }

  return {
    e164: normalizeE164(campaign.callerIdE164),
    phoneNumberId: null,
    source: "campaign_e164",
  };
}
