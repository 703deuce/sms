'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/app/contacts', label: 'Contacts', exact: true },
  { href: '/app/contacts/companies', label: 'Companies' },
  { href: '/app/contacts/deals', label: 'Deals' },
  { href: '/app/contacts/tasks', label: 'Tasks' },
  { href: '/app/contacts/calendar', label: 'Calendar' },
  { href: '/app/contacts/settings', label: 'CRM settings' },
]

export function ContactsSubnav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Contacts sections" className="mb-6 flex flex-wrap gap-2 border-b pb-3 text-sm">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`)
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'rounded-md px-3 py-1.5',
              active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
