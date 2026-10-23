import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { assertRepAuthorized } from "@/lib/server/phone/power-dialer/session-runtime";
import { resolveWorkspaceId } from "@/lib/server/workspace";

/** M05 — Rep speaks live on connected leg (no prerecorded playback). */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(_request);
  if (denied) return denied;
  try {
    const { id: attemptId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    await assertRepAuthorized(workspaceId);
    const prisma = getPrisma();
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: attemptId, workspaceId },
      include: { humanCall: true },
    });
    if (!attempt?.humanCall?.telnyxCallControlId) {
      throw new Error("No connected call for live voicemail");
    }
    if (attempt.status !== "answered") {
      throw new Error("Call must be connected to leave a live voicemail");
    }
    await prisma.powerDialerAttempt.update({
      where: { id: attemptId },
      data: {
        vmDeliveryMode: "live_rep",
        notes: `${attempt.notes || ""} live_voicemail_active`.trim(),
        answerClassification: attempt.answerClassification || "voicemail",
      },
    });
    return NextResponse.json({
      data: {
        ok: true,
        message: "Live voicemail — speak after the beep. Hang up when finished, then set disposition.",
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
