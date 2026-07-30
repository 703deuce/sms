import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter");

    const data = await getPrisma().conversation.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(filter === "unassigned" ? { assigneeId: null } : {}),
        ...(filter === "unread" ? { unread: true } : {}),
        ...(filter === "archived" ? { status: "CLOSED" as const } : {}),
        ...(filter === "mine" ? { assigneeId: auth.session.userId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        contact: true,
        assignee: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({
      data: data.map((c: (typeof data)[number]) => ({
        id: c.id,
        status: c.status,
        unread: c.unread,
        assignedTo: c.assignee?.name || null,
        contact: c.contact
          ? {
              id: c.contact.id,
              phone: c.contact.phone,
              firstName: c.contact.firstName,
              lastName: c.contact.lastName,
            }
          : null,
        lastMessage: c.messages[0]?.body || "",
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
