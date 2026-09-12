import { NextResponse } from "next/server";
import { isSchedulingConflictError } from "@/lib/appointments/scheduling-conflict-error";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { canUseFeature } from "@/lib/workspace/capabilities";
import type { WorkspaceFeature } from "@/lib/workspace/types";

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const workspaceId = await getActiveWorkspaceId();
  return { session, workspaceId };
}

/** Enforce business-only API surfaces for the active workspace. */
export async function requireWorkspaceFeature(feature: WorkspaceFeature) {
  const auth = await requireSession();
  if ("error" in auth) return auth;
  if (!auth.workspaceId) {
    return { error: NextResponse.json({ error: "workspaceId required" }, { status: 400 }) };
  }
  try {
    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { type: true },
    });
    const workspaceType = workspace?.type === "PERSONAL" ? "PERSONAL" : "BUSINESS";
    if (!canUseFeature(workspaceType, feature)) {
      return {
        error: NextResponse.json(
          { error: "This feature is not available in your current workspace." },
          { status: 403 },
        ),
      };
    }
  } catch {
    return {
      error: NextResponse.json({ error: "Could not verify workspace" }, { status: 500 }),
    };
  }
  return auth;
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
  if (isSchedulingConflictError(err)) {
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
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
  const httpStatus = /forbidden|unauthorized/i.test(message) ? 403 : status;
  const conflictCode =
    err && typeof err === "object" && "code" in err && typeof (err as { code?: string }).code === "string"
      ? (err as { code: string }).code
      : undefined;
  return NextResponse.json(
    { error: message, ...(conflictCode ? { code: conflictCode } : {}) },
    { status: httpStatus },
  );
}

export { jsonEntitlementError } from "@/lib/products/entitlement-errors";
