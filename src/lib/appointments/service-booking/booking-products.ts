import "server-only";

import { getPrisma } from "@/lib/db";

export async function listBookingProducts(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.bookingProduct.findMany({
    where: { workspaceId },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

export async function upsertBookingProduct(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    description?: string;
    sku?: string;
    priceCents: number;
    currency?: string;
    quantityAvailable?: number;
    sellStandalone?: boolean;
    eligibleTypeIds?: string[];
    active?: boolean;
    displayOrder?: number;
  },
) {
  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    description: input.description,
    sku: input.sku,
    priceCents: input.priceCents,
    currency: input.currency ?? "usd",
    quantityAvailable: input.quantityAvailable,
    sellStandalone: input.sellStandalone ?? true,
    eligibleTypeIds: input.eligibleTypeIds || [],
    active: input.active ?? true,
    displayOrder: input.displayOrder ?? 0,
  };
  if (input.id) {
    return prisma.bookingProduct.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.bookingProduct.create({ data: { workspaceId, ...data } });
}
