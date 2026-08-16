import { NextResponse } from "next/server";
import {
  attachTwilioVoicemailRecording,
  applyTwilioVoicemailTranscription,
} from "@/lib/phone/twilio-voicemail-pipeline";
import { verifyTwilioVoiceWebhookSignature } from "@/lib/numbers/providers/voice/twilio-voice-webhook-auth";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

export async function POST(request: Request) {
  const params = await parseTwilioForm(request);
  if (!(await verifyTwilioVoiceWebhookSignature(request, params, params.To))) {
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

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const human = await prisma.humanCall.findUnique({ where: { id: humanCallId } });
  if (!human) return NextResponse.json({ ok: true });

  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: human.workspaceId, e164: human.to },
    select: { id: true },
  });

  await attachTwilioVoicemailRecording({
    workspaceId: human.workspaceId,
    humanCallId: human.id,
    recordingUrl,
    recordingSid,
    durationSeconds: duration,
    phoneNumberId: pn?.id,
  });

  return NextResponse.json({ ok: true });
}
