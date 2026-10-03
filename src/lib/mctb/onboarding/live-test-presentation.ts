import type { LiveTestChecks } from "@/lib/mctb/onboarding/live-test";

export type OnboardingLiveTestStep = {
  id: string;
  label: string;
  done: boolean;
};

/** Customer-facing Step 7 timeline — only states backed by runtime checks. */
export function buildOnboardingLiveTestSteps(input: {
  checks: LiveTestChecks;
  consentMode: "press_1" | "existing_consent" | null;
}): OnboardingLiveTestStep[] {
  const { checks, consentMode } = input;
  const callReceived = checks.callDetected && checks.forwardingVerified;
  const consentLabel =
    consentMode === "press_1"
      ? "Consent confirmed (Press 1)"
      : consentMode === "existing_consent"
        ? "Consent path satisfied"
        : "Consent confirmed";
  return [
    {
      id: "call",
      label: "Call received on Transovo (forwarded from your business line)",
      done: callReceived,
    },
    {
      id: "consent",
      label: consentLabel,
      done: callReceived && checks.consentCompleted,
    },
    {
      id: "sms",
      label: "Recovery text sent",
      done: callReceived && checks.textSent,
    },
    {
      id: "reply",
      label: "Reply received",
      done: callReceived && checks.replyReceived,
    },
  ];
}
