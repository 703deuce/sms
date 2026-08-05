import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getFlowDeploymentDiagnostics } from "@/lib/automations/deployment-diagnostics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const diagnostics = await getFlowDeploymentDiagnostics(
      auth.workspaceId,
      id,
    );
    if (!diagnostics) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: diagnostics });
  } catch (err) {
    return jsonError(err, 500);
  }
}
