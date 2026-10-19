import { getPrisma } from "@/lib/server/db";
import { getPhoneSettings } from "@/lib/server/phone/settings";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
import { resolveTransferControlId } from "@/lib/server/phone/transfer";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

/** Best leg to record: PSTN caller on inbound bridge, else stored control id or webhook leg. */
export function resolveRecordingControlId(
  call: {
    telnyxCallControlId: string | null;
    telnyxCallLegId?: string | null;
    metadata: unknown;
    direction: string;
  },
  eventControlId?: string | null,
): string | null {
  const meta = (call.metadata || {}) as Record<string, unknown>;
  if (call.direction === "inbound" && typeof meta.callerCallControlId === "string" && meta.callerCallControlId) {
    return meta.callerCallControlId;
  }
  if (eventControlId) return eventControlId;
  return resolveTransferControlId({
    telnyxCallControlId: call.telnyxCallControlId,
    telnyxCallLegId: call.telnyxCallLegId ?? null,
    metadata: call.metadata,
  });
}

export async function maybeStartCallRecordingOnAnswer(input: {
  workspaceId: string;
  humanCallId: string;
  telnyxCallControlId: string | null;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call) return;
  if (call.recordingStartedAt) return;

  const controlId = resolveRecordingControlId(call, input.telnyxCallControlId);
  if (!controlId) {
    phoneServerLog("recording", "skip_no_control_id", { humanCallId: input.humanCallId });
    return;
  }

  const settings = await getPhoneSettings(input.workspaceId);
  if (!settings.recordCalls) return;

  await telnyxCallAction(controlId, "record_start", {
    format: "mp3",
    channels: "dual",
    play_beep: false,
  });

  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      recordingStartedAt: new Date(),
      telnyxCallControlId: call.telnyxCallControlId || controlId,
    },
  });
  phoneServerLog("recording", "record_start", {
    humanCallId: input.humanCallId,
    controlPrefix: controlId.slice(0, 8),
    direction: call.direction,
  });
}

/** Client or webhook fallback when WebRTC is live but Telnyx events are delayed. */
export async function requestHumanCallRecordingStart(workspaceId: string, humanCallId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: humanCallId, workspaceId },
  });
  if (!call) throw new Error("Call not found");
  if (call.recordingStartedAt || call.recordingUrl) {
    return { started: false, reason: "already_recording" as const };
  }
  if (call.status === "completed" || call.status === "missed" || call.status === "voicemail") {
    return { started: false, reason: "call_ended" as const };
  }
  if (!call.answeredAt && call.direction === "outbound") {
    await prisma.humanCall.update({
      where: { id: humanCallId },
      data: { answeredAt: new Date(), status: "in_progress" },
    });
  }
  await maybeStartCallRecordingOnAnswer({
    workspaceId,
    humanCallId,
    telnyxCallControlId: call.telnyxCallControlId,
  });
  const after = await prisma.humanCall.findUnique({
    where: { id: humanCallId },
    select: { recordingStartedAt: true },
  });
  return { started: Boolean(after?.recordingStartedAt), reason: after?.recordingStartedAt ? "ok" : "no_control_id" };
}
