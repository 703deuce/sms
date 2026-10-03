import type { LiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import type { MctbSetupTestStatus } from "@/lib/mctb/setup-test";

/** Single UI/runtime signal: did a production-path test prove calls reach MCTB and recovery SMS can send? */
export function resolveMctbForwardingVerifiedForUi(input: {
  forwardingConnectedAt?: string | null;
  liveTestPassedAt?: string | null;
  forwardingVerificationVerified?: boolean;
  liveTest?: LiveTestStatus | null;
  setupTest?: MctbSetupTestStatus | null;
}): boolean {
  if (input.forwardingConnectedAt) return true;
  if (input.liveTestPassedAt) return true;
  if (input.forwardingVerificationVerified) return true;
  if (input.setupTest?.verified) return true;
  if (input.liveTest?.passed) return true;
  const checks = input.liveTest?.checks;
  if (checks?.forwardingVerified && checks.textSent) return true;
  return false;
}

export function resolveMctbLiveRecoveryProvenForUi(input: {
  liveTest?: LiveTestStatus | null;
  setupTest?: MctbSetupTestStatus | null;
}): boolean {
  if (input.setupTest?.verified) return true;
  if (input.liveTest?.passed) return true;
  const checks = input.liveTest?.checks;
  return Boolean(
    checks?.forwardingVerified &&
      checks.missedCall &&
      checks.consentCompleted &&
      checks.textSent,
  );
}
