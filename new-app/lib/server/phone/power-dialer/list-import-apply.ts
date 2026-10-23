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

  const accepted: { lineNumber: number; contactId: string; action: "created" | "updated" }[] = [];
  const rejected: { lineNumber: number; reasons: string[]; rowSnapshot?: Record<string, string> }[] =
    [];

  for (const row of rows) {
    if (row.errors.length) {
      rejected.push({
        lineNumber: row.lineNumber,
        reasons: row.errors,
        rowSnapshot: row.raw as Record<string, string>,
      });
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
      rejected.push({
        lineNumber: row.lineNumber,
        reasons: ["Duplicate contact skipped"],
        rowSnapshot: row.raw as Record<string, string>,
      });
      continue;
    }

    let contactId: string;
    let action: "created" | "updated" = "created";
    if (existing) {
      if (options.duplicateBehavior === "update" || options.duplicateBehavior === "add_to_list") {
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(row.email ? { email: row.email } : {}),
            ...(row.title ? { title: row.title } : {}),
            ...(row.company ? { company: row.company } : {}),
            ...(row.timezone ? { timezone: row.timezone, timezoneInferred: false } : {}),
            customFields: { ...(existing.customFields as object), ...customFields },
          },
        });
        contactId = existing.id;
        action = "updated";
      } else {
        contactId = existing.id;
        action = "updated";
      }
    } else {
      const created = await prisma.contact.create({
        data: {
          workspaceId,
          phone: primary.e164,
          firstName,
          lastName,
          email: row.email || null,
          title: row.title || null,
          company: row.company || null,
          timezone: row.timezone || null,
          timezoneInferred: row.timezoneInferred ?? false,
          customFields: Object.keys(customFields).length ? customFields : undefined,
        },
      });
      contactId = created.id;
      action = "created";
      for (const p of row.phones) {
        if (!p.e164 || p.e164 === primary.e164) continue;
        await prisma.contactPhone.create({
          data: {
            contactId,
            e164: p.e164,
            label: p.field,
            priority: p.priority ?? 10,
          },
        }).catch(() => undefined);
      }
    }

    const { applyCustomFieldsFromImport } = await import("@/lib/server/crm/native/custom-fields");
    await applyCustomFieldsFromImport(workspaceId, contactId, customFields);

    await prisma.contactListMember.upsert({
      where: { listId_contactId: { listId, contactId } },
      create: { listId, contactId },
      update: {},
    });

    accepted.push({ lineNumber: row.lineNumber, contactId, action });
  }

  await prisma.contactList.update({
    where: { id: listId },
    data: { source: "csv", updatedAt: new Date() },
  });

  const created = accepted.filter((a) => a.action === "created").length;
  const updated = accepted.filter((a) => a.action === "updated").length;
  return {
    imported: created,
    updated,
    processed: accepted.length,
    invalid: rejected.length,
    rejected,
    accepted,
  };
}
