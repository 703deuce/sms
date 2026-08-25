import "server-only";

import type { PhoneLineType, PhoneVerificationResult } from "./phone-verification-result";
import {
  displayLineType,
  normalizeLineType,
  normalizeVerifyPhone,
  smsSuitabilityFromLineType,
} from "./phone-normalization";
import { telnyxNumberLookup } from "./telnyx-lookup-client";
import { getCachedLookup, setCachedLookup } from "./verify-cache";
import {
  appendVerifyCreditLedger,
  consumeReservedCredit,
  getVerifyCreditBalance,
} from "./verify-credits";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import {
  verificationResultMeaning,
  verifyProviderCostCents,
} from "./phone-verification-result";

export type VerifyPhoneNumberInput = {
  workspaceId: string;
  phone: string;
  bulkJobId?: string;
  reservationId?: string;
  skipCreditCharge?: boolean;
};

export type VerifyPhoneNumberOutput = PhoneVerificationResult & { lookupId: string };

async function assertVerifyAccess(workspaceId: string) {
  const entitled = await hasWorkspaceProductFeature(workspaceId, "verify");
  if (entitled) return;
  const balance = await getVerifyCreditBalance(workspaceId);
  if (balance > 0) return;
  throw new Error("VERIFY_NOT_ENTITLED");
}

/** Canonical phone verification entry point — used by single, bulk, and future API. */
export async function verifyPhoneNumber(
  input: VerifyPhoneNumberInput,
): Promise<VerifyPhoneNumberOutput> {
  await assertVerifyAccess(input.workspaceId);

  const normalized = normalizeVerifyPhone(input.phone);
  if (!normalized.ok) {
    const lookupId = await persistLookup({
      workspaceId: input.workspaceId,
      inputRaw: input.phone,
      normalizedE164: null,
      lineType: "unknown",
      lookupStatus: "invalid_format",
      errorMessage: normalized.error,
      bulkJobId: input.bulkJobId,
      formatValid: false,
    });
    return buildResult({
      lookupId,
      normalizedE164: null,
      formatValid: false,
      lookupStatus: "invalid_format",
      lineType: "unknown",
      cacheHit: false,
      creditsCharged: 0,
    });
  }

  const cached = await getCachedLookup(normalized.e164);
  if (cached) {
    const lineType = normalizeLineType(cached.lineType);
    const lookupId = await persistLookup({
      workspaceId: input.workspaceId,
      inputRaw: input.phone,
      normalizedE164: normalized.e164,
      lineType,
      carrier: cached.carrier,
      country: cached.country,
      ported: cached.ported,
      lookupStatus: "success",
      providerResponseJson: cached.providerResponseJson,
      cacheHit: true,
      bulkJobId: input.bulkJobId,
      formatValid: true,
    });

    let creditsCharged = 0;
    if (!input.skipCreditCharge) {
      await chargeCredit(input.workspaceId, lookupId, input.reservationId);
      creditsCharged = 1;
    }

    return buildResult({
      lookupId,
      normalizedE164: normalized.e164,
      formatValid: true,
      lookupStatus: "success",
      lineType,
      carrier: cached.carrier,
      country: cached.country,
      ported: cached.ported,
      cacheHit: true,
      creditsCharged,
    });
  }

  if (!input.skipCreditCharge && !input.reservationId) {
    const balance = await getVerifyCreditBalance(input.workspaceId);
    if (balance < 1) throw new Error("INSUFFICIENT_CREDITS");
  }

  try {
    const data = await telnyxNumberLookup(normalized.e164);
    const carrier = data.carrier?.name || null;
    const lineType = normalizeLineType(data.carrier?.type);
    const country = data.country_code || null;
    const ported = data.portability?.ported_status || null;

    await setCachedLookup({
      normalizedE164: normalized.e164,
      lineType: data.carrier?.type,
      carrier,
      country,
      ported,
      providerResponseJson: data,
    });

    const lookupId = await persistLookup({
      workspaceId: input.workspaceId,
      inputRaw: input.phone,
      normalizedE164: normalized.e164,
      lineType,
      carrier,
      country,
      ported,
      lookupStatus: "success",
      providerResponseJson: data,
      bulkJobId: input.bulkJobId,
      formatValid: true,
      providerCostCents: verifyProviderCostCents(),
    });

    let creditsCharged = 0;
    if (!input.skipCreditCharge) {
      await chargeCredit(input.workspaceId, lookupId, input.reservationId);
      creditsCharged = 1;
    }

    return buildResult({
      lookupId,
      normalizedE164: normalized.e164,
      formatValid: true,
      lookupStatus: "success",
      lineType,
      carrier,
      country,
      ported,
      cacheHit: false,
      creditsCharged,
    });
  } catch (err) {
    const lookupId = await persistLookup({
      workspaceId: input.workspaceId,
      inputRaw: input.phone,
      normalizedE164: normalized.e164,
      lineType: "unknown",
      lookupStatus: "provider_error",
      errorMessage: err instanceof Error ? err.message.slice(0, 200) : "lookup_failed",
      bulkJobId: input.bulkJobId,
      formatValid: true,
    });
    return buildResult({
      lookupId,
      normalizedE164: normalized.e164,
      formatValid: true,
      lookupStatus: "provider_error",
      lineType: "unknown",
      cacheHit: false,
      creditsCharged: 0,
    });
  }
}

