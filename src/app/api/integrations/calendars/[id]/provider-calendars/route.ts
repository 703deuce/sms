import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listConnectionProviderCalendars } from "@/lib/calendar/connection-settings";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const calendars = await listConnectionProviderCalendars(auth.workspaceId, id);
    return NextResponse.json({ data: calendars });
  } catch (err) {
    return jsonError(err, 400);
  }
}
