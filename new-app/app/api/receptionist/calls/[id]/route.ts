import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getReceptionistCall } from "@/lib/server/receptionist/calls-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const workspaceId = await resolveWorkspaceId();
    const call = await getReceptionistCall(workspaceId, id);
    if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: call });
  } catch (err) {
    return jsonError(err, 500);
  }
}
