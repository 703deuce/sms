import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { transferHumanCall } from "@/lib/server/phone/transfer";
import { assertRepAuthorized } from "@/lib/server/phone/power-dialer/session-runtime";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  startWarmTransfer,
  completeWarmTransfer,
  cancelWarmTransfer,
  parseWarmTransferState,
} from "@/lib/server/phone/power-dialer/warm-transfer";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id: attemptId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    await assertRepAuthorized(workspaceId);
    const body = (await request.json()) as {
      to?: string;
      mode?: "cold" | "warm" | "three_way";
      action?: "start" | "complete" | "cancel";
    };
    const prisma = getPrisma();
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: attemptId, workspaceId },
      include: { humanCall: true, session: true },
    });
    if (!attempt?.humanCallId) throw new Error("No active call to transfer");

    if (body.action === "complete") {
      const data = await completeWarmTransfer(workspaceId, attemptId);
      return NextResponse.json({ data });
    }
    if (body.action === "cancel") {
      const data = await cancelWarmTransfer(workspaceId, attemptId);
      return NextResponse.json({ data });
    }

    const to = String(body.to || "").trim();
    if (!to && body.mode !== "warm") {
      return NextResponse.json({ error: "to required" }, { status: 400 });
    }
    const mode = body.mode || "cold";

    if (mode === "warm" || mode === "three_way") {
      const result = await startWarmTransfer({
        workspaceId,
        attemptId,
        toE164: to,
        mode,
      });
      const state = parseWarmTransferState(attempt.session.transferStateJson);
      return NextResponse.json({ data: { ...result, transferState: state } });
    }

    const updated = await transferHumanCall({
      workspaceId,
      humanCallId: attempt.humanCallId,
      toE164: to,
    });
    await prisma.powerDialerAttempt.update({
      where: { id: attemptId },
      data: { disposition: "Transferred", status: "completed", endedAt: new Date() },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return jsonError(err, 400);
  }
}
