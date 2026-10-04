/** Client-safe MCTB overview shapes (no server imports). */

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
  needsAttention: Array<{
    missedCallId: string | null;
    conversationId: string;
    name: string;
    phone: string;
    phoneE164: string;
    reason: string;
    preview: string;
    updatedAt: string;
  }>;
  recentMissedCalls: Array<{
    id: string;
    callerLabel: string;
    callerName: string | null;
    callerE164: string;
    missedAt: string;
    missedAtRelative: string;
    recoveryLabel: string;
    replyLabel: string;
    subtitle: string;
    statusChip: string;
    /** LLM team brief headline when a notification snapshot exists */
    teamBriefHeadline?: string | null;
    teamBriefSummary?: string | null;
  }>;
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
