import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadVoiceOverview } from "@/lib/voice/overview";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days") || 1);
    const data = await loadVoiceOverview(auth.workspaceId, days);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
