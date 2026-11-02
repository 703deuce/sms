/** Client-side enrich when SSR skipped transcript fields on READY project pages. */
export function shouldClientEnrichReadyClips(
  initialStatus: string,
  initialClips: unknown[] | null | undefined,
): boolean {
  return initialStatus === 'READY' && Array.isArray(initialClips) && initialClips.length > 0
}
