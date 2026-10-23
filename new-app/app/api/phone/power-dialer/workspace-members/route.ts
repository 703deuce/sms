import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listWorkspaceReps } from "@/lib/server/phone/power-dialer/campaign-access";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listWorkspaceReps(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
