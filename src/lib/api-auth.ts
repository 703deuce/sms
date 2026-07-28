import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const workspaceId = await getActiveWorkspaceId();
  return { session, workspaceId };
}

export function jsonError(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status });
}
