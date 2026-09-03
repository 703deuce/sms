/**
 * V1 launch navigation flags — single source of truth.
 * Do not scatter hardcoded nav conditionals; import from here.
 *
 * @see docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md
 */

/** Mass SMS marketing surfaces (Campaigns, Drips, Keywords, Playbooks, Grow, etc.). */
export const MASS_MESSAGING_IN_V1_NAV = false;

/** Appointments / scheduling product surfaces. */
export const APPOINTMENTS_IN_V1_NAV = true;

/** Missed Call Text Back surfaces. */
export const MISSED_CALL_TEXT_BACK_IN_V1_NAV = false;

/** Shared launch surfaces always visible when entitled. */
export const CONVERSATIONS_IN_V1_NAV = true;
export const CONTACTS_IN_V1_NAV = true;
export const ANALYTICS_IN_V1_NAV = true;
export const COMPLIANCE_IN_V1_NAV = true;
export const NUMBERS_IN_V1_NAV = true;
export const SETTINGS_IN_V1_NAV = true;

/** Deferred from primary nav — routes preserved. */
export const SMART_ROUTING_IN_V1_NAV = false;
export const AI_RECEPTIONIST_IN_V1_NAV = false;
export const PLAYBOOKS_IN_V1_NAV = false;
export const AUTOMATIONS_IN_V1_NAV = false;

export function isMassMessagingInV1Nav(): boolean {
  return MASS_MESSAGING_IN_V1_NAV;
}

export function isAppointmentsInV1Nav(): boolean {
  return APPOINTMENTS_IN_V1_NAV;
}

export function isMissedCallTextBackInV1Nav(): boolean {
  return MISSED_CALL_TEXT_BACK_IN_V1_NAV;
}

export function isAnalyticsInV1Nav(): boolean {
  return ANALYTICS_IN_V1_NAV;
}

export function isComplianceInV1Nav(): boolean {
  return COMPLIANCE_IN_V1_NAV;
}

export function isNumbersInV1Nav(): boolean {
  return NUMBERS_IN_V1_NAV;
}

export function isConversationsInV1Nav(): boolean {
  return CONVERSATIONS_IN_V1_NAV;
}

export function isContactsInV1Nav(): boolean {
  return CONTACTS_IN_V1_NAV;
}

export function isSettingsInV1Nav(): boolean {
  return SETTINGS_IN_V1_NAV;
}
