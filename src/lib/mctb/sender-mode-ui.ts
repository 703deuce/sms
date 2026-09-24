import type { MctbSenderMode } from "@/lib/agents/missed-call-text-back/types";
import { parseMctbPhoneRole } from "@/lib/messaging/compliance/phone-number-class";
import type { PhoneMessagingStatus } from "@/lib/messaging/compliance/phone-messaging-status";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";

export const MCTB_SENDER_MODE_PLATFORM_TITLE = "Transovo Platform Number";
export const MCTB_SENDER_MODE_PLATFORM_DESCRIPTION =
  "No number setup required. Transovo manages the sending number.";
export const MCTB_SENDER_MODE_WORKSPACE_TITLE = "My Verified Number";
export const MCTB_SENDER_MODE_WORKSPACE_DESCRIPTION =
  "Send from a verified number connected to your workspace.";

export type MctbSetupPhoneOption = {
  id: string;
  e164: string;
  friendlyName?: string | null;
  label?: string | null;
  type?: string | null;
  settingsJson?: unknown;
  messagingStatus?: PhoneMessagingStatus;
};

/** Workspace-owned numbers eligible as WORKSPACE SMS senders (never platform TFN). */
export function filterMctbWorkspaceSmsSenderOptions(
  phones: MctbSetupPhoneOption[],
): Array<MctbSetupPhoneOption & { eligible: boolean }> {
  return phones
    .filter((p) => parseMctbPhoneRole(p.settingsJson) !== "platform_mctb_sender")
    .map((p) => ({
      ...p,
      eligible: Boolean(p.messagingStatus?.approved),
    }));
}

export function formatWorkspaceSmsSenderOptionLabel(phone: MctbSetupPhoneOption): string {
  const display = formatMctbPhoneLabel(phone.e164, phone.friendlyName || phone.label);
  const ms = phone.messagingStatus;
  const kind =
    ms?.complianceType === "TOLL_FREE_VERIFICATION" || ms?.numberClass === "TWILIO_TOLL_FREE"
      ? "Toll-free"
      : ms?.complianceType === "A2P_10DLC" || ms?.numberClass === "TELNYX_LOCAL_A2P"
        ? "10DLC"
        : "Messaging";
  const status = ms?.approved ? "Verified" : ms?.label || "Pending";
  return `${display} — ${kind} — ${status}`;
}

export function formatMctbTextBackSenderSummary(input: {
  senderMode?: MctbSenderMode | null;
  smsPhone?: { e164: string; friendlyName?: string | null } | null;
  messagingReady: boolean;
}): { primary: string; secondary: string; ready: boolean } {
  const mode = input.senderMode || "WORKSPACE";
  if (mode === "PLATFORM") {
    return {
      primary: MCTB_SENDER_MODE_PLATFORM_TITLE,
      secondary: "Transovo-managed sender",
      ready: true,
    };
  }
  if (input.smsPhone) {
    const ready = Boolean(input.messagingReady && input.smsPhone);
    return {
      primary: formatMctbPhoneLabel(input.smsPhone.e164, input.smsPhone.friendlyName),
      secondary: ready ? "Ready" : "Pending verification",
      ready,
    };
  }
  return {
    primary: MCTB_SENDER_MODE_WORKSPACE_TITLE,
    secondary: "Select a verified number",
    ready: false,
  };
}

export function formatMctbTextBackSenderRailLabel(input: {
  senderMode?: MctbSenderMode | null;
  smsPhone?: { e164: string } | null;
  messagingReady: boolean;
}): string | null {
  const summary = formatMctbTextBackSenderSummary(input);
  if (!summary.primary) return null;
  return `${summary.primary} · ${summary.ready ? "Ready" : summary.secondary}`;
}
