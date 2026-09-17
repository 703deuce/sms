import type { LiveControlPlane } from "./live-control-plane";
import { buildLiveFrontendBookingAuthorityAppendFromControlPlane } from "./live-booking-authority";

/**
 * Push authoritative workflow + booking authority into the Live session (front half only).
 */
export function buildLiveControlPlaneSyncEvents(controlPlane: LiveControlPlane): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  events.push(controlPlane.buildDelegationToolsSessionUpdate());
  events.push(buildLiveFrontendBookingAuthorityAppendFromControlPlane(controlPlane));
  return events;
}
