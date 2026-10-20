export function effectiveOutboundSmsMode(mode: string | undefined | null): string {
  return mode || "platform";
}

export function isLikelySmsCapableInboundLine(_e164: string | null | undefined): boolean {
  return false;
}

export function parseVoiceOutboundSmsSettings(_raw: unknown): Record<string, unknown> {
  return {};
}

export function pickExplicitSmsNumber(_config: unknown): string | null {
  return null;
}
