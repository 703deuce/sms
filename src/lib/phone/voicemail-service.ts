import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxPhoneConfigured } from "./human-call-service";

export async function ensureUserVoicemailBox(workspaceId: string, userId: string, name?: string) {
  const prisma = getPrisma();
  const existing = await prisma.voicemailBox.findFirst({
    where: { workspaceId, ownerUserId: userId },
  });
  if (existing) return existing;
  return prisma.voicemailBox.create({
    data: {
      workspaceId,
      ownerUserId: userId,
      name: name || "Personal voicemail",
      greetingText: "Please leave a message after the tone.",
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
