/**
 * Map app form values → Twilio TrustHub / A2P attribute enums.
 */

const BUSINESS_TYPE_MAP: Record<string, string> = {
  sole_proprietorship: "Sole Proprietorship",
  partnership: "Partnership",
  llc: "Limited Liability Corporation",
  corporation: "Corporation",
  co_operative: "Co-operative",
  non_profit: "Non-profit Corporation",
  "Sole Proprietorship": "Sole Proprietorship",
  Partnership: "Partnership",
  "Limited Liability Corporation": "Limited Liability Corporation",
  Corporation: "Corporation",
  "Co-operative": "Co-operative",
  "Non-profit Corporation": "Non-profit Corporation",
};

const INDUSTRY_MAP: Record<string, string> = {
  agriculture: "AGRICULTURE",
  automotive: "AUTOMOTIVE",
  banking: "BANKING",
  construction: "CONSTRUCTION",
  education: "EDUCATION",
  electronics: "ELECTRONICS",
  energy: "ENERGY",
  engineering: "ENGINEERING",
  fast_moving_consumer_goods: "FAST_MOVING_CONSUMER_GOODS",
  financial: "FINANCIAL",
  finishing: "FINISHING",
  food_and_beverage: "FOOD_AND_BEVERAGE",
  health: "HEALTH",
  hospitality: "HOSPITALITY",
  insurance: "INSURANCE",
  jewelry: "JEWELRY",
  legal: "LEGAL",
  manufacturing: "MANUFACTURING",
  media: "MEDIA",
  not_for_profit: "NOT_FOR_PROFIT",
  oil_and_gas: "OIL_AND_GAS",
  online: "ONLINE",
  professional_services: "PROFESSIONAL_SERVICES",
  raw_materials: "RAW_MATERIALS",
  real_estate: "REAL_ESTATE",
  religion: "RELIGION",
  retail: "RETAIL",
  technology: "TECHNOLOGY",
  telecommunications: "TELECOMMUNICATIONS",
  transportation: "TRANSPORTATION",
  travel: "TRAVEL",
};

const USE_CASE_MAP: Record<string, string> = {
  customer_care: "CUSTOMER_CARE",
  delivery_notifications: "DELIVERY_NOTIFICATIONS",
  account_notification: "ACCOUNT_NOTIFICATION",
  marketing: "MARKETING",
  two_factor_auth: "2FA",
  security_alert: "SECURITY_ALERT",
  polling_voting: "POLLING_VOTING",
  higher_education: "HIGHER_EDUCATION",
  charity_nonprofit: "CHARITY_NONPROFIT",
  political: "POLITICAL",
  agents_and_franchises: "AGENTS_FRANCHISES",
  mixed: "MIXED",
  low_volume: "LOW_VOLUME",
};

export function mapBusinessType(value: string) {
  return BUSINESS_TYPE_MAP[value] || BUSINESS_TYPE_MAP[value.toLowerCase()] || value;
}

export function mapIndustry(value: string) {
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  return INDUSTRY_MAP[key] || value.toUpperCase().replace(/\s+/g, "_");
}

export function mapUseCase(value: string) {
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  return USE_CASE_MAP[key] || value.toUpperCase().replace(/\s+/g, "_");
}

/** Twilio A2P messaging profile company_type enum. */
export function mapA2pCompanyType(businessType: string): string {
  const mapped = mapBusinessType(businessType).toLowerCase();
  if (mapped.includes("sole")) return "sole_proprietor";
  if (mapped.includes("non-profit") || mapped.includes("nonprofit")) return "non_profit";
  if (mapped.includes("public")) return "public";
  if (mapped.includes("government")) return "government";
  return "private";
}

export function normalizeE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new Error(`Invalid phone number: ${phone}`);
}

export function tryNormalizeE164(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  try {
    return normalizeE164(trimmed);
  } catch {
    return null;
  }
}
