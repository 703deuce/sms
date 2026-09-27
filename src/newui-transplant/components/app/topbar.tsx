'use client'

import { usePathname } from 'next/navigation'
import { Bell, HelpCircle, Search } from 'lucide-react'
import { SidebarTrigger } from '@/newui-transplant/components/ui/sidebar'
import { Separator } from '@/newui-transplant/components/ui/separator'
import { Button } from '@/newui-transplant/components/ui/button'
import { Avatar, AvatarFallback } from '@/newui-transplant/components/ui/avatar'
import { resolveCustomerNavSections } from '@/newui-transplant/lib/nav'

function sectionFor(pathname: string) {
  for (const section of resolveCustomerNavSections()) {
    for (const item of section.items) {
      if (pathname === item.href || (item.matchPrefix && pathname.startsWith(item.matchPrefix))) {
        return { section: section.label, page: item.label }
      }
    }
  }
  if (pathname.startsWith('/settings')) return { section: 'Shared', page: 'Settings' }
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
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden truncate text-muted-foreground sm:inline">{section}</span>
        {page ? (
          <>
            <span className="hidden text-muted-foreground/50 sm:inline" aria-hidden="true">
              /
            </span>
            <span className="truncate font-medium">{page}</span>
          </>
        ) : null}
      </nav>
      <div className="ml-auto flex items-center gap-1.5">
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
        <Button variant="ghost" size="icon" aria-label="Help">
          <HelpCircle />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" aria-hidden="true" />
        </Button>
        <Avatar className="ml-1 size-8">
          <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
