'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { HelpCircle, LifeBuoy, Plug, Plus, Settings, SunMoon } from 'lucide-react'
import { StatusBadge } from '@/components/app/status'
import { AppBreadcrumbs } from '@/components/shell/app-breadcrumbs'
import { GlobalSearch } from '@/components/shell/global-search'
import { NotificationsPopover } from '@/components/shell/notifications-popover'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { useClipsWorkspace } from '@/components/providers/clips-workspace-provider'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { FlaskConical } from 'lucide-react'

const UTILITIES = [
  { title: 'Integrations', href: '/app/integrations', icon: Plug },
  { title: 'Settings', href: '/app/settings', icon: Settings },
  { title: 'Help', href: '/app/help', icon: HelpCircle },
]

export function AppTopBar() {
  const router = useRouter()
  const { testMode } = useClipsWorkspace()
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <header
      data-testid="app-topbar"
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-4"
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <AppBreadcrumbs />
      <div className="ml-auto flex items-center gap-1">
        <GlobalSearch />
        {testMode && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="hidden sm:inline-flex">
                  <StatusBadge tone="warning" icon={<FlaskConical className="size-3" aria-hidden />}>
                    Test mode
                  </StatusBadge>
                </span>
              }
            />
            <TooltipContent>All features unlocked · no billing</TooltipContent>
          </Tooltip>
        )}
        <ThemeToggle />
        <NotificationsPopover />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Account menu, MO">
                <span
                  className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                  aria-hidden
                >
                  MO
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="block text-sm font-medium">Account</span>
                <span className="block text-xs font-normal text-muted-foreground">Settings & billing</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {UTILITIES.map((u) => (
              <DropdownMenuItem key={u.href} onClick={() => router.push(u.href)}>
                <u.icon className="size-4" />
                {u.title}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              role="menuitemradio"
              aria-checked={resolvedTheme === 'light'}
              onClick={() => setTheme('light')}
            >
              <SunMoon className="size-4" aria-hidden />
              Light theme
            </DropdownMenuItem>
            <DropdownMenuItem
              role="menuitemradio"
              aria-checked={resolvedTheme === 'dark'}
              onClick={() => setTheme('dark')}
            >
              <SunMoon className="size-4" aria-hidden />
              Dark theme
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Link
          href="/app/clips/new"
          className={cn(buttonVariants({ size: 'icon' }), 'size-9 md:hidden')}
          aria-label="New project"
        >
          <Plus className="size-4" />
        </Link>
      </div>
    </header>
  )
}
