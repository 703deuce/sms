import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import {
  endSession,
  pauseSession,
  resumeSession,
  createAttempt,
  listSessionAttempts,
  getSessionRuntime,
} from "@/lib/server/phone/power-dialer";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const includeAttempts = url.searchParams.get("attempts") === "1";
    const [runtime, attempts] = await Promise.all([
      getSessionRuntime(workspaceId, id),
      includeAttempts ? listSessionAttempts(workspaceId, id) : Promise.resolve(undefined),
    ]);
    return NextResponse.json({
      data: {
        next: runtime.next,
        session: runtime.session,
        rules: runtime.rules,
        progression: runtime.progression,
        eligibilityCounts: runtime.eligibilityCounts,
        currentAttempt: runtime.currentAttempt,
        ringTimeoutHangup: runtime.ringTimeoutHangup,
        emptyReasons: runtime.emptyReasons,
        nextEligibleAt: runtime.nextEligibleAt,
        attempts,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { action?: string };
    if (body.action === "pause") await pauseSession(workspaceId, id);
    else if (body.action === "resume") await resumeSession(workspaceId, id);
    else if (body.action === "end") await endSession(workspaceId, id);
    else if (body.action === "skip_countdown") {
      const prisma = getPrisma();
      await prisma.powerDialerSession.updateMany({
        where: { id, workspaceId, status: "active" },
        data: { nextCallAt: new Date() },
      });
    } else if (body.action === "create_attempt") {
      const contactId = String((body as { contactId?: string }).contactId || "");
      const attemptNumber = Number((body as { attemptNumber?: number }).attemptNumber || 1);
      const idempotencyKey =
        typeof (body as { idempotencyKey?: string }).idempotencyKey === "string"
          ? (body as { idempotencyKey?: string }).idempotencyKey
          : undefined;
      const data = await createAttempt(workspaceId, id, contactId, attemptNumber, idempotencyKey);
      return NextResponse.json({ data });
    }
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
