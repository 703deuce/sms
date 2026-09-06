import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getWorkspaceCalendarConnection } from "@/lib/calendar/connections";
import { getGoogleOAuthStartUrl } from "@/lib/calendar/oauth";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const connectionId = new URL(request.url).searchParams.get("connectionId") || "";
    const returnTo = new URL(request.url).searchParams.get("returnTo") || undefined;
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId required" }, { status: 400 });
    }
    const conn = await getWorkspaceCalendarConnection(auth.workspaceId, connectionId);
    if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const url = getGoogleOAuthStartUrl(connectionId, auth.workspaceId, returnTo);
    return NextResponse.redirect(url);
  } catch (err) {
    return jsonError(err, 400);
  }
}
