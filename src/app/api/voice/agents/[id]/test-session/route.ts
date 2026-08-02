import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createVoiceTestSession,
  endVoiceTestSession,
} from "@/lib/voice/platform/test-session";

/**
 * POST — mint a short-lived WebRTC test session for this workspace agent.
 * Returns anonymous_login target only (never TELNYX_API_KEY).
 *
 * DELETE/PATCH — audit session end + persist test conversation label.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      sync?: boolean;
      testVariables?: Record<string, string>;
    };

    const result = await createVoiceTestSession({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      agentId,
      sync: body.sync !== false,
      testVariables: body.testVariables,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const body = (await request.json()) as {
      sessionId?: string;
      durationSec?: number;
      conversationId?: string | null;
      error?: string | null;
      action?: string;
      quality?: Record<string, unknown> | null;
      qualityReport?: Record<string, unknown> | null;
      timeline?: Record<string, unknown> | null;
    };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    // Ownership check
    const { getPrisma } = await import("@/lib/db");
    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await endVoiceTestSession({
      workspaceId: auth.workspaceId,
      agentId,
      sessionId: body.sessionId,
      durationSec: body.durationSec,
      conversationId: body.conversationId,
      error: body.error,
      quality: body.quality as Parameters<typeof endVoiceTestSession>[0]["quality"],
      qualityReport: body.qualityReport ?? null,
      timeline: body.timeline ?? null,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
