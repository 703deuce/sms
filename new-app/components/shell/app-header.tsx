'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { HelpCircle, Menu, Plug, Settings, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useClipsWorkspace } from '@/components/providers/clips-workspace-provider'
import { useResolvedNavContext } from '@/components/shell/use-resolved-nav-context'
import { BUSINESS } from '@/lib/data'
import { cn } from '@/lib/utils'
import { GlobalSearch } from './global-search'
import { NotificationsPopover } from './notifications-popover'

const UTILITIES = [
  { title: 'Integrations', href: '/app/integrations', icon: Plug },
  { title: 'Settings', href: '/app/settings', icon: Settings },
  { title: 'Help', href: '/app/help', icon: HelpCircle },
]

export function AppHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const context = useResolvedNavContext()
  const { testMode } = useClipsWorkspace()

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-card/85 px-3 backdrop-blur-xl backdrop-saturate-150 md:px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu />
      </Button>

      <Link
        href="/app/clips"
        className="flex items-center gap-2 rounded-md pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Clips home"
      >
        <span className="flex size-8 items-center justify-center rounded-lg tile-primary text-sm font-bold tracking-tight">
          T
        </span>
        <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">Transovo Clips</span>
      </Link>

      <span className="hidden text-sm text-muted-foreground lg:inline">{BUSINESS.workspace}</span>

      <nav aria-label="Product" className="hidden items-center gap-1 lg:flex">
        <Link
          href="/app/clips"
          aria-current={context.key === 'clips' ? 'true' : undefined}
          className={cn(
            'relative flex h-16 items-center px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
            context.key === 'clips' && 'text-foreground',
          )}
        >
          Clips
          {context.key === 'clips' && (
            <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
          )}
        </Link>
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <GlobalSearch />

        {testMode && (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Test mode · all features unlocked
          </Badge>
        )}

        <Link href="/app/clips/new" className={cn(buttonVariants({ size: 'sm' }), 'hidden gap-1.5 sm:inline-flex')}>
          <Upload />
          New project
        </Link>

        <span aria-hidden className="mx-1 hidden h-6 w-px bg-border xl:block" />

        <div className="hidden items-center xl:flex">
          {UTILITIES.map((u) => {
            const active = pathname === u.href || pathname.startsWith(`${u.href}/`)
            return (
              <Tooltip key={u.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={u.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'relative text-muted-foreground',
                        active && 'bg-accent text-accent-foreground',
                      )}
                    >
                      <u.icon />
                      <span className="sr-only">{u.title}</span>
                    </Link>
                  }
                />
                <TooltipContent>{u.title}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        <NotificationsPopover />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  MO
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="block text-sm font-medium text-foreground">Account</span>
                <span className="block text-xs font-normal text-muted-foreground">Settings & billing</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/app/settings')}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/app/settings?tab=billing')}>
              Billing &amp; usage
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/app/help')}>
              <HelpCircle />
              Help
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
