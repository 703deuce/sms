'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function CampaignSubnav({ campaignId }: { campaignId: string }) {
  const pathname = usePathname()
  const base = `/app/power-dialer/campaigns/${campaignId}`
  const links = [
    { href: `${base}/contacts`, label: 'Contacts' },
    { href: `${base}/history`, label: 'History' },
    { href: `${base}/analytics`, label: 'Analytics' },
  ]
  return (
    <nav aria-label="Campaign sections" className="mb-4 flex flex-wrap gap-2 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            'rounded-md px-3 py-1.5 border',
            pathname === l.href ? 'border-primary bg-primary/10 text-primary' : 'border-transparent hover:bg-muted',
          )}
        >
          {l.label}
        </Link>
      ))}
      <Link href={`/app/power-dialer/dialer?campaign=${campaignId}`} className="ml-auto text-primary hover:underline self-center">
        Start dialing
      </Link>
    </nav>
  )
}
