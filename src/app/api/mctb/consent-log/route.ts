import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadConsentLogRows } from "@/lib/mctb/consent-log";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || 100);
  const caller = searchParams.get("caller") || undefined;

  const { rows, summary } = await loadConsentLogRows(workspaceId, { limit, caller });

  return NextResponse.json({
    data: {
      summary,
      events: rows,
    },
  });
}
