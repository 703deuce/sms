/**
 * Twilio voicemail recording — transcription via Deepgram when entitled (not Twilio STT).
 */
import { getPrisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";

export async function ensureVoicemailMessageForHumanCall(input: {
  workspaceId: string;
  humanCallId: string;
  phoneNumberId?: string | null;
}) {
  const prisma = getPrisma();
  const human = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!human) return null;

  let message = await prisma.voicemailMessage.findFirst({
    where: { humanCallId: human.id, workspaceId: input.workspaceId },
  });
  if (message) return message;

  let box = input.phoneNumberId
    ? await prisma.voicemailBox.findFirst({
        where: { workspaceId: input.workspaceId, phoneNumberId: input.phoneNumberId, active: true },
      })
    : null;
  if (!box) {
    box = await prisma.voicemailBox.findFirst({
      where: { workspaceId: input.workspaceId, phoneNumberId: input.phoneNumberId ?? undefined, active: true },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!box) return null;

  return prisma.voicemailMessage.create({
    data: {
      workspaceId: input.workspaceId,
      boxId: box.id,
      fromE164: human.from,
      toE164: human.to,
      humanCallId: human.id,
      isRead: false,
    },
  });
}

export async function attachTwilioVoicemailRecording(input: {
  workspaceId: string;
  humanCallId: string;
  recordingUrl: string;
  recordingSid?: string;
  durationSeconds?: number;
  phoneNumberId?: string | null;
}) {
  const prisma = getPrisma();
  const msg =
    (await ensureVoicemailMessageForHumanCall({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      phoneNumberId: input.phoneNumberId,
    })) ??
    (await prisma.voicemailMessage.findFirst({
      where: { workspaceId: input.workspaceId, humanCallId: input.humanCallId },
    }));
  if (!msg) return null;

  const updated = await prisma.voicemailMessage.update({
    where: { id: msg.id },
    data: {
      recordingUrl: input.recordingUrl,
      durationSeconds: input.durationSeconds ?? msg.durationSeconds,
    },
  });

  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      status: "voicemail",
      disposition: `voicemail:twilio:${input.recordingSid || "recording"}`,
      recordingUrl: input.recordingUrl,
    },
  });

  const { enqueueTranscriptionJob } = await import("@/lib/transcription/service");
  await enqueueTranscriptionJob({
    workspaceId: input.workspaceId,
    sourceType: "voicemail_message",
    sourceId: updated.id,
    recordingUrl: input.recordingUrl,
    provider: "twilio",
    durationSeconds: input.durationSeconds ?? null,
    diarize: false,
    bypassEntitlement: true,
  }).catch((err) => console.warn("[twilio-voicemail] transcription enqueue failed", err));

  return updated;
}

export async function applyTwilioVoicemailTranscription(input: {
  workspaceId: string;
  humanCallId: string;
  transcriptText: string;
  transcriptionSid?: string;
}) {
  const prisma = getPrisma();
  const msg = await prisma.voicemailMessage.findFirst({
    where: { workspaceId: input.workspaceId, humanCallId: input.humanCallId },
    orderBy: { createdAt: "desc" },
  });
  if (!msg) return null;

  const updated = await prisma.voicemailMessage.update({
    where: { id: msg.id },
    data: {
      transcriptText: input.transcriptText.trim(),
    },
  });

  const box = await prisma.voicemailBox.findFirst({ where: { id: msg.boxId } });
  await maybeSendVoicemailEmails(updated, box);

  return updated;
}

export async function maybeSendVoicemailEmails(
  message: {
    id: string;
    fromE164: string | null;
    toE164: string | null;
    durationSeconds: number | null;
    transcriptText: string | null;
  },
  box: { name: string; emailNotify?: string | null; secondaryEmailNotify?: string | null } | null,
) {
  const notifyTargets = [
    box?.emailNotify,
    box?.secondaryEmailNotify,
  ].filter((e): e is string => Boolean(e && String(e).trim()));

  if (!notifyTargets.length) return;

  try {
    const { sendTransactionalEmail } = await import("@/lib/email/brevo");
    const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";
    const transcriptBlock = message.transcriptText
      ? `<p><strong>Transcript:</strong> ${message.transcriptText}</p>`
      : "";
    const recordingLink = appUrl
      ? `<p><a href="${appUrl}/api/phone/voicemail/${message.id}/recording">Download recording</a></p>`
      : "";
    const html = `<p>New voicemail on <strong>${box?.name ?? "voicemail"}</strong>.</p>
<p>From: ${message.fromE164 || "unknown"}</p>
<p>To: ${message.toE164 || "—"}</p>
<p>Duration: ${message.durationSeconds ?? "—"}s</p>
${transcriptBlock}
${recordingLink}
${appUrl ? `<p><a href="${appUrl}/personal/voicemail">Open voicemail inbox</a></p>` : ""}`;
    for (const to of notifyTargets) {
      await sendTransactionalEmail({
        to: String(to),
        subject: `New voicemail from ${message.fromE164 || "unknown"}`,
        htmlContent: html,
        textContent: `New voicemail from ${message.fromE164 || "unknown"}. ${message.transcriptText || ""}`,
      });
    }
  } catch (err) {
    console.warn("[twilio-voicemail] email notify failed", err);
  }
}

export function twilioVoicemailTranscriptionCallbackUrl(humanCallId: string): string {
  const base = getAppBaseUrl();
  return `${base}/api/webhooks/twilio/voice/transcription?humanCallId=${encodeURIComponent(humanCallId)}`;
}
