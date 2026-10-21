'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ChevronDown,
  Contact,
  Grid3x3,
  HelpCircle,
  Home,
  Inbox,
  Menu,
  Plug,
  Settings,
} from 'lucide-react'
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
import { useAgent } from '@/components/providers/agent-provider'
import { PRODUCTS, resolveContext } from '@/lib/nav'
import { resolveRuntimeProfile } from '@/lib/receptionist/runtime-profile'
import { BUSINESS, THREADS } from '@/lib/data'
import { cn } from '@/lib/utils'
import { GlobalSearch } from './global-search'
import { NotificationsPopover } from './notifications-popover'
import { useRouter } from 'next/navigation'

const UTILITIES = [
  { title: 'Home', href: '/app/home', icon: Home },
  { title: 'Inbox', href: '/app/inbox', icon: Inbox },
  { title: 'Contacts', href: '/app/contacts', icon: Contact },
  { title: 'Integrations', href: '/app/integrations', icon: Plug },
  { title: 'Settings', href: '/app/settings', icon: Settings },
  { title: 'Help', href: '/app/help', icon: HelpCircle },
]

export function AppHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { draft } = useAgent()
  const context = resolveContext(pathname, resolveRuntimeProfile(draft))
  const unread = THREADS.filter((t) => t.unread).length

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-card/85 px-3 backdrop-blur-xl backdrop-saturate-150 md:px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu />
      </Button>

      <Link href="/app/home" className="flex items-center gap-2 rounded-md pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Transovo home">
        <span className="flex size-8 items-center justify-center rounded-lg tile-primary text-sm font-bold tracking-tight">
          T
        </span>
        <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">Transovo</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" className="hidden gap-1.5 text-muted-foreground lg:inline-flex">
              <span className="max-w-32 truncate">{BUSINESS.workspace}</span>
              <ChevronDown className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuItem>Harbor &amp; Pine</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <span aria-hidden className="hidden h-6 w-px bg-border lg:block" />

      <nav aria-label="Products" className="hidden items-center gap-1 lg:flex">
        {PRODUCTS.map((p) => {
          const active = context.key === p.key
          return (
            <Link
              key={p.key}
              href={p.href}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'relative flex h-16 items-center px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                active && 'text-foreground',
              )}
            >
              {p.title}
              {active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
            </Link>
          )
        })}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5 lg:hidden">
              <span className="max-w-36 truncate">{context.key === 'workspace' ? 'Product' : context.title}</span>
              <ChevronDown className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Product</DropdownMenuLabel>
            {PRODUCTS.map((p) => (
              <DropdownMenuItem key={p.key} onClick={() => router.push(p.href)}>
                <p.icon />
                {p.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-1">
        <GlobalSearch />

        <Link href="/app/phone/dialer" className={cn(buttonVariants({ size: 'sm' }), 'hidden gap-1.5 sm:inline-flex')}>
          <Grid3x3 />
          Dial
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
                      <span className="sr-only">
                        {u.title}
                        {u.title === 'Inbox' ? `, ${unread} unread` : ''}
                      </span>
                      {u.title === 'Inbox' && unread > 0 && (
                        <span aria-hidden className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                          {unread}
                        </span>
                      )}
                    </Link>
                  }
                />
                <TooltipContent>{u.title}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Workspace shortcuts">
                <Inbox />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              {UTILITIES.map((u) => (
                <DropdownMenuItem key={u.href} onClick={() => router.push(u.href)}>
                  <u.icon />
                  {u.title}
                  {u.title === 'Inbox' && <span className="ml-auto text-xs text-muted-foreground">{unread}</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

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
                <span className="block text-sm font-medium text-foreground">Maya Okafor</span>
                <span className="block text-xs font-normal text-muted-foreground">Owner · maya@harborpine.com</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/app/settings')}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/app/settings?tab=billing')}>
              <Bell />
              Billing &amp; usage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
