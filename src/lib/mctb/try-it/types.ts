import type { MctbConsentMode, MctbDemoSession } from "@/lib/mctb/onboarding/types";

export type TryItProgressChecks = {
  callReceived: boolean;
  greetingPlayed: boolean;
  press1Received: boolean;
  consentConfirmed: boolean;
  recoverySmsQueued: boolean;
  recoverySmsSent: boolean;
};

export type TryItStatus = {
  demoNumberE164: string;
  demoNumberDisplay: string;
  consentMode: MctbConsentMode;
  sessionActive: boolean;
  waitingForCall: boolean;
  completed: boolean;
  expired: boolean;
  checks: TryItProgressChecks;
  session?: MctbDemoSession | null;
  callerE164?: string | null;
};
