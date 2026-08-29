import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadLists } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadLists(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      contactIds?: string[];
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const list = await getPrisma().contactList.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        description: body.description || null,
      },
    });
    if (body.contactIds?.length) {
      for (const contactId of body.contactIds) {
        await getPrisma().contactListMember.create({
          data: { listId: list.id, contactId },
        }).catch(() => null);
      }
    }
    return NextResponse.json({ data: list }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      description?: string;
      addContactIds?: string[];
      removeContactIds?: string[];
    };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const existing = await getPrisma().contactList.findFirst({
      where: { id: body.id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const list = await getPrisma().contactList.update({
      where: { id: body.id },
      data: {
        name: body.name?.trim() || undefined,
        description: body.description ?? undefined,
      },
    });

    for (const contactId of body.addContactIds || []) {
      const existingMember = await getPrisma().contactListMember.findFirst({
        where: { listId: list.id, contactId },
      });
      if (existingMember) continue;
      await getPrisma().contactListMember.create({
        data: { listId: list.id, contactId },
      });
      const { dispatchAutoReplies } = await import("@/lib/auto-replies/dispatch");
      await dispatchAutoReplies({
        workspaceId: auth.workspaceId,
        contactId,
        triggerType: "list_join",
        listId: list.id,
      }).catch(() => undefined);
      const { triggerDripCampaigns } = await import("@/lib/drip-campaigns/engine");
      await triggerDripCampaigns({
        workspaceId: auth.workspaceId,
        contactId,
        triggerType: "list_join",
        listId: list.id,
      }).catch(() => undefined);
    }
    for (const contactId of body.removeContactIds || []) {
      await getPrisma().contactListMember.deleteMany({
        where: { listId: list.id, contactId },
      });
    }

    return NextResponse.json({ data: list });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const existing = await getPrisma().contactList.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().contactList.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
