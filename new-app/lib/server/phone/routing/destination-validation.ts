import { normalizeE164 } from "@/lib/server/phone/normalize";
import type { ForwardingDestinationKind } from "./destination-types";

export function assertDestinationKind(kind: string): ForwardingDestinationKind {
  if (kind === "external_phone" || kind === "workspace_number") return kind;
  throw new Error("destinationKind must be external_phone or workspace_number");
}

export function normalizeExternalDestinationE164(raw: string): string {
  const e164 = normalizeE164(raw);
  if (!e164 || e164.length < 8) {
    throw new Error("Enter a valid phone number in E.164 format");
  }
  return e164;
}

/** Direct loop: inbound business line must not equal external destination. */
export function rejectDirectE164Loop(inboundE164: string | undefined, destE164: string) {
  if (!inboundE164) return;
  const a = normalizeE164(inboundE164);
  const b = normalizeE164(destE164);
  if (a === b) {
    throw new Error("Forwarding destination cannot be the same as your Transovo business number");
  }
}

/** Direct loop: inbound number cannot forward to itself as a workspace destination. */
export function rejectDirectWorkspaceLoop(
  inboundPhoneNumberId: string | undefined,
  workspacePhoneNumberId: string,
) {
  if (inboundPhoneNumberId && inboundPhoneNumberId === workspacePhoneNumberId) {
    throw new Error("A number cannot forward to itself");
  }
}
