// lib/sidebar-open-state.ts (pure)
export const SIDEBAR_PREF_COOKIE = 'sidebar_state'
export function resolveSidebarOpen(a: { pref: boolean; override: boolean | null; forcedRail: boolean }) {
  return a.override ?? (a.forcedRail ? false : a.pref)
}
export function writeSidebarPref(open: boolean) {
  document.cookie = `${SIDEBAR_PREF_COOKIE}=${open}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}
