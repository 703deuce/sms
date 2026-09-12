import { RESPONSE_MODE_LABELS } from "@/lib/mctb/handoff/defaults";
import { DEFAULT_ROUTING_MATRIX } from "@/lib/mctb/handoff/defaults";
import type {
  MctbHandoffConfigDto,
  MctbHandoffEventType,
  MctbNotificationRecipientDto,
  MctbResponseMode,
} from "@/lib/mctb/handoff/types";
import { formatPhone } from "@/lib/utils";

export const ROUTING_EVENT_ROWS: MctbHandoffEventType[] = Object.keys(
  DEFAULT_ROUTING_MATRIX,
) as MctbHandoffEventType[];

export const HANDOFF_EVENT_LABELS: Record<MctbHandoffEventType, string> = {
  missed_call_detected: "Missed call detected",
  caller_replied: "Customer replied",
  lead_captured: "Lead captured",
  callback_requested: "Callback requested",
  urgent_detected: "Urgent situation detected",
  human_required: "Human required",
  appointment_booked: "Appointment booked",
  voicemail_received: "Voicemail received",
  recovery_failure: "Recovery failure",
};

export type NotificationsSnapshot = {
  config: MctbHandoffConfigDto;
  recipients: MctbNotificationRecipientDto[];
};

export function notificationsSnapshotsEqual(a: NotificationsSnapshot, b: NotificationsSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function enabledRecipientCount(recipients: MctbNotificationRecipientDto[]): number {
  return recipients.filter((r) => r.enabled).length;
}

export function primaryEmailDestination(recipients: MctbNotificationRecipientDto[]): string {
  const r = recipients.find((x) => x.enabled && x.email?.trim());
  return r?.email?.trim() || "Not set";
}

export function primarySmsDestination(recipients: MctbNotificationRecipientDto[]): string {
  const r = recipients.find((x) => x.enabled && x.mobileE164?.trim());
  return r?.mobileE164 ? formatPhone(r.mobileE164) : "Not set";
}

export function handoffModeLabel(mode: MctbResponseMode): string {
  return RESPONSE_MODE_LABELS[mode]?.title || mode;
}

export function alertsActiveLabel(recipients: MctbNotificationRecipientDto[]): string {
  const n = enabledRecipientCount(recipients);
  return n > 0 ? "Active" : "Needs setup";
}

export function handoffFlowSteps(mode: MctbResponseMode): string[] {
  const base = ["Missed call", "Recovery text sent", "Customer replies"];
  switch (mode) {
    case "notify_only":
      return [...base, "Team notified", "Conversation saved"];
    case "guided_collection":
      return [...base, "Guided questions", "Lead summary sent", "Team notified"];
    case "ai_conversation":
      return [...base, "AI continues thread", "Escalate when needed"];
    case "immediate_handoff":
      return [...base, "Automation stops", "Team alerted immediately"];
    default:
      return base;
  }
}

export function routingRow(
  config: MctbHandoffConfigDto,
  event: MctbHandoffEventType,
): {
  channels: { sms?: boolean; email?: boolean; in_app?: boolean };
  recipientIds?: string[];
} {
  const row =
    config.routingMatrix[event] ||
    DEFAULT_ROUTING_MATRIX[event] || {
      channels: { in_app: true },
      recipientIds: [],
    };
  return {
    channels: row.channels || {},
    recipientIds: row.recipientIds || [],
  };
}
