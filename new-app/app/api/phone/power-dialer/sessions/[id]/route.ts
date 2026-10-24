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
import {
  orchestratePowerDialerSession,
  reconcilePowerDialerSession,
  listUpcomingEligibleContacts,
  skipContactInSession,
  setPreviewHeld,
} from "@/lib/server/phone/power-dialer/session-orchestration";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const includeAttempts = url.searchParams.get("attempts") === "1";
    await orchestratePowerDialerSession(workspaceId, id);
    const [runtime, attempts, upcoming] = await Promise.all([
      getSessionRuntime(workspaceId, id),
      includeAttempts ? listSessionAttempts(workspaceId, id) : Promise.resolve(undefined),
      listUpcomingEligibleContacts(workspaceId, id, 8),
    ]);
    return NextResponse.json({
      data: {
        next: runtime.next,
        session: runtime.session,
        rules: runtime.rules,
        progression: runtime.progression,
        eligibilityCounts: runtime.eligibilityCounts,
        currentAttempt: runtime.currentAttempt,
        connectionIntelligence: runtime.connectionIntelligence,
        parallelDial: runtime.parallelDial,
        ringTimeoutHangup: runtime.ringTimeoutHangup,
        emptyReasons: runtime.emptyReasons,
        nextEligibleAt: runtime.nextEligibleAt,
        upcomingQueue: upcoming,
        queueContext: runtime.queueContext,
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
    } else if (body.action === "orchestrate") {
      const data = await orchestratePowerDialerSession(workspaceId, id);
      return NextResponse.json({ data });
    } else if (body.action === "reconcile") {
      const data = await reconcilePowerDialerSession(workspaceId, id);
      return NextResponse.json({ data });
    } else if (body.action === "skip_contact") {
      const contactId = String((body as { contactId?: string }).contactId || "");
      if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });
      await skipContactInSession(workspaceId, id, contactId);
      return NextResponse.json({ ok: true });
    } else if (body.action === "preview_held") {
      const held = (body as { held?: boolean }).held === true;
      await setPreviewHeld(workspaceId, id, held);
      return NextResponse.json({ ok: true });
    } else if (body.action === "prepare_agent_media") {
      const fromE164 = String((body as { fromE164?: string }).fromE164 || "");
      if (!fromE164) {
        return NextResponse.json({ error: "fromE164 required" }, { status: 400 });
      }
      const { prepareSessionAgentMedia } = await import(
        "@/lib/server/phone/power-dialer/session-agent-media"
      );
      const data = await prepareSessionAgentMedia({
        workspaceId,
        sessionId: id,
        fromE164,
      });
      return NextResponse.json({ data });
    } else if (body.action === "report_agent_media_ready") {
      const { markSessionAgentMediaReady, sessionRequiresWarmAgentMedia } = await import(
        "@/lib/server/phone/power-dialer/session-agent-media"
      );
      const required = await sessionRequiresWarmAgentMedia(workspaceId);
      if (required) {
        return NextResponse.json(
          { error: "Server warm agent leg required — wait for session SIP answer" },
          { status: 400 },
        );
      }
      await markSessionAgentMediaReady({ workspaceId, sessionId: id });
      return NextResponse.json({ ok: true });
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
