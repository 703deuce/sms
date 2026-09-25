/** Canonical customer-facing destinations for legacy /voice/agents/* compatibility redirects. */
export function legacyVoiceAgentPageRedirect(pathname: string): string {
  if (pathname.endsWith("/integrations")) {
    return "/integrations";
  }
  return "/voice/receptionist";
}
