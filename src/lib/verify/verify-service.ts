import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { telnyxNumberLookup } from "./telnyx-lookup-client";
import { getCachedLookup, setCachedLookup } from "./verify-cache";
import {
  appendVerifyCreditLedger,
  getVerifyCreditBalance,
  consumeReservedCredit,
} from "./verify-credits";
import {
  displayLineType,
  normalizeVerifyPhone,
  smsSuitabilityFromLineType,
} from "./phone-normalization";
import type { VerifyLookupResult } from "./types";

export async function assertVerifyEntitlement(workspaceId: string) {
  const ok = await hasWorkspaceProductFeature(workspaceId, "verify");
  if (ok) return;
  const balance = await getVerifyCreditBalance(workspaceId);
  if (balance > 0) return;
  throw new Error("VERIFY_NOT_ENTITLED");
}

export async function runSingleVerify(input: {
  workspaceId: string;
  phone: string;
  bulkJobId?: string;
  reservationId?: string;
  skipCreditCharge?: boolean;
}): Promise<VerifyLookupResult & { lookupId: string; creditsCharged: number; cacheHit: boolean }> {
  await assertVerifyEntitlement(input.workspaceId);

  const normalized = normalizeVerifyPhone(input.phone);
  if (!normalized.ok) {
    const lookupId = await persistLookup({
      workspaceId: input.workspaceId,
      inputRaw: input.phone,
      normalizedE164: null,
      lookupStatus: "invalid_format",
      errorMessage: normalized.error,
      bulkJobId: input.bulkJobId,
    });
    return {
      normalizedE164: null,
      lineType: "Unknown",
      carrier: null,
      country: null,
      ported: null,
      lookupStatus: "invalid_format",
      smsSuitability: null,
      lookupId,
      creditsCharged: 0,
      cacheHit: false,
    };
  }

  const cached = await getCachedLookup(normalized.e164);
  if (cached) {
    const lineType = displayLineType(cached.lineType);
    const lookupId = await persistLookup({
      workspaceId: input.workspaceId,
      inputRaw: input.phone,
      normalizedE164: normalized.e164,
      lineType: cached.lineType,
      carrier: cached.carrier,
      country: cached.country,
      ported: cached.ported,
      lookupStatus: "success",
      providerResponseJson: cached.providerResponseJson,
      cacheHit: true,
      bulkJobId: input.bulkJobId,
    });

    let creditsCharged = 0;
    if (!input.skipCreditCharge) {
      await chargeCredit(input.workspaceId, lookupId, input.reservationId);
      creditsCharged = 1;
    }

    return {
      normalizedE164: normalized.e164,
      lineType: lineType as VerifyLookupResult["lineType"],
      carrier: cached.carrier,
      country: cached.country,
      ported: cached.ported,
      lookupStatus: "success",
      smsSuitability: smsSuitabilityFromLineType(lineType),
      lookupId,
      creditsCharged,
      cacheHit: true,
    };
  }

  if (!input.skipCreditCharge && !input.reservationId) {
    const balance = await getVerifyCreditBalance(input.workspaceId);
    if (balance < 1) throw new Error("INSUFFICIENT_CREDITS");
  }

  try {
    const data = await telnyxNumberLookup(normalized.e164);
    const carrier = data.carrier?.name || null;
    const lineType = displayLineType(data.carrier?.type);
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
      lineType: data.carrier?.type,
      carrier,
      country,
      ported,
      lookupStatus: "success",
      providerResponseJson: data,
      bulkJobId: input.bulkJobId,
    });

    let creditsCharged = 0;
    if (!input.skipCreditCharge) {
      await chargeCredit(input.workspaceId, lookupId, input.reservationId);
      creditsCharged = 1;
    }

    return {
      normalizedE164: normalized.e164,
      lineType: lineType as VerifyLookupResult["lineType"],
      carrier,
      country,
      ported,
      lookupStatus: "success",
      smsSuitability: smsSuitabilityFromLineType(lineType),
      lookupId,
      creditsCharged,
      cacheHit: false,
    };
  } catch (err) {
    const lookupId = await persistLookup({
      workspaceId: input.workspaceId,
      inputRaw: input.phone,
      normalizedE164: normalized.e164,
      lookupStatus: "provider_error",
      errorMessage: err instanceof Error ? err.message.slice(0, 200) : "lookup_failed",
      bulkJobId: input.bulkJobId,
    });
    return {
      normalizedE164: normalized.e164,
      lineType: "Unknown",
      carrier: null,
      country: null,
      ported: null,
      lookupStatus: "provider_error",
      smsSuitability: null,
      lookupId,
      creditsCharged: 0,
      cacheHit: false,
    };
  }
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
  lineType?: string | null;
  carrier?: string | null;
  country?: string | null;
  ported?: string | null;
  lookupStatus: string;
  providerResponseJson?: unknown;
  cacheHit?: boolean;
  bulkJobId?: string;
  errorMessage?: string;
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
      providerResponseJson: (input.providerResponseJson || {}) as object,
      creditsCharged: 0,
      cacheHit: input.cacheHit || false,
      bulkJobId: input.bulkJobId,
      errorMessage: input.errorMessage,
    },
  });
  return row.id;
}

export async function listVerifyHistory(workspaceId: string, limit = 50) {
  const prisma = getPrisma();
  return prisma.verifyLookup.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, limit),
  });
}
