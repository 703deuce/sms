import "server-only";

import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

/**
 * PLATFORM recovery SMS must not use the CFNA ingress toll-free (phoneNumberId).
 */
export async function resolveMctbPlatformSmsPhoneNumberId(): Promise<string | null> {
  const platform = await resolveCanonicalMctbPlatformSender();
  return platform?.phoneNumberId ?? null;
}

export async function reconcileMctbSmsPhoneNumberId(input: {
  senderMode: "PLATFORM" | "WORKSPACE" | string | null | undefined;
  phoneNumberId: string | null | undefined;
  smsPhoneNumberId: string | null | undefined;
}): Promise<string | null | undefined> {
  const mode = input.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE";
  if (mode === "WORKSPACE") {
    return input.smsPhoneNumberId;
  }
  const platformId = await resolveMctbPlatformSmsPhoneNumberId();
  if (!platformId) return input.smsPhoneNumberId;
  if (!input.smsPhoneNumberId || input.smsPhoneNumberId === input.phoneNumberId) {
    return platformId;
  }
  return input.smsPhoneNumberId;
}

export async function smsPatchWhenIngressChanges(input: {
  priorRuntime: { senderMode?: string | null; smsPhoneNumberId?: string | null };
  bodySenderMode?: "PLATFORM" | "WORKSPACE";
  phoneNumberChanged: boolean;
  explicitSmsPhoneNumberId?: string | null;
}): Promise<string | undefined> {
  if (input.explicitSmsPhoneNumberId !== undefined) {
    return input.explicitSmsPhoneNumberId ?? undefined;
  }
  if (!input.phoneNumberChanged) return undefined;

  const mode =
    input.bodySenderMode ??
    (input.priorRuntime.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE");
  if (mode !== "PLATFORM") return undefined;

  const platformId = await resolveMctbPlatformSmsPhoneNumberId();
  return platformId ?? undefined;
}
