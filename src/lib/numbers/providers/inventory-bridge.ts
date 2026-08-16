import type { NormalizedNumberCandidate } from "./types";

/** Bridge normalized provider candidates into premium scoring inputs. */
export type InventoryCandidateForScoring = {
  phoneNumber: string;
  provider: "telnyx" | "twilio";
  providerReference: string | null;
  monthlyCost?: string;
  upfrontCost?: string;
  currency?: string;
  vanityFormat?: string;
  raw: Record<string, unknown>;
};

export function inventoryCandidateFromNormalized(
  candidate: NormalizedNumberCandidate,
): InventoryCandidateForScoring {
  return {
    phoneNumber: candidate.e164,
    provider: candidate.provider,
    providerReference: candidate.providerReference,
    monthlyCost: candidate.monthlyCost ?? undefined,
    upfrontCost: candidate.upfrontCost ?? undefined,
    currency: candidate.currency ?? undefined,
    vanityFormat: candidate.vanityFormat ?? undefined,
    raw: candidate.raw,
  };
}
