import "server-only";

import { getPrisma } from "@/lib/db";

export async function listBookingCategories(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.bookingCategory.findMany({
    where: { workspaceId },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

export async function upsertBookingCategory(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    displayOrder?: number;
    active?: boolean;
    collapsible?: boolean;
    collapsedByDefault?: boolean;
    imageUrl?: string;
  },
) {
  const prisma = getPrisma();
  const slug =
    input.slug ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const data = {
    name: input.name.trim(),
    slug,
    description: input.description,
    displayOrder: input.displayOrder ?? 0,
    active: input.active ?? true,
    collapsible: input.collapsible ?? true,
    collapsedByDefault: input.collapsedByDefault ?? false,
    imageUrl: input.imageUrl,
  };
  if (input.id) {
    return prisma.bookingCategory.update({
      where: { id: input.id, workspaceId },
      data,
    });
  }
  return prisma.bookingCategory.create({ data: { workspaceId, ...data } });
}

export function categoryPublicUrl(baseUrl: string, workspaceSlug: string, categorySlug: string) {
  return `${baseUrl.replace(/\/$/, "")}/book/${workspaceSlug}?category=${categorySlug}`;
}
