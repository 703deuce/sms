import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadContactStats } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const stats = await loadContactStats(auth.workspaceId);
    return NextResponse.json({
      data: {
        contacts: stats.total,
        subscribed: stats.subscribed,
        unsubscribed: stats.unsubscribed,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
