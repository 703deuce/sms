import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { retryFailedBulkVerifyRows } from "@/lib/verify/bulk-verify-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const data = await retryFailedBulkVerifyRows(auth.workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
