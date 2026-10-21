import type { RoutePolicy } from "@/lib/data";

/**
 * Workspace-level AI coverage flags live in `workspaceCallRouting.policyJson`.
 * Only modes listed here change live Telnyx Call Control ingress today.
 */
export const PHONE_AI_COVERAGE_RUNTIME_MODES: ReadonlySet<RoutePolicy["aiCoverage"]> = new Set([
  "off",
]);

export function isPhoneAiCoverageRuntimeMode(mode: RoutePolicy["aiCoverage"]): boolean {
  return PHONE_AI_COVERAGE_RUNTIME_MODES.has(mode);
}

export function phoneAiCoverageModeDescription(mode: RoutePolicy["aiCoverage"]): string {
  if (isPhoneAiCoverageRuntimeMode(mode)) {
    return "Applied on numbers using browser/WebRTC or legacy workspace routing.";
  }
  return "Saved for when Conversational IVR is the answering path for this line — not active on Call Forwarding-only numbers yet.";
}
