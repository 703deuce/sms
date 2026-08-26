import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { uploadCallRecordingToStorage } from "@/lib/smart-routing/call-recording-storage";
import { buildVoicemailStorageRecordingUrl } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage";

export { buildVoicemailStorageRecordingUrl, parseVoicemailStorageRecordingUrl } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage";

export type StartMctbSipVoicemailInput = {
  workspaceId: string;
  callerE164: string;
  transovoNumberE164: string;
  providerCallId: string;
  livekitRoomName?: string | null;
  forwardedFromE164?: string | null;
};

export async function startMctbSipVoicemailForPython(input: StartMctbSipVoicemailInput) {
  const workspaceId = String(input.workspaceId || "").trim();
  const callerE164 = String(input.callerE164 || "").trim();
  const transovoNumberE164 = String(input.transovoNumberE164 || "").trim();
  if (!workspaceId || !callerE164 || !transovoNumberE164) {
    return { ok: false, error: "missing_required_fields" };
  }

  const prisma = getPrisma();
  let normalized: string | null = null;
  try {
    normalized = normalizeE164(transovoNumberE164);
  } catch {
    normalized = transovoNumberE164;
  }

  const phone = await prisma.phoneNumber.findFirst({
    where: {
      workspaceId,
      OR: [{ e164: transovoNumberE164 }, { e164: normalized }],
    },
    select: { id: true, e164: true },
  });

  let box = phone
    ? await prisma.voicemailBox.findFirst({
        where: { workspaceId, phoneNumberId: phone.id, active: true },
      })
    : null;

  if (!box && phone) {
    const { ensureNumberVoicemailBox } = await import("@/lib/phone/voicemail-service");
    box = await ensureNumberVoicemailBox(workspaceId, phone.id);
  }

  if (!box) {
    box = await prisma.voicemailBox.findFirst({
      where: { workspaceId, active: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!box) {
    box = await prisma.voicemailBox.create({
      data: {
        workspaceId,
        name: "Main voicemail",
        greetingText: "Please leave a message after the tone.",
        transcriptionEnabled: true,
        active: true,
      },
    });
  }

  const message = await prisma.voicemailMessage.create({
    data: {
      workspaceId,
      boxId: box.id,
      fromE164: callerE164,
      toE164: phone?.e164 || transovoNumberE164,
      isRead: false,
      transcriptStatus: box.transcriptionEnabled ? "pending" : "disabled",
    },
  });

  const { notifyWorkspace } = await import("@/lib/notifications/in-app");
  await notifyWorkspace(workspaceId, {
    type: "voicemail",
    title: "New voicemail",
    body: `Voicemail from ${callerE164}`,
    href: "/personal/voicemail",
  }).catch(() => undefined);

  if (box.smsNotifyE164?.trim()) {
    const { sendQuickSms } = await import("@/lib/sms/send-quick");
    await sendQuickSms({
      workspaceId,
      to: box.smsNotifyE164.trim(),
      body: `New voicemail from ${callerE164}. Open Transovo to listen.`,
      idempotencyKey: `vm-notify:${message.id}`,
    }).catch(() => undefined);
  }

  return {
    ok: true,
    messageId: message.id,
    boxId: box.id,
    transcriptionEnabled: Boolean(box.transcriptionEnabled),
    providerCallId: input.providerCallId,
    livekitRoomName: input.livekitRoomName || null,
    forwardedFromE164: input.forwardedFromE164 || null,
  };
}

export type CompleteMctbSipVoicemailInput = {
  workspaceId: string;
  messageId: string;
  audioBase64: string;
  mimeType?: string;
  durationSeconds?: number | null;
  providerCallId?: string | null;
};

export async function completeMctbSipVoicemailForPython(input: CompleteMctbSipVoicemailInput) {
  const workspaceId = String(input.workspaceId || "").trim();
  const messageId = String(input.messageId || "").trim();
  const audioBase64 = String(input.audioBase64 || "").trim();
  if (!workspaceId || !messageId || !audioBase64) {
    return { ok: false, error: "missing_required_fields" };
  }

  const prisma = getPrisma();
  const message = await prisma.voicemailMessage.findFirst({
    where: { id: messageId, workspaceId },
  });
  if (!message) {
    return { ok: false, error: "message_not_found" };
  }

  const bytes = Buffer.from(audioBase64, "base64");
  if (!bytes.length) {
    return { ok: false, error: "empty_recording" };
  }

  const mimeType = input.mimeType?.trim() || "audio/mpeg";
  const extension = mimeType.includes("wav") ? "wav" : "mp3";
  const stored = await uploadCallRecordingToStorage({
    workspaceId,
    callId: input.providerCallId || messageId,
    bytes,
    mimeType,
    extension,
  });

  const recordingUrl = buildVoicemailStorageRecordingUrl(stored.bucket, stored.path);
  const durationSeconds = input.durationSeconds ?? message.durationSeconds;

  const { attachVoicemailRecordingAndTranscribe } = await import("@/lib/phone/voicemail-service");
  const updated = await attachVoicemailRecordingAndTranscribe({
    workspaceId,
    messageId,
    recordingUrl,
    durationSeconds,
    upstreamProvider: "telnyx",
  });

  const appUrl = getAppBaseUrl().replace(/\/$/, "");
  return {
    ok: true,
    messageId,
    recordingUrl,
    playbackUrl: appUrl ? `${appUrl}/api/phone/voicemail/${messageId}/recording` : null,
    durationSeconds: updated?.durationSeconds ?? durationSeconds ?? null,
    transcriptStatus: updated?.transcriptStatus ?? message.transcriptStatus,
  };
}
