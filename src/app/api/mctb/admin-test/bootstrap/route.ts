import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { bootstrapAdminMctbTestAccount } from "@/lib/mctb/admin-test/bootstrap";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const workspaceId = await getActiveWorkspaceId();
  try {
    const result = await bootstrapAdminMctbTestAccount({
      workspaceId,
      userId: session.userId,
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bootstrap failed" },
      { status: 400 },
    );
  }
}
