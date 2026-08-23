import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadPlatformActivityFeed } from "@/lib/platform/activity-feed";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const limit = Number(new URL(request.url).searchParams.get("limit") || "40");
    const items = await loadPlatformActivityFeed(auth.workspaceId, Math.min(limit, 100));
    return NextResponse.json({ data: items });
  } catch (err) {
    return jsonError(err);
  }
}
