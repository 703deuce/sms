import "server-only";

import { getPrisma } from "@/lib/db";

export type GlobalSearchResult = {
  kind: "appointment" | "contact" | "booking_category" | "package" | "class_series";
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  matchedAt?: string;
};

export async function globalServiceBookingSearch(
  workspaceId: string,
  query: string,
  options?: { limit?: number; kinds?: GlobalSearchResult["kind"][] },
) {
  const q = query.trim();
  if (!q) return [];

  const limit = options?.limit ?? 20;
  const kinds = options?.kinds;
  const prisma = getPrisma();
  const results: GlobalSearchResult[] = [];

  const include = (kind: GlobalSearchResult["kind"]) => !kinds?.length || kinds.includes(kind);

  if (include("contact")) {
    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    for (const c of contacts) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone;
      results.push({
        kind: "contact",
        id: c.id,
        title: name,
        subtitle: c.email || c.phone,
        href: `/contacts/${c.id}`,
      });
    }
  }

  if (include("appointment")) {
    const appointments = await prisma.voiceAppointment.findMany({
      where: {
        workspaceId,
        OR: [
          { serviceName: { contains: q, mode: "insensitive" } },
          { staffName: { contains: q, mode: "insensitive" } },
          { externalId: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { startsAt: "desc" },
    });
    for (const a of appointments) {
      results.push({
        kind: "appointment",
        id: a.id,
        title: a.serviceName || "Appointment",
        subtitle: a.staffName || undefined,
        matchedAt: a.startsAt.toISOString(),
        href: `/appointments/${a.id}`,
      });
    }
  }

  if (include("booking_category")) {
    const categories = await prisma.bookingCategory.findMany({
      where: {
        workspaceId,
        active: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { name: "asc" },
    });
    for (const cat of categories) {
      results.push({
        kind: "booking_category",
        id: cat.id,
        title: cat.name,
        subtitle: cat.description || undefined,
        href: `/appointments/types?category=${cat.slug}`,
      });
    }
  }

  if (include("package")) {
    const packages = await prisma.packageProduct.findMany({
      where: {
        workspaceId,
        active: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { name: "asc" },
    });
    for (const pkg of packages) {
      results.push({
        kind: "package",
        id: pkg.id,
        title: pkg.name,
        subtitle: pkg.description || undefined,
      });
    }
  }

  if (include("class_series")) {
    const series = await prisma.classSeries.findMany({
      where: {
        workspaceId,
        active: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { name: "asc" },
    });
    for (const s of series) {
      results.push({
        kind: "class_series",
        id: s.id,
        title: s.name,
        subtitle: s.description || undefined,
      });
    }
  }

  return results.slice(0, limit);
}
