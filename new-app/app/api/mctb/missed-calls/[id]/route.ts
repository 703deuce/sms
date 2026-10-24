import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { loadMctbMissedCallDetail } from "@/lib/server/mctb/missed-call-detail";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireSession();
    const { id } = await ctx.params;
    const data = await loadMctbMissedCallDetail(workspaceId, id);
    if (!data) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "detail_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
