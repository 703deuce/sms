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
  }
}
