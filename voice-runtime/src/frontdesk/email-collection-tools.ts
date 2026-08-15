import type { FrontDeskUserData } from "./userdata";
import { isValidEmail, normalizeSpokenEmail } from "./email-utils";

/** Resolve confirmed email from session state or inline parameter. */
export function resolveConfirmedEmail(
  userData: FrontDeskUserData,
  inlineEmail?: string,
): string | null {
  const fromParam = inlineEmail?.trim();
  if (fromParam) {
    const normalized = normalizeSpokenEmail(fromParam);
    if (isValidEmail(normalized)) return normalized;
  }
  const confirmed = userData.confirmedEmail?.trim();
  if (confirmed && isValidEmail(confirmed)) return confirmed;

  const fromFields = userData.receptionistFields?.email?.trim();
  if (fromFields) {
    const normalized = normalizeSpokenEmail(fromFields);
    if (isValidEmail(normalized)) return normalized;
  }

  return null;
}
