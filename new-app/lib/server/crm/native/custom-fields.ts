import { getPrisma } from "@/lib/server/db";
import { assertCrmRead, assertCrmWrite } from "./permissions";

export async function listCustomFieldDefinitions(workspaceId: string) {
  await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  return prisma.crmCustomFieldDefinition.findMany({
    where: { workspaceId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function upsertCustomFieldDefinition(
  workspaceId: string,
  input: {
    id?: string;
    key: string;
    label: string;
    fieldType: "text" | "number" | "select";
    optionsJson?: string[];
    sortOrder?: number;
  },
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const key = input.key.trim().replace(/\s+/g, "_").toLowerCase();
  if (input.id) {
    return prisma.crmCustomFieldDefinition.update({
      where: { id: input.id },
      data: {
        label: input.label.trim(),
        fieldType: input.fieldType,
        optionsJson: input.optionsJson as import("@prisma/client").Prisma.InputJsonValue,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }
  return prisma.crmCustomFieldDefinition.create({
    data: {
      workspaceId,
      key,
      label: input.label.trim(),
      fieldType: input.fieldType,
      optionsJson: input.optionsJson as import("@prisma/client").Prisma.InputJsonValue,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function applyCustomFieldsFromImport(
  workspaceId: string,
  contactId: string,
  customFields: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const defs = await prisma.crmCustomFieldDefinition.findMany({ where: { workspaceId } });
  for (const def of defs) {
    const raw = customFields[def.key];
    if (raw === undefined || raw === null || raw === "") continue;
    const data =
      def.fieldType === "number"
        ? { valueNumber: Number(raw), valueText: null }
        : { valueText: String(raw), valueNumber: null };
    await prisma.crmCustomFieldValue.upsert({
      where: { contactId_fieldId: { contactId, fieldId: def.id } },
      create: { contactId, fieldId: def.id, ...data },
      update: data,
    });
  }
}

export async function setContactCustomFieldValue(
  workspaceId: string,
  contactId: string,
  fieldKey: string,
  value: unknown,
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const field = await prisma.crmCustomFieldDefinition.findFirst({
    where: { workspaceId, key: fieldKey },
  });
  if (!field) throw new Error("Custom field not found");
  const data =
    field.fieldType === "number"
      ? { valueNumber: Number(value), valueText: null }
      : { valueText: String(value), valueNumber: null };
  return prisma.crmCustomFieldValue.upsert({
    where: { contactId_fieldId: { contactId, fieldId: field.id } },
    create: { contactId, fieldId: field.id, ...data },
    update: data,
  });
}
