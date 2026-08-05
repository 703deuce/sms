import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadExecutionDetail } from "@/lib/automations/execution-detail";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; executionId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id, executionId } = await params;

    const data = await loadExecutionDetail(
      auth.workspaceId,
      id,
      executionId,
    );
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
