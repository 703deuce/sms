import "server-only";

import { verifyPhoneNumber, type VerifyPhoneNumberOutput } from "./verify-phone-number";
import type { PhoneLineType } from "./phone-verification-result";

export type SingleVerifyResult = Omit<VerifyPhoneNumberOutput, "lineType"> & {
  normalizedE164: string | null;
  lineType: string;
  lookupStatus: string;
  lineTypeCode: PhoneLineType;
};

/** @deprecated Use verifyPhoneNumber — kept for existing imports. */
export async function runSingleVerify(input: {
  workspaceId: string;
  phone: string;
  bulkJobId?: string;
  reservationId?: string;
  skipCreditCharge?: boolean;
}): Promise<SingleVerifyResult> {
  const result = await verifyPhoneNumber(input);
  const { lineType: lineTypeCode, ...rest } = result;
  return {
    ...rest,
    normalizedE164: result.normalizedNumber,
    lineType: result.lineTypeDisplay,
    lookupStatus: result.lookupStatus,
    lineTypeCode,
  };
}

export { verifyPhoneNumber };

export async function listVerifyHistory(workspaceId: string, limit = 50) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  return prisma.verifyLookup.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, limit),
  });
}

export async function assertVerifyEntitlement(workspaceId: string) {
  const { hasWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
  const { getVerifyCreditBalance } = await import("./verify-credits");
  const ok = await hasWorkspaceProductFeature(workspaceId, "verify");
  if (ok) return;
  const balance = await getVerifyCreditBalance(workspaceId);
  if (balance > 0) return;
  throw new Error("VERIFY_NOT_ENTITLED");
}
