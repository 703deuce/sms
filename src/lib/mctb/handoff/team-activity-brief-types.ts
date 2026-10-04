/** LLM-authored team summary — shared by email notifications and in-app surfaces. */
export type MctbTeamActivityBrief = {
  headline: string;
  summary: string;
  bullets: string[];
  recommendedNextStep: string;
  hasVoicemail: boolean;
  hasTextReplies: boolean;
  textReplyCount: number;
  callerName?: string;
  callerPhone?: string;
  generatedAt: string;
  provider?: string;
  model?: string;
};

export type MctbTeamBriefContext = {
  businessName: string;
  missedAt: string | null;
  callerPhone: string;
  callerName?: string;
  recoveryStatus?: string;
  voicemailTranscript?: string | null;
  voicemailSummary?: string | null;
  smsThread: Array<{ direction: "customer" | "business" | "system"; body: string; at?: string }>;
  triggerEvent: string;
};
