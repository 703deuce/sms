'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { WorkspaceProvider } from '@/components/providers/workspace-provider'
import { NumbersProvider } from '@/components/providers/numbers-provider'
import { AgentProvider } from '@/components/providers/agent-provider'
import type { PersistedShellContext } from '@/lib/nav-shell-context'
import { AppHeader } from './app-header'
import { ShellContextProvider } from './shell-context-provider'
import { SidebarNav } from './sidebar-nav'
import { ActiveCallBar, IncomingCallBar } from './active-call-bar'
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
    <WorkspaceProvider>
     <NumbersProvider>
     <AgentProvider>
      <div className="flex min-h-dvh flex-col">
        <AppHeader onOpenMenu={() => setMobileOpen(true)} />
        <IncomingCallBar />
        <ActiveCallBar />
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
     </AgentProvider>
     </NumbersProvider>
    </WorkspaceProvider>
    </ShellContextProvider>
  )
}
