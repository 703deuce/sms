/**
 * Numbers platform v1 — Personal numbers surface (forwarding, voicemail, porting).
 * Smart Routing, Business workspace, AI receptionist, and messaging nav stay in code
 * but hidden from v1 menu until those products launch.
 */
export const NUMBERS_PLATFORM_ONLY = true;

/** Smart Routing routes/APIs remain; nav and v1 CTAs hide until AI receptionist launch. */
export const SMART_ROUTING_IN_V1_NAV = false;

export function isNumbersPlatformOnlyLaunch(): boolean {
  return NUMBERS_PLATFORM_ONLY;
}

export function isSmartRoutingInNav(): boolean {
  return SMART_ROUTING_IN_V1_NAV;
}
