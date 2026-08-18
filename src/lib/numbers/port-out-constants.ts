/**
 * Transovo port-out lifecycle — provider-agnostic customer statuses.
 */

export const PORT_OUT_STATUSES = [
  "READY_TO_TRANSFER",
  "WAITING_FOR_CARRIER",
  "REQUEST_RECEIVED",
  "AUTHORIZATION_REQUIRED",
  "AUTHORIZED",
  "SCHEDULED",
  "ACTION_REQUIRED",
  "PORTABILITY_REVIEW",
  "COMPLETED",
  "CANCELED",
  "UNEXPECTED_PORT_REQUEST",
] as const;

export type PortOutStatus = (typeof PORT_OUT_STATUSES)[number];

export const PORT_OUT_REJECTION_CATEGORIES = [
  "FIXABLE_CREDENTIAL_MISMATCH",
  "ACCOUNT_NUMBER_MISMATCH",
  "PIN_MISMATCH",
  "NAME_MISMATCH",
  "ADDRESS_MISMATCH",
  "PORT_LOCK",
  "MISSING_AUTHORIZATION",
  "NUMBER_TYPE_UNSUPPORTED",
  "RATE_CENTER_UNSUPPORTED",
  "DESTINATION_COVERAGE_UNSUPPORTED",
  "NUMBER_INACTIVE",
  "DUPLICATE_PORT",
  "OTHER_REJECTION",
] as const;

export type PortOutRejectionCategory = (typeof PORT_OUT_REJECTION_CATEGORIES)[number];

export const PORTABILITY_GUARANTEE_DAYS = 30;

export function portOutStatusLabel(status: string): string {
  const map: Record<string, string> = {
    READY_TO_TRANSFER: "Ready to transfer",
    WAITING_FOR_CARRIER: "Waiting for carrier",
    REQUEST_RECEIVED: "Carrier request received",
    AUTHORIZATION_REQUIRED: "Authorization required",
    AUTHORIZED: "Authorized",
    SCHEDULED: "Transfer scheduled",
    ACTION_REQUIRED: "Action required",
    PORTABILITY_REVIEW: "Portability review",
    COMPLETED: "Transfer complete",
    CANCELED: "Canceled",
    UNEXPECTED_PORT_REQUEST: "Unexpected port request",
  };
  return map[status] || status;
}

export function portOutStatusDescription(status: string): string {
  const map: Record<string, string> = {
    READY_TO_TRANSFER: "Your number is ready. Share your porting information with your new carrier.",
    WAITING_FOR_CARRIER:
      "Your new carrier must submit the transfer request. Your Transovo number stays active until the transfer completes.",
    REQUEST_RECEIVED: "We received a transfer request from your new carrier and are reviewing it.",
    AUTHORIZATION_REQUIRED: "We need to authorize this transfer before it can proceed.",
    AUTHORIZED: "Your transfer has been authorized with the carrier.",
    SCHEDULED: "Your transfer is scheduled. Your number remains active on Transovo until the transfer date.",
    ACTION_REQUIRED: "Something needs your attention before the transfer can continue.",
    PORTABILITY_REVIEW: "We're reviewing whether your number can transfer to the destination you selected.",
    COMPLETED: "Your transfer is complete.",
    CANCELED: "This port-out was canceled.",
    UNEXPECTED_PORT_REQUEST: "We received a transfer request we could not match to your account.",
  };
  return map[status] || "";
}

export function rejectionCategoryCustomerMessage(category: string): string {
  const map: Record<string, string> = {
    FIXABLE_CREDENTIAL_MISMATCH:
      "The information your new carrier submitted doesn't match our records. Verify your account number, PIN, and authorized name with your new carrier.",
    ACCOUNT_NUMBER_MISMATCH:
      "The account number your new carrier used doesn't match. Use the Transovo account number shown in your port-out packet.",
    PIN_MISMATCH:
      "The port PIN your new carrier used is incorrect. Unlock your number in Transovo and share the current PIN.",
    NAME_MISMATCH:
      "The authorized name on the transfer doesn't match our records. Confirm the account holder name with your new carrier.",
    ADDRESS_MISMATCH:
      "The service address on the transfer doesn't match. Confirm your billing/service address with your new carrier.",
    PORT_LOCK:
      "This number is locked for port-out. Unlock it in Transovo before your new carrier resubmits.",
    MISSING_AUTHORIZATION:
      "Authorization is missing on the transfer request. Your new carrier may need a signed authorization.",
    NUMBER_TYPE_UNSUPPORTED:
      "Your new carrier indicated this number type cannot be accepted on their network.",
    RATE_CENTER_UNSUPPORTED:
      "Your new carrier indicated a rate-center or coverage limitation for this number.",
    DESTINATION_COVERAGE_UNSUPPORTED:
      "Your new carrier cannot accept this number due to destination coverage limits.",
    NUMBER_INACTIVE: "The number is not active for transfer.",
    DUPLICATE_PORT: "A duplicate transfer request was detected.",
    OTHER_REJECTION:
      "The transfer was rejected. Contact your new carrier for details and correct any issues before resubmitting.",
  };
  return map[category] || map.OTHER_REJECTION;
}

export function isCorrectableRejection(category: string | null | undefined): boolean {
  if (!category) return false;
  return [
    "FIXABLE_CREDENTIAL_MISMATCH",
    "ACCOUNT_NUMBER_MISMATCH",
    "PIN_MISMATCH",
    "NAME_MISMATCH",
    "ADDRESS_MISMATCH",
    "PORT_LOCK",
    "MISSING_AUTHORIZATION",
    "DUPLICATE_PORT",
    "OTHER_REJECTION",
  ].includes(category);
}

export function isPortabilityReviewRejection(category: string | null | undefined): boolean {
  if (!category) return false;
  return [
    "NUMBER_TYPE_UNSUPPORTED",
    "RATE_CENTER_UNSUPPORTED",
    "DESTINATION_COVERAGE_UNSUPPORTED",
  ].includes(category);
}

/** Map Telnyx portout API status to Transovo status. */
export function mapTelnyxPortOutStatus(telnyxStatus: string): PortOutStatus {
  const s = telnyxStatus.toLowerCase();
  if (s === "pending") return "REQUEST_RECEIVED";
  if (s === "authorized") return "AUTHORIZED";
  if (s === "ported") return "COMPLETED";
  if (s === "rejected" || s === "rejected-pending") return "ACTION_REQUIRED";
  if (s === "canceled") return "CANCELED";
  return "REQUEST_RECEIVED";
}
