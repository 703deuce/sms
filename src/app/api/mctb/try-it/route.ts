import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getTryItStatus } from "@/lib/mctb/try-it/status";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    traceMctbDebug("try-it", "get_start", { workspaceId: auth.workspaceId });
    const status = await getTryItStatus(auth.workspaceId);
    traceMctbDebug("try-it", "get_complete", {
      workspaceId: auth.workspaceId,
      sessionActive: status.sessionActive,
      consentMode: status.consentMode,
    });
    return NextResponse.json({ data: status });
  } catch (err) {
    traceMctbDebugError("try-it", "get_failed", err);
    return jsonError(err, 500);
  }
}
