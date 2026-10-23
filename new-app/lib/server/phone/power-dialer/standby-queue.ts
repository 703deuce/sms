import { getPrisma } from "@/lib/server/db";
import type { Contact, ContactListMember } from "@prisma/client";

export type QueueMemberRow = ContactListMember & {
  contact: Contact & { phones?: { e164: string; priority: number; isPreferred: boolean; outcome: string | null }[] };
  sourceListId: string;
  sourceListName: string;
};

export type SessionQueueContext = {
  members: QueueMemberRow[];
  activeListId: string;
  activeListName: string;
  waterfallIndex: number;
  waterfallReason: string | null;
  listChain: { id: string; name: string }[];
};

type MemberWithContact = ContactListMember & {
  contact: QueueMemberRow["contact"];
};

async function loadListMembers(listId: string, listName: string): Promise<QueueMemberRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.contactListMember.findMany({
    where: { listId },
    include: { contact: { include: { phones: true } } },
    orderBy: [{ queueSortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((m) => ({
    ...m,
    sourceListId: listId,
    sourceListName: listName,
  }));
}

/** M24 — primary list then standby lists; members tagged with source list. */
export async function loadSessionQueueMembers(input: {
  primaryListId: string;
  primaryListName: string;
  standbyListIds?: string[];
}): Promise<{ allMembers: QueueMemberRow[]; listChain: { id: string; name: string }[] }> {
  const prisma = getPrisma();
  const chain: { id: string; name: string }[] = [
    { id: input.primaryListId, name: input.primaryListName },
  ];
  const standby = (input.standbyListIds || []).filter(Boolean);
  if (standby.length) {
    const lists = await prisma.contactList.findMany({
      where: { id: { in: standby } },
      select: { id: true, name: true },
    });
    const byId = new Map(lists.map((l) => [l.id, l.name]));
    for (const id of standby) {
      chain.push({ id, name: byId.get(id) || "Standby list" });
    }
  }

  const allMembers: QueueMemberRow[] = [];
  for (const link of chain) {
    const chunk = await loadListMembers(link.id, link.name);
    allMembers.push(...chunk);
  }
  return { allMembers, listChain: chain };
}

/** Pick active waterfall list from eligibility per list segment. */
export function resolveWaterfallActiveList(
  listChain: { id: string; name: string }[],
  members: QueueMemberRow[],
  isEligible: (m: MemberWithContact) => boolean,
  persistedIndex = 0,
): { index: number; reason: string | null; activeMembers: QueueMemberRow[] } {
  const start = Math.min(Math.max(0, persistedIndex), listChain.length - 1);
  for (let i = start; i < listChain.length; i++) {
    const listId = listChain[i].id;
    const slice = members.filter((m) => m.sourceListId === listId);
    const hasEligible = slice.some((m) => isEligible(m));
    if (hasEligible) {
      return {
        index: i,
        reason: i > 0 ? "primary_exhausted" : null,
        activeMembers: slice,
      };
    }
  }
  const last = listChain[listChain.length - 1];
  return {
    index: listChain.length - 1,
    reason: "no_eligible_in_chain",
    activeMembers: members.filter((m) => m.sourceListId === last.id),
  };
}
