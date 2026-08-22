/**
 * Inbound SMS routing for the platform demo line (+15714073615).
 *
 * Production customer numbers use normal per-workspace inbound resolution.
 * Platform demo: match active onboarding demo session only — no cross-workspace
 * recent-outbound pairing for production customers.
 */
import { isPlatformDemoPhoneRecord } from "@/lib/messaging/compliance/phone-number-class";
import { resolveDemoWorkspaceForCaller } from "@/lib/mctb/onboarding/demo";

export type PlatformInboundRouteReason = "demo_session" | "phone_owner";

/**
 * Resolve workspace for inbound SMS to the platform demo Telnyx line.
 * Returns null when no active demo session — do not attribute to random workspaces.
 */
export async function resolvePlatformDemoInboundWorkspace(input: {
  fromE164: string;
  phoneRecord?: { workspaceId: string; e164: string; settingsJson?: unknown } | null;
}): Promise<{ workspaceId: string; reason: PlatformInboundRouteReason } | null> {
  const isPlatform =
    input.phoneRecord &&
    isPlatformDemoPhoneRecord({
      e164: input.phoneRecord.e164,
      settingsJson: input.phoneRecord.settingsJson,
    });

  if (!isPlatform) return null;

  const demo = await resolveDemoWorkspaceForCaller(input.fromE164);
  if (demo) {
    return { workspaceId: demo.workspaceId, reason: "demo_session" };
  }

  return input.phoneRecord?.workspaceId
    ? { workspaceId: input.phoneRecord.workspaceId, reason: "phone_owner" }
    : null;
}
