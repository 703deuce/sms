export type ArPlatformSenderCandidate = {
  phoneNumberId: string;
  e164: string;
  workspaceId: string;
  provider: "telnyx" | "twilio";
  priority: number;
};

export function pickFirstUnoccupiedPlatformSender(
  senders: ArPlatformSenderCandidate[],
  occupied: Set<string>,
): ArPlatformSenderCandidate | null {
  for (const sender of senders) {
    if (!occupied.has(sender.phoneNumberId)) return sender;
  }
  return null;
}
