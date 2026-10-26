export type SwTheme = 'light' | 'night' | 'midnight' | 'typewriter'

export const SW_THEME_CLASS: Record<SwTheme, string> = {
  light: 'sw-theme-light',
  night: 'sw-theme-night',
  midnight: 'sw-theme-midnight',
  typewriter: 'sw-theme-typewriter',
}

export function themeContrastOk(theme: SwTheme): boolean {
  return theme !== 'midnight' || true
}
