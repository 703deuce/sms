import "server-only";

import { getPrisma } from "@/lib/db";

export type CustomerFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "email"
  | "phone";

export async function listCustomerFieldDefinitions(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.customerFieldDefinition.findMany({
    where: { workspaceId },
    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
  });
}

export async function upsertCustomerFieldDefinition(
  workspaceId: string,
  input: {
    id?: string;
    key?: string;
    label: string;
    fieldType?: CustomerFieldType;
    options?: string[];
    required?: boolean;
    displayOrder?: number;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const key =
    input.key ||
    input.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  const data = {
    key,
    label: input.label.trim(),
    fieldType: input.fieldType ?? "text",
    options: input.options ?? null,
    required: input.required ?? false,
    displayOrder: input.displayOrder ?? 0,
    active: input.active ?? true,
    metadata: input.metadata,
  };

  if (input.id) {
    return prisma.customerFieldDefinition.update({
      where: { id: input.id, workspaceId },
      data,
    });
  }

  return prisma.customerFieldDefinition.create({
    data: { workspaceId, ...data },
  });
}

export async function deleteCustomerFieldDefinition(workspaceId: string, id: string) {
  const prisma = getPrisma();
  return prisma.customerFieldDefinition.delete({
    where: { id, workspaceId },
  });
}

export async function getContactCustomFieldValues(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  const [definitions, contact] = await Promise.all([
    listCustomerFieldDefinitions(workspaceId),
    prisma.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { customFields: true },
    }),
  ]);
  if (!contact) throw new Error("Contact not found");

  const stored = (contact.customFields || {}) as Record<string, unknown>;
  return definitions
    .filter((def: { active: boolean }) => def.active)
    .map((def: { id: string; key: string; label: string; fieldType: string; required: boolean }) => ({
      definitionId: def.id,
      key: def.key,
      label: def.label,
      fieldType: def.fieldType,
      required: def.required,
      value: stored[def.key] ?? null,
    }));
}

export async function setContactCustomFieldValues(
  workspaceId: string,
  contactId: string,
  values: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const definitions = await prisma.customerFieldDefinition.findMany({
    where: { workspaceId, active: true },
  });
  const defByKey = new Map(definitions.map((d: { key: string }) => [d.key, d]));

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { customFields: true },
  });
  if (!contact) throw new Error("Contact not found");

  const existing = (contact.customFields || {}) as Record<string, unknown>;
  const merged = { ...existing };

  for (const [key, value] of Object.entries(values)) {
    const def = defByKey.get(key) as
      | { key: string; label: string; required: boolean }
      | undefined;
    if (!def) throw new Error(`Unknown custom field: ${key}`);
    if (def.required && (value === null || value === undefined || value === "")) {
      throw new Error(`Field "${def.label}" is required`);
    }
    merged[key] = value;
  }

  for (const def of definitions as Array<{ key: string; label: string; required: boolean }>) {
    if (def.required && (merged[def.key] === null || merged[def.key] === undefined || merged[def.key] === "")) {
      throw new Error(`Field "${def.label}" is required`);
    }
  }

  return prisma.contact.update({
    where: { id: contactId, workspaceId },
    data: { customFields: merged },
    select: { id: true, customFields: true },
  });
}
