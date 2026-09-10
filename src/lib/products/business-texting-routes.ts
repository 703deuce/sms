/**
 * Business Texting Phase 1 — canonical Appointments routes for absorbed SMS surfaces.
 * Legacy `/campaigns/*` remains during absorption; new nav uses `/appointments/campaigns/*`.
 */
import { isBusinessTextingCampaignsInV1Nav } from "@/lib/products/v1-launch-nav";

export const APPOINTMENTS_CAMPAIGNS_BASE = "/appointments/campaigns";
export const LEGACY_CAMPAIGNS_BASE = "/campaigns";

export function isAppointmentsCampaignsPath(pathname: string): boolean {
  return (
    pathname === APPOINTMENTS_CAMPAIGNS_BASE ||
    pathname.startsWith(`${APPOINTMENTS_CAMPAIGNS_BASE}/`)
  );
}

export function isLegacyCampaignsPath(pathname: string): boolean {
  return pathname === LEGACY_CAMPAIGNS_BASE || pathname.startsWith(`${LEGACY_CAMPAIGNS_BASE}/`);
}

/** Resolve campaigns base path from current route or V1 nav flag. */
export function resolveCampaignsBasePath(pathname?: string | null): string {
  if (pathname && isAppointmentsCampaignsPath(pathname)) {
    return APPOINTMENTS_CAMPAIGNS_BASE;
  }
  if (pathname && isLegacyCampaignsPath(pathname)) {
    return LEGACY_CAMPAIGNS_BASE;
  }
  if (isBusinessTextingCampaignsInV1Nav()) {
    return APPOINTMENTS_CAMPAIGNS_BASE;
  }
  return LEGACY_CAMPAIGNS_BASE;
}

/** Build a path under the campaigns base (suffix may include leading slash). */
export function campaignsPath(suffix = "", base?: string): string {
  const root = base ?? resolveCampaignsBasePath();
  if (!suffix) return root;
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${root}${normalized}`;
}

/** Navigation paths for Kimi campaign compose/review flows. */
export function buildCampaignNavPaths(base: string) {
  return {
    homePath: base,
    reviewPath: (campaignId: string) => `${base}/new/review?id=${campaignId}`,
    queuePath: (campaignId: string) => `${base}/new/queue?id=${campaignId}`,
    successPath: (campaignId: string, mode: string) =>
      `${base}/new/success?id=${campaignId}&mode=${mode}`,
    detailPath: (campaignId: string) => `${base}/${campaignId}`,
    editPath: (campaignId: string) => `${base}/new?edit=${campaignId}`,
  };
}
