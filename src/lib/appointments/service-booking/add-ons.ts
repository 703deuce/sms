import "server-only";

import { getPrisma } from "@/lib/db";

export async function listBookingAddOns(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.bookingAddOn.findMany({
    where: { workspaceId },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

export async function upsertBookingAddOn(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    description?: string;
    priceCents?: number;
    durationDeltaMinutes?: number;
    quantityMax?: number;
    required?: boolean;
    eligibleTypeIds?: string[];
    resourceIds?: string[];
    active?: boolean;
    displayOrder?: number;
  },
) {
  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    description: input.description,
    priceCents: input.priceCents ?? 0,
    durationDeltaMinutes: input.durationDeltaMinutes ?? 0,
    quantityMax: input.quantityMax ?? 1,
    required: input.required ?? false,
    eligibleTypeIds: input.eligibleTypeIds || [],
    resourceIds: input.resourceIds || [],
    active: input.active ?? true,
    displayOrder: input.displayOrder ?? 0,
  };
  if (input.id) {
    return prisma.bookingAddOn.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.bookingAddOn.create({ data: { workspaceId, ...data } });
}

export function calculateAddOnTotals(
  addOns: Array<{ priceCents: number; durationDeltaMinutes: number; quantity?: number }>,
) {
  let priceCents = 0;
  let durationDeltaMinutes = 0;
  for (const addOn of addOns) {
    const qty = addOn.quantity ?? 1;
    priceCents += addOn.priceCents * qty;
    durationDeltaMinutes += addOn.durationDeltaMinutes * qty;
  }
  return { priceCents, durationDeltaMinutes };
}
