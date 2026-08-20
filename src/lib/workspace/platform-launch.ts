/**
 * Numbers platform v1 — Personal numbers surface (forwarding, voicemail, porting).
 * Smart Routing, Business workspace, AI receptionist, and messaging nav stay in code
 * but hidden from v1 menu until those products launch.
 */
export const NUMBERS_PLATFORM_ONLY = true;

/** Smart Routing routes/APIs remain; nav and v1 CTAs hide until AI receptionist launch. */
export const SMART_ROUTING_IN_V1_NAV = false;

/** Legacy SMS marketing landing — hidden at numbers v1 launch. */
export const HIDE_SMS_MARKETING_AT_LAUNCH = true;

/** Port-in carrier API is not certified; launch with port-out only. */
export const HIDE_PORT_IN_AT_LAUNCH = true;

export function isNumbersPlatformOnlyLaunch(): boolean {
  return NUMBERS_PLATFORM_ONLY;
}

export function isSmartRoutingInNav(): boolean {
  return SMART_ROUTING_IN_V1_NAV;
}

export function isSmsMarketingHiddenAtLaunch(): boolean {
  return NUMBERS_PLATFORM_ONLY && HIDE_SMS_MARKETING_AT_LAUNCH;
}

export function isPortInHiddenAtLaunch(): boolean {
  return NUMBERS_PLATFORM_ONLY && HIDE_PORT_IN_AT_LAUNCH;
}
