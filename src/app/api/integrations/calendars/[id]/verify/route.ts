import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { verifyWorkspaceCalendarConnection } from "@/lib/calendar/connection-settings";
import { getWorkspaceCalendarConnection } from "@/lib/calendar/connections";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const conn = await getWorkspaceCalendarConnection(auth.workspaceId, id);
    if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (conn.provider !== "microsoft") {
      return NextResponse.json(
        { error: "Live verification is only required for Microsoft Outlook right now" },
        { status: 400 },
      );
    }
    const data = await verifyWorkspaceCalendarConnection(auth.workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
