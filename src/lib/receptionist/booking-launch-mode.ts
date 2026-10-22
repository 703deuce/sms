/**
 * Temporary V1 launch: booking is link-only (no live calendar FIND/BOOK in UI or compile defaults).
 * Flip to `false` when live booking and calendar connect return.
 */
export const BOOKING_LINK_ONLY_LAUNCH = true;

export function isBookingLinkOnlyLaunch(): boolean {
  return BOOKING_LINK_ONLY_LAUNCH;
}
