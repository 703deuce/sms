/**
 * Voice receptionist routes surfaced inside the MCTB-first product chrome.
 * URLs stay on existing /voice/* — legacy /mctb/voice-agent redirects to /voice/agents.
 */

export const MCTB_BUNDLED_AI_RECEPTIONIST_PATH_PREFIXES = [
  "/voice/overview",
  "/voice/calls",
  "/voice/knowledge",
  "/voice/call-handling",
  "/voice/inbound-routing",
  "/voice/receptionist",
  "/voice/agents",
  "/mctb/voice-agent",
] as const;

export function isMctbBundledAiReceptionistPath(pathname: string): boolean {
  return MCTB_BUNDLED_AI_RECEPTIONIST_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
