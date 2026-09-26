import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  buildCallHandlingBehaviorSummary,
  afterHoursBehaviorSummary,
} from "@/lib/voice/call-handling/behavior-summary";
import { formatBusinessHoursSummaryLine } from "@/lib/solutions/appointment-receptionist/knowledge-editor-schedule";
import { ensureEmergencyTransferWizardState } from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import { resolveActiveOnCallTarget } from "@/lib/voice-receptionist-wizard/operating-maturity/on-call";
import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "@/lib/voice-receptionist-wizard/operating-maturity/defaults";
import { fmtCallPhone } from "@/lib/voice/calls/display";

export type RecentTransferRow = {
  id: string;
  callId: string;
  createdAt: string;
  callerE164: string | null;
  destination: string;
  transferType: string;
  status: string;
  answered: boolean;
  transferMode: string | null;
};

export type VoiceCallHandlingWired = {
  duringHoursLine: string;
  afterHoursLine: string;
  afterHoursLive: boolean;
  transfers: Array<{ name: string; number: string; ring: string; status: string }>;
  recent: Array<{ caller: string; to: string; reason: string; time: string; result: string }>;
  onCallDescription: string;
  emergencyKeywords: string[];
  switches: {
    ringTeamFirst?: boolean;
    aiAfterHours?: boolean;
    holidaySchedule?: boolean;
    emergenciesOnly?: boolean;
    whisper?: boolean;
    textSummary?: boolean;
    blockSpam?: boolean;
    declineSolicitors?: boolean;
    recordCalls?: boolean;
  };
  onSwitchChange?: (key: keyof VoiceCallHandlingWired["switches"], value: boolean) => void;
  onSave?: () => Promise<void> | void;
};

function formatTransferTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildVoiceCallHandlingWired(
  state: AppointmentReceptionistWizardState,
  recentTransfers: RecentTransferRow[],
): VoiceCallHandlingWired {
  const summary = buildCallHandlingBehaviorSummary(state);
  const hours = afterHoursBehaviorSummary(state);
  const businessHoursLine = formatBusinessHoursSummaryLine(state);
  const normalized = ensureEmergencyTransferWizardState(state);
  const destinations = (normalized.transferDestinations ?? []).filter((d) => d.enabled !== false);
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const steps = [...(normalized.transferPlanSteps ?? [])]
    .filter((s) => destById.has(s.destinationId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const transfers = steps.length
    ? steps.map((s) => {
        const dest = destById.get(s.destinationId)!;
        return {
          name: dest.label || "Destination",
          number: fmtCallPhone(dest.phoneE164),
          ring: `${s.timeoutSeconds ?? normalized.transferRingSeconds ?? 30}s`,
          status: dest.phoneE164?.trim() ? "Verified" : "Unverified",
        };
      })
    : destinations.map((d) => ({
        name: d.label || "Destination",
        number: fmtCallPhone(d.phoneE164),
        ring: `${normalized.transferRingSeconds ?? 30}s`,
        status: d.phoneE164?.trim() ? "Verified" : "Unverified",
      }));

  const maturity = state.operatingMaturity ?? DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG;
  const onCall = resolveActiveOnCallTarget({ schedule: maturity.onCallSchedule });
  const onCallDescription = onCall
    ? `This week: ${onCall.label} · ${fmtCallPhone(onCall.phoneE164)}`
    : maturity.onCallSchedule.enabled
      ? "On-call rotation configured"
      : "No on-call rotation";

  const urgencyKeywords =
    state.urgencyRules?.flatMap((r) => r.keywords ?? []).filter(Boolean).slice(0, 12) ?? [];

  const whenClosed = maturity.afterHoursBehavior.whenClosed;
  const holidays = maturity.businessSchedule?.holidays ?? [];

  return {
    duringHoursLine: summary.transfersEnabled
      ? `${summary.primaryDestinationLabel ?? "Team"} · ${businessHoursLine}`
      : businessHoursLine,
    afterHoursLine: hours.afterHours,
    afterHoursLive: Boolean(state.voiceV2HumanTransferEnabled ?? true),
    transfers,
    recent: recentTransfers.map((t) => ({
      caller: t.callerE164 ? fmtCallPhone(t.callerE164) : "Unknown caller",
      to: t.destination,
      reason: t.transferType || "Transfer",
      time: formatTransferTime(t.createdAt),
      result: t.answered ? "Answered" : "No answer → voicemail",
    })),
    onCallDescription,
    emergencyKeywords: urgencyKeywords.length ? urgencyKeywords : [],
    switches: {
      ringTeamFirst: whenClosed.allowOfficeTransfer,
      aiAfterHours: whenClosed.allowOnCallEscalation,
      emergenciesOnly: !whenClosed.allowNormalTransferDestinations,
      whisper: Boolean(state.warmTransfer),
      textSummary: Boolean(state.afterHoursNotificationEvents),
      blockSpam: state.spamLikelyPolicy === "BLOCK",
      declineSolicitors: state.salesSolicitationEnabled === true,
      recordCalls: state.callRecording === true,
      holidaySchedule: holidays.length > 0,
    },
  };
}
