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
        userId: session.userId,
      },
    });
    if (membership) return workspaceId;
  } catch {
    // DB unavailable — deny override for safety
  }

  throw new Error("Forbidden: not a member of the requested workspace");
}

/**
 * Require an authenticated platform admin. Mirrors the admin route-group layout
 * (session required); additionally enforces the platform-admin flag for writes.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!session.isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export function jsonError(err: unknown, status = 400) {
  // Lazy import avoided — keep this tiny and sync for route handlers.
  const message =
    err instanceof Error
      ? err.message && err.message !== "[object Object]"
        ? err.message
        : "Request failed"
      : typeof err === "string"
        ? err
        : (() => {
            try {
              const o = err as Record<string, unknown> | null;
              if (o && typeof o === "object") {
                for (const key of ["error", "message", "detail", "details"]) {
                  const v = o[key];
                  if (typeof v === "string" && v.trim()) return v.trim();
                }
                return JSON.stringify(err).slice(0, 400);
              }
            } catch {
              // ignore
            }
            return "Request failed";
          })();
  const code = /forbidden|unauthorized/i.test(message) ? 403 : status;
  return NextResponse.json({ error: message }, { status: code });
}
