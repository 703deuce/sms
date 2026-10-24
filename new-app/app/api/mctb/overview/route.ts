import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { loadMctbOverviewForNewApp } from "@/lib/server/mctb/overview-load";

export async function GET() {
  try {
    const { workspaceId } = await requireSession();
    const data = await loadMctbOverviewForNewApp(workspaceId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load MCTB overview";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
