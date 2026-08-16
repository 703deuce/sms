import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxPhoneConfigured } from "./human-call-service";

export async function ensureUserVoicemailBox(
  workspaceId: string,
  userId: string,
  name?: string,
  greetingText?: string | null,
) {
  const prisma = getPrisma();
  const existing = await prisma.voicemailBox.findFirst({
    where: { workspaceId, ownerUserId: userId },
  });
  if (existing) {
    if (greetingText != null || name) {
      return prisma.voicemailBox.update({
        where: { id: existing.id },
        data: {
          ...(greetingText != null ? { greetingText } : {}),
          ...(name ? { name } : {}),
        },
      });
    }
    return existing;
  }
  return prisma.voicemailBox.create({
    data: {
      workspaceId,
      ownerUserId: userId,
      name: name || "Personal voicemail",
      greetingText: greetingText || "Please leave a message after the tone.",
      transcriptionEnabled: true,
    },
  });
}

export async function leaveVoicemailOnCall(input: {
  workspaceId: string;
  humanCallId: string;
  telnyxCallControlId: string;
  queueId?: string | null;
  userId?: string | null;
}) {
  const prisma = getPrisma();
  let box = input.queueId
    ? await prisma.voicemailBox.findFirst({
        where: { workspaceId: input.workspaceId, queueId: input.queueId, active: true },
      })
    : null;
  if (!box && input.userId) {
    box = await ensureUserVoicemailBox(input.workspaceId, input.userId);
  }
  if (!box) {
    box = await prisma.voicemailBox.findFirst({
      where: { workspaceId: input.workspaceId, active: true },
    });
  }
  if (!box) {
    box = await prisma.voicemailBox.create({
      data: {
        workspaceId: input.workspaceId,
        name: "Main voicemail",
        greetingText: "Please leave a message after the tone.",
      },
    });
  }

  const call = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });

  if (isTelnyxPhoneConfigured()) {
    if (box.greetingUrl) {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/playback_start`, {
        method: "POST",
        body: { audio_url: box.greetingUrl },
      }).catch(() => undefined);
    } else if (box.greetingText) {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/speak`, {
        method: "POST",
        body: { payload: box.greetingText, voice: "female", language: "en-US" },
      }).catch(() => undefined);
    }
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/record_start`, {
      method: "POST",
      body: { format: "mp3", channels: "single", play_beep: true, max_length: 180 },
    }).catch(() => undefined);
  }

  const msg = await prisma.voicemailMessage.create({
    data: {
      workspaceId: input.workspaceId,
      boxId: box.id,
      fromE164: call?.from || null,
      toE164: call?.to || null,
      humanCallId: call?.id || null,
      isRead: false,
    },
  });

  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: { status: "voicemail", disposition: `voicemail:${box.id}` },
  });

  return { box, message: msg };
}

export async function listVoicemailMessages(workspaceId: string, boxId?: string) {
  return getPrisma().voicemailMessage.findMany({
    where: {
      workspaceId,
      ...(boxId ? { boxId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/**
 * Attach recording to the voicemail row for a human call, then transcribe when enabled.
 */
export async function attachVoicemailRecordingAndTranscribe(input: {
  workspaceId: string;
  humanCallId?: string | null;
  messageId?: string | null;
  recordingUrl: string;
  durationSeconds?: number | null;
}) {
  const prisma = getPrisma();
  const msg = input.messageId
    ? await prisma.voicemailMessage.findFirst({
        where: { id: input.messageId, workspaceId: input.workspaceId },
      })
    : input.humanCallId
      ? await prisma.voicemailMessage.findFirst({
          where: {
            workspaceId: input.workspaceId,
            humanCallId: input.humanCallId,
          },
          orderBy: { createdAt: "desc" },
        })
      : null;
  if (!msg) return null;

  const box = await prisma.voicemailBox.findFirst({
    where: { id: msg.boxId, workspaceId: input.workspaceId },
  });

  const updated = await prisma.voicemailMessage.update({
    where: { id: msg.id },
    data: {
      recordingUrl: input.recordingUrl,
      durationSeconds: input.durationSeconds ?? msg.durationSeconds,
    },
  });

  // Optional email notify when the box has emailNotify configured (Brevo when keyed).
  const notifyTargets = [
    box?.emailNotify,
    box?.secondaryEmailNotify,
  ].filter((e): e is string => Boolean(e && String(e).trim()));

  if (notifyTargets.length > 0) {
    try {
      const { sendTransactionalEmail } = await import("@/lib/email/brevo");
      const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";
      const transcriptBlock = updated.transcriptText
        ? `<p><strong>Transcript:</strong> ${updated.transcriptText}</p>`
        : "";
      const recordingLink = appUrl
        ? `<p><a href="${appUrl}/api/phone/voicemail/${updated.id}/recording">Download recording</a></p>`
        : "";
      const html = `<p>New voicemail on <strong>${box.name}</strong>.</p>
<p>From: ${updated.fromE164 || "unknown"}</p>
<p>To: ${updated.toE164 || "—"}</p>
<p>Duration: ${updated.durationSeconds ?? "—"}s</p>
${transcriptBlock}
${recordingLink}
${appUrl ? `<p><a href="${appUrl}/personal/voicemail">Open voicemail inbox</a></p>` : ""}`;
      for (const to of notifyTargets) {
        await sendTransactionalEmail({
          to: String(to),
          subject: `New voicemail from ${updated.fromE164 || "unknown"}`,
          htmlContent: html,
          textContent: `New voicemail on ${box.name} from ${updated.fromE164 || "unknown"}. ${updated.transcriptText || ""}`,
        });
      }
    } catch (err) {
      console.warn("[voicemail] email notify failed", err);
    }
  }

  if (!box?.transcriptionEnabled) return updated;
  if (updated.transcriptText) return updated;

  try {
    const { transcribeAudioUrl } = await import("./voicemail-transcribe");
    const transcript = await transcribeAudioUrl(input.recordingUrl);
    if (!transcript) {
      // No OpenAI key — leave recording playable; UI shows "transcription pending".
      return prisma.voicemailMessage.update({
        where: { id: msg.id },
        data: {
          transcriptText:
            "[Transcription pending — set OPENAI_API_KEY to enable Whisper transcripts]",
        },
      });
    }
    return prisma.voicemailMessage.update({
      where: { id: msg.id },
      data: { transcriptText: transcript },
    });
  } catch (err) {
    console.warn("[voicemail] transcription failed", err);
    return prisma.voicemailMessage.update({
      where: { id: msg.id },
      data: {
        transcriptText: `[Transcription failed: ${err instanceof Error ? err.message.slice(0, 120) : "error"}]`,
      },
    });
  }
}
