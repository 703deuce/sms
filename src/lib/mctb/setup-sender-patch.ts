import type { MctbSenderMode } from "@/lib/agents/missed-call-text-back/types";

/**
 * Whether changing ingress phoneNumberId should auto-copy into smsPhoneNumberId.
 * Legacy coupling — disabled for the two-number product model.
 */
export function shouldAutoCopyIngressToSmsOnPhoneChange(): boolean {
  return false;
}

export function resolveSmsPhoneNumberIdForSetupPatch(input: {
  bodySmsPhoneNumberId: string | null | undefined;
  phoneNumberChanged: boolean;
  nextPhoneNumberId: string | null | undefined;
}): string | null | undefined {
  if (input.bodySmsPhoneNumberId !== undefined) {
    return input.bodySmsPhoneNumberId;
  }
  if (
    shouldAutoCopyIngressToSmsOnPhoneChange() &&
    input.phoneNumberChanged &&
    input.nextPhoneNumberId !== undefined
  ) {
    return input.nextPhoneNumberId;
  }
  return undefined;
}

export function resolveStaleSmsPhoneRepair(input: {
  senderMode: MctbSenderMode;
  sanitizedSmsPhoneNumberId: string | null;
  sanitizedPhoneNumberId: string | null;
}): string | null {
  if (input.senderMode === "PLATFORM") {
    return input.sanitizedSmsPhoneNumberId;
  }
  return input.sanitizedSmsPhoneNumberId || input.sanitizedPhoneNumberId;
}
