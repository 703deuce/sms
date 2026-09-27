/**
 * Voice receptionist routes surfaced inside the MCTB-first product chrome (when Voice is customer-visible).
 * URLs stay on existing /voice/* — legacy /mctb/voice-agent redirects to /voice/agents.
 *
 * Launch freeze: `isVoiceCustomerUiPath` is the superset used for direct-route protection — every
 * customer `/voice/*` page (including `/voice/receptionist/edit`, `/voice/settings`, legacy MCTB
 * URLs like `/voice/setup`) redirects when Voice is hidden. APIs under `/api/voice` are unaffected.
 */

export const MCTB_BUNDLED_AI_RECEPTIONIST_PATH_PREFIXES = [
  "/voice/overview",
  "/voice/calls",
  "/voice/knowledge",
  "/voice/call-handling",
  "/voice/inbound-routing",
  "/voice/analytics",
  "/voice/receptionist",
  "/voice/agents",
  "/voice/needs-attention",
  "/mctb/voice-agent",
] as const;

/** Customer browser routes under `/voice` (query strings ignored by middleware pathname). */
export function isVoiceCustomerUiPath(pathname: string): boolean {
  return pathname === "/voice" || pathname.startsWith("/voice/");
}

export function isMctbBundledAiReceptionistPath(pathname: string): boolean {
  return MCTB_BUNDLED_AI_RECEPTIONIST_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
