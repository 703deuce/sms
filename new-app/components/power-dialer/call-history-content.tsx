'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SegmentedFilter } from '@/components/app/filters'
import { CallsTable } from '@/components/calls/calls-table'

const TABS = [
  { value: 'calls', label: 'Calls' },
  { value: 'sessions', label: 'Sessions' },
] as const

export function PowerDialerCallHistoryContent({ initialFilter }: { initialFilter?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') === 'sessions' ? 'sessions' : 'calls'

  const setTab = (next: string) => {
    if (next === 'sessions') {
      window.location.assign('/app/power-dialer/call-history/sessions')
      return
    }
    const q = new URLSearchParams(searchParams.toString())
    q.delete('tab')
    const suffix = q.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedFilter label="History view" value={tab} onChange={setTab} options={[...TABS]} />
      <CallsTable variant="power_dialer" basePath="/app/power-dialer/call-history" initialFilter={initialFilter} />
    </div>
  )
}
