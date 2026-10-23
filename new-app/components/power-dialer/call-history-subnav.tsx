'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SegmentedFilter } from '@/components/app/filters'

const TABS = [
  { value: 'calls', label: 'Calls' },
  { value: 'sessions', label: 'Sessions' },
] as const

export function PowerDialerCallHistorySubnav() {
  const pathname = usePathname()
  const tab = pathname.includes('/sessions') ? 'sessions' : 'calls'

  return (
    <div className="flex flex-col gap-4">
      <SegmentedFilter
        label="History view"
        value={tab}
        onChange={(next) => {
          if (next === 'sessions') {
            window.location.assign('/app/power-dialer/call-history/sessions')
          } else {
            window.location.assign('/app/power-dialer/call-history')
          }
        }}
        options={[...TABS]}
      />
      {tab === 'sessions' ? (
        <p className="text-xs text-muted-foreground">
          <Link href="/app/power-dialer/call-history" className="text-primary hover:underline">
            ← Back to call attempts
          </Link>
        </p>
      ) : null}
    </div>
  )
}
