import { getPrisma } from "@/lib/db";
import { bookingLinkHostname, validateBookingLinkUrl } from "@/lib/mctb/booking-links/validate-url";

export type MctbBookingLinkDto = {
  id: string;
  label: string;
  url: string;
  description: string | null;
  active: boolean;
  isDefault: boolean;
  hostname: string;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: {
  id: string;
  label: string;
  url: string;
  description: string | null;
  active: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): MctbBookingLinkDto {
  return {
    id: row.id,
    label: row.label,
    url: row.url,
    description: row.description,
    active: row.active,
    isDefault: row.isDefault,
    hostname: bookingLinkHostname(row.url),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listMctbBookingLinks(workspaceId: string, activeOnly = false) {
  const prisma = getPrisma();
  const rows = await prisma.mctbBookingLink.findMany({
    where: { workspaceId, ...(activeOnly ? { active: true } : {}) },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
  return rows.map(toDto);
}

export async function createMctbBookingLink(
  workspaceId: string,
  input: {
    label: string;
    url: string;
    description?: string | null;
    active?: boolean;
    isDefault?: boolean;
  },
) {
  const validated = validateBookingLinkUrl(input.url);
  if (!validated.ok) throw new Error(validated.error);
  const label = input.label.trim();
  if (!label) throw new Error("Label is required");
  const prisma = getPrisma();
  if (input.isDefault) {
    await prisma.mctbBookingLink.updateMany({
      where: { workspaceId },
      data: { isDefault: false },
    });
  }
  const row = await prisma.mctbBookingLink.create({
    data: {
      workspaceId,
      label,
      url: validated.url,
      description: input.description?.trim() || null,
      active: input.active ?? true,
      isDefault: input.isDefault ?? false,
    },
  });
  return toDto(row);
}

export async function updateMctbBookingLink(
  workspaceId: string,
  id: string,
  input: {
    label?: string;
    url?: string;
    description?: string | null;
    active?: boolean;
    isDefault?: boolean;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.mctbBookingLink.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Booking link not found");
  let url = existing.url;
  if (input.url !== undefined) {
    const validated = validateBookingLinkUrl(input.url);
    if (!validated.ok) throw new Error(validated.error);
    url = validated.url;
  }
  if (input.isDefault) {
    await prisma.mctbBookingLink.updateMany({
      where: { workspaceId },
      data: { isDefault: false },
    });
  }
  const row = await prisma.mctbBookingLink.update({
    where: { id },
    data: {
      label: input.label !== undefined ? input.label.trim() : undefined,
      url,
      description: input.description !== undefined ? input.description?.trim() || null : undefined,
      active: input.active,
      isDefault: input.isDefault,
    },
  });
  return toDto(row);
}

export async function deleteMctbBookingLink(workspaceId: string, id: string) {
  const prisma = getPrisma();
  const existing = await prisma.mctbBookingLink.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Booking link not found");
  await prisma.mctbBookingLink.delete({ where: { id } });
}
