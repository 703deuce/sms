'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useSidebar } from '@/components/ui/sidebar'
import {
  isClipEditorPath,
  readSidebarOpenFromStorage,
  SIDEBAR_AUTO_COLLAPSE_MAX_WIDTH_PX,
  writeSidebarOpenToStorage,
} from '@/lib/sidebar-layout'

/**
 * Responsive collapse, editor default rail, and localStorage sync for sidebar open state.
 */
export function SidebarLayoutEffects() {
  const pathname = usePathname()
  const { setOpen, open } = useSidebar()
  const userToggledRef = useRef(false)
  const lastWideOpenRef = useRef<boolean | null>(null)

  useEffect(() => {
    const stored = readSidebarOpenFromStorage()
    if (stored !== null) {
      setOpen(stored)
      lastWideOpenRef.current = stored
    }
  }, [setOpen])

  useEffect(() => {
    writeSidebarOpenToStorage(open)
  }, [open])

  useEffect(() => {
    if (isClipEditorPath(pathname)) {
      setOpen(false)
      console.info('[clips-shell] sidebar collapsed for editor route', { pathname })
    }
  }, [pathname, setOpen])

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${SIDEBAR_AUTO_COLLAPSE_MAX_WIDTH_PX}px)`)

    const apply = () => {
      if (mq.matches) {
        setOpen(false)
        return
      }
      if (isClipEditorPath(pathname)) {
        setOpen(false)
        return
      }
      const restore = userToggledRef.current
        ? readSidebarOpenFromStorage()
        : lastWideOpenRef.current ?? readSidebarOpenFromStorage()
      if (restore !== null) setOpen(restore)
    }

    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pathname, setOpen])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'transovo_sidebar_open' || e.newValue == null) return
      setOpen(e.newValue === 'true')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [setOpen])

  useEffect(() => {
    const onToggle = () => {
      userToggledRef.current = true
      if (window.innerWidth > SIDEBAR_AUTO_COLLAPSE_MAX_WIDTH_PX) {
        lastWideOpenRef.current = readSidebarOpenFromStorage()
      }
    }
    window.addEventListener('transovo-sidebar-toggled', onToggle)
    return () => window.removeEventListener('transovo-sidebar-toggled', onToggle)
  }, [])

  return null
}
