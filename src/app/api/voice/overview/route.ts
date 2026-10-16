import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadVoiceOverviewSummary } from "@/lib/voice/overview-summary";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const hubOnly =
      new URL(request.url).searchParams.get("hub") === "1" ||
      new URL(request.url).searchParams.get("scope") === "receptionist";
    const result = await loadVoiceOverviewSummary(auth.workspaceId, { hubOnly });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, 500);
  }
}
