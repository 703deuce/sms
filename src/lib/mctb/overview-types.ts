/** Client-safe MCTB overview shapes (no server imports). */

export type MctbOverviewRecentRecoveryRow = {
  id: string;
  callerName: string | null;
  callerPhoneE164: string;
  callerPhoneLabel: string;
  /** Primary list label — name when known, else formatted phone */
  callerLabel: string;
  missedAt: string;
  recoveryLabel: string;
  replyLabel: string;
  summaryText: string;
  footerChips: string[];
  conversationId: string | null;
  teamBriefHeadline: string | null;
  teamBriefSummary: string | null;
};

export type MctbOverviewStatus =
  | "setup_incomplete"
  | "paused"
  | "messaging_blocked"
  | "active";

export type MctbOverviewPayload = {
  status: MctbOverviewStatus;
  statusLabel: string;
  pausedUntil: string | null;
  setupComplete: boolean;
  kpis: {
    windowLabel: string;
    timeZone: string;
    missedCallsToday: number;
    recoveryTextsToday: number;
    repliesToday: number;
    needsReplyCount: number;
  };
  recentMissedCalls: MctbOverviewRecentRecoveryRow[];
  recentConversations: Array<{
    id: string;
    label: string;
    preview: string;
    updatedAt: string;
    needsReply: boolean;
    replied: boolean;
  }>;
  setupHealth: {
    businessLine: string | null;
    forwardingLabel: string;
    consentLabel: string;
    senderLabel: string;
    recoveryLabel: string;
    voicemailLabel: string | null;
  };
  performanceSnapshot: null;
  leadRecovery: {
    enabled: boolean;
    activePolicyCount: number;
    policySummary: string;
    status: "ready" | "needs_attention" | "disabled";
    statusLabel: string;
    attentionReason: string | null;
    attentionHref: string | null;
  };
  callHandling: {
    mode: "MCTB_RECOVERY" | "VOICE_AGENT";
    modeLabel: string;
    forwardingLabel: string;
    ingressE164: string | null;
  };
};
