import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { buildMctbEventTimeline } from "@/lib/mctb/timeline";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await params;

  try {
    const timeline = await buildMctbEventTimeline(id);
    const { getPrisma } = await import("@/lib/db");
    const event = await getPrisma().missedCallEvent.findFirst({
      where: { id, workspaceId },
    });
    if (!event) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      event,
      timeline,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
