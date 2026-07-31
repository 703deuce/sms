import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const call = await getPrisma().voiceCall.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [events, transcripts, recordings, insights, transfers, toolExecutions] =
      await Promise.all([
        getPrisma().voiceCallEvent.findMany({
          where: { callId: id },
          orderBy: { createdAt: "asc" },
        }),
        getPrisma().voiceTranscript.findMany({ where: { callId: id } }),
        getPrisma().voiceRecording.findMany({ where: { callId: id } }),
        getPrisma().voiceConversationInsight.findMany({ where: { callId: id } }),
        getPrisma().voiceTransfer.findMany({ where: { callId: id } }),
        getPrisma().voiceToolExecution.findMany({
          where: { callId: id },
          orderBy: { createdAt: "asc" },
        }),
      ]);

    return NextResponse.json({
      data: {
        call: {
          ...call,
          startedAt: call.startedAt.toISOString(),
          answeredAt: call.answeredAt?.toISOString() ?? null,
          endedAt: call.endedAt?.toISOString() ?? null,
          createdAt: call.createdAt.toISOString(),
          updatedAt: call.updatedAt.toISOString(),
        },
        events,
        transcripts,
        recordings,
        insights,
        transfers,
        toolExecutions,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
