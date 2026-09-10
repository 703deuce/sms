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

export async function fulfillBookingProductSale(
  workspaceId: string,
  input: {
    productId: string;
    contactId: string;
    quantity?: number;
  },
) {
  const prisma = getPrisma();
  const quantity = input.quantity ?? 1;
  if (quantity <= 0) throw new Error("Quantity must be positive");

  const product = await prisma.bookingProduct.findFirst({
    where: { id: input.productId, workspaceId, active: true },
  });
  if (!product) throw new Error("Product not found");
  if (product.sellStandalone === false) throw new Error("Product is not sold standalone");

  if (product.quantityAvailable != null) {
    if (product.quantityAvailable < quantity) throw new Error("Insufficient product inventory");
    await prisma.bookingProduct.update({
      where: { id: product.id },
      data: { quantityAvailable: product.quantityAvailable - quantity },
    });
  }

  return {
    productId: product.id,
    name: product.name,
    quantity,
    totalCents: product.priceCents * quantity,
    contactId: input.contactId,
  };
}

export async function duplicateBookingProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const source = await prisma.bookingProduct.findFirst({
    where: { id: productId, workspaceId },
  });
  if (!source) throw new Error("Product not found");
  return prisma.bookingProduct.create({
    data: {
      workspaceId,
      name: `${source.name} (copy)`,
      description: source.description,
      sku: source.sku ? `${source.sku}-copy` : undefined,
      priceCents: source.priceCents,
      currency: source.currency,
      quantityAvailable: source.quantityAvailable,
      sellStandalone: source.sellStandalone,
      eligibleTypeIds: source.eligibleTypeIds,
      active: false,
      displayOrder: source.displayOrder,
    },
  });
}
