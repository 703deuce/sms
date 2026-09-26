'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function LinkTabs({ tabs, label }: { tabs: { label: string; href: string }[]; label: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-5">
        {tabs.map((tab) => {
          const active = pathname === tab.href
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex h-10 items-center text-sm transition-colors',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
                {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" /> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
