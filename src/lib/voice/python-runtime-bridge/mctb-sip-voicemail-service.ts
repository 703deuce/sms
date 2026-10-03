import "server-only";

import { getPrisma } from "@/lib/db";
import { ensureMctbVoicemailBoxProvisioned } from "@/lib/mctb/voicemail-provisioning";
import { attachVoicemailRecordingAndTranscribe } from "@/lib/phone/voicemail-service";
import { uploadCallRecordingToStorage, createSignedRecordingUrl } from "@/lib/smart-routing/call-recording-storage";
import {
  buildVoicemailStorageRecordingUrl,
  parseAnyVoicemailRecordingStorageRef,
} from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage";

export function formatSupabaseRecordingRef(bucket: string, path: string): string {
  return buildVoicemailStorageRecordingUrl(bucket, path);
}

export async function resolveVoicemailRecordingFetchUrl(
  recordingUrl: string,
): Promise<string> {
  const storageRef = parseAnyVoicemailRecordingStorageRef(recordingUrl);
  if (!storageRef) {
    return recordingUrl;
  }
  return createSignedRecordingUrl(storageRef.bucket, storageRef.path, 3600);
}

export type BeginMctbSipVoicemailInput = {
  workspaceId: string;
  transovoNumberE164: string;
  callerE164: string;
  providerCallId: string;
  livekitRoomName?: string | null;
  customerBusinessE164?: string | null;
};

export async function beginMctbSipVoicemailForPython(input: BeginMctbSipVoicemailInput) {
  const provisioned = await ensureMctbVoicemailBoxProvisioned(
    input.workspaceId,
    input.transovoNumberE164,
  );
  if (!provisioned) {
    return { ok: false as const, error: "voicemail_box_unavailable" };
  }

  const prisma = getPrisma();
  const msg = await prisma.voicemailMessage.create({
    data: {
      workspaceId: input.workspaceId,
      boxId: provisioned.boxId,
      fromE164: input.callerE164 || null,
      toE164: input.transovoNumberE164 || null,
      isRead: false,
      internalNotes: JSON.stringify({
        source: "mctb_sip_voicemail_fallback",
        providerCallId: input.providerCallId,
        livekitRoomName: input.livekitRoomName ?? null,
        customerBusinessE164: input.customerBusinessE164 ?? null,
      }),
    },
  });

  const { notifyWorkspace } = await import("@/lib/notifications/in-app");
  await notifyWorkspace(input.workspaceId, {
    type: "voicemail",
    title: "New voicemail",
    body: `Voicemail from ${input.callerE164 || "unknown"}`,
    href: "/personal/voicemail",
  }).catch(() => undefined);

  return {
    ok: true as const,
    messageId: msg.id,
    boxId: provisioned.boxId,
    voicemailPlayUrl: provisioned.greetingPlayUrl,
    voicemailSayText: provisioned.greetingSayText,
  };
}

export type FinalizeMctbSipVoicemailInput = {
  workspaceId: string;
  messageId: string;
  audioBase64: string;
  mimeType?: string;
  durationSeconds?: number | null;
  sampleRate?: number | null;
};

export async function finalizeMctbSipVoicemailForPython(input: FinalizeMctbSipVoicemailInput) {
  const prisma = getPrisma();
  const msg = await prisma.voicemailMessage.findFirst({
    where: { id: input.messageId, workspaceId: input.workspaceId },
  });
  if (!msg) {
    return { ok: false as const, error: "message_not_found" };
  }

  const bytes = Buffer.from(input.audioBase64, "base64");
  if (!bytes.length) {
    return { ok: false as const, error: "empty_recording" };
  }

  const ext = input.mimeType?.includes("wav") ? "wav" : "mp3";
  const stored = await uploadCallRecordingToStorage({
    workspaceId: input.workspaceId,
    callId: `voicemail-${msg.id}`,
    bytes,
    mimeType: input.mimeType || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
    extension: ext,
  });

  const recordingRef = formatSupabaseRecordingRef(stored.bucket, stored.path);
  const signedUrl = await createSignedRecordingUrl(stored.bucket, stored.path, 7 * 24 * 3600);

  const updated = await attachVoicemailRecordingAndTranscribe({
    workspaceId: input.workspaceId,
    messageId: msg.id,
    recordingUrl: signedUrl,
    durationSeconds: input.durationSeconds ?? null,
    upstreamProvider: "telnyx",
  });

  if (updated) {
    await prisma.voicemailMessage.update({
      where: { id: msg.id },
      data: { recordingUrl: recordingRef },
    });
  }

  return {
    ok: true as const,
    messageId: msg.id,
    recordingUrl: recordingRef,
    durationSeconds: input.durationSeconds ?? null,
    transcribeQueued: Boolean(updated),
  };
}
