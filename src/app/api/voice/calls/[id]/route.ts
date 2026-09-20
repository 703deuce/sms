import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const prisma = getPrisma();
    const call = await prisma.voiceCall.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      include: {
        agent: { select: { id: true, name: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
      },
    });
    if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const callbackRequest = await prisma.callbackRequest.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        metadata: { path: ["voiceV3", "callId"], equals: id },
      },
      orderBy: { requestedAt: "desc" },
    });

    const [events, transcripts, recordings, insights, transfers, toolExecutions] =
      await Promise.all([
        prisma.voiceCallEvent.findMany({
          where: { callId: id },
          orderBy: { createdAt: "asc" },
        }),
        prisma.voiceTranscript.findMany({
          where: { callId: id },
          include: { segments: { orderBy: { startMs: "asc" } } },
        }),
        prisma.voiceRecording.findMany({ where: { callId: id } }),
        prisma.voiceConversationInsight.findMany({ where: { callId: id } }),
        prisma.voiceTransfer.findMany({ where: { callId: id } }),
        prisma.voiceToolExecution.findMany({
          where: { callId: id },
          orderBy: { createdAt: "asc" },
        }),
      ]);

    const meta = asRecord(call.metadata);
    const feedback = asRecord(meta.callFeedback);
    const voiceV3PostCall = asRecord(meta.voiceV3PostCall);
    const voiceV3Analytics = asRecord(meta.voiceV3Analytics);
    const structuredSummary = insights[0]?.customFields
      ? asRecord((insights[0].customFields as Record<string, unknown>).voiceV3StructuredSummary)
      : {};

    return NextResponse.json({
      data: {
        call: {
          ...call,
          startedAt: call.startedAt.toISOString(),
          answeredAt: call.answeredAt?.toISOString() ?? null,
          endedAt: call.endedAt?.toISOString() ?? null,
          createdAt: call.createdAt.toISOString(),
          updatedAt: call.updatedAt.toISOString(),
          agentName: call.agent?.name ?? null,
          contactName: call.contact
            ? [call.contact.firstName, call.contact.lastName].filter(Boolean).join(" ")
            : null,
          contactEmail: call.contact?.email ?? null,
          structuredMessage: meta.structuredMessage ?? null,
          executionTrace: meta.executionTrace ?? null,
          callFeedback: feedback.rating ? feedback : null,
        },
        events,
        transcripts,
        recordings,
        insights,
        transfers,
        toolExecutions,
        callbackRequest: callbackRequest
          ? {
              id: callbackRequest.id,
              status: callbackRequest.status,
              reason: callbackRequest.reason,
              requestedAt: callbackRequest.requestedAt.toISOString(),
            }
          : null,
        voiceV3PostCall,
        voiceV3Analytics,
        voiceV3StructuredSummary: structuredSummary,
      },
    });
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
    const { id } = await params;
    const body = (await request.json()) as {
      feedback?: {
        rating?: "good" | "needs_improvement";
        reason?: string;
      };
    };

    const prisma = getPrisma();
    const call = await prisma.voiceCall.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { id: true, metadata: true },
    });
    if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!body.feedback?.rating) {
      return NextResponse.json({ error: "feedback.rating required" }, { status: 400 });
    }

    const meta = asRecord(call.metadata);
    meta.callFeedback = {
      rating: body.feedback.rating,
      reason: body.feedback.reason || null,
      at: new Date().toISOString(),
    };

    await prisma.voiceCall.update({
      where: { id },
      data: { metadata: meta as object },
    });

    return NextResponse.json({ ok: true, feedback: meta.callFeedback });
  } catch (err) {
    return jsonError(err, 500);
  }
}
