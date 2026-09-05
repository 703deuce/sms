import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/api-auth";
import { listWorkspaceCalendarEvents } from "@/lib/calendar/workspace-calendar-events";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const data = await listWorkspaceCalendarEvents(auth.workspaceId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
