import { getPrisma } from "@/lib/db";
import type { AutomationCanvasNode, AutomationDefinition } from "../types";
import { outcomeResult } from "./resolve-outcome";

function listIdsFromConfig(config: Record<string, unknown>): string[] {
  const ids = config.listIds;
  return Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
}

export async function runAddContactToList(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  contactId: string,
  workspaceId: string,
) {
  const prisma = getPrisma();
  const listIds = listIdsFromConfig(node.data.config || {});
  if (!listIds.length) {
    return outcomeResult(def, node.id, "failed", { error: "no_lists" });
  }

  let added = 0;
  let already = 0;
  for (const listId of listIds) {
    const list = await prisma.contactList.findFirst({
      where: { id: listId, workspaceId },
    });
    if (!list) continue;
    const existing = await prisma.contactListMember.findUnique({
      where: { listId_contactId: { listId, contactId } },
    });
    if (existing) {
      already += 1;
      continue;
    }
    await prisma.contactListMember.create({ data: { listId, contactId } });
    added += 1;
    try {
      const { enrollForTrigger } = await import("../enroll");
      await enrollForTrigger(workspaceId, "customer_added_to_list", contactId, {
        listId,
      });
    } catch {
      /* non-fatal */
    }
  }

  if (added > 0) return outcomeResult(def, node.id, "added", { added, already });
  if (already > 0) {
    return outcomeResult(def, node.id, "already_on_list", { added, already });
  }
  return outcomeResult(def, node.id, "failed", { error: "lists_not_found" });
}

export async function runRemoveContactFromList(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  contactId: string,
  workspaceId: string,
) {
  const prisma = getPrisma();
  const listIds = listIdsFromConfig(node.data.config || {});
  if (!listIds.length) {
    return outcomeResult(def, node.id, "failed", { error: "no_lists" });
  }

  let removed = 0;
  let missing = 0;
  for (const listId of listIds) {
    const list = await prisma.contactList.findFirst({
      where: { id: listId, workspaceId },
    });
    if (!list) continue;
    const existing = await prisma.contactListMember.findUnique({
      where: { listId_contactId: { listId, contactId } },
    });
    if (!existing) {
      missing += 1;
      continue;
    }
    await prisma.contactListMember.delete({
      where: { listId_contactId: { listId, contactId } },
    });
    removed += 1;
    try {
      const { enrollForTrigger } = await import("../enroll");
      await enrollForTrigger(workspaceId, "customer_removed_from_list", contactId, {
        listId,
      });
    } catch {
      /* non-fatal */
    }
  }

  if (removed > 0) return outcomeResult(def, node.id, "removed", { removed });
  if (missing > 0) return outcomeResult(def, node.id, "wasnt_on_list", { missing });
  return outcomeResult(def, node.id, "failed", { error: "lists_not_found" });
}

export async function isContactOnLists(
  workspaceId: string,
  contactId: string,
  listIds: string[],
  matchMode: string,
): Promise<boolean> {
  if (!listIds.length) return false;
  const prisma = getPrisma();
  const validLists = await prisma.contactList.findMany({
    where: { workspaceId, id: { in: listIds } },
    select: { id: true },
  });
  const validIds = validLists.map((l) => l.id);
  if (!validIds.length) return false;
  const memberships = await prisma.contactListMember.findMany({
    where: {
      contactId,
      listId: { in: validIds },
    },
    select: { listId: true },
  });
  const on = new Set(memberships.map((m) => m.listId));
  if (matchMode === "all") return validIds.every((id) => on.has(id));
  if (matchMode === "none") return validIds.every((id) => !on.has(id));
  return validIds.some((id) => on.has(id));
}
