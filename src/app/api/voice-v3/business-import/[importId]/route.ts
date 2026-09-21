import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getImportForWorkspace } from "@/lib/voice-v3/business-import/service";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ importId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { importId } = await ctx.params;
    const row = await getImportForWorkspace(auth.workspaceId, importId);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      data: {
        id: row.id,
        status: row.status,
        trigger: row.trigger,
        review: row.reviewJson,
        errorMessage: row.errorMessage,
        telemetry: row.telemetryJson,
        completedAt: row.completedAt,
        appliedAt: row.appliedAt,
        source: row.sourceRecord,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
