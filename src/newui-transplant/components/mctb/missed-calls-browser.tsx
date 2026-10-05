'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, MoreHorizontal, Phone, PhoneMissed, Search, X } from 'lucide-react'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'
import { EmptyState, Initials } from '@/newui-transplant/components/app/kit'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { td, th } from '@/newui-transplant/components/app/opus-tables'
import { RecoveryPill } from '@/newui-transplant/components/app/status'
import type { MctbMissedCallsListWiring } from '@/newui-transplant/mirror/routes/mctb/missed-calls/page'
import type { MissedCall } from '@/newui-transplant/lib/view-models'
import { OPUS_CARD, OPUS_SEARCH_INPUT, OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'

const RECOVERY = [
  { value: 'All', label: 'All outcomes' },
  { value: 'Needs attention', label: 'Needs attention' },
  { value: 'Replied', label: 'Replied' },
  { value: 'Waiting for consent', label: 'Waiting for consent' },
  { value: 'Suppressed', label: 'Suppressed' },
  { value: 'Failed', label: 'Failed' },
]
const DATES = [
  { value: 'Today', label: 'Today' },
  { value: 'Last 7 days', label: 'Last 7 days' },
  { value: 'Last 30 days', label: 'Last 30 days' },
  { value: 'All time', label: 'All time' },
]
const TRIGGERS = [
  { value: 'All', label: 'All triggers' },
  ...['No answer', 'Busy', 'Rejected', 'Unreachable', 'Voicemail'].map((t) => ({ value: t, label: t })),
]
const SORTS = [
  { value: 'Newest first', label: 'Newest first' },
  { value: 'Oldest first', label: 'Oldest first' },
]

export function MissedCallsBrowser({
  missedCalls,
  wiring,
}: {
  missedCalls: MissedCall[]
  wiring?: MctbMissedCallsListWiring
}) {
  const [queryLocal, setQueryLocal] = useState('')
  const [recoveryLocal, setRecoveryLocal] = useState('All')
  const [dateLocal, setDateLocal] = useState('Last 7 days')
  const [triggerLocal, setTriggerLocal] = useState('All')
  const [sortLocal, setSortLocal] = useState('Newest first')

  const query = wiring?.query ?? queryLocal
  const setQuery = wiring?.onQueryChange ?? setQueryLocal
  const recovery = wiring?.recovery ?? recoveryLocal
  const setRecovery = wiring?.onRecoveryChange ?? setRecoveryLocal
  const date = wiring?.date ?? dateLocal
  const setDate = wiring?.onDateChange ?? setDateLocal
  const trigger = wiring?.trigger ?? triggerLocal
  const setTrigger = wiring?.onTriggerChange ?? setTriggerLocal
  const sort = wiring?.sort ?? sortLocal
  const setSort = wiring?.onSortChange ?? setSortLocal

  const rows = useMemo(() => {
    if (wiring) return missedCalls
    const q = query.trim().toLowerCase()
    const list = missedCalls.filter(
      (m) =>
        (recovery === 'All' || m.recovery === recovery) &&
        (trigger === 'All' || m.trigger === trigger) &&
        (!q || `${m.caller} ${m.phone}`.toLowerCase().includes(q)),
    )
    return sort === 'Oldest first' ? [...list].reverse() : list
  }, [query, recovery, trigger, sort, missedCalls, wiring])

  const dirty =
    query ||
    recovery !== 'All' ||
    date !== 'Last 7 days' ||
    trigger !== 'All' ||
    sort !== 'Newest first'

  const clear = () => {
    setQuery('')
    setRecovery('All')
    setDate('Last 7 days')
    setTrigger('All')
    setSort('Newest first')
    if (wiring) wiring.onPageChange(1)
  }

  const page = wiring?.page ?? 1
  const pageCount = wiring?.pageCount ?? 1
  const total = wiring?.total ?? missedCalls.length

  return (
    <div className={OPUS_CARD}>
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="missed-search" className="sr-only">Search caller or number</label>
          <input
            id="missed-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search caller or number"
            className={OPUS_SEARCH_INPUT}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SimpleSelect label="Recovery outcome" options={RECOVERY} value={recovery} onChange={setRecovery} className="w-44" />
          <SimpleSelect label="Date range" options={DATES} value={date} onChange={setDate} className="w-36" />
          <SimpleSelect label="Trigger" options={TRIGGERS} value={trigger} onChange={setTrigger} className="w-36" />
          <SimpleSelect label="Sort" options={SORTS} value={sort} onChange={setSort} className="w-36" />
          {dirty ? (
            <Button variant="ghost" size="sm" onClick={clear}>
              <X aria-hidden="true" /> Clear
            </Button>
          ) : null}
        </div>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={th}>Caller</th>
                <th scope="col" className={th}>Missed</th>
                <th scope="col" className={th}>Trigger</th>
                <th scope="col" className={th}>Recovery</th>
                <th scope="col" className={th}>Reply</th>
                <th scope="col" className={th}>Business line</th>
                <th scope="col" className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => (
                <tr key={m.id} className="group relative hover:bg-muted/40">
                  <td className={td}>
                    <Link href={`/mctb/missed-calls/${m.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <Initials name={m.caller} />
                      <span className="flex min-w-0 flex-col">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{m.caller}</span>
                          {m.callsToday && m.callsToday > 1 ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Called {m.callsToday}× today
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">{m.phone}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={cn(td, 'text-muted-foreground')}>{m.missed}</td>
                  <td className={td}>{m.trigger}</td>
                  <td className={td}><RecoveryPill status={m.recovery} /></td>
                  <td className={cn(td, 'max-w-64 truncate text-muted-foreground')}>{m.reply ?? '—'}</td>
                  <td className={cn(td, 'text-muted-foreground')}>{m.line}</td>
                  <td className={cn(td, 'w-8 text-right')}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.caller}`} className="relative z-10" />}>
                        <MoreHorizontal aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/mctb/missed-calls/${m.id}`} />}>Open</DropdownMenuItem>
                        <DropdownMenuItem render={<a href={`tel:${m.phone}`} />}>
                          <Phone aria-hidden="true" /> Call back
                        </DropdownMenuItem>
                        {m.conversationId ? (
                          <DropdownMenuItem render={<Link href={`/mctb/conversations?conversation=${m.conversationId}`} />}>
                            <MessageSquare aria-hidden="true" /> Open conversation
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            const e164 = m.callerE164 || m.phone
                            void wiring?.onAddExclusion?.(e164, m.caller)
                          }}
                        >
                          Add to exclusions
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={PhoneMissed}
          title="No missed calls match"
          description="Try clearing filters or widening the date range."
          action={<Button variant="outline" size="sm" onClick={clear}>Clear filters</Button>}
        />
      )}

      <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground tabular-nums">{rows.length}</span> of {total}
          {date !== 'Last 7 days' ? ` · ${date}` : ''}
        </span>
        <span className="tabular-nums">Page {page} of {pageCount}</span>
      </div>
    </div>
  )
}
