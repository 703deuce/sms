/**
 * Messaging compliance types — toll-free verification vs 10DLC/A2P.
 * Toll-free trial numbers use TOLL_FREE_VERIFICATION, not A2P_10DLC.
 */

export type MessagingComplianceType = "TOLL_FREE_VERIFICATION" | "A2P_10DLC";

/** Internal lifecycle for toll-free verification (MCTB trial). */
export type TollFreeVerificationStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING"
  | "APPROVED"
  | "ACTION_REQUIRED"
  | "REJECTED";

export type TollFreeVerificationRecord = {
  workspaceId: string;
  phoneNumberId: string;
  phoneE164: string;
  provider: "twilio";
  status: TollFreeVerificationStatus;
  twilioVerificationSid?: string | null;
  externalReferenceId: string;
  submissionSnapshot?: Record<string, unknown> | null;
  providerStatusRaw?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  actionRequiredAt?: string | null;
  failureReason?: string | null;
  lastSyncedAt?: string | null;
};

export function mapTwilioTfvStatus(raw: string | null | undefined): TollFreeVerificationStatus {
  const s = String(raw || "").toUpperCase();
  if (s === "TWILIO_APPROVED") return "APPROVED";
  if (s === "TWILIO_REJECTED") return "REJECTED";
  if (s === "PENDING_REVIEW" || s === "IN_REVIEW") return "PENDING";
  if (s.includes("ACTION") || s.includes("REQUIRED")) return "ACTION_REQUIRED";
  return "PENDING";
}

/** Sync legacy a2pStatus from messaging compliance status (backward compat). */
export function complianceStatusToA2p(
  status: TollFreeVerificationStatus,
): "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" {
  switch (status) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "DRAFT":
    case "NOT_STARTED":
      return "DRAFT";
    default:
      return "PENDING";
  }
}

export function isTfvApproved(status: TollFreeVerificationStatus): boolean {
  return status === "APPROVED";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type MessagingComplianceSnapshot = {
  type: MessagingComplianceType;
  status: TollFreeVerificationStatus | string;
};

/** Read messaging compliance from PhoneNumber.settingsJson. */
export function parseMessagingComplianceFromSettings(
  settingsJson: unknown,
): MessagingComplianceSnapshot | null {
  const settings = asRecord(settingsJson);
  const raw = asRecord(settings.messagingCompliance);
  if (!raw.type) return null;
  return {
    type: raw.type as MessagingComplianceType,
    status: String(raw.status || "NOT_STARTED") as TollFreeVerificationStatus,
  };
}

/** True when toll-free verification (or legacy a2pStatus) shows approved messaging. */
export function isPhoneMessagingApproved(input: {
  settingsJson?: unknown;
  a2pStatus?: string | null;
  type?: string | null;
}): boolean {
  const compliance = parseMessagingComplianceFromSettings(input.settingsJson);
  if (compliance?.type === "TOLL_FREE_VERIFICATION") {
    return isTfvApproved(compliance.status as TollFreeVerificationStatus);
  }
  if (compliance?.type === "A2P_10DLC") {
    return String(compliance.status).toUpperCase() === "APPROVED";
  }
  const type = String(input.type || "").toLowerCase();
  if (type.includes("toll")) {
    return String(input.a2pStatus || "").toLowerCase() === "approved";
  }
  return String(input.a2pStatus || "").toLowerCase() === "approved";
}

export function shouldDedupeTfvSubmission(input: {
  existingStatus?: TollFreeVerificationStatus | null;
  existingSid?: string | null;
}): boolean {
  if (!input.existingSid) return false;
  return ["SUBMITTED", "PENDING", "APPROVED", "ACTION_REQUIRED"].includes(
    input.existingStatus || "NOT_STARTED",
  );
}
