import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  getActiveImpersonation,
  startImpersonation,
  stopImpersonation,
} from "@/lib/server/phone/power-dialer/impersonation";
import { getMembershipForUser, isPowerDialerAdminRole } from "@/lib/server/phone/power-dialer/campaign-access";
import { listWorkspaceReps } from "@/lib/server/phone/power-dialer/campaign-access";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const actorUserId = await resolveInternalUserId();
    const active = await getActiveImpersonation({ workspaceId, actorUserId });
    const membership = await getMembershipForUser(workspaceId, actorUserId);
    const canImpersonate =
      membership && (isPowerDialerAdminRole(membership.role) || membership.role === "MANAGER");
    const reps = canImpersonate ? await listWorkspaceReps(workspaceId) : [];
    return NextResponse.json({
      data: {
        active: active
          ? { sessionId: active.id, targetUserId: active.targetUserId, startedAt: active.startedAt }
          : null,
        canImpersonate: Boolean(canImpersonate),
        reps,
      },
    });
  } catch (err) {
    return jsonError(err, 403);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const actorUserId = await resolveInternalUserId();
    const body = (await request.json()) as { action?: string; targetUserId?: string };
    if (body.action === "stop") {
      await stopImpersonation({ workspaceId, actorUserId, reason: "user_stopped" });
      return NextResponse.json({ ok: true });
    }
    if (!body.targetUserId) throw new Error("targetUserId required");
    const session = await startImpersonation({
      workspaceId,
      actorUserId,
      targetUserId: body.targetUserId,
    });
    return NextResponse.json({ data: { sessionId: session.id, targetUserId: session.targetUserId } });
  } catch (err) {
    return jsonError(err, 403);
  }
}
