import type { ContextKey } from '@/lib/nav'

/** Persists which product shell owns shared CRM routes (`/app/contacts/*`). */
export const SHELL_CONTEXT_COOKIE = 'transovo_shell_context'

export type PersistedShellContext = 'power_dialer' | 'workspace'

const CRM_ROUTE_PREFIX = '/app/contacts'

export function isSharedCrmRoute(pathname: string): boolean {
  return pathname === CRM_ROUTE_PREFIX || pathname.startsWith(`${CRM_ROUTE_PREFIX}/`)
}

export function readPersistedShellContext(): PersistedShellContext | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${SHELL_CONTEXT_COOKIE}=([^;]*)`))
  const value = match?.[1]
  if (value === 'power_dialer' || value === 'workspace') return value
  return null
}

export function writePersistedShellContext(key: PersistedShellContext): void {
  if (typeof document === 'undefined') return
  document.cookie = `${SHELL_CONTEXT_COOKIE}=${key};path=/;max-age=31536000;SameSite=Lax`
}

/** Call when entering a product-owned route or explicit workspace CRM entry. */
export function syncShellContextFromPath(pathname: string): PersistedShellContext | null {
  if (pathname === '/app/power-dialer' || pathname.startsWith('/app/power-dialer/')) {
    writePersistedShellContext('power_dialer')
    return 'power_dialer'
  }
  return readPersistedShellContext()
}

export function shellContextToNavKey(
  persisted: PersistedShellContext | null,
): ContextKey | null {
  if (persisted === 'power_dialer') return 'power_dialer'
  if (persisted === 'workspace') return 'workspace'
  return null
}

export function isPowerDialerContactsNavActive(pathname: string): boolean {
  if (pathname === '/app/contacts') return true
  if (!pathname.startsWith('/app/contacts/')) return false
  const segment = pathname.slice('/app/contacts/'.length).split('/')[0]
  return !['companies', 'deals', 'tasks', 'calendar', 'settings'].includes(segment)
}
