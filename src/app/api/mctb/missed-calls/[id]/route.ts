import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";
import { loadMctbMissedCallDetailPayload } from "@/lib/mctb/missed-call-detail-load";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await params;
  traceMctbDebug("missed-call-detail", "get_start", { workspaceId, eventId: id });

  try {
    const result = await loadMctbMissedCallDetailPayload(workspaceId, id);
    if (!result.ok) {
      traceMctbDebug("missed-call-detail", "not_found", { workspaceId, eventId: id });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    traceMctbDebug("missed-call-detail", "get_complete", {
      workspaceId,
      eventId: id,
      status: result.body.event.status,
      callerE164: result.body.event.callerE164,
      timelineSteps: result.body.timeline.steps.length,
    });
    return NextResponse.json(result.body);
  } catch (err) {
    traceMctbDebugError("missed-call-detail", "get_failed", err, { workspaceId, eventId: id });
    return NextResponse.json({ error: "Failed to load missed call" }, { status: 500 });
  }
}
