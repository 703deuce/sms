import { getPrisma } from "@/lib/db";
import {
  contactMatchesSegment,
  parseSegmentConditions,
} from "@/lib/contacts/segment-query";

export async function contactMatchesSavedSegment(
  workspaceId: string,
  contactId: string,
  segmentId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const segment = await prisma.segment.findFirst({
    where: { id: segmentId, workspaceId },
  });
  if (!segment) return false;

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
  });
  if (!contact) return false;

  const tagRows = await prisma.contactTag.findMany({
    where: { contactId },
    include: { tag: true },
  });
  const tagNames = tagRows.map((r: { tag: { name: string } }) => r.tag.name);

  return contactMatchesSegment(
    {
      id: contact.id,
      status: contact.status,
      customFields: contact.customFields,
      tagNames,
      source: contact.consentSource,
      consentStatus: contact.status,
    },
    parseSegmentConditions(segment.conditions),
  );
}

export async function contactMatchesSavedSegments(
  workspaceId: string,
  contactId: string,
  segmentIds: string[],
  matchMode: string,
): Promise<boolean> {
  if (!segmentIds.length) return false;
  const results = await Promise.all(
    segmentIds.map((id) => contactMatchesSavedSegment(workspaceId, contactId, id)),
  );
  if (matchMode === "all") return results.every(Boolean);
  if (matchMode === "none") return results.every((r) => !r);
  return results.some(Boolean);
}
