import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getReceptionistReadiness } from "@/lib/server/receptionist/readiness-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await getReceptionistReadiness(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
