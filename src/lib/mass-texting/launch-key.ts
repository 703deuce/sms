/** Stable Mass Texting launch idempotency key — one audit + reservation per campaign. */
export function canonicalLaunchIdempotencyKey(
  workspaceId: string,
  campaignId: string,
  provided?: string | null,
): string {
  const canonical = `launch:${workspaceId}:${campaignId}`;
  const trimmed = provided?.trim();
  if (!trimmed) return canonical;
  if (trimmed === canonical) return canonical;
  if (trimmed === `launch:${campaignId}`) return canonical;
  return canonical;
}
