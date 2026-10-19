/** API read model aligned with v0 Call UI (single normalized call). */

export type CallDirection = "inbound" | "outbound";

export type CallOutcome =
  | "answered"
  | "missed"
  | "voicemail"
  | "busy"
  | "failed"
  | "canceled";

export type PhoneCallDto = {
  id: string;
  direction: CallDirection;
  caller: string;
  callerNumber: string;
  contactId: string | null;
  numberId: string | null;
  startedAt: string;
  durationSec: number;
  outcome: CallOutcome;
  routedTo: string;
  user: string | null;
  handled: boolean;
  callbackNeeded: boolean;
  recording: boolean;
  recordingUrl: string | null;
  disposition: string | null;
  source: string | null;
  status: string;
  transcriptText: string | null;
  voicemail: {
    durationSec: number;
    transcript: string | null;
    messageId: string;
    isRead: boolean;
  } | null;
  notes: { id: string; content: string; createdAt: string; author: string | null }[];
  contactSummary: {
    id: string;
    name: string;
    phone: string;
    company: string | null;
    status: string;
    owner: string | null;
    lastInteraction: string | null;
  } | null;
  lineSummary: {
    id: string;
    label: string;
    e164: string;
  } | null;
  metadata: Record<string, unknown> | null;
};

export type RoutePolicyDto = {
  numberId: string | null;
  duringHours: string;
  ringStrategy: string;
  ringTimeout: number;
  noAnswer: string;
  afterHours: string;
  aiCoverage: string;
  mctbEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
  greetingText: string | null;
  greetingUrl: string | null;
  providerSyncStatus: string;
  providerSyncError: string | null;
};

export type PhoneReadinessDto = {
  telnyxConfigured: boolean;
  webrtcCredentialConfigured: boolean;
  connectionConfigured: boolean;
  activeLines: number;
  defaultCallerId: string | null;
  registrationHint: string;
};
