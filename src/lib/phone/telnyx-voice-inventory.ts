/**
 * Telnyx voice inventory — ownership/status only, not "pre-provisioned for LiveKit."
 * Voice routing is applied on product Activate.
 */

export type VoiceInventoryBlockReason =
  | "non_telnyx_provider"
  | "released"
  | "inactive";

export function isReleasedPhoneStatus(status: string | null | undefined): boolean {
  const s = String(status || "").trim().toLowerCase();
  return s === "released" || s === "release_pending";
}

export function isActiveAssignablePhoneStatus(status: string | null | undefined): boolean {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return true;
  if (isReleasedPhoneStatus(s)) return false;
  if (s === "active" || s === "verified" || s === "ready" || s === "in_use") {
    return true;
  }
  // Workspace / provider labels that still map to assignable Telnyx DIDs in production.
  if (
    s === "purchased" ||
    s === "in_service" ||
    s === "assigned" ||
    s === "enabled" ||
    s === "provisioned"
  ) {
    return true;
  }
  // Default permissive: only block explicit released states (above).
  return true;
}

export function describeTelnyxVoiceInventory(input: {
  provider?: string | null;
  status?: string | null;
}): {
  telnyxVoiceConfigurable: boolean;
  voiceInventoryBlockReason: VoiceInventoryBlockReason | null;
} {
  const provider = String(input.provider || "telnyx").trim().toLowerCase();
  if (provider !== "telnyx") {
    return {
      telnyxVoiceConfigurable: false,
      voiceInventoryBlockReason: "non_telnyx_provider",
    };
  }
  if (isReleasedPhoneStatus(input.status)) {
    return {
      telnyxVoiceConfigurable: false,
      voiceInventoryBlockReason: "released",
    };
  }
  if (!isActiveAssignablePhoneStatus(input.status)) {
    return {
      telnyxVoiceConfigurable: false,
      voiceInventoryBlockReason: "inactive",
    };
  }
  return { telnyxVoiceConfigurable: true, voiceInventoryBlockReason: null };
}
