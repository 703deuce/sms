import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listReceptionistCalls } from "@/lib/server/receptionist/calls-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const { data, total } = await listReceptionistCalls(workspaceId, {
      limit: Number(url.searchParams.get("limit") || 25),
      page: Number(url.searchParams.get("page") || 0),
      q: url.searchParams.get("q") || undefined,
      filter: url.searchParams.get("filter") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      numberId: url.searchParams.get("numberId") || undefined,
    });
    return NextResponse.json({ data, meta: { total } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
