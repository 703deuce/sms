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

    const patch: Record<string, unknown> = {};
    if (body.keyword !== undefined) {
      const keyword = body.keyword.trim().toUpperCase();
      if (keyword) patch.keyword = keyword;
    }
    if (body.listName !== undefined) {
      patch.listName = body.listName.trim();
    }
    if (body.confirmation !== undefined) {
      patch.confirmation = body.confirmation.trim() || null;
    }
    if (body.autoReply !== undefined) {
      patch.autoReply = body.autoReply.trim() || null;
    }
    if (body.status !== undefined) {
      patch.status = body.status || existing.status;
    }

    const updated =
      Object.keys(patch).length > 0
        ? await getPrisma().keyword.update({
            where: { id },
            data: patch,
          })
        : existing;
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
