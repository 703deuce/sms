import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { traceMctbDebug } from "@/lib/mctb/debug";
import {
  parseMissedCallsListQuery,
} from "@/lib/mctb/missed-calls-list-filters";
import { loadMctbMissedCallsListData } from "@/lib/mctb/missed-calls-list-data";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const query = parseMissedCallsListQuery(searchParams);

  traceMctbDebug("missed-calls", "get_start", { workspaceId, query });

  const data = await loadMctbMissedCallsListData(workspaceId, query);

  traceMctbDebug("missed-calls", "get_complete", {
    workspaceId,
    eventCount: data.events.length,
    total: data.pagination.total,
    summary: data.summary,
  });

  return NextResponse.json({ data });
}
