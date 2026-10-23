import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import {
  assertCanWriteContact,
  assertCrmRead,
  assertCrmWrite,
  contactVisibleToUser,
} from "./permissions";
import { lockContactFieldForUserEdit } from "./sync-field-apply";

export async function listNativeContacts(
  workspaceId: string,
  opts: {
    q?: string;
    page?: number;
    pageSize?: number;
    folderId?: string;
    ownerUserId?: string;
    viewId?: string;
    tagId?: string;
  },
) {
  const { userId, isAdmin } = await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  const { getOrCreateWorkspaceCrmSettings } = await import("./crm-settings");
  const settings = await getOrCreateWorkspaceCrmSettings(workspaceId);
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const term = opts.q?.trim() || "";
  const digits = term.replace(/\D/g, "");

  let filters: Record<string, unknown> = {};
  if (opts.viewId) {
    const view = await prisma.contactSavedView.findFirst({
      where: { id: opts.viewId, workspaceId },
    });
    if (view?.filtersJson && typeof view.filtersJson === "object") {
      filters = view.filtersJson as Record<string, unknown>;
    }
  }

  const ownerFilter =
    opts.ownerUserId ||
    (settings.teamScopes.contactsRead === "owned" && !isAdmin ? userId : undefined);

  const where = {
    workspaceId,
    status: { not: "INVALID" as const },
    ...(opts.folderId ? { folderId: opts.folderId } : {}),
    ...(ownerFilter ? { OR: [{ ownerUserId: ownerFilter }, { assignedUser: ownerFilter }] } : {}),
    ...(opts.tagId
      ? { tagMembers: { some: { tagId: opts.tagId } } }
      : {}),
    ...(filters.leadStage ? { leadStage: String(filters.leadStage) } : {}),
    ...(term
      ? {
          OR: [
            { firstName: { contains: term, mode: "insensitive" as const } },
            { lastName: { contains: term, mode: "insensitive" as const } },
            { company: { contains: term, mode: "insensitive" as const } },
            { email: { contains: term, mode: "insensitive" as const } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        folder: { select: { id: true, name: true } },
        tagMembers: { include: { tag: { select: { id: true, name: true } } } },
      },
    }),
  ]);

  const visible = rows.filter((c) => contactVisibleToUser(c, userId, isAdmin));
  return {
    total,
    page,
    pageSize,
    contacts: visible.map((c) => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
      phone: c.phone,
      email: c.email,
      company: c.company,
      title: c.title,
      status: c.status,
      ownerUserId: c.ownerUserId || c.assignedUser,
      timezone: c.timezone,
      folder: c.folder,
      tags: c.tagMembers.map((t) => t.tag),
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function patchNativeContact(
  workspaceId: string,
  contactId: string,
  input: Record<string, unknown>,
) {
  const { userId, isAdmin, writeScope } = await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
  if (!contact) throw new Error("Contact not found");
  if (!contactVisibleToUser(contact, userId, isAdmin)) throw new Error("Not allowed");
  assertCanWriteContact(contact, userId, isAdmin, writeScope);

  const data: Record<string, unknown> = {};
  const lockKeys: string[] = [];
  for (const key of [
    "firstName",
    "lastName",
    "email",
    "title",
    "company",
    "leadSource",
    "leadStage",
    "timezone",
    "ownerUserId",
    "folderId",
    "crmCompanyId",
  ]) {
    if (input[key] !== undefined) {
      data[key] = input[key];
      lockKeys.push(key);
    }
  }
  if (input.refresherNotes !== undefined) {
    const custom =
      contact.customFields && typeof contact.customFields === "object"
        ? { ...(contact.customFields as object) }
        : {};
    (custom as Record<string, unknown>).refresherNotes = input.refresherNotes;
    data.customFields = custom;
  }
  if (input.phone && typeof input.phone === "string") {
    data.phone = normalizeE164(input.phone);
    lockKeys.push("phone");
  }

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: data as import("@prisma/client").Prisma.ContactUpdateInput,
  });
  for (const key of lockKeys) {
    await lockContactFieldForUserEdit({ workspaceId, contactId, fieldKey: key });
  }
  return updated;
}

export async function bulkPatchContacts(
  workspaceId: string,
  contactIds: string[],
  patch: { ownerUserId?: string; folderId?: string | null; leadStage?: string; tagIds?: string[] },
) {
  const { userId, isAdmin, writeScope } = await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  let updated = 0;
  for (const id of contactIds) {
    const contact = await prisma.contact.findFirst({ where: { id, workspaceId } });
    if (!contact || !contactVisibleToUser(contact, userId, isAdmin)) continue;
    try {
      assertCanWriteContact(contact, userId, isAdmin, writeScope);
    } catch {
      continue;
    }
    await prisma.contact.update({
      where: { id },
      data: {
        ...(patch.ownerUserId !== undefined ? { ownerUserId: patch.ownerUserId } : {}),
        ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
        ...(patch.leadStage !== undefined ? { leadStage: patch.leadStage } : {}),
      },
    });
    if (patch.tagIds?.length) {
      for (const tagId of patch.tagIds) {
        await prisma.contactTag.upsert({
          where: { tagId_contactId: { tagId, contactId: id } },
          create: { tagId, contactId: id },
          update: {},
        });
      }
    }
    updated += 1;
  }
  return { updated };
}

export async function mergeContacts(workspaceId: string, primaryId: string, mergedId: string) {
  const { userId, isAdmin, writeScope } = await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  if (primaryId === mergedId) throw new Error("Cannot merge contact with itself");
  const [primary, merged] = await Promise.all([
    prisma.contact.findFirst({ where: { id: primaryId, workspaceId } }),
    prisma.contact.findFirst({ where: { id: mergedId, workspaceId } }),
  ]);
  if (!primary || !merged) throw new Error("Contact not found");
  assertCanWriteContact(primary, userId, isAdmin, writeScope);
  assertCanWriteContact(merged, userId, isAdmin, writeScope);

  await prisma.contactMergeRecord.create({
    data: {
      workspaceId,
      primaryContactId: primaryId,
      mergedContactId: mergedId,
      mergedByUserId: userId,
      mergedSnapshot: merged as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  await prisma.powerDialerAttempt.updateMany({
    where: { contactId: mergedId },
    data: { contactId: primaryId },
  });
  await prisma.crmTask.updateMany({ where: { contactId: mergedId }, data: { contactId: primaryId } });
  await prisma.crmDeal.updateMany({ where: { contactId: mergedId }, data: { contactId: primaryId } });
  await prisma.contactActivityEvent.updateMany({
    where: { contactId: mergedId },
    data: { contactId: primaryId },
  });

  await prisma.contact.update({
    where: { id: mergedId },
    data: { status: "INVALID", customFields: { mergedInto: primaryId } },
  });

  return { primaryContactId: primaryId, mergedContactId: mergedId };
}

export async function exportContactsCsv(workspaceId: string) {
  await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  const rows = await prisma.contact.findMany({
    where: { workspaceId, status: { not: "INVALID" } },
    take: 5000,
    orderBy: { createdAt: "desc" },
  });
  const header = "id,firstName,lastName,phone,email,title,company,leadSource,leadStage,timezone\n";
  const body = rows
    .map((c) =>
      [
        c.id,
        c.firstName || "",
        c.lastName || "",
        c.phone,
        c.email || "",
        c.title || "",
        c.company || "",
        c.leadSource || "",
        c.leadStage || "",
        c.timezone || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  return header + body;
}

export async function listFolders(workspaceId: string) {
  await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  return prisma.contactFolder.findMany({
    where: { workspaceId },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { children: true },
  });
}

export async function upsertFolder(
  workspaceId: string,
  input: { id?: string; name: string; parentId?: string | null; sortOrder?: number },
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  if (input.id) {
    return prisma.contactFolder.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }
  return prisma.contactFolder.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function listSavedViews(workspaceId: string) {
  const { userId } = await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  return prisma.contactSavedView.findMany({
    where: { workspaceId, OR: [{ ownerUserId: null }, { ownerUserId: userId }] },
    orderBy: [{ pinned: "desc" }, { name: "asc" }],
  });
}

export async function upsertSavedView(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    filtersJson: Record<string, unknown>;
    pinned?: boolean;
    ownerUserId?: string | null;
  },
) {
  const { userId } = await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  if (input.id) {
    return prisma.contactSavedView.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        filtersJson: input.filtersJson as import("@prisma/client").Prisma.InputJsonValue,
        pinned: Boolean(input.pinned),
      },
    });
  }
  return prisma.contactSavedView.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      filtersJson: input.filtersJson as import("@prisma/client").Prisma.InputJsonValue,
      pinned: Boolean(input.pinned),
      ownerUserId: input.ownerUserId ?? userId,
    },
  });
}

export async function reassignContactOwner(
  workspaceId: string,
  contactId: string,
  newOwnerUserId: string,
  allowCrossRep: boolean,
) {
  const { userId, isAdmin, writeScope } = await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
  if (!contact) throw new Error("Contact not found");
  if (!contactVisibleToUser(contact, userId, isAdmin)) throw new Error("Not allowed");
  if (!isAdmin && !allowCrossRep && writeScope === "owned") {
    const owner = contact.ownerUserId || contact.assignedUser;
    if (owner && owner !== userId) throw new Error("Cross-agent reassignment not permitted");
  }
  return prisma.contact.update({
    where: { id: contactId },
    data: { ownerUserId: newOwnerUserId, assignedUser: newOwnerUserId },
  });
}

export async function addContactNote(workspaceId: string, contactId: string, body: string) {
  const { userId, isAdmin } = await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
  if (!contact || !contactVisibleToUser(contact, userId, isAdmin)) throw new Error("Not allowed");
  return prisma.contactActivityEvent.create({
    data: {
      workspaceId,
      contactId,
      kind: "note",
      title: "Note",
      body: body.trim(),
      metadata: { authorUserId: userId },
    },
  });
}
