/** Power Dialer product registration (nav + workspace settings namespace). */

export const POWER_DIALER_PRODUCT_TITLE = 'Power Dialer'
export const POWER_DIALER_PRODUCT_HREF = '/app/power-dialer'

/** UI ships with greenfield phone; gate here if entitlements land later. */
export const POWER_DIALER_UI_ENABLED = true

export type PowerDialerWorkspaceSettings = {
  defaultTimezone?: string
  defaultRingTimeoutSec?: number
  defaultPostCallIntervalSec?: number
  defaultMaxAttempts?: number
  requireDispositionBeforeNext?: boolean
  defaultPhoneFieldPriority?: string[]
  prerecordedVmOptIn?: boolean
  recordingEnabled?: boolean
  recordingConsentAnnounce?: boolean
  recordingRetentionDays?: number
  recordingAccessRoles?: string[]
  defaultCallerIdPhoneNumberId?: string | null
  callScreeningEnabled?: boolean
  callScreeningNotifyRep?: boolean
  callScreeningSkipRecognized?: boolean
  callScreeningRepHandles?: boolean
  callScreeningUncertainBehavior?: 'rep_handles' | 'hangup' | 'voicemail'
  premiumReputationEntitlement?: boolean
}

const DEFAULTS: PowerDialerWorkspaceSettings = {
  defaultTimezone: 'America/Chicago',
  defaultRingTimeoutSec: 30,
  defaultPostCallIntervalSec: 5,
  defaultMaxAttempts: 3,
  requireDispositionBeforeNext: true,
  defaultPhoneFieldPriority: ['mobile', 'phone'],
}

export function mergePowerDialerSettings(
  raw: unknown,
): PowerDialerWorkspaceSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    defaultTimezone:
      typeof o.defaultTimezone === 'string' ? o.defaultTimezone : DEFAULTS.defaultTimezone,
    defaultRingTimeoutSec:
      typeof o.defaultRingTimeoutSec === 'number'
        ? o.defaultRingTimeoutSec
        : DEFAULTS.defaultRingTimeoutSec,
    defaultPostCallIntervalSec:
      typeof o.defaultPostCallIntervalSec === 'number'
        ? o.defaultPostCallIntervalSec
        : DEFAULTS.defaultPostCallIntervalSec,
    defaultMaxAttempts:
      typeof o.defaultMaxAttempts === 'number' ? o.defaultMaxAttempts : DEFAULTS.defaultMaxAttempts,
    requireDispositionBeforeNext:
      typeof o.requireDispositionBeforeNext === 'boolean'
        ? o.requireDispositionBeforeNext
        : DEFAULTS.requireDispositionBeforeNext,
    defaultPhoneFieldPriority: Array.isArray(o.defaultPhoneFieldPriority)
      ? o.defaultPhoneFieldPriority.filter((x): x is string => typeof x === 'string')
      : DEFAULTS.defaultPhoneFieldPriority,
    prerecordedVmOptIn: typeof o.prerecordedVmOptIn === 'boolean' ? o.prerecordedVmOptIn : false,
    recordingEnabled: typeof o.recordingEnabled === 'boolean' ? o.recordingEnabled : true,
    recordingConsentAnnounce:
      typeof o.recordingConsentAnnounce === 'boolean' ? o.recordingConsentAnnounce : false,
    recordingRetentionDays:
      typeof o.recordingRetentionDays === 'number' ? o.recordingRetentionDays : 365,
    recordingAccessRoles: Array.isArray(o.recordingAccessRoles)
      ? o.recordingAccessRoles.filter((x): x is string => typeof x === 'string')
      : ['OWNER', 'ADMINISTRATOR', 'MANAGER'],
    defaultCallerIdPhoneNumberId:
      typeof o.defaultCallerIdPhoneNumberId === 'string' ? o.defaultCallerIdPhoneNumberId : null,
    callScreeningEnabled: typeof o.callScreeningEnabled === 'boolean' ? o.callScreeningEnabled : false,
    callScreeningNotifyRep:
      typeof o.callScreeningNotifyRep === 'boolean' ? o.callScreeningNotifyRep : true,
    callScreeningSkipRecognized:
      typeof o.callScreeningSkipRecognized === 'boolean' ? o.callScreeningSkipRecognized : false,
    callScreeningRepHandles:
      typeof o.callScreeningRepHandles === 'boolean' ? o.callScreeningRepHandles : true,
    callScreeningUncertainBehavior:
      o.callScreeningUncertainBehavior === 'hangup' ||
      o.callScreeningUncertainBehavior === 'voicemail'
        ? o.callScreeningUncertainBehavior
        : 'rep_handles',
    premiumReputationEntitlement:
      typeof o.premiumReputationEntitlement === 'boolean' ? o.premiumReputationEntitlement : false,
  }
}
