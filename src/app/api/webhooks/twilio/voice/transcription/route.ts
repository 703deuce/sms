import { NextResponse } from "next/server";
import { applyTwilioVoicemailTranscription } from "@/lib/phone/twilio-voicemail-pipeline";
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
  const transcript = params.TranscriptionText || params.transcription_text || "";

  if (!humanCallId || !transcript.trim()) {
    return NextResponse.json({ ok: true });
  }

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const human = await prisma.humanCall.findUnique({ where: { id: humanCallId } });
  if (!human) return NextResponse.json({ ok: true });

  await applyTwilioVoicemailTranscription({
    workspaceId: human.workspaceId,
    humanCallId: human.id,
    transcriptText: transcript,
    transcriptionSid: params.TranscriptionSid,
  });

  return NextResponse.json({ ok: true });
}
