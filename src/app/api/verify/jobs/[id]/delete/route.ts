import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { deleteBulkVerifyJob } from "@/lib/verify/bulk-verify-service";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    await deleteBulkVerifyJob(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
