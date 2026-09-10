import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

export type PosTaxConfig = {
  /** Tax rate in basis points (600 = 6.00%) */
  rateBps: number;
  /** Line kinds subject to sales tax */
  taxableKinds: string[];
};

const DEFAULT_TAXABLE_KINDS = ["product", "service", "appointment", "package", "gift", "membership", "custom"];

const NON_TAXABLE_KINDS = new Set(["discount", "tip"]);

export async function getPosTaxConfig(workspaceId: string): Promise<PosTaxConfig> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const raw = (platform as { posSalesTax?: { rateBps?: number; taxableKinds?: string[] } }).posSalesTax;
  return {
    rateBps: Math.max(0, raw?.rateBps ?? 0),
    taxableKinds: raw?.taxableKinds?.length ? raw.taxableKinds : DEFAULT_TAXABLE_KINDS,
  };
}

/** Authoritative POS sales tax in integer cents. */
export function calculatePosTaxCents(
  lineItems: Array<{ kind: string; totalCents: number }>,
  config: PosTaxConfig,
): number {
  if (config.rateBps <= 0) return 0;

  const taxableSet = new Set(config.taxableKinds);
  let taxableSubtotalCents = 0;

  for (const line of lineItems) {
    if (NON_TAXABLE_KINDS.has(line.kind)) continue;
    if (!taxableSet.has(line.kind)) continue;
    if (line.totalCents <= 0) continue;
    taxableSubtotalCents += line.totalCents;
  }

  if (taxableSubtotalCents <= 0) return 0;
  return Math.round((taxableSubtotalCents * config.rateBps) / 10000);
}
