import { getPrisma } from "@/lib/server/db";
import type { DuplicateBehavior } from "./campaign-extended-config";
import type { ParsedImportRow } from "./csv-import";

export async function applyCsvImportToList(
  workspaceId: string,
  listId: string,
  rows: ParsedImportRow[],
  options: {
    duplicateBehavior: DuplicateBehavior;
    defaultCountry?: string;
  },
) {
  const prisma = getPrisma();
  const list = await prisma.contactList.findFirst({ where: { id: listId, workspaceId } });
  if (!list) throw new Error("List not found");

  const accepted: { lineNumber: number; contactId: string }[] = [];
  const rejected: { lineNumber: number; reasons: string[] }[] = [];

  for (const row of rows) {
    if (row.errors.length) {
      rejected.push({ lineNumber: row.lineNumber, reasons: row.errors });
      continue;
    }
    const primary = row.phones.find((p) => p.e164);
    if (!primary?.e164) {
      rejected.push({ lineNumber: row.lineNumber, reasons: ["No valid phone"] });
      continue;
    }

    const parts = (row.name || "").trim().split(/\s+/);
    const firstName = parts[0] || null;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
    const customFields = { ...row.customFields };
    for (const p of row.phones) {
      if (p.e164 && p.field !== "phone") customFields[p.field] = p.e164;
    }

    const existing = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId, phone: primary.e164 } },
    });

    if (existing && options.duplicateBehavior === "skip") {
      rejected.push({ lineNumber: row.lineNumber, reasons: ["Duplicate contact skipped"] });
      continue;
    }

    let contactId: string;
    if (existing) {
      if (options.duplicateBehavior === "update" || options.duplicateBehavior === "add_to_list") {
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(row.company ? { company: row.company } : {}),
            ...(row.timezone ? { timezone: row.timezone } : {}),
            customFields: { ...(existing.customFields as object), ...customFields },
          },
        });
        contactId = existing.id;
      } else {
        contactId = existing.id;
      }
    } else {
      const created = await prisma.contact.create({
        data: {
          workspaceId,
          phone: primary.e164,
          firstName,
          lastName,
          company: row.company || null,
          timezone: row.timezone || null,
          customFields: Object.keys(customFields).length ? customFields : undefined,
        },
      });
      contactId = created.id;
    }

    await prisma.contactListMember.upsert({
      where: { listId_contactId: { listId, contactId } },
      create: { listId, contactId },
      update: {},
    });

    accepted.push({ lineNumber: row.lineNumber, contactId });
  }

  await prisma.contactList.update({
    where: { id: listId },
    data: { source: "csv", updatedAt: new Date() },
  });

  return {
    imported: accepted.length,
    rejected,
    accepted,
  };
}
