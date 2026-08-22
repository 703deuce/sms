import {
  isPhoneMessagingApproved,
  isTfvApproved,
  parseMessagingComplianceFromSettings,
  type TollFreeVerificationStatus,
} from "./messaging-compliance";
import { classifyProductionNumber } from "./phone-number-class";

export type PhoneMessagingStatus = {
  approved: boolean;
  complianceType: "TOLL_FREE_VERIFICATION" | "A2P_10DLC" | "LEGACY" | "UNKNOWN";
  status: string;
  label: string;
  numberClass: "TWILIO_TOLL_FREE" | "TELNYX_LOCAL_A2P";
};

function statusLabel(input: {
  complianceType: PhoneMessagingStatus["complianceType"];
  status: string;
  approved: boolean;
}): string {
  if (input.approved) {
    return input.complianceType === "A2P_10DLC" ? "A2P approved" : "Messaging approved";
  }
  const status = input.status.toUpperCase();
  if (status === "NOT_STARTED") return "Not started";
  if (status === "PENDING" || status === "IN_REVIEW" || status === "SUBMITTED") {
    return input.complianceType === "A2P_10DLC" ? "A2P pending" : "Verification pending";
  }
  if (status === "REJECTED" || status === "ACTION_REQUIRED") return "Action required";
  return status.replace(/_/g, " ").toLowerCase();
}

/** Human-readable messaging compliance for a phone number row. */
export function getPhoneMessagingStatus(input: {
  e164: string;
  settingsJson?: unknown;
  a2pStatus?: string | null;
  type?: string | null;
  provider?: string | null;
}): PhoneMessagingStatus {
  const compliance = parseMessagingComplianceFromSettings(input.settingsJson);
  const numberClass = classifyProductionNumber(input);
  const approved = isPhoneMessagingApproved(input);

  let complianceType: PhoneMessagingStatus["complianceType"] = "UNKNOWN";
  let status = String(input.a2pStatus || "NOT_STARTED");

  if (compliance?.type === "TOLL_FREE_VERIFICATION") {
    complianceType = "TOLL_FREE_VERIFICATION";
    status = String(compliance.status || "NOT_STARTED");
  } else if (compliance?.type === "A2P_10DLC") {
    complianceType = "A2P_10DLC";
    status = String(compliance.status || "NOT_STARTED");
  } else if (String(input.type || "").toLowerCase().includes("toll")) {
    complianceType = "TOLL_FREE_VERIFICATION";
    status = isTfvApproved(status as TollFreeVerificationStatus) ? "APPROVED" : status;
  } else if (approved) {
    complianceType = "LEGACY";
    status = "APPROVED";
  }

  return {
    approved,
    complianceType,
    status,
    label: statusLabel({ complianceType, status, approved }),
    numberClass,
  };
}
