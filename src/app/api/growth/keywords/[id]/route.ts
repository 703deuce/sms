import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

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
