import { formatRecoveryStatus, formatReplyStatus } from "@/lib/mctb/recovery-display";
import { presentRecoverySuppression } from "@/lib/mctb/recovery-suppression-presentation";

export type MissedCallConversationPresentation = {
  label: string;
  tone: "muted" | "active" | "attention";
};

export type MissedCallNextActionPresentation = {
  label: string;
  kind: "open_conversation" | "call" | "voicemail" | "callback" | "none";
  conversationId?: string | null;
  voicemailId?: string | null;
};

export function deriveMissedCallConversationPresentation(input: {
  status: string;
  automationState?: string | null;
  followUpStatus?: string | null;
}): MissedCallConversationPresentation {
  const automation = (input.automationState || "").toLowerCase();
  if (automation === "human_active" || automation === "needs_human") {
    return { label: "Human handling", tone: "attention" };
  }
  if (automation === "resolved" || automation === "appointment_booked") {
    return { label: "Resolved", tone: "muted" };
  }
  if (automation === "automation_active" || automation === "collecting_information") {
    return { label: "AI Recovery active", tone: "active" };
  }
  const reply = formatReplyStatus(input.status);
  if (reply === "Replied") return { label: "Replied", tone: "active" };
  if (input.followUpStatus === "needs_follow_up") {
    return { label: "Needs callback", tone: "attention" };
  }
  if (reply === "No reply") return { label: "No reply", tone: "muted" };
  return { label: reply === "—" ? "—" : reply, tone: "muted" };
}

export function deriveMissedCallNextAction(input: {
  status: string;
  suppressionReason: string | null;
  conversationId?: string | null;
  voicemailId?: string | null;
  hasVoicemail?: boolean;
  automationState?: string | null;
  followUpStatus?: string | null;
}): MissedCallNextActionPresentation {
  const automation = (input.automationState || "").toLowerCase();
  if (automation === "resolved" || automation === "appointment_booked") {
    return { label: "—", kind: "none" };
  }
  if (input.status.toUpperCase() === "CUSTOMER_REPLIED" && input.conversationId) {
    return {
      label: "Open conversation",
      kind: "open_conversation",
      conversationId: input.conversationId,
    };
  }
  if (input.hasVoicemail || input.voicemailId) {
    return { label: "Review voicemail", kind: "voicemail", voicemailId: input.voicemailId };
  }
  if (
    input.followUpStatus === "needs_follow_up" ||
    automation === "callback_requested" ||
    automation === "needs_human"
  ) {
    return { label: "Needs callback", kind: "callback" };
  }
  const recovery = formatRecoveryStatus(input.status, input.suppressionReason);
  if (recovery === "Failed" || recovery === "Suppressed") {
    return { label: "Review details", kind: "none" };
  }
  if (input.conversationId) {
    return {
      label: "Open conversation",
      kind: "open_conversation",
      conversationId: input.conversationId,
    };
  }
  return { label: "Call customer", kind: "call" };
}

export function recoveryListSecondaryLine(
  status: string,
  suppressionReason: string | null,
): string | null {
  const s = status.toUpperCase();
  if (s === "SUPPRESSED" || s === "FAILED") {
    return presentRecoverySuppression(suppressionReason, status).shortLabel;
  }
  return null;
}
