import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadContactById } from "@/lib/workspace-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await loadContactById(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      status?: string;
      assignedUser?: string | null;
      company?: string;
      tagNames?: string[];
      listIds?: string[];
    };

    const existing = await getPrisma().contact.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await getPrisma().contact.update({
      where: { id },
      data: {
        firstName: body.firstName ?? undefined,
        lastName: body.lastName ?? undefined,
        email: body.email ?? undefined,
        status: body.status
          ? (body.status.toUpperCase() as
              | "SUBSCRIBED"
              | "UNSUBSCRIBED"
              | "BLOCKED"
              | "INVALID")
          : undefined,
        assignedUser: body.assignedUser === undefined ? undefined : body.assignedUser,
        company: body.company ?? undefined,
      },
    });

    if (body.tagNames) {
      await getPrisma().contactTag.deleteMany({ where: { contactId: id } });
      for (const raw of body.tagNames) {
        const name = raw.trim().toLowerCase();
        if (!name) continue;
        const tag = await getPrisma().tag.upsert({
          where: {
            workspaceId_name: { workspaceId: auth.workspaceId, name },
          },
          create: { workspaceId: auth.workspaceId, name },
          update: {},
        });
        await getPrisma().contactTag.create({
          data: { tagId: tag.id, contactId: id },
        });
      }
    }

    if (body.listIds) {
      await getPrisma().contactListMember.deleteMany({ where: { contactId: id } });
      for (const listId of body.listIds) {
        await getPrisma().contactListMember.create({
          data: { listId, contactId: id },
        }).catch(() => null);
      }
    }

    const data = await loadContactById(auth.workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const existing = await getPrisma().contact.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
