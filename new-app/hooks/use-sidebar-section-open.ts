'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SidebarProductSection } from '@/lib/app-sidebar-sections'
import { readSidebarSectionsState, writeSidebarSectionState } from '@/lib/app-sidebar-sections'

export function useSidebarSectionOpen(section: SidebarProductSection, defaultOpen = true) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const stored = readSidebarSectionsState()[section]
    if (stored !== undefined) setOpen(stored)
  }, [section])

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      writeSidebarSectionState(section, next)
      console.info('[nav:section-persist]', { section, open: next })
    },
    [section],
  )

  return { open, onOpenChange }
}
