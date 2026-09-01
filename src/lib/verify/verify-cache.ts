import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";

const CACHE_DAYS = Number(process.env.VERIFY_LOOKUP_CACHE_DAYS || "30");

export async function getCachedLookup(normalizedE164: string) {
  const prisma = getPrisma();
  const row = await prisma.verifyLookupCache.findUnique({ where: { normalizedE164 } });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function setCachedLookup(input: {
  normalizedE164: string;
  lineType?: string | null;
  carrier?: string | null;
  country?: string | null;
  ported?: string | null;
  providerResponseJson?: unknown;
}) {
  const prisma = getPrisma();
  const expiresAt = new Date(Date.now() + CACHE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.verifyLookupCache.upsert({
    where: { normalizedE164: input.normalizedE164 },
    create: {
      id: createId(),
      normalizedE164: input.normalizedE164,
      lineType: input.lineType,
      carrier: input.carrier,
      country: input.country,
      ported: input.ported,
      providerResponseJson: (input.providerResponseJson || {}) as object,
      expiresAt,
    },
    update: {
      lineType: input.lineType,
      carrier: input.carrier,
      country: input.country,
      ported: input.ported,
      providerResponseJson: (input.providerResponseJson || {}) as object,
      expiresAt,
    },
  });
}
