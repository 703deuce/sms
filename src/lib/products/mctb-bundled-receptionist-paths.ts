/**
 * Voice receptionist routes surfaced inside the MCTB-first product chrome.
 * URLs stay on existing /voice/* and /mctb/voice-agent — no duplicate pages.
 */

export const MCTB_BUNDLED_AI_RECEPTIONIST_PATH_PREFIXES = [
  "/voice/overview",
  "/voice/calls",
  "/voice/knowledge",
  "/voice/inbound-routing",
  "/voice/call-handling",
  "/voice/analytics",
  "/voice/receptionist",
  "/voice/needs-attention",
  "/mctb/voice-agent",
] as const;

export function isMctbBundledAiReceptionistPath(pathname: string): boolean {
  return MCTB_BUNDLED_AI_RECEPTIONIST_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
