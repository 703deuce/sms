import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { verifyTwilioVoiceWebhookSignature } from "@/lib/numbers/providers/voice/twilio-voice-webhook-auth";
import { attachVoicemailRecordingAndTranscribe } from "@/lib/phone/voicemail-service";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

async function verifySignature(request: Request, params: Record<string, string>) {
  return verifyTwilioVoiceWebhookSignature(request, params, params.To);
}

export async function POST(request: Request) {
  const params = await parseTwilioForm(request);
  if (!(await verifySignature(request, params))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const url = new URL(request.url);
  const humanCallId = url.searchParams.get("humanCallId");
  const recordingUrl = params.RecordingUrl;
  const recordingSid = params.RecordingSid;
  const duration = Number(params.RecordingDuration || "0");

  if (!humanCallId || !recordingUrl) {
    return NextResponse.json({ ok: true });
  }

  const prisma = getPrisma();
  const human = await prisma.humanCall.findUnique({ where: { id: humanCallId } });
  if (!human) return NextResponse.json({ ok: true });

  let message = await prisma.voicemailMessage.findFirst({
    where: { humanCallId: human.id, workspaceId: human.workspaceId },
  });

  if (!message) {
    const box = await prisma.voicemailBox.findFirst({
      where: { workspaceId: human.workspaceId, active: true },
    });
    if (!box) return NextResponse.json({ ok: true });
    message = await prisma.voicemailMessage.create({
      data: {
        workspaceId: human.workspaceId,
        boxId: box.id,
        fromE164: human.from,
        toE164: human.to,
        humanCallId: human.id,
        isRead: false,
      },
    });
  }

  await attachVoicemailRecordingAndTranscribe({
    workspaceId: human.workspaceId,
    messageId: message.id,
    humanCallId: human.id,
    recordingUrl,
    durationSeconds: duration,
  });

  await prisma.humanCall.update({
    where: { id: human.id },
    data: {
      status: "voicemail",
      disposition: `voicemail:twilio:${recordingSid || "recording"}`,
      recordingUrl,
    },
  });

  return NextResponse.json({ ok: true });
}
