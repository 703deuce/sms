/**
 * M40 — Auto voicemail drop after AMD signals greeting end (beep).
 *
 * Telnyx premium AMD may return machine_end_beep, machine_end_silence, or machine_end_other.
 * We treat machine_end_beep as the supported "beep detected" signal; silence/other are documented
 * fallbacks that still indicate machine greeting completion without a distinct beep event.
 *
 * Default OFF at workspace level; requires prerecordedVmOptIn + compliance acknowledgement.
 */

import { getPrisma } from "@/lib/server/db";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";
import { parseExtendedConfig } from "./campaign-extended-config";
import { startVoicemailDropPlayback } from "./voicemail-drop-playback";

const GREETING_END_RESULTS = new Set([
  "machine_end_beep",
  "machine_end_silence",
  "machine_end_other",
]);

export function amdResultSupportsAutoDrop(raw: string): boolean {
  const r = raw.toLowerCase().trim();
  return GREETING_END_RESULTS.has(r);
}

export async function maybeAutoDropVoicemailAfterAmd(input: {
  workspaceId: string;
  humanCallId: string;
  attemptId: string;
  amdResult: string;
}) {
  if (!amdResultSupportsAutoDrop(input.amdResult)) return { triggered: false, reason: "not_greeting_end" };

  const settings = await getPowerDialerSettings(input.workspaceId);
  if (!settings.prerecordedVmOptIn) return { triggered: false, reason: "prerecorded_not_opted_in" };
  if (!settings.beepAutoDropEnabled) return { triggered: false, reason: "auto_drop_disabled" };
  if (!settings.complianceAcknowledgedAt) {
    return { triggered: false, reason: "compliance_not_acknowledged" };
  }

  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
    include: {
      humanCall: true,
      session: { include: { campaign: true } },
    },
  });
  if (!attempt?.humanCall?.telnyxCallControlId) {
    return { triggered: false, reason: "no_call_leg" };
  }
  if (attempt.voicemailDropSentAt) return { triggered: false, reason: "already_dropped" };

  const ext = parseExtendedConfig(attempt.session.campaign.configJson);
  const dropId = ext.voicemailDropId;
  if (!dropId) return { triggered: false, reason: "no_campaign_drop" };

  const drop = await prisma.powerDialerVoicemailDrop.findFirst({
    where: { id: dropId, workspaceId: input.workspaceId, archivedAt: null },
  });
  if (!drop) return { triggered: false, reason: "drop_missing" };

  await startVoicemailDropPlayback({
    telnyxCallControlId: attempt.humanCall.telnyxCallControlId,
    audioUrl: drop.storageUrl,
  });

  await prisma.powerDialerAttempt.update({
    where: { id: attempt.id },
    data: {
      voicemailDropSentAt: new Date(),
      vmDeliveryMode: "prerecorded_auto",
      notes: `${attempt.notes || ""} vm_drop_pending auto_amd:${input.amdResult}`.trim(),
      answerClassification: "voicemail",
    },
  });

  return { triggered: true, amdResult: input.amdResult };
}
