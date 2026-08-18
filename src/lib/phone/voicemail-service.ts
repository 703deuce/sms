import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isTelnyxPhoneConfigured } from "./human-call-service";
import { resolveVoicemailGreetingPlayback } from "./voicemail-greeting-playback";

function encodeVoicemailClientState(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

async function resolvePhoneNumberIdForVoicemail(
  workspaceId: string,
  phoneNumberId?: string | null,
  toE164?: string | null,
) {
  if (phoneNumberId) return phoneNumberId;
  const to = toE164?.trim();
  if (!to) return null;
  const normalized = normalizeE164(to);
  const pn = await getPrisma().phoneNumber.findFirst({
    where: {
      workspaceId,
      OR: [{ e164: to }, { e164: normalized }],
    },
    select: { id: true },
  });
  return pn?.id ?? null;
}

export async function startVoicemailRecordingOnCall(input: {
  telnyxCallControlId: string;
  humanCallId: string;
}) {
  if (!isTelnyxPhoneConfigured()) return;
  await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/record_start`, {
    method: "POST",
    body: { format: "mp3", channels: "single", play_beep: true, max_length: 180 },
  }).catch((err) => {
    console.warn("[voicemail] record_start failed", {
      humanCallId: input.humanCallId,
      err,
    });
  });
}

export async function handleVoicemailGreetingMediaEnded(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
  clientState: Record<string, unknown>;
}) {
  const clientState = input.clientState;
  if (clientState.kind !== "voicemail_greeting") return { handled: false as const };

  const humanCallId = String(clientState.humanCallId || "");
  const telnyxCallControlId = String(
    input.eventPayload.call_control_id || clientState.telnyxCallControlId || "",
  );
  if (!humanCallId || !telnyxCallControlId) return { handled: false as const };

  const playbackStatus = String(
    (input.eventPayload as { status?: string }).status ||
      (input.eventPayload.payload as { status?: string } | undefined)?.status ||
      "",
  );

  if (input.eventType === "call.playback.ended") {
    const failedPlayback =
      playbackStatus === "file_not_found" ||
      playbackStatus === "failed" ||
      playbackStatus === "unknown";
    const sayText =
      typeof clientState.sayText === "string" ? clientState.sayText.trim() : "";

    if (failedPlayback && sayText) {
      console.warn("[voicemail] Telnyx playback ended with failure — falling back to speak", {
        humanCallId,
        playbackStatus,
        playUrl: clientState.playUrl,
      });
      await telnyxRequest(`/calls/${telnyxCallControlId}/actions/speak`, {
        method: "POST",
        body: {
          payload: sayText,
          voice: "female",
          language: "en-US",
          client_state: encodeVoicemailClientState({
            kind: "voicemail_greeting",
            humanCallId,
            awaiting: "speak",
            sayText,
          }),
        },
      }).catch((err) => {
        console.error("[voicemail] speak fallback after playback failure failed", {
          humanCallId,
          err,
        });
        return startVoicemailRecordingOnCall({ telnyxCallControlId, humanCallId });
      });
      return { handled: true as const, kind: "voicemail_greeting_speak_fallback" };
    }
  }

  if (
    input.eventType === "call.playback.ended" ||
    input.eventType === "call.speak.ended"
  ) {
    await startVoicemailRecordingOnCall({ telnyxCallControlId, humanCallId });
    return { handled: true as const, kind: "voicemail_recording_started" };
  }

  return { handled: false as const };
}

export async function ensureNumberVoicemailBox(
  workspaceId: string,
  phoneNumberId: string,
  ownerUserId?: string | null,
) {
  const prisma = getPrisma();
  const existing = await prisma.voicemailBox.findFirst({
    where: { workspaceId, phoneNumberId },
  });
  if (existing) return existing;

  const pn = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: { e164: true, friendlyName: true },
  });

  return prisma.voicemailBox.create({
    data: {
      workspaceId,
      phoneNumberId,
      ownerUserId: ownerUserId ?? null,
      name: pn?.friendlyName?.trim() || pn?.e164 || "Number voicemail",
      greetingText: "Please leave a message after the tone.",
      transcriptionEnabled: true,
      active: true,
    },
  });
}

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
  phoneNumberId?: string | null;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
  const phoneNumberId = await resolvePhoneNumberIdForVoicemail(
    input.workspaceId,
    input.phoneNumberId,
    call?.to,
  );

  let box = phoneNumberId
    ? await prisma.voicemailBox.findFirst({
        where: { workspaceId: input.workspaceId, phoneNumberId, active: true },
      })
    : null;
  if (!box && phoneNumberId) {
    box = await ensureNumberVoicemailBox(input.workspaceId, phoneNumberId, input.userId);
  }
  if (!box && input.queueId) {
    box = await prisma.voicemailBox.findFirst({
      where: { workspaceId: input.workspaceId, queueId: input.queueId, active: true },
    });
  }
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

  if (isTelnyxPhoneConfigured()) {
    const playback = await resolveVoicemailGreetingPlayback(input.workspaceId, box);
    console.info("[voicemail] leaveVoicemailOnCall", {
      humanCallId: input.humanCallId,
      phoneNumberId,
      boxId: box.id,
      boxPhoneNumberId: box.phoneNumberId,
      greetingUrl: box.greetingUrl,
      playUrl: playback.playUrl,
      sayText: playback.sayText
        ? playback.sayText.length > 40
          ? `${playback.sayText.slice(0, 40)}…`
          : playback.sayText
        : null,
    });

    const greetingState = encodeVoicemailClientState({
      kind: "voicemail_greeting",
      humanCallId: input.humanCallId,
      workspaceId: input.workspaceId,
      phoneNumberId,
      playUrl: playback.playUrl,
      sayText: playback.sayText,
    });

    if (playback.playUrl) {
      try {
        await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/playback_start`, {
          method: "POST",
          body: {
            audio_url: playback.playUrl,
            client_state: greetingState,
          },
        });
      } catch (err) {
        console.error("[voicemail] Telnyx playback_start failed", {
          humanCallId: input.humanCallId,
          phoneNumberId,
          playUrl: playback.playUrl,
          err,
        });
        if (playback.sayText) {
          await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/speak`, {
            method: "POST",
            body: {
              payload: playback.sayText,
              voice: "female",
              language: "en-US",
              client_state: encodeVoicemailClientState({
                kind: "voicemail_greeting",
                humanCallId: input.humanCallId,
                awaiting: "speak",
                sayText: playback.sayText,
              }),
            },
          }).catch(() => undefined);
        } else {
          await startVoicemailRecordingOnCall({
            telnyxCallControlId: input.telnyxCallControlId,
            humanCallId: input.humanCallId,
          });
        }
      }
    } else if (playback.sayText) {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/speak`, {
        method: "POST",
        body: {
          payload: playback.sayText,
          voice: "female",
          language: "en-US",
          client_state: encodeVoicemailClientState({
            kind: "voicemail_greeting",
            humanCallId: input.humanCallId,
            awaiting: "speak",
            sayText: playback.sayText,
          }),
        },
      }).catch(() => undefined);
    } else {
      await startVoicemailRecordingOnCall({
        telnyxCallControlId: input.telnyxCallControlId,
        humanCallId: input.humanCallId,
      });
    }
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
 * Telnyx voicemail: attach recording then transcribe via Transovo Whisper path.
 * Twilio numbers must use twilio-voicemail-pipeline (Twilio transcription).
 */
