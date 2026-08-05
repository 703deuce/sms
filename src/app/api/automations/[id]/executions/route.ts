import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listExecutionSummaries } from "@/lib/automations/execution-detail";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const data = await listExecutionSummaries(auth.workspaceId, id, 100);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
