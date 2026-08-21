import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadMctbSupportSnapshot } from "@/lib/mctb/admin/support-snapshot";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const snapshot = await loadMctbSupportSnapshot(workspaceId);
    if (!snapshot) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json({ data: snapshot });
  } catch (err) {
    return jsonError(err, 500);
  }
}
