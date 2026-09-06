import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getWorkspaceCalendarConnection } from "@/lib/calendar/connections";
import {
  enqueueCalendarConnectionSync,
  syncWorkspaceCalendarConnection,
} from "@/lib/calendar/import-sync";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const conn = await getWorkspaceCalendarConnection(auth.workspaceId, id);
    if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as {
      incremental?: boolean;
      async?: boolean;
    };

    if (body.async) {
      const job = await enqueueCalendarConnectionSync(auth.workspaceId, id, Boolean(body.incremental));
      return NextResponse.json({ data: { queued: true, jobId: job.id } });
    }

    const stats = await syncWorkspaceCalendarConnection(auth.workspaceId, id, {
      incremental: Boolean(body.incremental),
      manual: true,
    });
    return NextResponse.json({ data: stats });
  } catch (err) {
    return jsonError(err, 400);
  }
}
