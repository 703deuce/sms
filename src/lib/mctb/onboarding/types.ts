export type MctbOnboardingStep =
  | "business"
  | "configure"
  | "consent"
  | "demo"
  | "compliance"
  | "pending"
  | "connect"
  | "live_test"
  | "complete";

export type MctbConsentMode = "press_1" | "existing_consent";

export type MctbDemoSessionStatus =
  | "idle"
  | "waiting_call"
  | "call_detected"
  | "text_sent"
  | "reply_received"
  | "completed"
  | "expired";

export type MctbDemoSession = {
  status: MctbDemoSessionStatus;
  callerE164: string;
  demoNumberE164: string;
  startedAt: string;
  callDetectedAt?: string | null;
  textSentAt?: string | null;
  replyReceivedAt?: string | null;
  completedAt?: string | null;
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

export type MctbOnboardingState = {
  version: 1;
  currentStep: MctbOnboardingStep;
  completedSteps: MctbOnboardingStep[];
  startedAt: string;
  businessName?: string | null;
  industry?: string | null;
  messageTemplate?: string | null;
  consentMode?: MctbConsentMode | null;
  demoSession?: MctbDemoSession | null;
  complianceSubmittedAt?: string | null;
  complianceApprovedAt?: string | null;
  forwardingCarrier?: MctbForwardingCarrier | null;
  businessNumberE164?: string | null;
  forwardingConnectedAt?: string | null;
  liveTestPassedAt?: string | null;
  trialActivatedAt?: string | null;
  funnelEvents?: Record<string, string>;
};

export const MCTB_ONBOARDING_STEP_ORDER: MctbOnboardingStep[] = [
  "business",
  "configure",
  "consent",
  "demo",
  "compliance",
  "pending",
  "connect",
  "live_test",
  "complete",
];

export const MCTB_ONBOARDING_STEP_LABELS: Record<MctbOnboardingStep, string> = {
  business: "Business info",
  configure: "Missed-call text",
  consent: "Consent method",
  demo: "See it work",
  compliance: "Business verification",
  pending: "Verification pending",
  connect: "Connect your number",
  live_test: "Live test",
  complete: "Trial active",
};

export const DEFAULT_DEMO_MESSAGE =
  "Transovo Demo: Sorry we missed your call. This is how your customers will receive a text when you can't answer. Reply to test two-way texting.";

export const DEFAULT_ONBOARDING_MESSAGE =
  "Sorry we missed your call! Reply here and we'll get back to you shortly.";
