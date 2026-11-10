import { createHash } from 'node:crypto'

/** Stable link from a selected completed image-ad variant to its Studio reference asset. */
export function adCommercialReferenceId(sourceRunId: string, variantId: string): string {
  return 'stast_ad_' + createHash('sha256').update(sourceRunId + ':' + variantId).digest('hex').slice(0, 32)
}
