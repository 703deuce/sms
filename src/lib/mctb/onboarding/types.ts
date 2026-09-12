export type MctbOnboardingStep =
  | "business_line"
  | "connect_calls"
  | "consent"
  | "recovery"
  | "voicemail"
  | "review_test"
  | "ready"
  /** @deprecated legacy persisted values — normalized on read */
  | "business"
  | "trial_number"
  | "configure"
  | "demo"
  | "tfv"
  | "pending"
  | "connect"
  | "live_test"
  | "complete";

import type { MctbConsentMode } from "@/lib/mctb/consent-mode";

export type { MctbConsentMode };

export type MctbTfvStatus =
  | "not_started"
  | "submitted"
  | "in_review"
  | "approved"
  | "action_required"
  | "rejected";

export type MctbTrialNumberInfo = {
  e164: string;
  phoneNumberId: string;
  provider: "twilio" | "telnyx";
  numberType: "toll_free" | "local";
  voiceStatus: "ready" | "pending";
  messagingVerificationStatus: MctbTfvStatus;
  verificationId?: string | null;
  provisionedAt: string;
};

export type MctbDemoSessionStatus =
  | "idle"
  | "waiting_call"
  | "call_detected"
  | "text_sent"
  | "reply_received"
  | "completed"
  | "expired";

export type MctbDemoSession = {
  /** Stable id for workspace-isolated demo session resolution. */
  demoSessionId?: string;
  status: MctbDemoSessionStatus;
  callerE164: string;
  /** Platform-owned pre-approved demo number — NOT the customer's trial TFN. */
  demoNumberE164: string;
  startedAt: string;
  expiresAt?: string | null;
  /** try_it = standalone /voice/try-it page; onboarding = wizard demo step */
  context?: "try_it" | "onboarding";
  callDetectedAt?: string | null;
  textSentAt?: string | null;
  replyReceivedAt?: string | null;
  completedAt?: string | null;
  missedCallEventId?: string | null;
  /** Last platform inbound call that triggered demo detection (AT&T forward shape). */
  lastInboundCall?: {
    from: string;
    to: string;
    forwardedFrom?: string | null;
    callSid?: string | null;
    callStatus?: string | null;
    detectedAt: string;
  } | null;
};

export type MctbLiveTestSession = {
  startedAt: string;
  businessNumberE164?: string | null;
  callDetectedAt?: string | null;
  missedCallAt?: string | null;
  consentCompletedAt?: string | null;
  textSentAt?: string | null;
  replyReceivedAt?: string | null;
  passedAt?: string | null;
  missedCallEventId?: string | null;
};

export type MctbForwardingCarrier =
  | "verizon"
  | "att"
  | "tmobile"
  | "google_voice"
  | "ringcentral"
  | "spectrum"
  | "comcast"
  | "other";

export type MctbWorkspaceTollFreeInfo = MctbTrialNumberInfo;

export type MctbOnboardingState = {
  version: 2;
  currentStep: MctbOnboardingStep;
  completedSteps: MctbOnboardingStep[];
  startedAt: string;
  businessName?: string | null;
  websiteUrl?: string | null;
  industry?: string | null;
  messageTemplate?: string | null;
  consentMode?: MctbConsentMode | null;
  /** Workspace-owned Twilio toll-free number (provisioned during onboarding). */
  workspaceTollFreeNumber?: MctbWorkspaceTollFreeInfo | null;
  /** @deprecated Use workspaceTollFreeNumber — mirrored for backward compatibility. */
  trialNumber?: MctbTrialNumberInfo | null;
  demoSession?: MctbDemoSession | null;
  tfvSubmittedAt?: string | null;
  tfvApprovedAt?: string | null;
  tfvRejectedAt?: string | null;
  forwardingCarrier?: MctbForwardingCarrier | null;
  /** Customer's advertised business line (forwards to trial TFN). */
  businessNumberE164?: string | null;
  /** Target seconds before no-answer forward (must beat voicemail when VM is on). */
  forwardingRingSeconds?: number | null;
  forwardingTestStartedAt?: string | null;
  forwardingConnectedAt?: string | null;
  forwardingVerifiedCallSid?: string | null;
  forwardingVerifiedCallerE164?: string | null;
  forwardingVerifiedFromE164?: string | null;
  liveTestSession?: MctbLiveTestSession | null;
  liveTestPassedAt?: string | null;
  trialActivatedAt?: string | null;
  voicemailConfiguredAt?: string | null;
  funnelEvents?: Record<string, string>;
};

export const MCTB_ONBOARDING_STEP_ORDER: MctbOnboardingStep[] = [
  "business_line",
  "connect_calls",
  "consent",
  "recovery",
  "voicemail",
  "review_test",
  "ready",
];

export const MCTB_ONBOARDING_STEP_LABELS: Record<string, string> = {
  business_line: "Business line",
  connect_calls: "Connect calls",
  consent: "Consent",
  recovery: "Recovery",
  voicemail: "Voicemail",
  review_test: "Review & test",
  ready: "Ready",
  business: "Business info",
  trial_number: "Your Transovo number",
  configure: "Text-back message",
  demo: "See how it works",
  tfv: "Toll-free verification",
  pending: "Verification pending",
  connect: "Connect your business line",
  live_test: "Live test",
  complete: "Trial active",
};

export const DEFAULT_DEMO_MESSAGE =
  "Transovo Demo: Sorry we missed your call. This is how your customers will receive a text when you can't answer. Reply to test two-way texting.";

export const DEFAULT_ONBOARDING_MESSAGE =
  "Sorry we missed your call! Reply here and we'll get back to you shortly.";
