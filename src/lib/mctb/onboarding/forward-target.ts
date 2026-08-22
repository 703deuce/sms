/**
 * Onboarding call-forward target — customers forward missed calls to the platform
 * Telnyx 571 line (A2P-approved) until their toll-free number is TFV-ready.
 */
import {
  MCTB_PLATFORM_DEMO_DISPLAY,
  MCTB_PLATFORM_DEMO_E164,
} from "./constants";
import { formatDemoPhoneDisplay, getPlatformDemoNumberE164 } from "./demo";

/** E.164 customers dial into for conditional forwarding during onboarding. */
export function getOnboardingForwardTargetE164(): string {
  return getPlatformDemoNumberE164();
}

export function getOnboardingForwardTargetDisplay(): string {
  return MCTB_PLATFORM_DEMO_DISPLAY;
}

export function formatOnboardingForwardTarget(e164: string = MCTB_PLATFORM_DEMO_E164): string {
  return formatDemoPhoneDisplay(e164);
}
