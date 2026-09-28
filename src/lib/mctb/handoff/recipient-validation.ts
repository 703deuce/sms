import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { MctbNotificationRecipientDto } from "./types";

export class MctbNotificationRecipientValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MctbNotificationRecipientValidationError";
  }
}

export function normalizeMctbNotificationRecipientMobile(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    return normalizeE164(trimmed);
  } catch {
    throw new MctbNotificationRecipientValidationError(
      "Mobile number must be a valid phone number in E.164 format.",
    );
  }
}

/** Workspace-scoped save validation — reuse existing recipient model only. */
export function validateMctbNotificationRecipientsForSave(
  recipients: Array<Omit<MctbNotificationRecipientDto, "id"> & { id?: string }>,
): Array<Omit<MctbNotificationRecipientDto, "id"> & { id?: string }> {
  const seenMobile = new Set<string>();
  const seenEmail = new Set<string>();

  return recipients.map((r, index) => {
    const name = r.name?.trim();
    if (!name) {
      throw new MctbNotificationRecipientValidationError(
        `Recipient ${index + 1}: name is required.`,
      );
    }

    let mobileE164: string | null = null;
    if (r.mobileE164?.trim()) {
      mobileE164 = normalizeMctbNotificationRecipientMobile(r.mobileE164);
      if (seenMobile.has(mobileE164)) {
        throw new MctbNotificationRecipientValidationError(
          `Recipient ${index + 1}: duplicate mobile number.`,
        );
      }
      seenMobile.add(mobileE164);
    }

    let email: string | null = r.email?.trim() || null;
    if (email) {
      const key = email.toLowerCase();
      if (seenEmail.has(key)) {
        throw new MctbNotificationRecipientValidationError(
          `Recipient ${index + 1}: duplicate email address.`,
        );
      }
      seenEmail.add(key);
    }

    if (!email && !mobileE164) {
      throw new MctbNotificationRecipientValidationError(
        `Recipient ${index + 1}: email or mobile is required.`,
      );
    }

    return { ...r, name, email, mobileE164 };
  });
}
