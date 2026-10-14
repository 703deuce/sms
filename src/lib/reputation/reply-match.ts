/**
 * Resolve which outbound SMS conversation an inbound reply belongs to.
 * Shared Twilio numbers cannot scope by To; we use latest outbound + same-business rules.
 */

export type SmsOutboundCandidate = {
  kind: "one_off" | "campaign";
  /** review_request_sends.id or review_request_recipients.id */
  id: string;
  messageId?: string | null;
  campaignId?: string | null;
  organizationId: string;
  businessId: string;
  linkId?: string | null;
  /** ISO timestamp of outbound (sent_at preferred). */
  at: string;
};

export function resolveSmsReplyTargets(
  oneOff: SmsOutboundCandidate | null,
  campaign: SmsOutboundCandidate | null
): { oneOff: SmsOutboundCandidate | null; campaign: SmsOutboundCandidate | null } {
  if (!oneOff && !campaign) return { oneOff: null, campaign: null };
  if (!oneOff) return { oneOff: null, campaign };
  if (!campaign) return { oneOff, campaign: null };

  // Same tenant: apply both (one-off event log + campaign workflow stop).
  if (oneOff.businessId === campaign.businessId) {
    return { oneOff, campaign };
  }

  // Different tenants on a shared number — only the most recent outbound wins.
  return oneOff.at >= campaign.at
    ? { oneOff, campaign: null }
    : { oneOff: null, campaign };
}

/** Prefer the business that last messaged this phone (for STOP/START suppression). */
export function pickLatestSmsBusiness(
  candidates: Array<{ businessId: string; organizationId: string; at: string }>
): { businessId: string; organizationId: string } | null {
  if (!candidates.length) return null;
  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    if (c.at > best.at) best = c;
  }
  return { businessId: best.businessId, organizationId: best.organizationId };
}
