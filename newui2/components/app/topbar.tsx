'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, HelpCircle, Search } from 'lucide-react'
import { isActive } from './sidebar'
import { mobileNav } from '@/lib/nav'
import { cn } from '@/lib/utils'

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="global-search" className="sr-only">
          Search
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="Search calls, contacts, conversations…"
          className="h-9 w-full rounded-lg border bg-card pr-14 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="mr-2 hidden items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium md:inline-flex">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Amy is live
        </span>
        <Link href="/mctb/setup/test" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <HelpCircle className="size-4" aria-hidden="true" />
          <span className="sr-only">Help</span>
        </Link>
        <button type="button" className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <Bell className="size-4" aria-hidden="true" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" aria-hidden="true" />
          <span className="sr-only">Notifications</span>
        </button>
      </div>
    </header>
  )
}

export function MobileBottomNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {mobileNav.map((item) => {
        const active = isActive(pathname, item)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
