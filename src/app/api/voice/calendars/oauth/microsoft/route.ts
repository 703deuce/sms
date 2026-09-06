import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getMicrosoftOAuthStartUrl } from "@/lib/voice/calendar/oauth";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const connectionId = new URL(request.url).searchParams.get("connectionId") || "";
    const returnTo = new URL(request.url).searchParams.get("returnTo") || undefined;
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId required" }, { status: 400 });
    }
    const conn = await getPrisma().voiceCalendarConnection.findFirst({
      where: { id: connectionId, workspaceId: auth.workspaceId },
    });
    if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const url = getMicrosoftOAuthStartUrl(connectionId, auth.workspaceId, returnTo);
    return NextResponse.redirect(url);
  } catch (err) {
    return jsonError(err, 400);
  }
}
