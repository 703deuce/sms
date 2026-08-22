import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getMctbSetupTestStatus, startMctbSetupTest } from "@/lib/mctb/setup-test";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const status = await getMctbSetupTestStatus(workspaceId);
  return NextResponse.json({ ok: true, status });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  await startMctbSetupTest(workspaceId);
  const status = await getMctbSetupTestStatus(workspaceId);
  return NextResponse.json({ ok: true, status });
}
