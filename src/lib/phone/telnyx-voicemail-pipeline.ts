/**
 * Telnyx-owned voicemail transcription via record_start + call.recording.transcription.saved.
 * Whisper is only used as an explicit fallback when native transcription fails.
 */
import { getPrisma } from "@/lib/db";
import { maybeSendVoicemailEmails } from "@/lib/phone/twilio-voicemail-pipeline";

export const TRANSCRIPTION_PROCESSING = "Transcription processing…";
export const TRANSCRIPTION_FAILED_PREFIX = "[Transcription failed:";

export function isTranscriptionPending(text: string | null | undefined): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed === TRANSCRIPTION_PROCESSING) return true;
  if (trimmed.startsWith("[Transcription pending")) return true;
  return false;
}

export function isTranscriptionFailed(text: string | null | undefined): boolean {
  return Boolean(text?.trim().startsWith(TRANSCRIPTION_FAILED_PREFIX));
}

export function parseTelnyxRecordingTranscriptionPayload(
  payload: Record<string, unknown>,
): { transcript: string; transcriptionId?: string; recordingId?: string } | null {
  const transcriptionData = payload.transcription_data as Record<string, unknown> | undefined;
  const transcript =
    (typeof transcriptionData?.transcript === "string" ? transcriptionData.transcript : "") ||
    (typeof payload.transcription_text === "string" ? payload.transcription_text : "") ||
    (typeof payload.transcript === "string" ? payload.transcript : "") ||
    (typeof payload.text === "string" ? payload.text : "");
  const trimmed = transcript.trim();
  if (!trimmed) return null;

  const transcriptionId =
    (typeof payload.transcription_id === "string" ? payload.transcription_id : undefined) ||
    (typeof payload.transcriptionId === "string" ? payload.transcriptionId : undefined);
  const recordingId =
    (typeof payload.recording_id === "string" ? payload.recording_id : undefined) ||
    (typeof payload.recordingId === "string" ? payload.recordingId : undefined);

  return { transcript: trimmed, transcriptionId, recordingId };
}

export async function applyTelnyxVoicemailTranscription(input: {
  workspaceId: string;
  humanCallId: string;
  transcriptText: string;
  transcriptionId?: string;
}) {
  const prisma = getPrisma();
  const msg = await prisma.voicemailMessage.findFirst({
    where: { workspaceId: input.workspaceId, humanCallId: input.humanCallId },
    orderBy: { createdAt: "desc" },
  });
  if (!msg) return null;

  const updated = await prisma.voicemailMessage.update({
    where: { id: msg.id },
    data: { transcriptText: input.transcriptText.trim() },
  });

  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: { transcriptText: input.transcriptText.trim() },
  });

  const box = await prisma.voicemailBox.findFirst({ where: { id: msg.boxId } });
  await maybeSendVoicemailEmails(updated, box);

  return updated;
}

export async function markVoicemailTranscriptionProcessing(input: {
  workspaceId: string;
  humanCallId: string;
}) {
  const prisma = getPrisma();
  const msg = await prisma.voicemailMessage.findFirst({
    where: { workspaceId: input.workspaceId, humanCallId: input.humanCallId },
    orderBy: { createdAt: "desc" },
  });
  if (!msg) return null;
  if (msg.transcriptText && !isTranscriptionPending(msg.transcriptText)) return msg;

  return prisma.voicemailMessage.update({
    where: { id: msg.id },
    data: { transcriptText: TRANSCRIPTION_PROCESSING },
  });
}

export async function markVoicemailTranscriptionFailed(input: {
  workspaceId: string;
  humanCallId: string;
  reason: string;
}) {
  const prisma = getPrisma();
  const msg = await prisma.voicemailMessage.findFirst({
    where: { workspaceId: input.workspaceId, humanCallId: input.humanCallId },
    orderBy: { createdAt: "desc" },
  });
  if (!msg) return null;

  return prisma.voicemailMessage.update({
    where: { id: msg.id },
    data: {
      transcriptText: `${TRANSCRIPTION_FAILED_PREFIX} ${input.reason.slice(0, 120)}]`,
    },
  });
}
