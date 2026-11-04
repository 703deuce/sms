'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { ClipsWorkspaceProvider } from '@/components/providers/clips-workspace-provider'
import { AppMain } from '@/components/shell/app-main'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { AppTopBar } from '@/components/shell/app-topbar'
import { BreadcrumbTitleProvider } from '@/components/shell/breadcrumb-context'
import { ShellContextProvider } from '@/components/shell/shell-context-provider'
import type { PersistedShellContext } from '@/lib/nav-shell-context'
import {
  isClipEditorPath,
  SIDEBAR_AUTO_COLLAPSE_MAX_WIDTH_PX,
} from '@/lib/sidebar-layout'
import { resolveSidebarOpen, writeSidebarPref } from '@/lib/sidebar-open-state'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export function AppShell({
  children,
  initialShellContext = null,
  defaultSidebarOpen = true,
  recordingNavEnabled = false,
}: {
  children: React.ReactNode
  initialShellContext?: PersistedShellContext | null
  defaultSidebarOpen?: boolean
  recordingNavEnabled?: boolean
}) {
  const pathname = usePathname()
  const narrow = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(`(max-width: ${SIDEBAR_AUTO_COLLAPSE_MAX_WIDTH_PX}px)`)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(`(max-width: ${SIDEBAR_AUTO_COLLAPSE_MAX_WIDTH_PX}px)`).matches,
    () => false,
  )
  const forcedRail = narrow || isClipEditorPath(pathname ?? '')
  const [pref, setPref] = useState(defaultSidebarOpen)
  const [override, setOverride] = useState<boolean | null>(null)
  useEffect(() => {
    setOverride(null)
  }, [forcedRail])
  const open = resolveSidebarOpen({ pref, override, forcedRail })
  const onOpenChange = useCallback(
    (v: boolean) => {
      if (forcedRail) setOverride(v)
      else {
        setPref(v)
        writeSidebarPref(v)
      }
    },
    [forcedRail],
  )

  return (
    <ShellContextProvider initial={initialShellContext}>
      <ClipsWorkspaceProvider>
        <BreadcrumbTitleProvider>
          <SidebarProvider
            open={open}
            onOpenChange={onOpenChange}
            style={
              {
                '--sidebar-width': '15rem',
                '--sidebar-width-icon': '3.5rem',
              } as React.CSSProperties
            }
          >
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
            >
              Skip to content
            </a>
            <AppSidebar
              recordingNavEnabled={recordingNavEnabled}
              collapsible={isClipEditorPath(pathname ?? '') ? 'offcanvas' : 'icon'}
            />
            <SidebarInset className="min-w-0 bg-background has-[main[data-immersive]]:h-dvh has-[main[data-immersive]]:overflow-hidden">
              <AppTopBar />
              <AppMain>{children}</AppMain>
            </SidebarInset>
          </SidebarProvider>
        </BreadcrumbTitleProvider>
      </ClipsWorkspaceProvider>
    </ShellContextProvider>
  )
}
