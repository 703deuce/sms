'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/app/power-dialer/analytics', label: 'Overview' },
  { href: '/app/power-dialer/analytics/campaigns', label: 'Campaigns' },
  { href: '/app/power-dialer/analytics/representatives', label: 'Representatives' },
  { href: '/app/power-dialer/analytics/numbers', label: 'Numbers' },
  { href: '/app/power-dialer/analytics/screening', label: 'Screening' },
  { href: '/app/power-dialer/analytics/usage', label: 'Usage' },
  { href: '/app/power-dialer/analytics?tab=funnel', label: 'Funnel' },
  { href: '/app/power-dialer/analytics?tab=live', label: 'Live board' },
  { href: '/app/power-dialer/analytics?tab=reports', label: 'Reports' },
]

export function PowerDialerAnalyticsNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Analytics sections" className="flex flex-wrap gap-2 border-b pb-3">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm',
            pathname === l.href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
