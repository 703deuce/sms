/**
 * Presentation types shared by transplanted New UI components (from newui/lib/data.ts).
 * No mock arrays — production routes supply data via props/adapters.
 */

export type CallOutcome = "Appointment" | "Lead" | "Message" | "Transfer" | "Voicemail" | "No Answer";

export type VoiceCall = {
  id: string;
  caller: string;
  phone: string;
  date: string;
  time: string;
  duration: string;
  outcome: CallOutcome;
  attention?: string;
  recording: boolean;
  summary: string;
};

export type RecoveryStatus =
  | "Replied"
  | "Needs attention"
  | "Waiting for consent"
  | "Suppressed"
  | "Failed"
  | "Sent";

export type MissedCall = {
  id: string;
  caller: string;
  phone: string;
  callerE164?: string;
  missed: string;
  trigger: "No answer" | "Busy" | "Rejected" | "Unreachable" | "Voicemail";
  recovery: RecoveryStatus;
  reply: string | null;
  line: string;
  conversationId?: string;
  /** Missed-call attempts from this caller today (when provided by API). */
  callsToday?: number;
  teamBriefHeadline?: string | null;
  teamBriefSummary?: string | null;
};

export type Message = {
  from: "customer" | "business" | "system" | "ai";
  text: string;
  time: string;
  status?: string;
  urgentReply?: boolean;
};

export type Conversation = {
  id: string;
  name: string;
  phone: string;
  preview: string;
  time: string;
  unread: boolean;
  needsReply: boolean;
  tag?: string;
  messages: Message[];
  assignedTo?: string | null;
  consentLabel?: string;
  composerFooter?: string;
  missedCallEventId?: string;
  mctbUrgent?: {
    isUrgent: boolean;
    reason?: string | null;
    summary?: string | null;
    messagePreview?: string | null;
    assessedAt?: string | null;
    ruleVersion?: string | null;
  } | null;
};

export type VoicemailItem = {
  id: string;
  caller: string;
  phone: string;
  isNew: boolean;
  time: string;
  duration: string;
  summary: string;
  transcript: string | null;
  recordingSrc?: string;
  conversationHref?: string;
};

export type ChartWeekRow = {
  day: string;
  calls: number;
  missed: number;
  texts: number;
  replies: number;
  booked: number;
};

export type BusinessContext = {
  name: string;
  line: string;
  /** Transovo forwarding / ingress number (not the public business line). */
  forwardingLine: string;
  forwardingLineState: "ready" | "provisioning" | "missing";
  sender: string;
  senderDetail: string;
  senderMode: "PLATFORM" | "WORKSPACE";
  timezone: string;
  website: string;
};

export type NumberRow = {
  number: string;
  label: string;
  type: string;
  messaging: string;
  line: string;
};
