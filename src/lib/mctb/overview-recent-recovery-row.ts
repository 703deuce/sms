import type { MctbTeamActivityBrief } from "@/lib/mctb/handoff/team-activity-brief-types";
import type { MctbOverviewRecentRecoveryRow } from "@/lib/mctb/overview-types";

export type { MctbOverviewRecentRecoveryRow };
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { formatRecoveryStatus, formatReplyStatus } from "@/lib/mctb/recovery-display";

const OVERVIEW_SUMMARY_MAX = 520;

function hasCustomerReply(status: string): boolean {
  return status.toUpperCase() === "CUSTOMER_REPLIED";
}

export function buildOverviewRecoverySummaryText(input: {
  status: string;
  smsSentAt: Date | null;
  brief: MctbTeamActivityBrief | null | undefined;
  callerName: string | null;
}): string {
  const replied = hasCustomerReply(input.status) || Boolean(input.brief?.hasTextReplies);
  const sent = Boolean(input.smsSentAt);

  if (input.brief?.summary?.trim() && (replied || input.brief.hasVoicemail)) {
    return input.brief.summary.trim().slice(0, OVERVIEW_SUMMARY_MAX);
  }

  if (input.brief?.summary?.trim() && sent && !replied) {
    const lower = input.brief.summary.toLowerCase();
    if (lower.includes("has not replied") || lower.includes("no sms reply") || lower.includes("no reply")) {
      return input.brief.summary.trim().slice(0, OVERVIEW_SUMMARY_MAX);
    }
  }

  const recovery = formatRecoveryStatus(input.status);
  const waitingConsent = recovery.toLowerCase().includes("waiting for consent");

  if (!sent && !waitingConsent) {
    return "Missed call recorded. A recovery text has not been sent yet.";
  }
  if (waitingConsent) {
    return "Missed call recorded. Waiting for caller consent before a recovery text can be sent.";
  }
  if (!replied) {
    return "Missed call from a new caller. Transovo sent the recovery text, but the caller has not replied yet.";
  }

  if (input.brief?.summary?.trim()) {
    return input.brief.summary.trim().slice(0, OVERVIEW_SUMMARY_MAX);
  }

  const who = input.callerName?.trim() || "The caller";
  return `${who} replied to the recovery text. Open the missed call for the full conversation.`;
}

export function buildOverviewRecoveryFooterChips(input: {
  messageCount: number;
  smsSentAt: Date | null;
  replyLabel: string;
  hasVoicemail: boolean;
  aiRecoveryEnabled: boolean;
  outboundAfterOpener: boolean;
}): string[] {
  const chips: string[] = [];
  if (input.messageCount > 0) {
    chips.push(`${input.messageCount} message${input.messageCount === 1 ? "" : "s"}`);
  } else if (input.smsSentAt) {
    chips.push("Text delivered");
  }
  if (input.aiRecoveryEnabled && input.outboundAfterOpener && input.replyLabel === "Replied") {
    chips.push("AI Recovery handled");
  }
  if (input.hasVoicemail) {
    chips.push("Voicemail");
  }
  if (input.replyLabel === "No reply" && input.smsSentAt) {
    chips.push("No reply yet");
  }
  return chips;
}

export function mapMissedCallToOverviewRecoveryRow(input: {
  event: {
    id: string;
    callerE164: string;
    detectedAt: Date;
    status: string;
    suppressionReason: string | null;
    smsSentAt: Date | null;
  };
  contactName: string | null;
  brief: MctbTeamActivityBrief | null | undefined;
  conversation: { id: string; messageCount: number; outboundCount: number } | null;
  hasVoicemail: boolean;
  aiRecoveryEnabled: boolean;
}): MctbOverviewRecentRecoveryRow {
  const callerPhoneLabel = formatMctbPhoneLabel(input.event.callerE164);
  const callerName = input.contactName?.trim() || input.brief?.callerName?.trim() || null;
  const callerLabel = callerName || callerPhoneLabel;
  const recoveryLabel = formatRecoveryStatus(input.event.status, input.event.suppressionReason);
  const replyLabel = formatReplyStatus(input.event.status);
  const summaryText = buildOverviewRecoverySummaryText({
    status: input.event.status,
    smsSentAt: input.event.smsSentAt,
    brief: input.brief,
    callerName,
  });
  const messageCount = input.conversation?.messageCount ?? 0;
  const outboundAfterOpener = (input.conversation?.outboundCount ?? 0) > 1;
  const footerChips = buildOverviewRecoveryFooterChips({
    messageCount,
    smsSentAt: input.event.smsSentAt,
    replyLabel,
    hasVoicemail: input.hasVoicemail || Boolean(input.brief?.hasVoicemail),
    aiRecoveryEnabled: input.aiRecoveryEnabled,
    outboundAfterOpener,
  });

  return {
    id: input.event.id,
    callerName,
    callerPhoneE164: input.event.callerE164,
    callerPhoneLabel,
    callerLabel,
    missedAt: input.event.detectedAt.toISOString(),
    recoveryLabel,
    replyLabel,
    summaryText,
    footerChips,
    conversationId: input.conversation?.id ?? null,
    teamBriefHeadline: input.brief?.headline ?? null,
    teamBriefSummary: input.brief?.summary?.slice(0, OVERVIEW_SUMMARY_MAX) ?? null,
  };
}
