import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const workspaceId = await getActiveWorkspaceId();
  return { session, workspaceId };
}

/**
 * Resolve workspace for a mutating request.
 * Prefer session workspace; only allow override when the user is a member (or demo mode without DB membership).
 */
export async function resolveWorkspaceId(
  session: { userId: string; email: string },
  requestedWorkspaceId?: string | null,
) {
  const active = await getActiveWorkspaceId();
  const workspaceId = (requestedWorkspaceId || active || "").trim();
  if (!workspaceId) {
    throw new Error("workspaceId required");
  }

  if (workspaceId === active) return workspaceId;

  try {
    const membership = await getPrisma().membership.findFirst({
      where: {
        workspaceId,
        OR: [{ userId: session.userId }, { user: { email: session.email } }],
      },
    });
    if (membership) return workspaceId;
  } catch {
    // DB unavailable — deny override for safety
  }

  throw new Error("Forbidden: not a member of the requested workspace");
}

export function jsonError(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : String(err);
  const code = /forbidden|unauthorized/i.test(message) ? 403 : status;
  return NextResponse.json({ error: message }, { status: code });
}
