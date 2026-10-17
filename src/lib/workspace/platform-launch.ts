/**
 * Numbers platform v1 launch flags for marketing/hidden features.
 * Product access is now driven by ProductEntitlement — not this flag alone.
 */
export const NUMBERS_PLATFORM_ONLY = false;

/** AI Receptionist primary chrome — false while MCTB-only customer launch (Voice frozen/hidden). */
export const VOICE_PRIMARY_LAUNCH = false;

/** Standalone SMS platform hidden from primary nav/launcher — infrastructure preserved. */
export const SMS_STANDALONE_HIDDEN = true;

/** Legacy full Appointments scheduling chrome (not AR-only launch). */
export const APPOINTMENTS_V1_PRIMARY = false;

/**
 * Appointment Reminders UI is hidden from primary customer chrome while MCTB is primary.
 * Routes, APIs, jobs, and data remain in the codebase.
 */
export const APPOINTMENT_REMINDERS_V1_PRIMARY = false;

/** Missed Call Text Back is the default authenticated product experience. */
export const MCTB_V1_PRIMARY = true;

/**
 * One sidebar for MCTB + Appointment Reminders + Campaigns (Transovo Business Messaging).
 * When true, product switcher and per-product sidebars are disabled for the Opus shell.
 */
export const BUSINESS_MESSAGING_UNIFIED_NAV = true;

export function isBusinessMessagingUnifiedNav(): boolean {
  if (process.env.BUSINESS_MESSAGING_UNIFIED_NAV?.trim() === "0") return false;
  if (process.env.BUSINESS_MESSAGING_UNIFIED_NAV?.trim() === "false") return false;
  return BUSINESS_MESSAGING_UNIFIED_NAV;
}

/**
 * Unified sidebar launch: MCTB + AI Voice Agent (+ Reviews on menu). AR and Campaigns hidden from menu.
 * Routes stay live; re-enable AR/Campaigns via env or set this flag false.
 * Override: BUSINESS_MESSAGING_SIDEBAR_APPOINTMENT_REMINDERS=1, _CAMPAIGNS=1, _REVIEWS=0 to hide Reviews.
 */
export const BUSINESS_MESSAGING_SIDEBAR_MCTB_AND_VOICE_ONLY = true;

function businessMessagingSidebarEnvFlag(name: string): boolean | undefined {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return undefined;
}

export function isAppointmentRemindersInBusinessMessagingSidebar(): boolean {
  return (
    businessMessagingSidebarEnvFlag("BUSINESS_MESSAGING_SIDEBAR_APPOINTMENT_REMINDERS") ??
    !BUSINESS_MESSAGING_SIDEBAR_MCTB_AND_VOICE_ONLY
  );
}

export function isMassSmsInBusinessMessagingSidebar(): boolean {
  return (
    businessMessagingSidebarEnvFlag("BUSINESS_MESSAGING_SIDEBAR_CAMPAIGNS") ??
    !BUSINESS_MESSAGING_SIDEBAR_MCTB_AND_VOICE_ONLY
  );
}

export function isVisualizerInBusinessMessagingSidebar(): boolean {
  return businessMessagingSidebarEnvFlag("BUSINESS_MESSAGING_SIDEBAR_VISUALIZER") ?? true;
}

export function isReviewsInBusinessMessagingSidebar(): boolean {
  if (isVisualizerInBusinessMessagingSidebar()) {
    return businessMessagingSidebarEnvFlag("BUSINESS_MESSAGING_SIDEBAR_REVIEWS") ?? false;
  }
  return businessMessagingSidebarEnvFlag("BUSINESS_MESSAGING_SIDEBAR_REVIEWS") ?? true;
}

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

export function isAppointmentRemindersV1Primary(): boolean {
  return APPOINTMENT_REMINDERS_V1_PRIMARY;
}

export function isAppointmentsV1Primary(): boolean {
  return APPOINTMENTS_V1_PRIMARY && !MCTB_V1_PRIMARY && !APPOINTMENT_REMINDERS_V1_PRIMARY;
}

export function isMctbV1Primary(): boolean {
  return MCTB_V1_PRIMARY && !APPOINTMENT_REMINDERS_V1_PRIMARY;
}

/** New customer MCTB onboarding is disabled during AR-only launch. */
export function isMctbCustomerOnboardingOffered(): boolean {
  return isMctbV1Primary();
}

/**
 * Shared platform toll-free SMS may route to MCTB inbound (assignments, lead recovery).
 * Disabled while Appointment Reminders is the only launched product — platform replies are AR-only.
 */
export function isPlatformSharedSmsMctbInboundEnabled(): boolean {
  if (APPOINTMENT_REMINDERS_V1_PRIMARY) return false;
  return MCTB_V1_PRIMARY;
}

/**
 * Personal workspace type is not offered on the current MCTB-first launch.
 * New signups and MCTB onboarding always use BUSINESS tenants.
 */
export function isPersonalWorkspaceOffered(): boolean {
  if (MCTB_V1_PRIMARY) return false;
  return isNumbersPlatformOnlyLaunch();
}
