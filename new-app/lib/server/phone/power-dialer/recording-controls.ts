import { getPrisma } from "@/lib/server/db";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
import { resolveRecordingControlId } from "@/lib/server/phone/recording-runtime";
import { resolvePowerDialerRecordingPolicy } from "./power-dialer-recording";
import { auditComplianceDecision } from "./compliance-gates";

/** M58 — pause/resume recording on active power-dialer call. */
export async function setPowerDialerRecordingPaused(input: {
  workspaceId: string;
  attemptId: string;
  paused: boolean;
  actorUserId?: string | null;
}) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
    include: { humanCall: true },
  });
  if (!attempt?.humanCall) throw new Error("No call found for this attempt");
  const policy = await resolvePowerDialerRecordingPolicy(input.workspaceId, attempt.humanCallId!);
  if (!policy.record) throw new Error("Recording is disabled for this call");

  const controlId = resolveRecordingControlId(
    attempt.humanCall,
    attempt.humanCall.telnyxCallControlId,
  );
  if (!controlId) throw new Error("Call control not available");

  if (input.paused) {
    await telnyxCallAction(controlId, "record_stop", {});
    await prisma.humanCall.update({
      where: { id: attempt.humanCall.id },
      data: {
        metadata: {
          ...((attempt.humanCall.metadata || {}) as object),
          recordingPausedAt: new Date().toISOString(),
        },
      },
    });
  } else {
    await telnyxCallAction(controlId, "record_start", {
      format: "mp3",
      channels: "dual",
      play_beep: false,
    });
    await prisma.humanCall.update({
      where: { id: attempt.humanCall.id },
      data: {
        recordingStartedAt: attempt.humanCall.recordingStartedAt || new Date(),
        metadata: {
          ...((attempt.humanCall.metadata || {}) as object),
          recordingPausedAt: null,
        },
      },
    });
  }

  await auditComplianceDecision({
    workspaceId: input.workspaceId,
    action: input.paused ? "recording_paused" : "recording_resumed",
    actorUserId: input.actorUserId,
    detail: { attemptId: input.attemptId, humanCallId: attempt.humanCall.id },
  });

  return { ok: true };
}
