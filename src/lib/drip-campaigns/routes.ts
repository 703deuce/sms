/** Canonical drip campaign UI lives under Automations. */
export const DRIP_CAMPAIGNS_BASE = "/automations/drip-campaigns";

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
