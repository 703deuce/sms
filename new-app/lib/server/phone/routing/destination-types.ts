export type ForwardingDestinationKind = "external_phone" | "workspace_number";

export type ForwardingDestinationRef =
  | { kind: "external_phone"; e164PhoneNumber: string; label?: string }
  | { kind: "workspace_number"; phoneNumberId: string; label?: string };

export type ResolvedForwardingDialTarget = {
  dialE164: string;
  destinationKind: ForwardingDestinationKind;
  workspacePhoneNumberId?: string;
  press1: boolean;
  screeningText: string | null;
  ringTimeoutSec: number;
};
