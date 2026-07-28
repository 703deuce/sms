/**
 * Lightweight entitlement gate. Passes when billing is not configured.
 * Wire Stripe/plan checks here later without changing call sites.
 */
export function requireCampaignSendAccess(workspaceId: string): { ok: true } | { ok: false; error: string } {
  if (!workspaceId) return { ok: false, error: "workspaceId required" };
  if (process.env.MESSAGING_OUTBOUND_PAUSED === "1" || process.env.MESSAGING_OUTBOUND_PAUSED === "true") {
    return { ok: false, error: "Outbound messaging is paused for this environment" };
  }
  return { ok: true };
}
