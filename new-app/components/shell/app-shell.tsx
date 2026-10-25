'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ClipsWorkspaceProvider } from '@/components/providers/clips-workspace-provider'
import type { PersistedShellContext } from '@/lib/nav-shell-context'
import { AppHeader } from './app-header'
import { ShellContextProvider } from './shell-context-provider'
import { SidebarNav } from './sidebar-nav'
import { cn } from '@/lib/utils'

export function AppShell({
  children,
  initialShellContext = null,
}: {
  children: React.ReactNode
  initialShellContext?: PersistedShellContext | null
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <ShellContextProvider initial={initialShellContext}>
      <ClipsWorkspaceProvider>
        <div className="flex min-h-dvh flex-col">
          <AppHeader onOpenMenu={() => setMobileOpen(true)} />
          <div className="flex flex-1">
            <aside
              className={cn(
                'sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:block',
                expanded ? 'w-60' : 'w-20',
              )}
            >
              <SidebarNav compact={!expanded} onToggle={() => setExpanded((value) => !value)} />
            </aside>
            <main id="main" className="min-w-0 flex-1">
              {children}
            </main>
          </div>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </ClipsWorkspaceProvider>
    </ShellContextProvider>
  )
}
