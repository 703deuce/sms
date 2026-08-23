import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-auth";
import { loadPlatformAdminSnapshot } from "@/lib/platform/admin-snapshot";

type Params = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { workspaceId } = await params;
    const snapshot = await loadPlatformAdminSnapshot(workspaceId);
    if (!snapshot) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json({ data: snapshot });
  } catch (err) {
    return jsonError(err);
  }
}
