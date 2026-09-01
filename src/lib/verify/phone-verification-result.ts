export type PhoneLineType =
  | "mobile"
  | "landline"
  | "fixed_voip"
  | "non_fixed_voip"
  | "voip"
  | "toll_free"
  | "unknown";

export type PhoneReachability = "not_tested" | "reachable" | "unreachable" | "unknown";

/** Provider-agnostic normalized verification result. */
export type PhoneVerificationResult = {
  normalizedNumber: string | null;
  formatValid: boolean;
  country?: string | null;
  carrier?: string | null;
  lineType: PhoneLineType;
  lineTypeDisplay: string;
  ported?: string | null;
  reachability: PhoneReachability;
  smsSuitability: string | null;
  lookupStatus: "success" | "invalid_format" | "provider_error";
  provider: string;
  checkedAt: Date;
  cacheHit: boolean;
  creditsCharged: number;
  providerCostCents: number;
  meaning: string;
};

export function verificationResultMeaning(result: Pick<
  PhoneVerificationResult,
  "lineTypeDisplay" | "carrier" | "reachability" | "formatValid"
>): string {
  if (!result.formatValid) {
    return "This number could not be parsed into a valid phone format. It may be incomplete or incorrectly formatted.";
  }
  const carrierPart = result.carrier ? ` associated with ${result.carrier}` : "";
  const linePart = result.lineTypeDisplay !== "Unknown" ? result.lineTypeDisplay.toLowerCase() : "unknown line type";
  return `Telnyx identified this as a ${linePart} number${carrierPart}. This lookup does not guarantee that the subscriber will answer the phone or receive a particular message. Reachability was ${result.reachability === "not_tested" ? "not tested" : result.reachability}. Verification and SMS/call consent are separate.`;
}

/** Estimated Telnyx carrier lookup cost per query (no CNAM). */
export function verifyProviderCostCents(): number {
  const raw = Number(process.env.VERIFY_PROVIDER_COST_CENTS);
  if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
  return 0.15; // ~$0.0015 default
}
