import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { exportBulkVerifyJobCsv } from "@/lib/verify/verify-export";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const filter = new URL(request.url).searchParams.get("filter") || "all";
    const csv = await exportBulkVerifyJobCsv(auth.workspaceId, id, filter);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="verify-export-${id}.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
