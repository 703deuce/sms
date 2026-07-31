import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const q = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (q.length < 2) {
      return NextResponse.json({ data: { workspaces: [], users: [], tickets: [] } });
    }

    const prisma = getPrisma();
    const [workspaces, users, tickets] = await Promise.all([
      prisma.workspace.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        orderBy: { createdAt: "desc" },
      }),
      prisma.supportTicket.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { subject: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      data: {
        workspaces: workspaces.map((w: { id: string; name: string; slug: string }) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          href: `/admin/customers/${w.id}`,
        })),
        users: users.map((u: { id: string; name: string; email: string }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          href: `/admin/customers`,
        })),
        tickets: tickets.map((t: { id: string; subject: string; email: string; status: string }) => ({
          id: t.id,
          subject: t.subject,
          email: t.email,
          status: t.status,
          href: `/admin/support`,
        })),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
