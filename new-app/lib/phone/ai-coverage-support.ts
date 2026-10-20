import type { RoutePolicy } from "@/lib/data";

/**
 * Workspace-level AI coverage flags are stored in `workspaceCallRouting.policyJson`.
 * Only modes listed here change live Telnyx Call Control ingress today; others are preferences only.
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
  return "Saved for when Conversational IVR ingress is the answering path for this line — not active on Call Forwarding (Telnyx) numbers yet.";
}