function buildResult(input: {
  lookupId: string;
  normalizedE164: string | null;
  formatValid: boolean;
  lookupStatus: PhoneVerificationResult["lookupStatus"];
  lineType: PhoneLineType;
  carrier?: string | null;
  country?: string | null;
  ported?: string | null;
  cacheHit: boolean;
  creditsCharged: number;
}): VerifyPhoneNumberOutput {
  const lineTypeDisplay = displayLineType(input.lineType);
  const result: VerifyPhoneNumberOutput = {
    lookupId: input.lookupId,
    normalizedNumber: input.normalizedE164,
    formatValid: input.formatValid,
    country: input.country,
    carrier: input.carrier,
    lineType: input.lineType,
    lineTypeDisplay,
    ported: input.ported,
    reachability: "not_tested",
    smsSuitability: smsSuitabilityFromLineType(lineTypeDisplay),
    lookupStatus: input.lookupStatus,
    provider: "telnyx",
    checkedAt: new Date(),
    cacheHit: input.cacheHit,
    creditsCharged: input.creditsCharged,
    providerCostCents: input.cacheHit ? 0 : verifyProviderCostCents(),
    meaning: "",
  };
  result.meaning = verificationResultMeaning(result);
  return result;
}

async function chargeCredit(workspaceId: string, lookupId: string, reservationId?: string) {
  if (reservationId) {
    await consumeReservedCredit({ reservationId, workspaceId, lookupId });
    return;
  }
  await appendVerifyCreditLedger({
    workspaceId,
    entryType: "use",
    amount: -1,
    referenceType: "lookup",
    referenceId: lookupId,
    idempotencyKey: `verify-use:${lookupId}`,
    description: "Phone number verification",
  });
}

async function persistLookup(input: {
  workspaceId: string;
  inputRaw: string;
  normalizedE164: string | null;
  lineType: PhoneLineType | string;
  carrier?: string | null;
  country?: string | null;
  ported?: string | null;
  lookupStatus: string;
  providerResponseJson?: unknown;
  cacheHit?: boolean;
  bulkJobId?: string;
  errorMessage?: string;
  formatValid?: boolean;
  providerCostCents?: number;
}) {
  const prisma = getPrisma();
  const row = await prisma.verifyLookup.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      inputRaw: input.inputRaw,
      normalizedE164: input.normalizedE164,
      lineType: input.lineType,
      carrier: input.carrier,
      country: input.country,
      ported: input.ported,
      lookupStatus: input.lookupStatus,
      providerResponseJson: (input.providerResponseJson || {
        formatValid: input.formatValid,
        reachability: "not_tested",
        providerCostCents: input.providerCostCents ?? 0,
      }) as object,
      creditsCharged: 0,
      cacheHit: input.cacheHit || false,
      bulkJobId: input.bulkJobId,
      errorMessage: input.errorMessage,
    },
  });
  return row.id;
}