export async function attachVoicemailRecordingAndTranscribe(input: {
  workspaceId: string;
  humanCallId?: string | null;
  messageId?: string | null;
  recordingUrl: string;
  durationSeconds?: number | null;
  upstreamProvider?: "telnyx" | "twilio";
}) {
  if (input.upstreamProvider === "twilio") {
    throw new Error("Twilio voicemails must use the Twilio transcription pipeline");
  }
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
      const html = `<p>New voicemail on <strong>${box?.name ?? "voicemail"}</strong>.</p>
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
          textContent: `New voicemail on ${box?.name ?? "voicemail"} from ${updated.fromE164 || "unknown"}. ${updated.transcriptText || ""}`,
        });
      }
    } catch (err) {
      console.warn("[voicemail] email notify failed", err);
    }
  }

  if (!box?.transcriptionEnabled) return updated;
  if (updated.transcriptText && !updated.transcriptText.startsWith("[Transcription")) return updated;

  try {
    const { transcribeAudioUrl } = await import("./voicemail-transcribe");
    const transcript = await transcribeAudioUrl(input.recordingUrl);
    if (!transcript) {
      return prisma.voicemailMessage.update({
        where: { id: msg.id },
        data: {
          transcriptText:
            "[Transcription pending — set OPENAI_API_KEY to enable Whisper transcripts]",
        },
      });
    }
    const withTranscript = await prisma.voicemailMessage.update({
      where: { id: msg.id },
      data: { transcriptText: transcript },
    });
    if (notifyTargets.length > 0) {
      try {
        const { sendTransactionalEmail } = await import("@/lib/email/brevo");
        const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";
        for (const to of notifyTargets) {
          await sendTransactionalEmail({
            to: String(to),
            subject: `Voicemail transcript from ${withTranscript.fromE164 || "unknown"}`,
            htmlContent: `<p>Transcript: ${transcript}</p>${appUrl ? `<p><a href="${appUrl}/personal/voicemail">Open inbox</a></p>` : ""}`,
            textContent: transcript,
          });
        }
      } catch {
        // ignore secondary email errors
      }
    }
    return withTranscript;
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
