import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getReceptionistState } from "@/lib/server/receptionist/agent-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const state = await getReceptionistState(workspaceId);
    return NextResponse.json({ data: state });
  } catch (err) {
    return jsonError(err, 500);
  }
}
