import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveSegmentContactIds } from "@/lib/contacts/segment-query";
import { validateBulkRecipients, type BulkRecipient } from "@/lib/campaigns/enroll-campaign";
import type {
  AudiencePreviewResult,
  BroadcastAudienceDefinition,
  BroadcastAudienceSelection,
} from "./types";

type ResolvedContact = {
  contactId: string;
  phone: string;
  displayName: string;
  email?: string;
};

async function contactsFromList(workspaceId: string, listId: string): Promise<ResolvedContact[]> {
  const prisma = getPrisma();
  const members = await prisma.contactListMember.findMany({
    where: { listId, contact: { workspaceId } },
    include: { contact: true },
  });
  return members
    .filter((m: (typeof members)[number]) => m.contact?.phone)
    .map((m: (typeof members)[number]) => ({
      contactId: m.contact!.id,
      phone: m.contact!.phone,
      displayName: [m.contact!.firstName, m.contact!.lastName].filter(Boolean).join(" ") || m.contact!.phone,
      email: m.contact!.email || undefined,
    }));
}

async function contactsFromSegment(workspaceId: string, segmentId: string): Promise<ResolvedContact[]> {
  const prisma = getPrisma();
  const segment = await prisma.segment.findFirst({ where: { id: segmentId, workspaceId } });
  if (!segment) return [];
  const contactIds = await resolveSegmentContactIds(workspaceId, segment.conditions);
  if (!contactIds.length) return [];
  const contacts = await prisma.contact.findMany({
    where: { workspaceId, id: { in: contactIds } },
  });
  return contacts
    .filter((c: (typeof contacts)[number]) => c.phone)
    .map((c: (typeof contacts)[number]) => ({
      contactId: c.id,
      phone: c.phone,
      displayName: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
      email: c.email || undefined,
    }));
}

async function contactsFromAllEligible(workspaceId: string): Promise<ResolvedContact[]> {
  const prisma = getPrisma();
  const contacts = await prisma.contact.findMany({
    where: { workspaceId, status: "SUBSCRIBED" },
  });
  return contacts
    .filter((c: (typeof contacts)[number]) => c.phone)
    .map((c: (typeof contacts)[number]) => ({
      contactId: c.id,
      phone: c.phone,
      displayName: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
      email: c.email || undefined,
    }));
}

async function contactsFromIndividual(workspaceId: string, contactId: string): Promise<ResolvedContact[]> {
  const prisma = getPrisma();
  const c = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
  if (!c?.phone) return [];
  return [
    {
      contactId: c.id,
      phone: c.phone,
      displayName: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
      email: c.email || undefined,
    },
  ];
}

async function resolveSelection(
  workspaceId: string,
  selection: BroadcastAudienceSelection[],
): Promise<ResolvedContact[]> {
  const out: ResolvedContact[] = [];
  for (const item of selection) {
    if (item.type === "all") {
      out.push(...(await contactsFromAllEligible(workspaceId)));
    } else if (item.type === "list") {
      out.push(...(await contactsFromList(workspaceId, item.id)));
    } else if (item.type === "segment") {
      out.push(...(await contactsFromSegment(workspaceId, item.id)));
    } else if (item.type === "contact") {
      out.push(...(await contactsFromIndividual(workspaceId, item.id)));
    }
  }
  return out;
}

function dedupeByPhone(contacts: ResolvedContact[]): {
  unique: ResolvedContact[];
  duplicateRemoved: number;
} {
  const map = new Map<string, ResolvedContact>();
  let duplicateRemoved = 0;
  for (const c of contacts) {
    if (map.has(c.phone)) duplicateRemoved += 1;
    else map.set(c.phone, c);
  }
  return { unique: [...map.values()], duplicateRemoved };
}

export async function previewBroadcastAudience(
  workspaceId: string,
  audience: BroadcastAudienceDefinition,
  campaignId?: string | null,
): Promise<AudiencePreviewResult> {
  const included = await resolveSelection(workspaceId, audience.include);
  const excluded = await resolveSelection(workspaceId, audience.exclude);
  const excludePhones = new Set(excluded.map((c) => c.phone));

  const { unique, duplicateRemoved } = dedupeByPhone(included);
  const selectedCount = unique.length;
  let excludedCount = 0;
  const afterExclude = unique.filter((c) => {
    if (excludePhones.has(c.phone)) {
      excludedCount += 1;
      return false;
    }
    return true;
  });

  const bulk: BulkRecipient[] = afterExclude.map((c) => ({
    phone: c.phone,
    contactId: c.contactId,
    displayName: c.displayName,
    email: c.email,
  }));

  const { accepted, rejected } = await validateBulkRecipients(workspaceId, campaignId ?? null, bulk);

  const suppressedRemoved = rejected.filter((r) => r.reason === "suppressed").length;
  const invalidRemoved = rejected.filter(
    (r) => r.reason === "invalid_phone" || r.reason === "missing_address",
  ).length;
  const unsubscribedRemoved = 0;

  const acceptedPhones = new Set(accepted.map((a) => a.phone).filter(Boolean));
  const eligible = afterExclude.filter((c) => acceptedPhones.has(c.phone));

  return {
    selectedCount,
    duplicateRemoved,
    excludedCount,
    suppressedRemoved,
    invalidRemoved,
    unsubscribedRemoved,
    eligibleCount: eligible.length,
    eligibleSample: eligible.slice(0, 5).map((c) => ({
      contactId: c.contactId,
      name: c.displayName,
      phone: c.phone,
    })),
  };
}

export async function enrollBroadcastAudience(
  workspaceId: string,
  campaignId: string,
  audience: BroadcastAudienceDefinition,
): Promise<{ enrolled: number; rejected: number }> {
  const preview = await previewBroadcastAudience(workspaceId, audience, campaignId);
  const included = await resolveSelection(workspaceId, audience.include);
  const excluded = await resolveSelection(workspaceId, audience.exclude);
  const excludePhones = new Set(excluded.map((c) => c.phone));
  const { unique } = dedupeByPhone(included);
  const afterExclude = unique.filter((c) => !excludePhones.has(c.phone));

  const bulk: BulkRecipient[] = afterExclude.map((c) => ({
    phone: c.phone,
    contactId: c.contactId,
    displayName: c.displayName,
    email: c.email,
  }));

  const { accepted, rejected } = await validateBulkRecipients(workspaceId, campaignId, bulk);
  const { enrollContactInCampaign } = await import("@/lib/campaigns/enroll-campaign");

  let enrolled = 0;
  for (const r of accepted) {
    await enrollContactInCampaign({
      workspaceId,
      campaignId,
      phone: r.phone,
      email: r.email,
      displayName: r.displayName,
      contactId: r.contactId,
    });
    enrolled += 1;
  }

  return { enrolled, rejected: rejected.length };
}

export function audienceSummaryLabel(audience: BroadcastAudienceDefinition): string {
  if (!audience.include.length) return "No audience";
  return audience.include.map((a) => a.name).join(", ");
}
