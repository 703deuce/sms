import { getPrisma } from "@/lib/server/db";

const CONTACT_FIELD_KEYS = new Set([
  "firstName",
  "lastName",
  "email",
  "title",
  "company",
  "phone",
  "timezone",
  "leadSource",
  "leadStage",
  "ownerUserId",
]);

export type InboundFieldUpdate = {
  fieldKey: string;
  value: unknown;
};

export type ApplyInboundResult = {
  applied: string[];
  skipped: { fieldKey: string; reason: string }[];
};

/**
 * CRM sync ownership (B2) — inbound provider values must not overwrite user-edited fields.
 */
export async function applyInboundCrmFieldsToContact(input: {
  workspaceId: string;
  contactId: string;
  provider: string;
  updates: InboundFieldUpdate[];
}): Promise<ApplyInboundResult> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
  });
  if (!contact) throw new Error("Contact not found");

  const locks = await prisma.crmFieldLock.findMany({
    where: { contactId: input.contactId, workspaceId: input.workspaceId },
  });
  const lockByKey = new Map(locks.map((l) => [l.fieldKey, l.owner]));

  const applied: string[] = [];
  const skipped: { fieldKey: string; reason: string }[] = [];
  const data: Record<string, unknown> = {};

  for (const u of input.updates) {
    if (!CONTACT_FIELD_KEYS.has(u.fieldKey) && !u.fieldKey.startsWith("custom:")) {
      skipped.push({ fieldKey: u.fieldKey, reason: "unknown_field" });
      continue;
    }
    const lock = lockByKey.get(u.fieldKey);
    if (lock === "user_edit") {
      skipped.push({ fieldKey: u.fieldKey, reason: "user_lock" });
      continue;
    }
    if (u.fieldKey.startsWith("custom:")) {
      skipped.push({ fieldKey: u.fieldKey, reason: "custom_via_definition" });
      continue;
    }
    const current = (contact as Record<string, unknown>)[u.fieldKey];
    if (current != null && String(current).trim() !== "") {
      skipped.push({ fieldKey: u.fieldKey, reason: "native_value_present" });
      continue;
    }
    data[u.fieldKey] = u.value;
    applied.push(u.fieldKey);
  }

  if (Object.keys(data).length) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: data as import("@prisma/client").Prisma.ContactUpdateInput,
    });
    for (const key of applied) {
      await prisma.crmFieldLock.upsert({
        where: { contactId_fieldKey: { contactId: contact.id, fieldKey: key } },
        create: {
          workspaceId: input.workspaceId,
          contactId: contact.id,
          fieldKey: key,
          owner: `crm_sync:${input.provider}`,
        },
        update: { owner: `crm_sync:${input.provider}` },
      });
    }
  }

  return { applied, skipped };
}

export async function lockContactFieldForUserEdit(input: {
  workspaceId: string;
  contactId: string;
  fieldKey: string;
}) {
  const prisma = getPrisma();
  return prisma.crmFieldLock.upsert({
    where: { contactId_fieldKey: { contactId: input.contactId, fieldKey: input.fieldKey } },
    create: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      fieldKey: input.fieldKey,
      owner: "user_edit",
    },
    update: { owner: "user_edit", lockedAt: new Date() },
  });
}
