import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getReceptionistOverview } from "@/lib/server/receptionist/overview-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await getReceptionistOverview(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
