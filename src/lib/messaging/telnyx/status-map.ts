/**
 * Telnyx 10DLC brand/campaign status + vertical mapping.
 * Keep advance + compliance webhook in sync via these helpers.
 */

const TELNYX_VERTICALS = new Set([
  "AGRICULTURE",
  "COMMUNICATION",
  "CONSTRUCTION",
  "EDUCATION",
  "ENERGY",
  "ENTERTAINMENT",
  "FINANCIAL",
  "GAMBLING",
  "GOVERNMENT",
  "HEALTHCARE",
  "HOSPITALITY",
  "HUMAN_RESOURCES",
  "INSURANCE",
  "LEGAL",
  "MANUFACTURING",
  "NGO",
  "POLITICAL",
  "POSTAL",
  "PROFESSIONAL",
  "REAL_ESTATE",
  "RETAIL",
  "TECHNOLOGY",
  "TRANSPORTATION",
]);

export function mapTelnyxVertical(
  industry: string | null | undefined,
  vertical?: string | null,
): string {
  const raw = (vertical || industry || "PROFESSIONAL").trim();
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (TELNYX_VERTICALS.has(upper)) return upper;
  if (upper === "PROFESSIONAL_SERVICES") return "PROFESSIONAL";

  const s = raw.toLowerCase();
  if (s.includes("tech") || s.includes("software") || s.includes("saas")) return "TECHNOLOGY";
  if (s.includes("health") || s.includes("medical") || s.includes("dental")) return "HEALTHCARE";
  if (s.includes("real") || s.includes("estate") || s.includes("propert")) return "REAL_ESTATE";
  if (s.includes("retail") || s.includes("ecommerce") || s.includes("e-commerce") || s.includes("shop")) {
    return "RETAIL";
  }
  if (s.includes("financ") || s.includes("bank") || s.includes("lend")) return "FINANCIAL";
  if (s.includes("insur")) return "INSURANCE";
  if (s.includes("legal") || s.includes("law")) return "LEGAL";
  if (s.includes("educat") || s.includes("school") || s.includes("university")) return "EDUCATION";
  if (s.includes("hotel") || s.includes("hospitality") || s.includes("restaurant") || s.includes("travel")) {
    return "HOSPITALITY";
  }
  if (s.includes("construct") || s.includes("contractor") || s.includes("home service")) {
    return "CONSTRUCTION";
  }
  if (s.includes("transport") || s.includes("logistics") || s.includes("delivery")) {
    return "TRANSPORTATION";
  }
  if (s.includes("manufactur")) return "MANUFACTURING";
  if (s.includes("energy") || s.includes("utility")) return "ENERGY";
  if (s.includes("entertain") || s.includes("media")) return "ENTERTAINMENT";
  if (s.includes("govern")) return "GOVERNMENT";
  if (s.includes("nonprofit") || s.includes("non-profit") || s.includes("ngo")) return "NGO";
  if (s.includes("agricult") || s.includes("farm")) return "AGRICULTURE";
  if (s.includes("human resource") || s.includes(" staffing") || /\bhr\b/.test(s)) {
    return "HUMAN_RESOURCES";
  }
  if (s.includes("communicat") || s.includes("telecom")) return "COMMUNICATION";
  if (s.includes("politic")) return "POLITICAL";
  if (s.includes("gambl") || s.includes("casino")) return "GAMBLING";
  if (s.includes("postal") || s.includes("shipping")) return "POSTAL";
  if (s.includes("professional") || s.includes("consult") || s.includes("service")) {
    return "PROFESSIONAL";
  }
  return "PROFESSIONAL";
}

export function isApprovedBrandStatus(status: string) {
  const s = status.toUpperCase();
  return [
    "OK",
    "VERIFIED",
    "VETTED_VERIFIED",
    "SELF_DECLARED",
    "APPROVED",
    "ACTIVE",
  ].includes(s);
}

export function isRejectedBrandStatus(status: string) {
  const s = status.toUpperCase();
  return [
    "FAILED",
    "REJECTED",
    "UNVERIFIED",
    "REGISTRATION_FAILED",
    "SUSPENDED",
  ].includes(s);
}

/** Fully ready to assign numbers / send (MNO provisioning complete). */
export function isApprovedCampaignStatus(status: string) {
  const s = status.toUpperCase();
  return ["ACTIVE", "APPROVED", "VERIFIED", "OK", "MNO_PROVISIONED"].includes(s);
}

export function isRejectedCampaignStatus(status: string) {
  const s = status.toUpperCase();
  return [
    "FAILED",
    "REJECTED",
    "EXPIRED",
    "SUSPENDED",
    "TCR_FAILED",
    "TELNYX_FAILED",
    "MNO_REJECTED",
    "MNO_PROVISIONING_FAILED",
    "TCR_SUSPENDED",
    "TCR_EXPIRED",
  ].includes(s);
}

/** Normalize campaign API payload into a single status string for mapping. */
export function pickCampaignStatus(body: {
  status?: string | null;
  campaignStatus?: string | null;
}) {
  const status = (body.status || "").toUpperCase();
  if (status === "ACTIVE" || status === "EXPIRED" || status === "SUSPENDED") {
    return status;
  }
  return body.campaignStatus || body.status || "unknown";
}
