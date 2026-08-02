import { getPrisma } from "@/lib/db";
import { checkCommunicationConsent } from "./consent-gate";

export type AudienceExclusion = {
  contactId?: string | null;
  phone?: string | null;
  reason: string;
};

export type CampaignAudienceSnapshot = {
  campaignId: string;
  workspaceId: string;
  frozenAt: string;
  source: Record<string, unknown>;
  acceptedPhones: string[];
  acceptedContactIds: string[];
  excluded: AudienceExclusion[];
  immutable: true;
};

/**
 * Resolve audience → immutable snapshot → normalize/dedupe phones →
 * opt-out/suppression checks → record exclusions.
 * CampaignRecipient rows are the durable snapshot; configJson holds the freeze marker.
 */
export async function freezeCampaignAudienceSnapshot(input: {
  workspaceId: string;
  campaignId: string;
  contactIds: string[];
  source?: Record<string, unknown>;
}): Promise<CampaignAudienceSnapshot> {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const cfg = ((campaign as { configJson?: unknown }).configJson || {}) as Record<string, unknown>;
  if (cfg.audienceSnapshotFrozenAt) {
    return {
      campaignId: input.campaignId,
      workspaceId: input.workspaceId,
      frozenAt: String(cfg.audienceSnapshotFrozenAt),
      source: (cfg.audienceSnapshotSource as Record<string, unknown>) || {},
      acceptedPhones: (cfg.audienceSnapshotPhones as string[]) || [],
      acceptedContactIds: (cfg.audienceSnapshotContactIds as string[]) || [],
      excluded: (cfg.audienceSnapshotExcluded as AudienceExclusion[]) || [],
      immutable: true,
    };
  }

  const contacts = (await prisma.contact.findMany({
    where: { workspaceId: input.workspaceId, id: { in: input.contactIds } },
    select: { id: true, phone: true, status: true },
  })) as Array<{ id: string; phone: string; status: string }>;

  const seen = new Set<string>();
  const acceptedPhones: string[] = [];
  const acceptedContactIds: string[] = [];
  const excluded: AudienceExclusion[] = [];

  for (const c of contacts) {
    const phone = (c.phone || "").trim();
    if (!phone) {
      excluded.push({ contactId: c.id, reason: "missing_phone" });
      continue;
    }
    const key = phone.replace(/\D/g, "");
    if (seen.has(key)) {
      excluded.push({ contactId: c.id, phone, reason: "duplicate_phone" });
      continue;
    }

    const consent = await checkCommunicationConsent({
      workspaceId: input.workspaceId,
      contactId: c.id,
      phone,
      channel: "marketing",
    });
    if (!consent.allowed) {
      excluded.push({ contactId: c.id, phone, reason: consent.reason || "consent_blocked" });
      continue;
    }

    seen.add(key);
    acceptedPhones.push(phone);
    acceptedContactIds.push(c.id);
  }

  const frozenAt = new Date().toISOString();
  await prisma.campaign.update({
    where: { id: input.campaignId },
    data: {
      configJson: {
        ...cfg,
        audienceSnapshotFrozenAt: frozenAt,
        audienceSnapshotSource: input.source || { kind: "segment_or_list" },
        audienceSnapshotPhones: acceptedPhones,
        audienceSnapshotContactIds: acceptedContactIds,
        audienceSnapshotExcluded: excluded,
        audienceImmutable: true,
      } as object,
    },
  });

  return {
    campaignId: input.campaignId,
    workspaceId: input.workspaceId,
    frozenAt,
    source: input.source || { kind: "segment_or_list" },
    acceptedPhones,
    acceptedContactIds,
    excluded,
    immutable: true,
  };
}

export function isCampaignAudienceFrozen(configJson: unknown): boolean {
  if (!configJson || typeof configJson !== "object") return false;
  return Boolean((configJson as Record<string, unknown>).audienceImmutable);
}
