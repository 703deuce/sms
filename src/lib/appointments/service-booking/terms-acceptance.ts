import { createHash } from "crypto";
import type { TermsAcceptanceSnapshot } from "./types";

export function buildTermsAcceptanceSnapshot(input: {
  termsVersion: string;
  termsText: string;
  termsUrl?: string;
}): TermsAcceptanceSnapshot {
  const hash = createHash("sha256").update(input.termsText).digest("hex");
  return {
    accepted: true,
    acceptedAt: new Date().toISOString(),
    termsVersion: input.termsVersion,
    termsTextHash: hash,
    termsUrl: input.termsUrl,
  };
}

export function validateTermsAcceptance(
  body: { termsAccepted?: boolean; termsVersion?: string },
  requiredVersion: string,
): void {
  if (!body.termsAccepted) {
    throw new Error("You must accept the terms and conditions to complete booking");
  }
  if (body.termsVersion && body.termsVersion !== requiredVersion) {
    throw new Error("Terms have been updated. Please review and accept again.");
  }
}
