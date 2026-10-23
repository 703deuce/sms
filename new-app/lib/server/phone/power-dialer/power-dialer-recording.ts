import { getPrisma } from "@/lib/server/db";
import { getPhoneSettings } from "@/lib/server/phone/settings";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
import { resolveRecordingControlId } from "@/lib/server/phone/recording-runtime";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { mergePowerDialerSettings } from "@/lib/products/power-dialer";
import { parseExtendedConfig } from "./campaign-extended-config";

export async function resolvePowerDialerRecordingPolicy(
  workspaceId: string,
  humanCallId: string,
): Promise<{ record: boolean; consentAnnounce: boolean; retentionDays: number }> {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: humanCallId, workspaceId },
  });
  if (!call || call.source !== "power_dialer") {
    const phone = await getPhoneSettings(workspaceId);
    return {
      record: phone.recordCalls,
      consentAnnounce: false,
      retentionDays: 365,
    };
  }

  const meta = (call.metadata || {}) as { powerDialerAttemptId?: string };
  let campaignRecording: boolean | undefined;
  if (meta.powerDialerAttemptId) {
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: meta.powerDialerAttemptId, workspaceId },
      include: { session: { include: { campaign: true } } },
    });
    if (attempt?.session?.campaign) {
      const ext = parseExtendedConfig(attempt.session.campaign.configJson);
      if (typeof ext.recordingEnabled === "boolean") campaignRecording = ext.recordingEnabled;
    }
  }

  const wsRow = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const pd = mergePowerDialerSettings(
    (wsRow?.customFieldsConfig as { powerDialer?: unknown })?.powerDialer,
  );

  const phone = await getPhoneSettings(workspaceId);
  const { mergePowerDialerRecordingPolicy } = await import("./recording-policy");
  const merged = mergePowerDialerRecordingPolicy({
    campaignRecordingEnabled: campaignRecording,
    workspace: pd,
    isPowerDialerCall: true,
    phoneGlobalRecordCalls: phone.recordCalls,
  });
  return {
    record: merged.record,
    consentAnnounce: merged.consentAnnounce,
    retentionDays: merged.retentionDays,
  };
}

export async function maybeStartPowerDialerRecordingOnAnswer(input: {
  workspaceId: string;
  humanCallId: string;
  telnyxCallControlId: string | null;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || call.source !== "power_dialer") {
    const { maybeStartCallRecordingOnAnswer } = await import("@/lib/server/phone/recording-runtime");
    await maybeStartCallRecordingOnAnswer(input);
    return;
  }
  if (call.recordingStartedAt) return;

  const policy = await resolvePowerDialerRecordingPolicy(input.workspaceId, input.humanCallId);
  if (!policy.record) return;

  const controlId = resolveRecordingControlId(call, input.telnyxCallControlId);
  if (!controlId) {
    phoneServerLog("power-dialer-recording", "skip_no_control_id", { humanCallId: input.humanCallId });
    return;
  }

  if (policy.consentAnnounce) {
    await telnyxCallAction(controlId, "speak", {
      payload:
        "This call may be recorded for quality and training purposes.",
      voice: "Telnyx.KokoroTTS.af",
      language: "en-US",
    }).catch(() => undefined);
  }

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
      metadata: {
        ...((call.metadata || {}) as object),
        powerDialerRecordingRetentionDays: policy.retentionDays,
      },
    },
  });
}
