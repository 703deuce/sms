'use client'

import { useEffect } from 'react'
import type { PublicSchedulerTheme } from '@/features/appointments/kimi/public/types'

export function ApplySchedulerTheme({ theme }: { theme?: PublicSchedulerTheme }) {
  useEffect(() => {
    const root = document.documentElement
    if (theme?.primaryColor) {
      root.style.setProperty('--booking-accent', theme.primaryColor)
    }
    if (theme?.backgroundColor) {
      root.style.setProperty('--booking-page-bg', theme.backgroundColor)
    }
    return () => {
      root.style.removeProperty('--booking-accent')
      root.style.removeProperty('--booking-page-bg')
    }
  }, [theme?.primaryColor, theme?.backgroundColor])

  return null
}
