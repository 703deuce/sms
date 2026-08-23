export type NeedsAttentionKind =
  | "callback_request"
  | "voicemail"
  | "mctb_reply"
  | "missed_call"
  | "form_submission"
  | "repeat_caller";

export type NeedsAttentionStatus = "needs_attention" | "contacted" | "done";

export type NeedsAttentionEvent = {
  kind: NeedsAttentionKind;
  id: string;
  label: string;
  at: string;
  href?: string;
};

export type NeedsAttentionItem = {
  id: string;
  callerE164: string;
  callerName?: string | null;
  title: string;
  subtitle?: string;
  transcriptPreview?: string;
  status: NeedsAttentionStatus;
  assignedToUserId?: string | null;
  repeatCallerCount?: number;
  events: NeedsAttentionEvent[];
  latestAt: string;
  primaryKind: NeedsAttentionKind;
  primaryRefId: string;
};
