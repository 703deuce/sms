import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getMctbSetupTestStatus, startMctbSetupTest } from "@/lib/mctb/setup-test";
import { traceMctbDebug } from "@/lib/mctb/debug";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  traceMctbDebug("setup-test", "get_start", { workspaceId });
  const status = await getMctbSetupTestStatus(workspaceId);
  traceMctbDebug("setup-test", "get_complete", {
    workspaceId,
    started: status.started,
    verified: status.verified,
  });
  return NextResponse.json({ ok: true, status });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  traceMctbDebug("setup-test", "post_start", { workspaceId });
  await startMctbSetupTest(workspaceId);
  const status = await getMctbSetupTestStatus(workspaceId);
  traceMctbDebug("setup-test", "post_complete", {
    workspaceId,
    started: status.started,
    verified: status.verified,
  });
  return NextResponse.json({ ok: true, status });
}
