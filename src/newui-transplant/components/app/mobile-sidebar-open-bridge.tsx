'use client'

import { useEffect } from 'react'
import { useSidebar } from '@/newui-transplant/components/ui/sidebar'

/** Opens the Opus mobile sidebar sheet when legacy shell sets `menuOpen` (bottom More). */
export function MobileSidebarOpenBridge({
  menuOpen,
  onMenuClose,
}: {
  menuOpen: boolean
  onMenuClose?: () => void
}) {
  const { isMobile, setOpenMobile, openMobile } = useSidebar()

  useEffect(() => {
    if (menuOpen && isMobile) {
      setOpenMobile(true)
    }
  }, [menuOpen, isMobile, setOpenMobile])

  useEffect(() => {
    if (!openMobile && menuOpen) {
      onMenuClose?.()
    }
  }, [openMobile, menuOpen, onMenuClose])

  return null
}
