import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import { startRecording, speakOnCall } from "./telnyx-provider";
import { saveUploadedAudio } from "./media-service";

export type RecordByPhoneState = {
  kind: "smart_routing_record";
  workspaceId: string;
  assetName: string;
  recordingSessionId: string;
};

export async function startRecordByPhone(input: {
  workspaceId: string;
  userPhone: string;
  fromNumber: string;
  assetName?: string;
}) {
  if (!isTelnyxVoiceConfigured()) {
    throw new Error("Telnyx voice not configured");
  }
  const connectionId =
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim();
  if (!connectionId) throw new Error("TELNYX_CONNECTION_ID not configured");

  const recordingSessionId = createId();
  const state: RecordByPhoneState = {
    kind: "smart_routing_record",
    workspaceId: input.workspaceId,
    assetName: input.assetName ?? "Phone recording",
    recordingSessionId,
  };

  await telnyxRequest("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      from: input.fromNumber,
      to: normalizeE164(input.userPhone),
      client_state: Buffer.from(JSON.stringify(state)).toString("base64"),
    },
  });

  return { recordingSessionId, status: "calling" };
}

export async function handleRecordByPhoneAnswered(input: {
  callControlId: string;
  state: RecordByPhoneState;
}) {
  await speakOnCall(
    input.callControlId,
    "Record your greeting after the tone. Press pound when finished.",
  );
  await startRecording(input.callControlId);
  return { recording: true };
}

export async function finalizeRecordByPhone(input: {
  workspaceId: string;
  state: RecordByPhoneState;
  recordingUrl: string;
}) {
  const prisma = getPrisma();
  const res = await fetch(input.recordingUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  const asset = await saveUploadedAudio({
    workspaceId: input.workspaceId,
    name: input.state.assetName,
    buffer,
    mimeType: "audio/mpeg",
  });
  await prisma.smartRoutingAudioAsset.update({
    where: { id: asset.id },
    data: {
      metadataJson: {
        source: "record_by_phone",
        recordingSessionId: input.state.recordingSessionId,
      },
    },
  });
  return asset;
}
