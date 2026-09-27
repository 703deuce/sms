/**
 * Numbers platform v1 launch flags for marketing/hidden features.
 * Product access is now driven by ProductEntitlement — not this flag alone.
 */
export const NUMBERS_PLATFORM_ONLY = false;

/** AI Receptionist primary chrome — false while MCTB-only customer launch (Voice frozen/hidden). */
export const VOICE_PRIMARY_LAUNCH = false;

/** Standalone SMS platform hidden from primary nav/launcher — infrastructure preserved. */
export const SMS_STANDALONE_HIDDEN = true;

/** Legacy appointments-first chrome (superseded when MCTB V1 primary is on). */
export const APPOINTMENTS_V1_PRIMARY = true;

/** Current launch: Missed Call Text Back is the primary product experience. */
export const MCTB_V1_PRIMARY = true;

/** Sidebar/mobile show SMS mass marketing only — MCTB & AI After Hours hidden from chrome (routes preserved). */
export const SMS_ONLY_APP_NAV = false;

/** Smart Routing in primary product sidebar (MCTB + Numbers when enabled). */
export const SMART_ROUTING_IN_V1_NAV = true;

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

export function isVoicePrimaryLaunch(): boolean {
  return VOICE_PRIMARY_LAUNCH;
}

export function isSmsStandaloneHidden(): boolean {
  return SMS_STANDALONE_HIDDEN;
}

export function isSmsOnlyAppNav(): boolean {
  return SMS_ONLY_APP_NAV;
}

export function isAppointmentsV1Primary(): boolean {
  return APPOINTMENTS_V1_PRIMARY && !MCTB_V1_PRIMARY;
}

export function isMctbV1Primary(): boolean {
  return MCTB_V1_PRIMARY;
}
