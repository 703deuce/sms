import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadVoiceOverviewSummary } from "@/lib/voice/overview-summary";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const result = await loadVoiceOverviewSummary(auth.workspaceId);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, 500);
  }
}
