/**
 * Onboarding: voice on workspace TFN (Twilio), SMS via platform 571 (Telnyx A2P)
 * until TFV approves the toll-free number.
 */
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { getTfvStatusForWorkspace } from "@/lib/mctb/tfv/service";
import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import {
  resolvePlatformTelnyxSmsRoute,
  type MctbOutboundSmsRoute,
} from "@/lib/mctb/messaging/outbound-sms-route";

function sameE164(a: string, b: string): boolean {
  try {
    return normalizeE164(a) === normalizeE164(b);
  } catch {
    return false;
  }
}

/** True when this missed call should send recovery SMS from platform 571 instead of TFN. */
export async function shouldSendOnboardingSmsViaPlatform571(input: {
  workspaceId: string;
  businessE164: string;
}): Promise<boolean> {
  if (isPlatformDemoNumber(input.businessE164)) return false;

  const state = await loadMctbOnboardingState(input.workspaceId);
  const tfn = getWorkspaceTollFreeNumber(state)?.e164;
  if (!tfn || !sameE164(input.businessE164, tfn)) return false;

  const tfv = await getTfvStatusForWorkspace(input.workspaceId);
  // Voice on workspace TFN (Twilio); outbound SMS via platform 571 until TFV approves.
  return !tfv.approved;
}

export async function resolveOnboardingTfnSmsViaPlatform571(input: {
  workspaceId: string;
  businessE164: string;
}): Promise<MctbOutboundSmsRoute | null> {
  if (!(await shouldSendOnboardingSmsViaPlatform571(input))) return null;
  return resolvePlatformTelnyxSmsRoute({
    customerWorkspaceId: input.workspaceId,
    trafficMode: "PLATFORM_DEMO",
  });
}
