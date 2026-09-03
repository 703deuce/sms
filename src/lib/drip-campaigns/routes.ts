/** Canonical drip campaign UI lives under Automations. */
export const DRIP_CAMPAIGNS_BASE = "/automations/drip-campaigns";

/** SMS-only sub-nav for drip pages — no voice/MCTB flow builder links. */
export const DRIP_SECTION_NAV_TABS = [
  { label: "Drip Campaigns", href: DRIP_CAMPAIGNS_BASE },
  { label: "Auto Replies", href: "/auto-replies" },
] as const;

export function dripCampaignsListHref(): string {
  return DRIP_CAMPAIGNS_BASE;
}

export function dripCampaignNewHref(): string {
  return `${DRIP_CAMPAIGNS_BASE}/new`;
}

export function dripCampaignDetailHref(id: string): string {
  return `${DRIP_CAMPAIGNS_BASE}/${id}`;
}

export function dripCampaignEditHref(id: string): string {
  return `${DRIP_CAMPAIGNS_BASE}/${id}/edit`;
}
