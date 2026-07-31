import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadTags } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadTags(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { name?: string; contactIds?: string[] };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const tag = await getPrisma().tag.upsert({
      where: {
        workspaceId_name: {
          workspaceId: auth.workspaceId,
          name: body.name.trim().toLowerCase(),
        },
      },
      create: {
        workspaceId: auth.workspaceId,
        name: body.name.trim().toLowerCase(),
      },
      update: {},
    });
    for (const contactId of body.contactIds || []) {
      await getPrisma().contactTag.upsert({
        where: { tagId_contactId: { tagId: tag.id, contactId } },
        create: { tagId: tag.id, contactId },
        update: {},
      });
      const { emitAutomationEvent } = await import("@/lib/automations/events");
      await emitAutomationEvent(auth.workspaceId, "customer.tag_added", contactId, {
        tag: tag.name,
      }).catch(() => undefined);
    }
    return NextResponse.json({ data: tag }, { status: 201 });
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
    const existing = await getPrisma().tag.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().tag.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
