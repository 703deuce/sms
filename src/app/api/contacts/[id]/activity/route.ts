import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getContactActivityTimeline } from "@/lib/contacts/activity-timeline";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 80), 200);
    const data = await getContactActivityTimeline(auth.workspaceId, id, limit);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
