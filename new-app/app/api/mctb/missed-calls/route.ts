import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { listMctbMissedCalls } from "@/lib/server/mctb/missed-calls-list";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireSession();
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") || "0"));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "12")));
    const q = url.searchParams.get("q") || undefined;
    const { rows, total } = await listMctbMissedCalls({ workspaceId, page, limit, q });
    return NextResponse.json({ ok: true, data: rows, total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load missed calls";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
