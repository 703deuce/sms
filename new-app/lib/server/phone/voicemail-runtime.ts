import { getPrisma } from "@/lib/server/db";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import { getCallRouting } from "@/lib/server/phone/routing";
import {
  encodeTelnyxClientState,
  telnyxCallAction,
  telnyxCallControlPath,
} from "@/lib/server/phone/telnyx-call-actions";
import { telnyxRequest } from "@/lib/server/telnyx/client";

export async function startVoicemailRecordingOnCall(input: {
  telnyxCallControlId: string;
  humanCallId: string;
}) {
  if (!isTelnyxPhoneConfigured()) return;
  await telnyxCallAction(input.telnyxCallControlId, "record_start", {
    format: "mp3",
    channels: "single",
    play_beep: true,
    max_length: 180,
  });
}

async function ensureVoicemailBox(
  workspaceId: string,
  phoneNumberId: string | null,
  greetingText: string | null,
  greetingUrl: string | null,
) {
  const prisma = getPrisma();
  if (phoneNumberId) {
    const existing = await prisma.voicemailBox.findFirst({
      where: { workspaceId, phoneNumberId, active: true },
    });
    if (existing) return existing;
    return prisma.voicemailBox.create({
      data: {
        workspaceId,
        phoneNumberId,
        name: "Line voicemail",
        greetingText: greetingText || "Please leave a message after the tone.",
        greetingUrl,
        transcriptionEnabled: true,
        active: true,
      },
    });
  }
  const fallback = await prisma.voicemailBox.findFirst({
    where: { workspaceId, active: true },
  });
  if (fallback) return fallback;
  return prisma.voicemailBox.create({
    data: {
      workspaceId,
      name: "Main voicemail",
      greetingText: greetingText || "Please leave a message after the tone.",
      greetingUrl,
      transcriptionEnabled: true,
      active: true,
    },
  });
}

export async function leaveVoicemailOnCall(input: {
  workspaceId: string;
  humanCallId: string;
  telnyxCallControlId: string;
  phoneNumberId?: string | null;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call) throw new Error("Call not found");

  const routing = await getCallRouting(input.workspaceId);
  const box = await ensureVoicemailBox(
    input.workspaceId,
    input.phoneNumberId ?? call.phoneNumberId,
    routing.greetingText,
    routing.greetingUrl,
  );

  const sayText = (box.greetingText || routing.greetingText || "Please leave a message after the tone.").trim();
  const playUrl = box.greetingUrl || routing.greetingUrl || null;

  const greetingState = encodeTelnyxClientState({
    kind: "voicemail_greeting",
    humanCallId: input.humanCallId,
    workspaceId: input.workspaceId,
    sayText,
    playUrl,
  });

  if (isTelnyxPhoneConfigured()) {
    await telnyxCallAction(input.telnyxCallControlId, "answer").catch(() => undefined);
    if (playUrl) {
      await telnyxRequest(telnyxCallControlPath(input.telnyxCallControlId, "/actions/playback_start"), {
        method: "POST",
        body: { audio_url: playUrl, client_state: greetingState },
      }).catch(async () => {
        if (sayText) {
          await telnyxRequest(telnyxCallControlPath(input.telnyxCallControlId, "/actions/speak"), {
            method: "POST",
            body: {
              payload: sayText,
              voice: "female",
              language: "en-US",
              client_state: greetingState,
            },
          });
        } else {
          await startVoicemailRecordingOnCall(input);
        }
      });
    } else if (sayText) {
      await telnyxRequest(telnyxCallControlPath(input.telnyxCallControlId, "/actions/speak"), {
        method: "POST",
        body: {
          payload: sayText,
          voice: "female",
          language: "en-US",
          client_state: greetingState,
        },
      });
    } else {
      await startVoicemailRecordingOnCall(input);
    }
  }

  const msg = await prisma.voicemailMessage.create({
    data: {
      workspaceId: input.workspaceId,
      boxId: box.id,
      fromE164: call.from,
      toE164: call.to,
      humanCallId: call.id,
      isRead: false,
      transcriptStatus: "pending",
    },
  });

  await prisma.humanCall.update({
    where: { id: call.id },
    data: { status: "voicemail", disposition: `voicemail:${box.id}` },
  });

  return { box, message: msg };
}

export async function handleVoicemailGreetingMediaEnded(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
  clientState: Record<string, unknown>;
}) {
  if (input.clientState.kind !== "voicemail_greeting") return { handled: false as const };

  const humanCallId = String(input.clientState.humanCallId || "");
  const telnyxCallControlId = String(
    input.eventPayload.call_control_id || input.clientState.telnyxCallControlId || "",
  );
  if (!humanCallId || !telnyxCallControlId) return { handled: false as const };

  if (input.eventType === "call.playback.ended" || input.eventType === "call.speak.ended") {
    await startVoicemailRecordingOnCall({ telnyxCallControlId, humanCallId });
    return { handled: true as const };
  }
  return { handled: false as const };
}

export async function attachVoicemailRecording(input: {
  workspaceId: string;
  humanCallId: string;
  recordingUrl: string;
  durationSeconds?: number | null;
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
      recordingUrl: input.recordingUrl,
      durationSeconds: input.durationSeconds ?? msg.durationSeconds,
      transcriptStatus: msg.transcriptText ? "completed" : "pending",
    },
  });
}
