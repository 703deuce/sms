'use client'

import { ClipsWorkspaceProvider } from '@/components/providers/clips-workspace-provider'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { AppTopBar } from '@/components/shell/app-topbar'
import { BreadcrumbTitleProvider } from '@/components/shell/breadcrumb-context'
import { ShellContextProvider } from '@/components/shell/shell-context-provider'
import type { PersistedShellContext } from '@/lib/nav-shell-context'
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
  return (
    <ShellContextProvider initial={initialShellContext}>
      <ClipsWorkspaceProvider>
        <BreadcrumbTitleProvider>
          <SidebarProvider
            defaultOpen={defaultSidebarOpen}
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
            <AppSidebar recordingNavEnabled={recordingNavEnabled} />
            <SidebarInset className="min-w-0 bg-background">
              <AppTopBar />
              <main id="main" className="min-h-[calc(100dvh-3.5rem)]">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </BreadcrumbTitleProvider>
      </ClipsWorkspaceProvider>
    </ShellContextProvider>
  )
}
