import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getReceptionistAnalytics } from "@/lib/server/receptionist/analytics-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const data = await getReceptionistAnalytics(workspaceId, {
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
