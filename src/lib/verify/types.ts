export type VerifyCreditPack = "verify_1000" | "verify_5000" | "verify_10000" | "verify_50000";

export const VERIFY_PACK_CREDITS: Record<VerifyCreditPack, number> = {
  verify_1000: 1000,
  verify_5000: 5000,
  verify_10000: 10000,
  verify_50000: 50000,
};

export type LineTypeDisplay = "Mobile" | "Landline" | "VoIP" | "Toll-Free" | "Unknown";

export type VerifyLookupResult = {
  normalizedE164: string | null;
  lineType: LineTypeDisplay;
  carrier: string | null;
  country: string | null;
  ported: string | null;
  lookupStatus: "success" | "invalid_format" | "provider_error";
  smsSuitability: string | null;
};
