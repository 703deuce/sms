import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { transcribeRecordingWithDeepgram } from "@/lib/voice-v3/post-call/transcription";
import { enqueueVoiceV3PostCallJob } from "@/lib/voice-v3/post-call/enqueue";

export async function POST(
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
    });
    if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const recording = await prisma.voiceRecording.findFirst({
      where: { callId: id, workspaceId: auth.workspaceId, status: "ready" },
      orderBy: { createdAt: "desc" },
    });
    if (!recording) {
      return NextResponse.json({ error: "Recording not ready" }, { status: 409 });
    }
    await prisma.voiceTranscript.updateMany({
      where: { callId: id, workspaceId: auth.workspaceId },
      data: { status: "processing", errorMessage: null },
    });
    const result = await transcribeRecordingWithDeepgram({
      workspaceId: auth.workspaceId,
      callId: id,
      recordingId: recording.id,
      channels: recording.channels,
    });
    if (result.ok) {
      await enqueueVoiceV3PostCallJob({
        workspaceId: auth.workspaceId,
        callId: id,
        delaySeconds: 2,
      });
    }
    return NextResponse.json({ ok: result.ok, error: result.error });
  } catch (err) {
    return jsonError(err, 500);
  }
}
