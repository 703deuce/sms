import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { setPowerDialerRecordingPaused } from "@/lib/server/phone/power-dialer/recording-controls";
import { assertPowerDialerRecordingAccess } from "@/lib/server/phone/power-dialer/recording-access";
import { getPrisma } from "@/lib/server/db";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    await assertPowerDialerRecordingAccess(workspaceId, userId);
    const prisma = getPrisma();
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id, workspaceId },
      include: { humanCall: true },
    });
    if (!attempt?.humanCall?.recordingUrl) {
      return NextResponse.json({ error: "No recording for this attempt" }, { status: 404 });
    }
    return NextResponse.json({
      data: {
        recordingUrl: attempt.humanCall.recordingUrl,
        humanCallId: attempt.humanCall.id,
      },
    });
  } catch (err) {
    return jsonError(err, 403);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    const body = (await request.json()) as { paused?: boolean };
    const data = await setPowerDialerRecordingPaused({
      workspaceId,
      attemptId: id,
      paused: body.paused !== false,
      actorUserId: userId,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
