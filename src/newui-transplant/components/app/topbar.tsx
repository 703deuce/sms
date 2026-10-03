'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Bell, HelpCircle, Search } from 'lucide-react'
import { MctbHeaderIdentity } from '@/newui-transplant/components/app/mctb-header-identity'
import { MctbPlanUsageChip } from '@/newui-transplant/components/app/mctb-plan-usage-chip'
import { SidebarTrigger } from '@/newui-transplant/components/ui/sidebar'
import { Separator } from '@/newui-transplant/components/ui/separator'
import { Button } from '@/newui-transplant/components/ui/button'
import { Avatar, AvatarFallback } from '@/newui-transplant/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'
import { performClientLogout } from '@/lib/auth/logout-client'
import { resolveCustomerNavSections } from '@/newui-transplant/lib/nav'

function sectionFor(pathname: string) {
  for (const section of resolveCustomerNavSections()) {
    for (const item of section.items) {
      if (pathname === item.href || (item.matchPrefix && pathname.startsWith(item.matchPrefix))) {
        return { section: section.label, page: item.label }
      }
    }
  }
  if (pathname.startsWith('/settings')) return { section: 'Account', page: 'Settings' }
  if (pathname.startsWith('/getting-started')) return { section: 'Overview', page: 'Getting Started' }
  if (pathname.startsWith('/help')) return { section: 'Account', page: 'Help' }
  return { section: 'Transovo', page: '' }
}

export function Topbar({ userName }: { userName?: string }) {
  const pathname = usePathname()
  const initials = (userName || 'User')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'
  const { section, page } = sectionFor(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <MctbHeaderIdentity />
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
        <span className="truncate text-muted-foreground">{section}</span>
        {page ? (
          <>
            <span className="text-muted-foreground/50" aria-hidden="true">/</span>
            <span className="truncate font-medium">{page}</span>
          </>
        ) : null}
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <MctbPlanUsageChip />
        <label className="relative hidden md:block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search callers, numbers…"
            className="h-8 w-64 rounded-md border bg-card pl-8 pr-12 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </label>
        <Button variant="ghost" size="icon" aria-label="Help" render={<Link href="/help"><HelpCircle /></Link>} />
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="ml-1 rounded-full" aria-label="Account menu">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate font-normal">
              {userName?.trim() || 'Signed in'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings">Settings</Link>} />
            <DropdownMenuItem
              onClick={() => {
                void performClientLogout('/login')
              }}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
