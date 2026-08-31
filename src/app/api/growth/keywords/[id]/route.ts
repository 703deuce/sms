import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      keyword?: string;
      listName?: string;
      confirmation?: string;
      autoReply?: string;
      status?: string;
    };

    const existing = await getPrisma().keyword.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
    }

    const updated = await getPrisma().keyword.update({
      where: { id },
      data: {
        keyword: body.keyword?.trim().toUpperCase() || undefined,
        listName: body.listName?.trim() || undefined,
        confirmation: body.confirmation?.trim() || undefined,
        autoReply: body.autoReply?.trim() ?? undefined,
        status: body.status || undefined,
      },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const existing = await getPrisma().keyword.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
    }

    await getPrisma().keyword.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
